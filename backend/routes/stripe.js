const express = require('express');
const router = express.Router();
const stripe = require('../config/stripe');
const supabase = require('../config/supabase');
const { authenticateUser } = require('../middleware/auth');
const { getFrontendUrlFromRequest } = require('../config/urls');

// The Rebel Plan product price ID (set via dashboard and .env)
const STRIPE_PRICES = {
    rebel_plan: process.env.STRIPE_PRICE_REBEL_PLAN // e.g. price_1xyz987
};

/**
 * GET /api/stripe/status
 * Get the current subscription status and usage for the user
 */
router.get('/status', authenticateUser, async (req, res) => {
    try {
        const { data: sub } = await supabase
            .from('subscriptions')
            .select('plan_tier, emails_sent_this_cycle')
            .eq('user_id', req.user.id)
            .single();

        if (!sub) {
            return res.json({
                planTier: 'free',
                usage: { sent: 0, limit: 200, cycle: 'week' }
            });
        }

        let limit = 200; // default to free limit (per week)
        let cycle = 'week';
        if (sub.plan_tier === 'rebel_plan') {
            limit = 100000;
            cycle = 'month';
        }

        res.json({
            planTier: sub.plan_tier,
            usage: {
                sent: sub.emails_sent_this_cycle || 0,
                limit,
                cycle
            }
        });
    } catch (err) {
        console.error('[STRIPE] Error fetching status:', err);
        res.status(500).json({ error: 'Failed to fetch subscription status' });
    }
});

/**
 * POST /api/stripe/create-checkout-session
 * Creates a checkout session for a specific subscription tier
 */
router.post('/create-checkout-session', authenticateUser, async (req, res) => {
    const { planTier } = req.body; // 'rebel_plan'
    const frontendUrl = getFrontendUrlFromRequest(req);

    if (planTier !== 'rebel_plan') {
        return res.status(400).json({ error: 'Invalid plan tier requested' });
    }

    const priceId = STRIPE_PRICES[planTier];
    if (!priceId) {
        return res.status(500).json({ error: `Stripe price ID for ${planTier} is not configured on the server.` });
    }

    try {
        // Check if user already has a Stripe customer ID
        const { data: subscription } = await supabase
            .from('subscriptions')
            .select('stripe_customer_id')
            .eq('user_id', req.user.id)
            .single();

        let customerId = subscription?.stripe_customer_id;

        // Optional: create customer if it doesn't exist, though Stripe can handle this during checkout
        const sessionConfig = {
            mode: 'subscription',
            payment_method_types: ['card'],
            line_items: [
                {
                    price: priceId,
                    quantity: 1,
                },
            ],
            success_url: `${frontendUrl}/?success=true&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${frontendUrl}/?canceled=true`,
            client_reference_id: req.user.id, // Critical for knowing who paid in the webhook
            customer_email: customerId ? undefined : req.user.email,
        };

        if (customerId) {
            sessionConfig.customer = customerId;
        }

        const session = await stripe.checkout.sessions.create(sessionConfig);
        res.json({ url: session.url });

    } catch (err) {
        console.error('[STRIPE] Error creating checkout session:', err);
        res.status(500).json({ error: 'Failed to create checkout session' });
    }
});

/**
 * POST /api/stripe/customer-portal
 * Creates a billing portal session so users can manage payment details and subscriptions
 */
router.post('/customer-portal', authenticateUser, async (req, res) => {
    try {
        const { data: subscription } = await supabase
            .from('subscriptions')
            .select('stripe_customer_id')
            .eq('user_id', req.user.id)
            .single();

        if (!subscription || !subscription.stripe_customer_id) {
            return res.status(400).json({ error: 'No active Stripe customer found for this user.' });
        }

        const frontendUrl = getFrontendUrlFromRequest(req);
        const session = await stripe.billingPortal.sessions.create({
            customer: subscription.stripe_customer_id,
            return_url: `${frontendUrl}/`,
        });

        res.json({ url: session.url });
    } catch (err) {
        console.error('[STRIPE] Error creating customer portal session:', err);
        res.status(500).json({ error: 'Failed to create customer portal session' });
    }
});

