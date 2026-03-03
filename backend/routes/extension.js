const express = require('express');
const router = express.Router();
const supabaseAdmin = require('../config/supabase');
const authenticateUser = require('../middleware/auth');

// POST /api/extension/register
// Called when the user clicks "Link to Usenti" in the popup
router.post('/register', authenticateUser, async (req, res) => {
    try {
        const userId = req.user.id;
        // Just generate a simple extension ID for this session or use user id
        const extensionId = `ext_${userId}_${Date.now()}`;

        // Upsert the connection status
        const { error } = await supabaseAdmin
            .from('users_extensions')
            .upsert({
                user_id: userId,
                extension_id: extensionId,
                last_ping: new Date().toISOString(),
                status: 'active'
            }, { onConflict: 'user_id, extension_id' });

        if (error) throw error;

        res.json({ success: true, extensionId });
    } catch (err) {
        console.error('[Extension] Register Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/extension/ping
// Called every 2-5 minutes by the background worker to fetch tasks
router.post('/ping', authenticateUser, async (req, res) => {
    try {
        const userId = req.user.id;

        // Update their last ping time so the UI knows they are "online"
        await supabaseAdmin
            .from('users_extensions')
            .update({ last_ping: new Date().toISOString(), status: 'active' })
            .eq('user_id', userId);

        // Fetch up to 5 pending tasks for this user
        const { data: tasks, error: fetchError } = await supabaseAdmin
            .from('task_queue')
            .select('*')
            .eq('user_id', userId)
            .eq('status', 'pending')
            .order('created_at', { ascending: true })
            .limit(5);

        if (fetchError) throw fetchError;

        res.json({ success: true, tasks: tasks || [] });
    } catch (err) {
        console.error('[Extension] Ping Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/extension/task/:id/complete
router.post('/task/:id/complete', authenticateUser, async (req, res) => {
    try {
        const taskId = req.params.id;
        const userId = req.user.id;

        // Mark task complete
        const { data: updatedTask, error } = await supabaseAdmin
            .from('task_queue')
            .update({
                status: 'completed',
                processed_at: new Date().toISOString()
            })
            .eq('id', taskId)
            .eq('user_id', userId)
            .select('campaign_id, contact_id')
            .single();

        if (error) throw error;

        // Force the campaignExecutor to notice this task is complete immediately
        // by resetting the next_send_time to now.
        if (updatedTask) {
            await supabaseAdmin
                .from('campaign_contacts')
                .update({ next_send_time: new Date().toISOString() })
                .eq('campaign_id', updatedTask.campaign_id)
                .eq('contact_id', updatedTask.contact_id)
                .eq('status', 'in_progress');
        }

        res.json({ success: true });
    } catch (err) {
        console.error('[Extension] Task Complete Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/extension/task/:id/fail
router.post('/task/:id/fail', authenticateUser, async (req, res) => {
    try {
        const taskId = req.params.id;
        const userId = req.user.id;
        const { error: errMsg } = req.body;

        const { data: updatedTask, error } = await supabaseAdmin
            .from('task_queue')
            .update({
                status: 'failed',
                error_message: errMsg,
                processed_at: new Date().toISOString()
            })
            .eq('id', taskId)
            .eq('user_id', userId)
            .select('campaign_id, contact_id')
            .single();

        if (error) throw error;

        // Force executor check failure state
        if (updatedTask) {
            await supabaseAdmin
                .from('campaign_contacts')
                .update({ next_send_time: new Date().toISOString() })
                .eq('campaign_id', updatedTask.campaign_id)
                .eq('contact_id', updatedTask.contact_id)
                .eq('status', 'in_progress');
        }

        res.json({ success: true });
    } catch (err) {
        console.error('[Extension] Task fail Error:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
