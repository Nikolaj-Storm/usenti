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
            daily_limit
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
            condition_branches,
            next_step_if_true,
            next_step_if_false
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

    // Check daily limit
    console.log(`[EXECUTOR]   📊 Checking daily limit...`);
    const withinLimit = await emailService.checkDailyLimit(
      campaign.email_account_id,
      campaign.id
    );

    console.log(`[EXECUTOR]      Within daily limit: ${withinLimit ? '✅ YES' : '❌ NO'}`);

    if (!withinLimit) {
      console.log(`[EXECUTOR]      ⏸️  Daily limit reached, rescheduling to tomorrow 9 AM`);
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0);
      await this.updateNextSendTime(campaignContact.id, tomorrow);
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
        trackOpens: true,
        trackClicks: true
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
        console.error(`[EXECUTOR]         1. The password in Snowman matches the mail server password`);
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

    // Get next step (using array instead of .single() for better error handling)
    console.log(`[EXECUTOR]      📍 Looking for step after wait (step_order ${step.step_order + 1})...`);

    const { data: nextSteps, error } = await supabase
      .from('campaign_steps')
      .select('id, step_type, step_order')
      .eq('campaign_id', campaign.id)
      .eq('step_order', step.step_order + 1);

    if (error) {
      console.error(`[EXECUTOR]      ❌ Error finding next step:`, error);
      return;
    }

    const nextStep = nextSteps && nextSteps.length > 0 ? nextSteps[0] : null;

    if (nextStep) {
      console.log(`[EXECUTOR]      ✅ Found next step: ${nextStep.step_type} (order ${nextStep.step_order})`);

      // IMPORTANT: Set status back to 'in_progress' to release the lock and allow future processing
      const { error: updateError } = await supabase
        .from('campaign_contacts')
        .update({
          current_step_id: nextStep.id,
          next_send_time: nextSendTime.toISOString(),
          status: 'in_progress'
        })
        .eq('id', campaignContact.id);

      if (updateError) {
        console.error(`[EXECUTOR]      ❌ Error updating contact for wait:`, updateError);
      } else {
        console.log(`[EXECUTOR]      ✅ Contact scheduled for ${durationStr} wait`);
        console.log(`[EXECUTOR]         Next step ID: ${nextStep.id}`);
        console.log(`[EXECUTOR]         Will resume at: ${nextSendTime.toISOString()}`);
      }
    } else {
      // No more steps, mark as completed
      console.log(`[EXECUTOR]      🏁 No more steps after wait, marking as completed`);

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

  // Handle condition step - supports multiple condition branches with wait times
  async handleConditionStep(campaignContact, campaign, contact, step) {
    // Check if we're resuming branch step execution from a previous cycle
    const branchContext = campaignContact.branch_context;
    if (branchContext && branchContext.condition_step_id === step.id) {
      console.log(`[EXECUTOR] 🔀 Resuming branch execution for contact ${campaignContact.contact_id}`);
      console.log(`[EXECUTOR]   Branch ${branchContext.branch_index}, step ${branchContext.branch_step_index}`);
      return await this.processBranchStep(campaignContact, campaign, contact, step, branchContext);
    }

    // Get events for this contact in THIS campaign run only.
    // The campaign_id filter prevents cross-campaign contamination.
    // The created_at filter prevents stale events from a previous run of the same campaign.
    const enrollmentTime = campaignContact.created_at;
    const { data: events } = await supabase
      .from('email_events')
      .select('event_type, created_at')
      .eq('campaign_id', campaign.id)
      .eq('contact_id', campaignContact.contact_id)
      .gte('created_at', enrollmentTime)
      .order('created_at', { ascending: false });

    // Minimum delay (ms) between 'sent' and 'opened' events to count as a real open.
    // Email clients (Gmail, Apple Mail, Outlook) often preload tracking pixels automatically
    // within seconds of delivery, creating false "opened" events. Real human opens take longer.
    const MIN_OPEN_DELAY_MS = 3000; // 3 seconds

    // Get the last sent email time for this contact in this campaign
    const lastSentEvent = events?.find(e => e.event_type === 'sent');
    const lastSentTime = lastSentEvent ? new Date(lastSentEvent.created_at) : null;

    // Only consider interaction events that occurred AFTER the last email was sent.
    // Also filter out opens that happened too quickly after send (likely automated preloads).
    const relevantEvents = lastSentTime
      ? (events || []).filter(e => {
          if (e.event_type === 'sent') return false;
          const eventTime = new Date(e.created_at);
          if (eventTime <= lastSentTime) return false;
          // Filter out opens that happened within MIN_OPEN_DELAY_MS of send - likely preloaded by email client
          if (e.event_type === 'opened') {
            const delayMs = eventTime.getTime() - lastSentTime.getTime();
            if (delayMs < MIN_OPEN_DELAY_MS) {
              console.log(`[EXECUTOR]   ⚠️  Filtered out likely preloaded open (${delayMs}ms after send, threshold: ${MIN_OPEN_DELAY_MS}ms)`);
              return false;
            }
          }
          return true;
        })
      : (events || []).filter(e => e.event_type !== 'sent');

    const relevantEventTypes = relevantEvents.map(e => e.event_type);
    const hasOpened = relevantEventTypes.includes('opened');
    const hasClicked = relevantEventTypes.includes('clicked');
    const hasReplied = relevantEventTypes.includes('replied');

    console.log(`[EXECUTOR] 🔀 Evaluating conditions for contact ${contact.email} (${campaignContact.contact_id})`);
    console.log(`[EXECUTOR]   Campaign: ${campaign.id} | Enrolled: ${enrollmentTime}`);
    console.log(`[EXECUTOR]   All events (since enrollment): ${events?.map(e => `${e.event_type}@${e.created_at}`).join(', ') || 'none'}`);
    console.log(`[EXECUTOR]   Last email sent: ${lastSentTime ? lastSentTime.toISOString() : 'never'}`);
    console.log(`[EXECUTOR]   Relevant events (after last send, preload-filtered): ${relevantEventTypes.join(', ') || 'none'}`);
    console.log(`[EXECUTOR]   hasOpened=${hasOpened}, hasClicked=${hasClicked}, hasReplied=${hasReplied}`);

    // Helper function to evaluate a single condition
    const evaluateCondition = (condition) => {
      switch (condition) {
        case 'if_opened': return hasOpened;
        case 'if_not_opened': return !hasOpened;
        case 'if_clicked': return hasClicked;
        case 'if_not_clicked': return !hasClicked;
        case 'if_replied': return hasReplied;
        case 'if_not_replied': return !hasReplied;
        default: return false;
      }
    };

    // Helper to calculate wait time in ms from branch
    const getBranchWaitMs = (branch) => {
      const waitDays = parseInt(branch.wait_days) || 0;
      const waitHours = parseInt(branch.wait_hours) || 0;
      const waitMinutes = parseInt(branch.wait_minutes) || 0;
      return (waitDays * 24 * 60 * 60 * 1000) + (waitHours * 60 * 60 * 1000) + (waitMinutes * 60 * 1000);
    };

    // Check if we have new-style condition_branches
    let branches = step.condition_branches;
    if (typeof branches === 'string') {
      try { branches = JSON.parse(branches); } catch(e) { branches = null; }
    }

    let nextStepId = null;
    let matchedCondition = null;
    let matchedBranchSteps = null;
    let matchedBranchIndex = null;

    if (branches && Array.isArray(branches) && branches.length > 0) {
      // New multi-branch evaluation with wait time support
      console.log(`[EXECUTOR]   Evaluating ${branches.length} condition branches for ${contact.email}...`);

      // Log branch overview for diagnosis
      for (let i = 0; i < branches.length; i++) {
        const b = branches[i];
        const firstStepSubject = b.branch_steps?.[0]?.subject || '(no steps)';
        console.log(`[EXECUTOR]   Branch ${i}: condition="${b.condition}", wait=${b.wait_days || 0}d ${b.wait_hours || 0}h ${b.wait_minutes || 0}m, steps=${(b.branch_steps || []).length}, first_subject="${firstStepSubject}"`);
      }

      const now = Date.now();

      for (let bi = 0; bi < branches.length; bi++) {
        const branch = branches[bi];
        const branchWaitMs = getBranchWaitMs(branch);
        const isNegativeCondition = branch.condition.includes('not_');

        // For negative conditions with wait time, check if enough time has passed
        if (isNegativeCondition && branchWaitMs > 0 && lastSentTime) {
          const waitDeadline = new Date(lastSentTime.getTime() + branchWaitMs);
          const waitRemaining = waitDeadline.getTime() - now;

          console.log(`[EXECUTOR]   - ${branch.condition} (wait ${branch.wait_days || 0}d ${branch.wait_hours || 0}h ${branch.wait_minutes || 0}m): deadline ${waitDeadline.toISOString()}`);

          if (waitRemaining > 0) {
            // Not enough time has passed - reschedule to check again
            console.log(`[EXECUTOR]   ⏳ Wait time not elapsed for ${contact.email}, ${Math.ceil(waitRemaining / 60000)}m remaining`);
            console.log(`[EXECUTOR]   📅 Rescheduling condition check to ${waitDeadline.toISOString()}`);

            await supabase
              .from('campaign_contacts')
              .update({
                next_send_time: waitDeadline.toISOString(),
                status: 'in_progress'
              })
              .eq('id', campaignContact.id);

            return; // Exit early, will be processed again after wait period
          }
        }

        const conditionMet = evaluateCondition(branch.condition);
        console.log(`[EXECUTOR]   - ${branch.condition}: ${conditionMet ? '✅ MATCH' : '❌ no match'} (for ${contact.email})`);

        if (conditionMet) {
          matchedCondition = branch.condition;
          matchedBranchIndex = bi;
          nextStepId = branch.next_step_id;
          matchedBranchSteps = branch.branch_steps || [];
          const matchedSubject = matchedBranchSteps[0]?.subject || '(no steps)';
          console.log(`[EXECUTOR]   ✅ MATCHED Branch ${bi} for ${contact.email}: "${branch.condition}" → first email subject: "${matchedSubject}"`);
          break; // First match wins
        }
      }
    } else {
      // Legacy single-condition evaluation
      const conditionMet = evaluateCondition(step.condition_type);
      console.log(`[EXECUTOR]   Legacy condition ${step.condition_type}: ${conditionMet ? 'TRUE' : 'FALSE'}`);

      matchedCondition = step.condition_type;
      nextStepId = conditionMet ? step.next_step_if_true : step.next_step_if_false;
    }

    // If the matched branch has branch_steps, start processing them
    if (matchedBranchSteps && matchedBranchSteps.length > 0) {
      console.log(`[EXECUTOR]   📋 Branch has ${matchedBranchSteps.length} inline steps, starting branch execution`);
      const newContext = {
        condition_step_id: step.id,
        branch_index: matchedBranchIndex,
        branch_step_index: 0
      };
      return await this.processBranchStep(campaignContact, campaign, contact, step, newContext);
    }

    // If no next_step_id from condition, get next sequential step
    if (!nextStepId) {
      const { data: nextSeqStep } = await supabase
        .from('campaign_steps')
        .select('id')
        .eq('campaign_id', campaign.id)
        .eq('step_order', step.step_order + 1)
        .single();

      nextStepId = nextSeqStep?.id || null;
    }

    if (nextStepId) {
      // IMPORTANT: Set status back to 'in_progress' to release the lock
      await supabase
        .from('campaign_contacts')
        .update({
          current_step_id: nextStepId,
          next_send_time: new Date().toISOString(),
          status: 'in_progress'
        })
        .eq('id', campaignContact.id);

      console.log(`[EXECUTOR]   → Moving to step ${nextStepId} (matched: ${matchedCondition || 'default'})`);
    } else {
      // No next step, mark as completed
      await supabase
        .from('campaign_contacts')
        .update({ status: 'completed' })
        .eq('id', campaignContact.id);

      console.log(`[EXECUTOR]   ✓ Campaign completed for contact ${campaignContact.contact_id}`);
    }
  }

  // Process a single branch step within a condition branch
  async processBranchStep(campaignContact, campaign, contact, conditionStep, branchContext) {
    let branches = conditionStep.condition_branches;
    if (typeof branches === 'string') {
      try { branches = JSON.parse(branches); } catch(e) { branches = []; }
    }

    const branch = branches[branchContext.branch_index];
    if (!branch) {
      console.error(`[EXECUTOR]   Branch index ${branchContext.branch_index} not found, clearing context`);
      return await this.finishBranchAndMoveNext(campaignContact, campaign, conditionStep);
    }

    const branchSteps = branch.branch_steps || [];
    const currentIndex = branchContext.branch_step_index;

    // If we've processed all branch steps, move to next main step
    if (currentIndex >= branchSteps.length) {
      console.log(`[EXECUTOR]   All ${branchSteps.length} branch steps completed, moving to next main step`);
      return await this.finishBranchAndMoveNext(campaignContact, campaign, conditionStep);
    }

    const currentBranchStep = branchSteps[currentIndex];
    const isLastBranchStep = currentIndex >= branchSteps.length - 1;

    console.log(`[EXECUTOR]   Processing branch step ${currentIndex + 1}/${branchSteps.length}: ${currentBranchStep.step_type}`);

    // Prepare the context for after this step completes
    const nextContext = {
      ...branchContext,
      branch_step_index: currentIndex + 1
    };

    switch (currentBranchStep.step_type) {
      case 'email':
        await this.executeBranchEmailStep(campaignContact, campaign, contact, currentBranchStep);

        if (isLastBranchStep) {
          return await this.finishBranchAndMoveNext(campaignContact, campaign, conditionStep);
        } else {
          // More branch steps to process - save progress and continue immediately
          await supabase
            .from('campaign_contacts')
            .update({
              branch_context: nextContext,
              next_send_time: new Date().toISOString(),
              status: 'in_progress'
            })
            .eq('id', campaignContact.id);
          console.log(`[EXECUTOR]   Advancing to branch step ${currentIndex + 2}/${branchSteps.length}`);
        }
        break;

      case 'wait': {
        const waitDays = parseInt(currentBranchStep.wait_days) || 0;
        const waitHours = parseInt(currentBranchStep.wait_hours) || 0;
        const waitMinutes = parseInt(currentBranchStep.wait_minutes) || 0;
        const totalMs = (waitDays * 24 * 60 * 60 * 1000) +
                       (waitHours * 60 * 60 * 1000) +
                       (waitMinutes * 60 * 1000);
        const actualDelayMs = totalMs > 0 ? totalMs : (60 * 1000);
        const nextSendTime = new Date(Date.now() + actualDelayMs);

        console.log(`[EXECUTOR]   Wait branch step: ${waitDays}d ${waitHours}h ${waitMinutes}m`);
        console.log(`[EXECUTOR]   Scheduling resume at ${nextSendTime.toISOString()}`);

        // Save progress pointing to the NEXT branch step, scheduled after the wait
        await supabase
          .from('campaign_contacts')
          .update({
            branch_context: nextContext,
            next_send_time: nextSendTime.toISOString(),
            status: 'in_progress'
          })
          .eq('id', campaignContact.id);
        break;
      }

      default:
        console.log(`[EXECUTOR]   Unsupported branch step type: ${currentBranchStep.step_type}, skipping`);
        if (isLastBranchStep) {
          return await this.finishBranchAndMoveNext(campaignContact, campaign, conditionStep);
        } else {
          await supabase
            .from('campaign_contacts')
            .update({
              branch_context: nextContext,
              next_send_time: new Date().toISOString(),
              status: 'in_progress'
            })
            .eq('id', campaignContact.id);
        }
        break;
    }
  }

  // Send an email from an inline branch step
  async executeBranchEmailStep(campaignContact, campaign, contact, branchStep) {
    const personalizedSubject = emailService.personalizeContent(
      branchStep.subject || 'No Subject',
      contact
    );
    const personalizedBody = emailService.personalizeContent(
      branchStep.body || '',
      contact
    );

    console.log(`[EXECUTOR]      Branch email: "${personalizedSubject}" to ${contact.email}`);

    const accountSelection = await this.getNextEmailAccount(
      campaign.id,
      campaign.email_account_id
    );

    if (accountSelection.exhausted) {
      console.log(`[EXECUTOR]      All email accounts exhausted, rescheduling to tomorrow`);
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0);
      await this.updateNextSendTime(campaignContact.id, tomorrow);
      return;
    }

    if (!accountSelection.accountId) {
      throw new Error('No email account available for sending');
    }

    const result = await emailService.sendEmail({
      emailAccountId: accountSelection.accountId,
      to: contact.email,
      subject: personalizedSubject,
      body: personalizedBody,
      campaignId: campaign.id,
      contactId: contact.id,
      trackOpens: true,
      trackClicks: true
    });

    console.log(`[EXECUTOR]      Branch email sent! Message ID: ${result.messageId}`);

    // Increment emails_sent counter
    const newEmailsSent = (campaignContact.emails_sent || 0) + 1;
    await supabase
      .from('campaign_contacts')
      .update({ emails_sent: newEmailsSent })
      .eq('id', campaignContact.id);

    if (accountSelection.junctionId) {
      await this.incrementAccountCounterSafe(accountSelection.junctionId);
    }
  }

  // Clear branch context and move to the next main step after condition
  async finishBranchAndMoveNext(campaignContact, campaign, conditionStep) {
    console.log(`[EXECUTOR]   Branch execution complete, clearing context`);

    // Find next main step after the condition step
    const { data: nextSteps, error } = await supabase
      .from('campaign_steps')
      .select('id, step_type, step_order')
      .eq('campaign_id', campaign.id)
      .eq('step_order', conditionStep.step_order + 1);

    if (error) {
      console.error(`[EXECUTOR]   Error finding next main step:`, error);
      return;
    }

    const nextStep = nextSteps && nextSteps.length > 0 ? nextSteps[0] : null;

    if (nextStep) {
      console.log(`[EXECUTOR]   Moving to next main step: ${nextStep.step_type} (order ${nextStep.step_order})`);
      await supabase
        .from('campaign_contacts')
        .update({
          current_step_id: nextStep.id,
          branch_context: null,
          next_send_time: new Date().toISOString(),
          status: 'in_progress'
        })
        .eq('id', campaignContact.id);
    } else {
      console.log(`[EXECUTOR]   No more main steps, marking campaign complete for contact`);
      await supabase
        .from('campaign_contacts')
        .update({
          branch_context: null,
          status: 'completed'
        })
        .eq('id', campaignContact.id);
    }
  }

  // Move to next step in sequence
  async moveToNextStep(campaignContact, campaignId, currentStep) {
    console.log(`[EXECUTOR]      📍 Looking for next step after step_order ${currentStep.step_order}...`);

    const { data: nextSteps, error } = await supabase
      .from('campaign_steps')
      .select('id, step_type, step_order')
      .eq('campaign_id', campaignId)
      .eq('step_order', currentStep.step_order + 1);

    if (error) {
      console.error(`[EXECUTOR]      ❌ Error finding next step:`, error);
      return;
    }

    const nextStep = nextSteps && nextSteps.length > 0 ? nextSteps[0] : null;

    if (nextStep) {
      console.log(`[EXECUTOR]      ✅ Found next step: ${nextStep.step_type} (order ${nextStep.step_order}, id: ${nextStep.id})`);

      // IMPORTANT: Set status back to 'in_progress' to release the lock
      const { error: updateError } = await supabase
        .from('campaign_contacts')
        .update({
          current_step_id: nextStep.id,
          next_send_time: new Date().toISOString(),
          status: 'in_progress'
        })
        .eq('id', campaignContact.id);

      if (updateError) {
        console.error(`[EXECUTOR]      ❌ Error updating campaign_contact:`, updateError);
      } else {
        console.log(`[EXECUTOR]      ✅ Updated contact to next step, next_send_time: ${new Date().toISOString()}`);
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
