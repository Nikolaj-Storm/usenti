const supabase = require('../config/supabase');
const emailService = require('./emailService');

// Configurable batch limit - can be set via environment variable
// Default increased from 50 to 200 for better throughput
const BATCH_LIMIT = parseInt(process.env.CAMPAIGN_BATCH_LIMIT, 10) || 200;

class CampaignExecutor {
  constructor() {
    this.processing = false;
    // Track round-robin state for multi-account campaigns (in-memory cache)
    this.accountRotationIndex = new Map();
  }

  /**
   * Get the next email account for a campaign using round-robin rotation
   * Supports both legacy single-account and new multi-account campaigns
   */
  async getNextEmailAccount(campaignId, legacyEmailAccountId) {
    // First, check if campaign uses the junction table (multi-account)
    const { data: campaignAccounts, error } = await supabase
      .from('campaign_email_accounts')
      .select(`
        id,
        email_account_id,
        emails_sent_today,
        is_active,
        email_accounts!inner(
          id,
          email_address,
          daily_send_limit,
          is_active
        )
      `)
      .eq('campaign_id', campaignId)
      .eq('is_active', true)
      .eq('email_accounts.is_active', true);

    if (error) {
      console.error('[EXECUTOR] Error fetching campaign email accounts:', error);
      // Fall back to legacy single account
      return { accountId: legacyEmailAccountId, junctionId: null };
    }

    // If no junction table entries, use legacy single account
    if (!campaignAccounts || campaignAccounts.length === 0) {
      return { accountId: legacyEmailAccountId, junctionId: null };
    }

    // Filter accounts that haven't exceeded their daily limit
    const availableAccounts = campaignAccounts.filter(ca => {
      const dailyLimit = ca.email_accounts.daily_send_limit || 500;
      return ca.emails_sent_today < dailyLimit;
    });

    if (availableAccounts.length === 0) {
      console.log('[EXECUTOR] All email accounts have reached their daily limits');
      return { accountId: null, junctionId: null, exhausted: true };
    }

    // Round-robin selection
    let currentIndex = this.accountRotationIndex.get(campaignId) || 0;
    currentIndex = currentIndex % availableAccounts.length;

    const selected = availableAccounts[currentIndex];

    // Update rotation index for next call
    this.accountRotationIndex.set(campaignId, currentIndex + 1);

    console.log(`[EXECUTOR] 🔄 Round-robin selected account ${selected.email_accounts.email_address} (${currentIndex + 1}/${availableAccounts.length})`);

    return {
      accountId: selected.email_account_id,
      junctionId: selected.id,
      emailAddress: selected.email_accounts.email_address
    };
  }

  /**
   * Increment the daily counter for a campaign email account
   */
  async incrementAccountCounter(junctionId) {
    if (!junctionId) return;

    await supabase
      .from('campaign_email_accounts')
      .update({
        emails_sent_today: supabase.rpc('increment', { row_id: junctionId }),
        last_used_at: new Date().toISOString()
      })
      .eq('id', junctionId);
  }

  /**
   * Increment emails_sent_today using raw SQL increment
   */
  async incrementAccountCounterSafe(junctionId) {
    if (!junctionId) return;

    // Use a direct increment to avoid race conditions
    const { error } = await supabase.rpc('increment_campaign_email_account_counter', {
      junction_id: junctionId
    });

    // If RPC doesn't exist, fall back to regular update
    if (error) {
      await supabase
        .from('campaign_email_accounts')
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', junctionId);

      // Do a separate increment query
      const { data: current } = await supabase
        .from('campaign_email_accounts')
        .select('emails_sent_today')
        .eq('id', junctionId)
        .single();

      if (current) {
        await supabase
          .from('campaign_email_accounts')
          .update({ emails_sent_today: (current.emails_sent_today || 0) + 1 })
          .eq('id', junctionId);
      }
    }
  }

