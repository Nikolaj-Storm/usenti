const supabase = require('../config/supabase');

/**
 * Checks if the user's subscription has expired.
 * If plan_expires_at is set and in the past, downgrades to 'free' and clears expiration.
 * @param {string} userId - The user's UUID
 * @returns {Promise<Object>} The current subscription state
 */
async function ensureValidSubscription(userId) {
    const { data: sub, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .single();

    if (error && error.code !== 'PGRST116') {
        console.error(`[SUBSCRIPTION-SERVICE] Error fetching subscription for user ${userId}:`, error);
        return null;
    }

    if (!sub) {
        return { plan_tier: 'free', emails_sent_this_cycle: 0 };
    }

    // Check expiration
    if (sub.plan_expires_at && new Date(sub.plan_expires_at) < new Date()) {
        console.log(`[SUBSCRIPTION-SERVICE] User ${userId} plan expired. Downgrading to free.`);

        const { data: updatedSub, error: updateError } = await supabase
            .from('subscriptions')
            .update({
                plan_tier: 'free',
                plan_expires_at: null,
                updated_at: new Date().toISOString()
            })
            .eq('user_id', userId)
            .select()
            .single();

        if (updateError) {
            console.error(`[SUBSCRIPTION-SERVICE] Error downgrading subscription for user ${userId}:`, updateError);
            return sub; // Return stale data rather than completely failing
        }

        return updatedSub;
    }

    return sub;
}

module.exports = {
    ensureValidSubscription
};
