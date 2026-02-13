const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { authenticateUser } = require('../middleware/auth');

// Get warmup config for email account
router.get('/:email_account_id', authenticateUser, async (req, res) => {
  try {
    // Verify email account belongs to user
    const { data: account } = await supabase
      .from('email_accounts')
      .select('id')
      .eq('id', req.params.email_account_id)
      .eq('user_id', req.user.id)
      .single();

    if (!account) {
      return res.status(404).json({ error: 'Email account not found' });
    }

    const { data, error } = await supabase
      .from('warmup_configs')
      .select('*')
      .eq('email_account_id', req.params.email_account_id)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    
    res.json(data || { 
      is_active: false,
      daily_warmup_volume: 1000,
      current_daily_volume: 50,
      replies_per_thread: 20
    });
  } catch (error) {
    console.error('Error fetching warmup config:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create or update warmup config
router.post('/:email_account_id', authenticateUser, async (req, res) => {
  try {
    // Verify email account belongs to user
    const { data: account } = await supabase
      .from('email_accounts')
      .select('id')
      .eq('id', req.params.email_account_id)
      .eq('user_id', req.user.id)
      .single();

    if (!account) {
      return res.status(404).json({ error: 'Email account not found' });
    }

    const { 
      is_active, 
      daily_warmup_volume, 
      replies_per_thread 
    } = req.body;
    
    const { data, error } = await supabase
      .from('warmup_configs')
      .upsert({
        email_account_id: req.params.email_account_id,
        is_active: is_active !== undefined ? is_active : true,
        daily_warmup_volume: daily_warmup_volume || 1000,
        current_daily_volume: 50,
        rampup_increment: 50,
        replies_per_thread: replies_per_thread || 20
      }, {
        onConflict: 'email_account_id'
      })
      .select()
      .single();
    
    if (error) throw error;

    // Update email account warmup status
    await supabase
      .from('email_accounts')
      .update({ is_warming_up: is_active })
      .eq('id', req.params.email_account_id);

    res.json(data);
  } catch (error) {
    console.error('Error updating warmup config:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get warmup stats
router.get('/:email_account_id/stats', authenticateUser, async (req, res) => {
  try {
    // Verify email account belongs to user
    const { data: account } = await supabase
      .from('email_accounts')
      .select('id')
      .eq('id', req.params.email_account_id)
      .eq('user_id', req.user.id)
      .single();

    if (!account) {
      return res.status(404).json({ error: 'Email account not found' });
    }

    // Get active threads
    const { count: activeThreads } = await supabase
      .from('warmup_threads')
      .select('*', { count: 'exact', head: true })
      .eq('email_account_id', req.params.email_account_id)
      .eq('status', 'active');

    // Get total messages sent today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { count: messagesToday } = await supabase
      .from('warmup_messages')
      .select('*', { count: 'exact', head: true })
      .eq('email_account_id', req.params.email_account_id)
      .gte('created_at', today.toISOString());

    // Get inbox placement rate (this would be calculated from seed monitoring)
    const inboxPlacementRate = 95; // Placeholder

    res.json({
      active_threads: activeThreads || 0,
      messages_today: messagesToday || 0,
      inbox_placement_rate: inboxPlacementRate,
      status: activeThreads > 0 ? 'warming' : 'idle'
    });
  } catch (error) {
    console.error('Error fetching warmup stats:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