  // Main execution loop - called by cron
  async executePendingCampaigns() {
    if (this.processing) {
      console.log('[EXECUTOR] Already processing, skipping...');
      return;
    }

    this.processing = true;
    const now = new Date().toISOString();
    console.log('');
    console.log('='.repeat(80));
    console.log(`[EXECUTOR] 🚀 Starting campaign execution cycle at ${now}`);
    console.log('='.repeat(80));

    try {
      // =======================================================================
      // STEP 1: Identification
      // Find candidate contacts, but don't fetch full data yet.
      // This minimizes the initial query load.
      // =======================================================================
      console.log('[EXECUTOR] 🔍 Querying for pending campaign contacts...');
      console.log(`[EXECUTOR] Query filters: status='in_progress', campaign.status='running', next_send_time <= ${now}`);

      const { data: candidates, error: scanError } = await supabase
        .from('campaign_contacts')
        .select(`
          id,
          campaigns!inner (
            status
          )
        `)
        .eq('status', 'in_progress')
        .eq('campaigns.status', 'running')
        .lte('next_send_time', now)
        .limit(BATCH_LIMIT);

      if (scanError) {
        console.error('[EXECUTOR] ❌ Database query error:', scanError);
        throw scanError;
      }

      console.log(`[EXECUTOR] 📊 Found ${candidates?.length || 0} candidates for processing`);

      if (!candidates || candidates.length === 0) {
        console.log('[EXECUTOR] ℹ️  No pending emails to send at this time');
        return;
      }

      const candidateIds = candidates.map(c => c.id);

      // =======================================================================
      // STEP 2: Atomic Claim (Lock & Fetch)
      // We update status to 'processing' ONLY for rows that are still 'in_progress'.
      // This prevents Race Conditions where two executors pick up the same row.
      // The .select() returns only the rows that were successfully locked by THIS instance.
      // =======================================================================
      const { data: pending, error: claimError } = await supabase
        .from('campaign_contacts')
        .update({
          status: 'processing',
          updated_at: now
        })
        .in('id', candidateIds)
        .eq('status', 'in_progress') // Optimistic locking
        .select(`
          *,
          campaigns!inner(
            id,
            name,
            email_account_id,
            send_schedule,
            send_immediately,
            status,
            daily_limit,
            track_opens
          ),
          contacts!inner(
            id,
            email,
            first_name,
            last_name,
            company,
            custom_fields
          ),
          campaign_steps!inner(
            id,
            step_type,
            step_order,
            subject,
            body,
            wait_days,
            wait_hours,
            wait_minutes,
            condition_type,
            parent_id,
            branch
          )
        `);

      if (claimError) {
        console.error('[EXECUTOR] ❌ Error claiming contacts:', claimError);
        throw claimError;
      }

      console.log(`[EXECUTOR] ✅ Successfully claimed ${pending.length} emails to process (Race condition check passed)`);
      console.log('[EXECUTOR] Campaign breakdown:');

      // Log campaign summary
      const campaignSummary = pending.reduce((acc, item) => {
        const campaignName = item.campaigns.name;
        acc[campaignName] = (acc[campaignName] || 0) + 1;
        return acc;
      }, {});

      Object.entries(campaignSummary).forEach(([name, count]) => {
        console.log(`  - ${name}: ${count} contact(s)`);
      });

      console.log('[EXECUTOR] 🔄 Processing contacts...');
      console.log('');

      for (let i = 0; i < pending.length; i++) {
        const item = pending[i];
        console.log(`[EXECUTOR] [${i + 1}/${pending.length}] Processing contact ${item.contacts.email} (Campaign: ${item.campaigns.name})`);

        try {
          await this.processCampaignContact(item);
        } catch (err) {
          console.error(`[EXECUTOR] ❌ Error processing contact ${item.id}:`, err.message);
          console.error('[EXECUTOR] Error stack:', err.stack);

          // Emergency cleanup: if processing threw an unexpected error, mark as failed
          // so it doesn't get stuck in 'processing' forever
          try {
            await supabase
              .from('campaign_contacts')
              .update({ status: 'failed', updated_at: new Date().toISOString() })
              .eq('id', item.id);
          } catch (cleanupErr) {
            console.error('[EXECUTOR] Failed to mark crashed contact as failed:', cleanupErr);
          }
        }

        console.log(''); // Blank line for readability
      }

      console.log('='.repeat(80));
      console.log(`[EXECUTOR] ✅ Cycle complete - Processed ${pending.length} contacts`);
      console.log('='.repeat(80));
      console.log('');
    } catch (error) {
      console.error('[EXECUTOR] Execution error:', error);
    } finally {
      this.processing = false;
    }
  }