/**
 * POST /api/stripe/webhook
 * Stripe Webhooks endpoint (must use express.raw for signature verification)
 */
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;
    try {
        event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err) {
        console.error(`[STRIPE WEBHOOK ERROR] Signature verification failed:`, err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    console.log(`[STRIPE] Received webhook event: ${event.type}`);

    try {
        switch (event.type) {
            // 1. Session completed (Initial sign up)
            case 'checkout.session.completed': {
                const session = event.data.object;
                const userId = session.client_reference_id;
                const customerId = session.customer;
                const subscriptionId = session.subscription;

                if (!userId) {
                    console.error('[STRIPE] No client_reference_id found on checkout session');
                    break;
                }

                // Get the subscription to figure out which price they paid for
                const sub = await stripe.subscriptions.retrieve(subscriptionId);
                const priceId = sub.items.data[0].price.id;

                // Map priceId back to plan tier
                let planTier = 'free';
                if (priceId === STRIPE_PRICES.rebel_plan) planTier = 'rebel_plan';

                // Update DB
                const { error } = await supabase
                    .from('subscriptions')
                    .upsert({
                        user_id: userId,
                        stripe_customer_id: customerId,
                        stripe_subscription_id: subscriptionId,
                        plan_tier: planTier,
                        cycle_start_date: new Date().toISOString(),
                        emails_sent_this_cycle: 0,
                        updated_at: new Date().toISOString()
                    });

                if (error) console.error('[STRIPE] Supabase update error on session completed:', error);
                else console.log(`[STRIPE] Successfully upgraded user ${userId} to ${planTier} tier`);
                break;
            }

            // 2. Invoice paid (Recurring payment)
            case 'invoice.paid': {
                const invoice = event.data.object;
                const subscriptionId = invoice.subscription;

                if (invoice.billing_reason === 'subscription_create') {
                    // Handled by checkout.session.completed
                    break;
                }

                // They paid for next month, reset their rolling limit
                const { error } = await supabase
                    .from('subscriptions')
                    .update({
                        emails_sent_this_cycle: 0,
                        cycle_start_date: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    })
                    .eq('stripe_subscription_id', subscriptionId);

                if (error) console.error('[STRIPE] Supabase update error on invoice paid:', error);
                else console.log(`[STRIPE] Reset invoice limits for subscription ${subscriptionId}`);
                break;
            }

            // 3. Subscription updated (e.g. upgraded/downgraded via Customer Portal)
            case 'customer.subscription.updated': {
                const subscription = event.data.object;
                const subscriptionId = subscription.id;

                // Get the new price
                const priceId = subscription.items.data[0].price.id;

                let planTier = 'free';
                if (priceId === STRIPE_PRICES.rebel_plan) planTier = 'rebel_plan';

                const { error } = await supabase
                    .from('subscriptions')
                    .update({
                        plan_tier: planTier,
                        updated_at: new Date().toISOString()
                    })
                    .eq('stripe_subscription_id', subscriptionId);

                if (error) console.error('[STRIPE] Supabase update error on sub updated:', error);
                else console.log(`[STRIPE] Updated subscription ${subscriptionId} to tier ${planTier}`);
                break;
            }

            // 4. Subscription deleted / canceled
            case 'customer.subscription.deleted': {
                const subscription = event.data.object;
                const subscriptionId = subscription.id;

                // Downgrade them to free
                const { error } = await supabase
                    .from('subscriptions')
                    .update({
                        plan_tier: 'free',
                        stripe_subscription_id: null,
                        emails_sent_this_cycle: 0,
                        cycle_start_date: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    })
                    .eq('stripe_subscription_id', subscriptionId);

                if (error) console.error('[STRIPE] Supabase update error on sub deleted:', error);
                else console.log(`[STRIPE] Downgraded subscription ${subscriptionId} to free`);
                break;
            }

            default:
                console.log(`[STRIPE] Unhandled event type: ${event.type}`);
        }
    } catch (err) {
        console.error('[STRIPE] Webhook processing error:', err);
        return res.status(500).json({ error: 'Webhook handler failed' });
    }

    // Return a 200 response to acknowledge receipt of the event
    res.json({ received: true });
});

module.exports = router;
