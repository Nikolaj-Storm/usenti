const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');

// Optional: you can import warmupService here if you want trigger routes
// const warmupService = require('../services/warmupService');

// Middleware to ensure user is authenticated could be added,
// assuming we run this behind the main auth middleware in server.js

/**
 * GET /api/warmup/:accountId/settings
 * Fetch warmup settings for a specific email account
 */
router.get('/:accountId/settings', async (req, res) => {
    try {
        const { accountId } = req.params;

        const { data: settings, error } = await supabase
            .from('email_warmup_settings')
            .select('*')
            .eq('email_account_id', accountId)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 is not found, which is fine, we just return empty/paused
            console.error('[WARMUP-ROUTE] Error fetching settings:', error);
            return res.status(500).json({ error: error.message });
        }

        if (!settings) {
            return res.json({
                status: 'paused',
                daily_send_limit: 40,
                ramp_up_per_day: 5,
                reply_rate_percent: 30,
                current_daily_limit: 5
            });
        }

        res.json(settings);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * POST /api/warmup/:accountId/settings
 * Update or create warmup settings
 */
router.post('/:accountId/settings', async (req, res) => {
    try {
        const { accountId } = req.params;
        const { status, daily_send_limit, ramp_up_per_day, reply_rate_percent, network_opt_in, spam_save_rate_percent } = req.body;

        // Check if settings already exist
        const { data: existing } = await supabase
            .from('email_warmup_settings')
            .select('id')
            .eq('email_account_id', accountId)
            .single();

        const updatePayload = {};
        if (status !== undefined) updatePayload.status = status;
        if (daily_send_limit !== undefined) updatePayload.daily_send_limit = daily_send_limit;
        if (ramp_up_per_day !== undefined) updatePayload.ramp_up_per_day = ramp_up_per_day;
        if (reply_rate_percent !== undefined) updatePayload.reply_rate_percent = reply_rate_percent;
        if (network_opt_in !== undefined) updatePayload.network_opt_in = network_opt_in;
        if (spam_save_rate_percent !== undefined) updatePayload.spam_save_rate_percent = spam_save_rate_percent;

        let result;
        if (existing) {
            result = await supabase
                .from('email_warmup_settings')
                .update(updatePayload)
                .eq('id', existing.id)
                .select()
                .single();
        } else {
            result = await supabase
                .from('email_warmup_settings')
                .insert({
                    email_account_id: accountId,
                    ...updatePayload,
                    current_daily_limit: 5 // Default start limit
                })
                .select()
                .single();
        }

        if (result.error) {
            console.error('[WARMUP-ROUTE] Error saving settings:', result.error);
            return res.status(500).json({ error: result.error.message });
        }

        res.json(result.data);
    } catch (err) {
        console.error('[WARMUP-ROUTE] Server error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * GET /api/warmup/:accountId/stats
 * Get basic stats for the frontend UI graph
 */
router.get('/:accountId/stats', async (req, res) => {
    try {
        const { accountId } = req.params;

        // Get last 7 days of logs
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const { data: logs, error } = await supabase
            .from('email_warmup_logs')
            .select('action_type, created_at, status')
            .or(`sender_account_id.eq.${accountId},recipient_account_id.eq.${accountId}`)
            .gte('created_at', sevenDaysAgo.toISOString());

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        res.json({ logs });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