  // Process a single campaign contact
  async processCampaignContact(campaignContact) {
    const { campaigns: campaign, contacts: contact, campaign_steps: step } = campaignContact;

    console.log(`[EXECUTOR]   📋 Contact: ${contact.email}`);
    console.log(`[EXECUTOR]   📧 Campaign: ${campaign.name} (ID: ${campaign.id})`);
    console.log(`[EXECUTOR]   📍 Step ${step.step_order}: ${step.step_type.toUpperCase()}`);
    console.log(`[EXECUTOR]   ⏰ Next send time: ${campaignContact.next_send_time}`);
    console.log(`[EXECUTOR]   🚀 Send immediately: ${campaign.send_immediately ? 'YES' : 'NO'}`);
    console.log(`[EXECUTOR]   📬 Emails sent so far: ${campaignContact.emails_sent || 0}`);

    // Check if "Ignore schedules" is enabled (stored in send_immediately column)
    // If true, we skip schedule checks for ALL steps and send 24/7
    const shouldSkipSchedule = campaign.send_immediately;

    if (shouldSkipSchedule) {
      console.log(`[EXECUTOR]   ⚡ Skipping schedule check (Global override enabled)`);
    } else {
      // Check if within send schedule
      console.log(`[EXECUTOR]   🕐 Checking send schedule...`);
      const schedule = campaign.send_schedule;
      if (schedule) {
        console.log(`[EXECUTOR]      Schedule: Days=${schedule.days?.join(',')}, Hours=${schedule.start_hour}-${schedule.end_hour}`);
      }

      const withinSchedule = emailService.isWithinSchedule(campaign.send_schedule);
      console.log(`[EXECUTOR]      Within schedule: ${withinSchedule ? '✅ YES' : '❌ NO'}`);

      if (!withinSchedule) {
        const nextTime = emailService.getNextSendTime(campaign.send_schedule);
        console.log(`[EXECUTOR]      ⏭️  Rescheduling to next available time: ${nextTime.toISOString()}`);
        await this.updateNextSendTime(campaignContact.id, nextTime);
        return;
      }
    }

    // Check daily limit and subscription tier limits
    console.log(`[EXECUTOR]   📊 Checking limits and subscription tier...`);
    const limitCheck = await emailService.checkDailyLimit(
      campaign.email_account_id,
      campaign.id
    );

    const withinLimit = limitCheck.withinLimit;
    const planTier = limitCheck.planTier;

    // Temporarily attach planTier to campaign object so handleEmailStep can access it
    campaign._currentPlanTier = planTier;

    console.log(`[EXECUTOR]      Plan Tier: ${planTier} | Within limit: ${withinLimit ? '✅ YES' : '❌ NO'} ${limitCheck.errorMessage ? `(${limitCheck.errorMessage})` : ''}`);

    if (!withinLimit) {
      console.log(`[EXECUTOR]      ⏸️  Limit reached, rescheduling to tomorrow 9 AM`);
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0);
      await this.updateNextSendTime(campaignContact.id, tomorrow);
      return;
    }

    // Defense-in-depth: Check if contact has already replied to this campaign
    // This catches replies that arrived between the executor's initial query and now,
    // or replies that were tracked but the status update was delayed
    console.log(`[EXECUTOR]   🔍 Checking if contact has already replied to this campaign...`);
    const { data: replyEvents } = await supabase
      .from('email_events')
      .select('id')
      .eq('campaign_id', campaign.id)
      .eq('contact_id', contact.id)
      .eq('event_type', 'replied')
      .limit(1);

    if (replyEvents && replyEvents.length > 0) {
      console.log(`[EXECUTOR]   ⏹️  Contact has already replied to this campaign - stopping all follow-ups`);
      await supabase
        .from('campaign_contacts')
        .update({
          status: 'replied',
          replied_at: new Date().toISOString()
        })
        .eq('id', campaignContact.id);
      return;
    }

