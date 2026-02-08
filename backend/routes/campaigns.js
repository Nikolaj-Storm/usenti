const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { authenticateUser } = require('../middleware/auth');

// Get all campaigns for user
router.get('/', authenticateUser, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('campaigns')
      .select(`
        *,
        email_accounts(id, email_address),
        contact_lists(id, name, total_contacts),
        campaign_email_accounts(
          id,
          email_account_id,
          is_active,
          email_accounts(id, email_address)
        )
      `)
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Error fetching campaigns:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get single campaign
router.get('/:id', authenticateUser, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('campaigns')
      .select(`
        *,
        email_accounts(id, email_address),
        contact_lists(id, name, total_contacts),
        campaign_email_accounts(
          id,
          email_account_id,
          is_active,
          email_accounts(id, email_address)
        )
      `)
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (error) throw error;

    if (!data) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    res.json(data);
  } catch (error) {
    console.error('Error fetching campaign:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create new campaign
router.post('/', authenticateUser, async (req, res) => {
  try {
    const {
      name,
      email_account_id,
      email_account_ids,
      contact_list_id,
      send_schedule,
      daily_limit
    } = req.body;

    const accountIds = email_account_ids && email_account_ids.length > 0
      ? email_account_ids
      : (email_account_id ? [email_account_id] : []);

    if (!name || accountIds.length === 0 || !contact_list_id) {
      return res.status(400).json({
        error: 'Name, at least one email account, and contact list are required'
      });
    }

    const { data: emailAccounts, error: accountsError } = await supabase
      .from('email_accounts')
      .select('id')
      .in('id', accountIds)
      .eq('user_id', req.user.id);

    if (accountsError) throw accountsError;

    if (!emailAccounts || emailAccounts.length !== accountIds.length) {
      return res.status(400).json({ error: 'One or more email accounts are invalid' });
    }

    const { data: contactList } = await supabase
      .from('contact_lists')
      .select('id')
      .eq('id', contact_list_id)
      .eq('user_id', req.user.id)
      .single();

    if (!contactList) {
      return res.status(400).json({ error: 'Invalid contact list' });
    }

    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .insert({
        user_id: req.user.id,
        name,
        email_account_id: accountIds[0],
        contact_list_id,
        status: 'draft',
        send_schedule: send_schedule || {
          days: ['mon', 'tue', 'wed', 'thu', 'fri'],
          start_hour: 9,
          end_hour: 17
        },
        daily_limit: daily_limit || 500
      })
      .select()
      .single();

    if (campaignError) throw campaignError;

    if (accountIds.length > 0) {
      const junctionEntries = accountIds.map(accountId => ({
        campaign_id: campaign.id,
        email_account_id: accountId,
        is_active: true
      }));

      const { error: junctionError } = await supabase
        .from('campaign_email_accounts')
        .insert(junctionEntries);

      if (junctionError) {
        console.error('Error creating campaign_email_accounts:', junctionError);
      }
    }

    const { data: fullCampaign, error: fetchError } = await supabase
      .from('campaigns')
      .select(`
        *,
        email_accounts(id, email_address),
        contact_lists(id, name, total_contacts),
        campaign_email_accounts(
          id,
          email_account_id,
          is_active,
          email_accounts(id, email_address)
        )
      `)
      .eq('id', campaign.id)
      .single();

    if (fetchError) throw fetchError;

    res.json(fullCampaign);
  } catch (error) {
    console.error('Error creating campaign:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update campaign
router.put('/:id', authenticateUser, async (req, res) => {
  try {
    const { name, send_schedule, daily_limit, status } = req.body;

    const updates = {};
    if (name) updates.name = name;
    if (send_schedule) updates.send_schedule = send_schedule;
    if (daily_limit !== undefined) updates.daily_limit = daily_limit;
    if (status) updates.status = status;

    // Handle steps if provided
    const { steps } = req.body;
    if (steps && Array.isArray(steps)) {
      // Delete existing steps
      const { error: deleteError } = await supabase
        .from('campaign_steps')
        .delete()
        .eq('campaign_id', req.params.id);
      
      if (deleteError) throw deleteError;
      
      // Re-insert steps with parent_id, branch_index AND condition_branches
      for (const step of steps) {
        const { error: insertError } = await supabase
          .from('campaign_steps')
          .insert({
            id: step.id,
            campaign_id: req.params.id,
            step_type: step.step_type || step.type,
            config: step.config,
            step_order: step.step_order || step.position,
            branch_id: step.branch_id,
            // CRITICAL FIX: Save condition branches, parent_id, and branch_index
            condition_branches: step.condition_branches || null,
            parent_id: step.parent_id || null,
            branch_index: step.branch_index || null,
            // Save positions for visual editor
            position_x: step.position_x ? Math.round(Number(step.position_x)) : null,
            position_y: step.position_y ? Math.round(Number(step.position_y)) : null
          });
        
        if (insertError) throw insertError;
      }
    }

    const { data, error } = await supabase
      .from('campaigns')
      .update(updates)
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select(`
        *,
        email_accounts(id, email_address),
        contact_lists(id, name, total_contacts)
      `)
      .single();
    
    if (error) throw error;
    
    if (!data) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    res.json(data);
  } catch (error) {
    console.error('Error updating campaign:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete campaign
router.delete('/:id', authenticateUser, async (req, res) => {
  try {
    const { error } = await supabase
      .from('campaigns')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.user.id);

    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting campaign:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// CAMPAIGN EMAIL ACCOUNTS
// ============================================================================

router.get('/:id/email-accounts', authenticateUser, async (req, res) => {
  try {
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('id')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    const { data, error } = await supabase
      .from('campaign_email_accounts')
      .select(`
        id,
        email_account_id,
        emails_sent_today,
        last_used_at,
        is_active,
        email_accounts(id, email_address, daily_send_limit)
      `)
      .eq('campaign_id', req.params.id);

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    console.error('Error fetching campaign email accounts:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/email-accounts', authenticateUser, async (req, res) => {
  try {
    const { email_account_ids } = req.body;

    if (!email_account_ids || !Array.isArray(email_account_ids) || email_account_ids.length === 0) {
      return res.status(400).json({ error: 'email_account_ids array is required' });
    }

    const { data: campaign } = await supabase
      .from('campaigns')
      .select('id')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    const { data: emailAccounts } = await supabase
      .from('email_accounts')
      .select('id')
      .in('id', email_account_ids)
      .eq('user_id', req.user.id);

    if (!emailAccounts || emailAccounts.length !== email_account_ids.length) {
      return res.status(400).json({ error: 'One or more email accounts are invalid' });
    }

    const entries = email_account_ids.map(accountId => ({
      campaign_id: req.params.id,
      email_account_id: accountId,
      is_active: true
    }));

    const { error } = await supabase
      .from('campaign_email_accounts')
      .upsert(entries, { onConflict: 'campaign_id,email_account_id' });

    if (error) throw error;

    const { data: updatedList } = await supabase
      .from('campaign_email_accounts')
      .select(`
        id,
        email_account_id,
        emails_sent_today,
        last_used_at,
        is_active,
        email_accounts(id, email_address, daily_send_limit)
      `)
      .eq('campaign_id', req.params.id);

    res.json(updatedList || []);
  } catch (error) {
    console.error('Error adding campaign email accounts:', error);
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:campaignId/email-accounts/:accountId', authenticateUser, async (req, res) => {
  try {
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('id')
      .eq('id', req.params.campaignId)
      .eq('user_id', req.user.id)
      .single();

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    const { error } = await supabase
      .from('campaign_email_accounts')
      .delete()
      .eq('campaign_id', req.params.campaignId)
      .eq('email_account_id', req.params.accountId);

    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    console.error('Error removing campaign email account:', error);
    res.status(500).json({ error: error.message });
  }
});

router.patch('/:campaignId/email-accounts/:accountId', authenticateUser, async (req, res) => {
  try {
    const { is_active } = req.body;

    const { data: campaign } = await supabase
      .from('campaigns')
      .select('id')
      .eq('id', req.params.campaignId)
      .eq('user_id', req.user.id)
      .single();

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    const { data, error } = await supabase
      .from('campaign_email_accounts')
      .update({ is_active })
      .eq('campaign_id', req.params.campaignId)
      .eq('email_account_id', req.params.accountId)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Error updating campaign email account:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// CAMPAIGN STEPS
// ============================================================================

router.get('/:id/steps', authenticateUser, async (req, res) => {
  try {
    const { data: campaigns } = await supabase
      .from('campaigns')
      .select('id')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id);

    if (!campaigns || campaigns.length === 0) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    const { data, error } = await supabase
      .from('campaign_steps')
      .select('*')
      .eq('campaign_id', req.params.id)
      .order('step_order');
    
    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Error fetching campaign steps:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/steps', authenticateUser, async (req, res) => {
  try {
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('id')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    const {
      step_type,
      subject,
      body,
      wait_days,
      wait_hours,
      wait_minutes,
      condition_type,
      condition_branches,
      next_step_if_true,
      next_step_if_false,
      step_order
    } = req.body;

    if (!['email', 'wait', 'condition'].includes(step_type)) {
      return res.status(400).json({ error: 'Invalid step type' });
    }

    const { data, error } = await supabase
      .from('campaign_steps')
      .insert({
        campaign_id: req.params.id,
        step_type,
        subject: step_type === 'email' ? subject : null,
        body: step_type === 'email' ? body : null,
        wait_days: step_type === 'wait' ? (wait_days || 0) : null,
        wait_hours: step_type === 'wait' ? (wait_hours || 0) : null,
        wait_minutes: step_type === 'wait' ? (wait_minutes || 0) : null,
        condition_type: step_type === 'condition' ? condition_type : null,
        condition_branches: step_type === 'condition' ? (condition_branches || null) : null,
        next_step_if_true: step_type === 'condition' ? next_step_if_true : null,
        next_step_if_false: step_type === 'condition' ? next_step_if_false : null,
        step_order: step_order || 1
      })
      .select();

    if (error) throw error;
    const step = Array.isArray(data) ? data[0] : data;
    res.json(step);
  } catch (error) {
    console.error('Error adding campaign step:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update campaign step
router.put('/:campaignId/steps/:stepId', authenticateUser, async (req, res) => {
  try {
    // 1. Verify campaign ownership
    const { data: campaigns } = await supabase
      .from('campaigns')
      .select('id')
      .eq('id', req.params.campaignId)
      .eq('user_id', req.user.id);

    if (!campaigns || campaigns.length === 0) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    const {
      subject, body, wait_days, wait_hours, wait_minutes,
      condition_type, condition_branches, step_order,
      position_x, position_y
    } = req.body;

    const updates = {};
    if (subject !== undefined) updates.subject = subject;
    if (body !== undefined) updates.body = body;
    if (wait_days !== undefined) updates.wait_days = wait_days;
    if (wait_hours !== undefined) updates.wait_hours = wait_hours;
    if (wait_minutes !== undefined) updates.wait_minutes = wait_minutes;
    if (condition_type !== undefined) updates.condition_type = condition_type;
    if (condition_branches !== undefined) updates.condition_branches = condition_branches;
    if (step_order !== undefined) updates.step_order = step_order;
    if (position_x !== undefined) updates.position_x = Math.round(Number(position_x));
    if (position_y !== undefined) updates.position_y = Math.round(Number(position_y));

    if (Object.keys(updates).length === 0) {
      return res.json({ message: 'No updates provided' });
    }

    // 2. Perform Update without .single() to avoid coercion errors
    const { error: updateError } = await supabase
      .from('campaign_steps')
      .update(updates)
      .eq('id', req.params.stepId)
      .eq('campaign_id', req.params.campaignId);

    if (updateError) throw updateError;

    // 3. Fetch the updated record explicitly for the response
    const { data: updatedSteps, error: fetchError } = await supabase
      .from('campaign_steps')
      .select('*')
      .eq('id', req.params.stepId)
      .eq('campaign_id', req.params.campaignId);

    if (fetchError) throw fetchError;

    const updatedStep = updatedSteps && updatedSteps.length > 0 ? updatedSteps[0] : null;
    if (!updatedStep) {
      return res.status(404).json({ error: 'Step not found after update' });
    }

    res.json(updatedStep);
  } catch (error) {
    console.error('Error updating campaign step:', error);
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:campaignId/steps/:stepId', authenticateUser, async (req, res) => {
  try {
    const { data: campaigns } = await supabase
      .from('campaigns')
      .select('id')
      .eq('id', req.params.campaignId)
      .eq('user_id', req.user.id);

    if (!campaigns || campaigns.length === 0) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    const { error } = await supabase
      .from('campaign_steps')
      .delete()
      .eq('id', req.params.stepId)
      .eq('campaign_id', req.params.campaignId);
    
    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting campaign step:', error);
    res.status(500).json({ error: error.message });
  }
});

// Start campaign
router.post('/:id/start', authenticateUser, async (req, res) => {
  try {
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('id, contact_list_id')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    const { data: firstStep } = await supabase
      .from('campaign_steps')
      .select('id')
      .eq('campaign_id', req.params.id)
      .eq('step_order', 1)
      .single();

    if (!firstStep) {
      return res.status(400).json({ error: 'Campaign has no steps' });
    }

    const { data: contacts } = await supabase
      .from('contacts')
      .select('id')
      .eq('list_id', campaign.contact_list_id)
      .eq('status', 'active');

    if (!contacts || contacts.length === 0) {
      return res.status(400).json({ error: 'No active contacts in list' });
    }

    const { error: deleteError } = await supabase
      .from('campaign_contacts')
      .delete()
      .eq('campaign_id', req.params.id);

    if (deleteError) throw deleteError;

    const campaignContacts = contacts.map(contact => ({
      campaign_id: req.params.id,
      contact_id: contact.id,
      current_step_id: firstStep.id,
      status: 'in_progress',
      next_send_time: new Date().toISOString()
    }));

    const { error: insertError } = await supabase
      .from('campaign_contacts')
      .insert(campaignContacts);

    if (insertError) throw insertError;

    const { error: updateError } = await supabase
      .from('campaigns')
      .update({ 
        status: 'running', 
        started_at: new Date().toISOString() 
      })
      .eq('id', req.params.id);

    if (updateError) throw updateError;

    res.json({ 
      success: true, 
      message: `Campaign started with ${contacts.length} contacts` 
    });
  } catch (error) {
    console.error('Error starting campaign:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/pause', authenticateUser, async (req, res) => {
  try {
    const { error } = await supabase
      .from('campaigns')
      .update({ status: 'paused' })
      .eq('id', req.params.id)
      .eq('user_id', req.user.id);
    
    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    console.error('Error pausing campaign:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id/stats', authenticateUser, async (req, res) => {
  try {
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('id, contact_list_id')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    const { count: totalContacts } = await supabase
      .from('campaign_contacts')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', req.params.id);

    const { data: events } = await supabase
      .from('email_events')
      .select('event_type')
      .eq('campaign_id', req.params.id);

    const sentCount = events?.filter(e => e.event_type === 'sent').length || 0;
    const openedCount = events?.filter(e => e.event_type === 'opened').length || 0;
    const clickedCount = events?.filter(e => e.event_type === 'clicked').length || 0;
    const repliedCount = events?.filter(e => e.event_type === 'replied').length || 0;

    const stats = {
      total_contacts: totalContacts || 0,
      sent_count: sentCount,
      opened_count: openedCount,
      clicked_count: clickedCount,
      replied_count: repliedCount,
      open_rate: sentCount > 0 ? ((openedCount / sentCount) * 100).toFixed(1) : 0,
      click_rate: sentCount > 0 ? ((clickedCount / sentCount) * 100).toFixed(1) : 0,
      reply_rate: sentCount > 0 ? ((repliedCount / sentCount) * 100).toFixed(1) : 0
    };

    res.json(stats);
  } catch (error) {
    console.error('Error fetching campaign stats:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