    // Process based on step type
    console.log(`[EXECUTOR]   ⚙️  Processing step type: ${step.step_type}`);
    switch (step.step_type) {
      case 'email':
        await this.handleEmailStep(campaignContact, campaign, contact, step);
        break;
      case 'wait':
        await this.handleWaitStep(campaignContact, campaign, step);
        break;
      case 'condition':
        await this.handleConditionStep(campaignContact, campaign, contact, step);
        break;

      default:
        console.error(`[EXECUTOR] ❌ Unknown step type: ${step.step_type}`);
        // Reset status so contact doesn't stay stuck in 'processing'
        await supabase
          .from('campaign_contacts')
          .update({ status: 'in_progress' })
          .eq('id', campaignContact.id);
    }
  }

  // Handle email step - with multi-account rotation support
  async handleEmailStep(campaignContact, campaign, contact, step) {
    try {
      console.log(`[EXECUTOR]      📝 Personalizing email content...`);

      // Personalize content
      const personalizedSubject = emailService.personalizeContent(
        step.subject || 'No Subject',
        contact
      );
      const personalizedBody = emailService.personalizeContent(
        step.body || '',
        contact
      );

      console.log(`[EXECUTOR]         Subject: "${personalizedSubject}"`);
      console.log(`[EXECUTOR]         Body length: ${personalizedBody.length} characters`);
      console.log(`[EXECUTOR]         To: ${contact.email}`);

      // Get the next email account using round-robin rotation
      // This supports both legacy single-account and new multi-account campaigns
      const accountSelection = await this.getNextEmailAccount(
        campaign.id,
        campaign.email_account_id // fallback for legacy campaigns
      );

      if (accountSelection.exhausted) {
        // All accounts have reached their daily limits - reschedule for tomorrow
        console.log(`[EXECUTOR]      ⏸️  All email accounts exhausted, rescheduling to tomorrow 9 AM`);
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(9, 0, 0, 0);
        await this.updateNextSendTime(campaignContact.id, tomorrow);
        return;
      }

      if (!accountSelection.accountId) {
        throw new Error('No email account available for sending');
      }

      const emailAccountId = accountSelection.accountId;
      console.log(`[EXECUTOR]         Email Account ID: ${emailAccountId}`);
      if (accountSelection.emailAddress) {
        console.log(`[EXECUTOR]         Sending from: ${accountSelection.emailAddress}`);
      }

      // Send email
      console.log(`[EXECUTOR]      📤 Sending email via emailService...`);
      const result = await emailService.sendEmail({
        emailAccountId: emailAccountId,
        to: contact.email,
        subject: personalizedSubject,
        body: personalizedBody,
        campaignId: campaign.id,
        contactId: contact.id,
        trackOpens: true,  // Always add tracking pixel for campaign emails (required for open conditions)
        trackClicks: true,
        planTier: campaign._currentPlanTier || 'free' // Pass tier to conditionally append footer
      });

      console.log(`[EXECUTOR]      ✅ Email sent successfully!`);
      console.log(`[EXECUTOR]         Message ID: ${result.messageId}`);

      // Increment emails_sent counter for the campaign contact
      const newEmailsSent = (campaignContact.emails_sent || 0) + 1;
      await supabase
        .from('campaign_contacts')
        .update({ emails_sent: newEmailsSent })
        .eq('id', campaignContact.id);
      console.log(`[EXECUTOR]      📊 Updated emails_sent to ${newEmailsSent}`);

      // Increment the daily counter for the multi-account junction (if applicable)
      if (accountSelection.junctionId) {
        await this.incrementAccountCounterSafe(accountSelection.junctionId);
        console.log(`[EXECUTOR]      📊 Incremented daily counter for account rotation`);
      }

      // Move to next step
      console.log(`[EXECUTOR]      ➡️  Moving to next step...`);
      await this.moveToNextStep(campaignContact, campaign.id, step);
    } catch (error) {
      console.error(`[EXECUTOR]      ❌ Failed to send email to ${contact.email}`);
      console.error(`[EXECUTOR]         Error: ${error.message}`);
      console.error(`[EXECUTOR]         Stack: ${error.stack}`);

      // Provide actionable guidance for common SMTP errors
      if (error.message.includes('Authentication credentials invalid') || error.message.includes('Invalid login')) {
        console.error(`[EXECUTOR]      💡 TROUBLESHOOTING: SMTP authentication rejected. Check that:`);
        console.error(`[EXECUTOR]         1. The password in Usenti matches the mail server password`);
        console.error(`[EXECUTOR]         2. The SMTP username format is correct (full email vs local part)`);
        console.error(`[EXECUTOR]         3. SMTP authentication is enabled on the mail server`);
      } else if (error.message.includes('ECONNREFUSED') || error.message.includes('ENOTFOUND')) {
        console.error(`[EXECUTOR]      💡 TROUBLESHOOTING: Cannot connect to SMTP server. Check hostname/IP and firewall rules.`);
      }

      // Mark as failed
      console.log(`[EXECUTOR]      🔴 Marking contact as failed...`);
      await supabase
        .from('campaign_contacts')
        .update({ status: 'failed' })
        .eq('id', campaignContact.id);
    }
  }


  // Handle wait step - supports days, hours, and minutes
  async handleWaitStep(campaignContact, campaign, step) {
    // DEBUG: Log raw step data to see what's actually in the database
    console.log(`[EXECUTOR]      🔍 Raw step data from DB: wait_days=${step.wait_days} (${typeof step.wait_days}), wait_hours=${step.wait_hours} (${typeof step.wait_hours}), wait_minutes=${step.wait_minutes} (${typeof step.wait_minutes})`);

    // Get wait duration components (ensure they are numbers)
    const waitDays = parseInt(step.wait_days) || 0;
    const waitHours = parseInt(step.wait_hours) || 0;
    const waitMinutes = parseInt(step.wait_minutes) || 0;

    console.log(`[EXECUTOR]      ⏱️  Wait step configuration: D:${waitDays} H:${waitHours} M:${waitMinutes}`);

    // Calculate total milliseconds
    const totalMs = (waitDays * 24 * 60 * 60 * 1000) +
      (waitHours * 60 * 60 * 1000) +
      (waitMinutes * 60 * 1000);

    // If all values are 0, use a minimal delay (1 minute) instead of 1 hour
    // This prevents unexpected long delays when values fail to save
    const actualDelayMs = totalMs > 0 ? totalMs : (60 * 1000); // Default to 1 minute if empty (was 1 hour!)

    if (totalMs === 0) {
      console.log(`[EXECUTOR]      ⚠️  WARNING: All wait values are 0! Using 1 minute default. Check if values were saved correctly.`);
    }

    const nextSendTime = new Date(Date.now() + actualDelayMs);

    // Format duration for logging
    const durationParts = [];
    if (waitDays > 0) durationParts.push(`${waitDays}d`);
    if (waitHours > 0) durationParts.push(`${waitHours}h`);
    if (waitMinutes > 0) durationParts.push(`${waitMinutes}m`);
    const durationStr = durationParts.length > 0 ? durationParts.join(' ') : '1m (default)';

    console.log(`[EXECUTOR]         - Calculated wait: ${durationStr} (${actualDelayMs}ms)`);
    console.log(`[EXECUTOR]         - Next send time will be: ${nextSendTime.toISOString()}`);

    // Use moveToNextStep with a custom send time override
    await this.moveToNextStep(campaignContact, campaign.id, step, nextSendTime);
  }

  // Handle condition step - evaluate condition and route to yes/no branch
  async handleConditionStep(campaignContact, campaign, contact, step) {
    const conditionType = step.condition_type || 'email_opened';
    console.log(`[EXECUTOR]      Step ID: ${step.id}`);
    console.log(`[EXECUTOR]      🔀 Evaluating condition: ${conditionType}`);

    // Safety Warning: Check if we are evaluating too soon after the last email sent
    if (conditionType === 'email_opened' || conditionType === 'email_clicked') {
      const { data: lastSent } = await supabase
        .from('email_events')
        .select('created_at')
        .eq('campaign_id', campaign.id)
        .eq('contact_id', contact.id)
        .eq('event_type', 'sent')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (lastSent) {
        const sentTime = new Date(lastSent.created_at).getTime();
        const timeSinceSend = Date.now() - sentTime;
        const minutesSinceSend = timeSinceSend / 1000 / 60;

        console.log(`[EXECUTOR]      🕒 Time since last email: ${minutesSinceSend.toFixed(1)} mins`);

        if (minutesSinceSend < 5) {
          console.log(`[EXECUTOR] ⚠️  WARNING: Checking condition < 5 mins after sending. False negatives likely! (Add a Wait step)`);
        }
      }
    }

    let conditionMet = false;

    try {
      if (conditionType === 'email_opened') {
        // Check if contact has any 'open' events for this campaign
        // We use limit(1) because existence of ANY open event is sufficient
        console.log(`[EXECUTOR]      🔍 Querying email_events for 'opened'... (Campaign: ${campaign.id}, Contact: ${contact.id})`);

        const { data: openEvents, error } = await supabase
          .from('email_events')
          .select('id, created_at')
          .eq('campaign_id', campaign.id)
          .eq('contact_id', contact.id)
          .eq('event_type', 'opened')
          .limit(1);

        if (error) {
          console.error(`[EXECUTOR]      ❌ Error checking open events:`, error);
        }

        conditionMet = openEvents && openEvents.length > 0;
        if (conditionMet) {
          console.log(`[EXECUTOR]      ✅ Email OPENED (Found event id: ${openEvents[0].id} at ${openEvents[0].created_at})`);
        } else {
          console.log(`[EXECUTOR]      ❌ Email NOT OPENED (0 'opened' events found for contact ${contact.id})`);
        }

      } else if (conditionType === 'email_clicked') {
        const { data: clickEvents, error } = await supabase
          .from('email_events')
          .select('id')
          .eq('campaign_id', campaign.id)
          .eq('contact_id', contact.id)
          .eq('event_type', 'clicked')
          .limit(1);

        if (error) {
          console.error(`[EXECUTOR]      ❌ Error checking click events:`, error);
        }

        conditionMet = clickEvents && clickEvents.length > 0;
        console.log(`[EXECUTOR]      📊 Email clicked? ${conditionMet ? 'YES' : 'NO'}`);

      } else if (conditionType === 'email_replied') {
        const { data: replyEvents, error } = await supabase
          .from('email_events')
          .select('id')
          .eq('campaign_id', campaign.id)
          .eq('contact_id', contact.id)
          .eq('event_type', 'replied')
          .limit(1);

        if (error) {
          console.error(`[EXECUTOR]      ❌ Error checking reply events:`, error);
        }

        conditionMet = replyEvents && replyEvents.length > 0;
        console.log(`[EXECUTOR]      📊 Email replied? ${conditionMet ? 'YES' : 'NO'}`);

      } else {
        console.log(`[EXECUTOR]      ⚠️  Unknown condition type: ${conditionType}, defaulting to NO`);
      }
    } catch (err) {
      console.error(`[EXECUTOR]      ❌ Error evaluating condition:`, err.message);
    }

    const branchName = conditionMet ? 'yes' : 'no';
    console.log(`[EXECUTOR]      ➡️  Routing to '${branchName}' branch`);

    // Find the first step in the matching branch (child steps with parent_id = this condition's id)
    const { data: branchSteps, error: branchError } = await supabase
      .from('campaign_steps')
      .select('id, step_type, step_order, branch')
      .eq('campaign_id', campaign.id)
      .eq('parent_id', step.id)
      .order('step_order');

    if (branchError) {
      console.error(`[EXECUTOR]      ❌ Error finding branch steps:`, branchError);
    }

    console.log(`[EXECUTOR]      📋 Found ${branchSteps?.length || 0} child steps for condition ${step.id}`);
    if (branchSteps && branchSteps.length > 0) {
      branchSteps.forEach((bs, i) => {
        console.log(`[EXECUTOR]         Child[${i}]: id=${bs.id}, type=${bs.step_type}, order=${bs.step_order}, branch=${bs.branch}`);
      });
    }

    // Filter for the matching branch
    let targetSteps = branchSteps?.filter(s => s.branch === branchName) || [];

    // If no steps with branch labels (legacy data without branch column), try all child steps
    if (targetSteps.length === 0 && branchSteps && branchSteps.length > 0) {
      console.log(`[EXECUTOR]      ⚠️  No steps with branch='${branchName}', checking if branch column is empty...`);
      const unbranchedSteps = branchSteps.filter(s => !s.branch);
      if (unbranchedSteps.length > 0) {
        console.log(`[EXECUTOR]      ⚠️  Found ${unbranchedSteps.length} child steps without branch labels, cannot route - skipping condition`);
      }
    }

    if (targetSteps.length > 0) {
      // Sort by step_order and take the first
      targetSteps.sort((a, b) => a.step_order - b.step_order);
      const firstBranchStep = targetSteps[0];
      console.log(`[EXECUTOR]      ✅ Advancing to branch step: ${firstBranchStep.step_type} (id: ${firstBranchStep.id})`);

      const { error: updateError } = await supabase
        .from('campaign_contacts')
        .update({
          current_step_id: firstBranchStep.id,
          next_send_time: new Date().toISOString(),
          status: 'in_progress'
        })
        .eq('id', campaignContact.id);

      if (updateError) {
        console.error(`[EXECUTOR]      ❌ Error updating to branch step:`, updateError);
      } else {
        console.log(`[EXECUTOR]      ✅ Contact routed to '${branchName}' branch`);

        // Immediately process the next step in the same cycle to avoid waiting
        // for the next cron tick (saves up to 5 minutes per non-wait step)
        if (firstBranchStep.step_type === 'email' || firstBranchStep.step_type === 'condition') {
          console.log(`[EXECUTOR]      ⚡ Immediately processing branch step (${firstBranchStep.step_type}) in same cycle...`);

          // Re-fetch the updated campaign contact with full join data
          const { data: updatedContact, error: refetchError } = await supabase
            .from('campaign_contacts')
            .select(`
              *,
              campaigns!inner(
                id, name, email_account_id, send_schedule, send_immediately, status, daily_limit, track_opens
              ),
              contacts!inner(
                id, email, first_name, last_name, company, custom_fields
              ),
              campaign_steps!inner(
                id, step_type, step_order, subject, body, wait_days, wait_hours, wait_minutes,
                condition_type, parent_id, branch
              )
            `)
            .eq('id', campaignContact.id)
            .single();

          if (!refetchError && updatedContact) {
            try {
              await this.processCampaignContact(updatedContact);
            } catch (immediateErr) {
              console.error(`[EXECUTOR]      ❌ Error in immediate branch processing:`, immediateErr.message);
            }
          } else if (refetchError) {
            console.error(`[EXECUTOR]      ❌ Error re-fetching contact for immediate processing:`, refetchError);
          }
        }
      }
    } else {
      // No branch steps found - skip the condition and go to next main-flow step
      console.log(`[EXECUTOR]      ⚠️  No '${branchName}' branch steps found, skipping to next main-flow step`);
      await this.moveToNextStep(campaignContact, campaign.id, step);
    }
  }

  // Move to next step in sequence (handles both main-flow and branch steps)
  // overrideNextSendTime: optional Date to use instead of "now" (used by wait steps)
  async moveToNextStep(campaignContact, campaignId, currentStep, overrideNextSendTime) {
    const isInBranch = !!(currentStep.parent_id || currentStep.branch);
    console.log(`[EXECUTOR]      📍 Looking for next step after step_order ${currentStep.step_order} (in branch: ${isInBranch ? `yes, parent=${currentStep.parent_id}, branch=${currentStep.branch}` : 'no'})...`);

    let nextStep = null;

    if (isInBranch && currentStep.parent_id) {
      // We're inside a branch - look for the next step in the SAME branch
      const { data: nextBranchSteps, error: branchError } = await supabase
        .from('campaign_steps')
        .select('id, step_type, step_order, parent_id, branch')
        .eq('campaign_id', campaignId)
        .eq('parent_id', currentStep.parent_id)
        .eq('branch', currentStep.branch)
        .gt('step_order', currentStep.step_order)
        .order('step_order')
        .limit(1);

      if (branchError) {
        console.error(`[EXECUTOR]      ❌ Error finding next branch step:`, branchError);
      }

      nextStep = nextBranchSteps && nextBranchSteps.length > 0 ? nextBranchSteps[0] : null;

      if (!nextStep) {
        // End of branch - go back to main flow after the condition step
        console.log(`[EXECUTOR]      🔄 End of branch, returning to main flow...`);

        // Get the parent condition step to find its step_order
        const { data: parentSteps, error: parentError } = await supabase
          .from('campaign_steps')
          .select('id, step_order')
          .eq('id', currentStep.parent_id);

        if (parentError) {
          console.error(`[EXECUTOR]      ❌ Error finding parent condition step:`, parentError);
        }

        const parentStep = parentSteps && parentSteps.length > 0 ? parentSteps[0] : null;

        if (parentStep) {
          console.log(`[EXECUTOR]      📍 Parent condition step_order: ${parentStep.step_order}, looking for main-flow step_order > ${parentStep.step_order}...`);

          // Find next main-flow step (no parent_id) after the condition
          const { data: mainFlowSteps, error: mainError } = await supabase
            .from('campaign_steps')
            .select('id, step_type, step_order, parent_id, branch')
            .eq('campaign_id', campaignId)
            .is('parent_id', null)
            .gt('step_order', parentStep.step_order)
            .order('step_order')
            .limit(1);

          if (mainError) {
            console.error(`[EXECUTOR]      ❌ Error finding next main-flow step:`, mainError);
          }

          nextStep = mainFlowSteps && mainFlowSteps.length > 0 ? mainFlowSteps[0] : null;

          // Fallback: if parent_id IS NULL doesn't work, try without that filter
          if (!nextStep) {
            const { data: fallbackSteps, error: fbError } = await supabase
              .from('campaign_steps')
              .select('id, step_type, step_order, parent_id, branch')
              .eq('campaign_id', campaignId)
              .gt('step_order', parentStep.step_order)
              .order('step_order')
              .limit(5);

            if (!fbError && fallbackSteps && fallbackSteps.length > 0) {
              // Find the first step that's NOT a child of any condition (no branch)
              const mainStep = fallbackSteps.find(s => !s.parent_id && !s.branch);
              if (mainStep) {
                console.log(`[EXECUTOR]      📍 Fallback: found main-flow step via non-branch filter`);
                nextStep = mainStep;
              }
            }
          }
        }
      }
    } else {
      // Main flow - find next step with parent_id IS NULL
      const { data: nextSteps, error } = await supabase
        .from('campaign_steps')
        .select('id, step_type, step_order, parent_id, branch')
        .eq('campaign_id', campaignId)
        .is('parent_id', null)
        .gt('step_order', currentStep.step_order)
        .order('step_order')
        .limit(1);

      if (error) {
        console.error(`[EXECUTOR]      ❌ Error finding next step:`, error);
      }

      nextStep = nextSteps && nextSteps.length > 0 ? nextSteps[0] : null;

      // Fallback: if parent_id IS NULL filter didn't work, try simple step_order + 1
      if (!nextStep) {
        const { data: fallbackSteps, error: fbError } = await supabase
          .from('campaign_steps')
          .select('id, step_type, step_order, parent_id, branch')
          .eq('campaign_id', campaignId)
          .eq('step_order', currentStep.step_order + 1);

        if (!fbError && fallbackSteps && fallbackSteps.length > 0) {
          // Prefer a step without parent (main flow)
          nextStep = fallbackSteps.find(s => !s.parent_id && !s.branch) || fallbackSteps[0];
        }
      }
    }

    if (nextStep) {
      console.log(`[EXECUTOR]      ✅ Found next step: ${nextStep.step_type} (order ${nextStep.step_order}, id: ${nextStep.id})`);

      // IMPORTANT: Set status back to 'in_progress' to release the lock
      const nextSendTime = overrideNextSendTime ? overrideNextSendTime.toISOString() : new Date().toISOString();
      const { error: updateError } = await supabase
        .from('campaign_contacts')
        .update({
          current_step_id: nextStep.id,
          next_send_time: nextSendTime,
          status: 'in_progress'
        })
        .eq('id', campaignContact.id);

      if (updateError) {
        console.error(`[EXECUTOR]      ❌ Error updating campaign_contact:`, updateError);
      } else {
        console.log(`[EXECUTOR]      ✅ Updated contact to next step, next_send_time: ${nextSendTime}`);
      }
    } else {
      // No more steps, mark as completed
      console.log(`[EXECUTOR]      🏁 No more steps found, marking contact as completed`);

      const { error: completeError } = await supabase
        .from('campaign_contacts')
        .update({ status: 'completed' })
        .eq('id', campaignContact.id);

      if (completeError) {
        console.error(`[EXECUTOR]      ❌ Error marking as completed:`, completeError);
      } else {
        console.log(`[EXECUTOR]      ✅ Contact marked as completed`);
      }
    }
  }

  // Helper to update next send time
  async updateNextSendTime(campaignContactId, nextTime) {
    // IMPORTANT: Set status back to 'in_progress' to release the lock
    await supabase
      .from('campaign_contacts')
      .update({
        next_send_time: nextTime.toISOString(),
        status: 'in_progress'
      })
      .eq('id', campaignContactId);
  }
}

module.exports = new CampaignExecutor();
