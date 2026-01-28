const supabase = require('../config/supabase');
const emailService = require('./emailService');

class CampaignExecutor {
  constructor() {
    this.processing = false;
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
      // Get pending campaign contacts that are ready to send
      console.log('[EXECUTOR] 🔍 Querying for pending campaign contacts...');
      console.log(`[EXECUTOR] Query filters: status='in_progress', campaign.status='running', next_send_time <= ${now}`);

      const { data: pending, error } = await supabase
        .from('campaign_contacts')
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
        `)
        .eq('status', 'in_progress')
        .eq('campaigns.status', 'running')
        .lte('next_send_time', new Date().toISOString())
        .limit(50);

      if (error) {
        console.error('[EXECUTOR] ❌ Database query error:', error);
        throw error;
      }

      console.log(`[EXECUTOR] 📊 Query returned ${pending?.length || 0} pending campaign contacts`);

      if (!pending || pending.length === 0) {
        console.log('[EXECUTOR] ℹ️  No pending emails to send at this time');
        console.log('[EXECUTOR] Possible reasons:');
        console.log('  - No campaigns are running');
        console.log('  - No contacts in in_progress status');
        console.log('  - next_send_time is in the future');
        console.log('='.repeat(80));
        return;
      }

      console.log(`[EXECUTOR] ✅ Found ${pending.length} emails ready to process`);
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

    // Check if this is the first email and send_immediately is enabled
    const isFirstEmail = step.step_order === 1 && (campaignContact.emails_sent || 0) === 0;
    const shouldSkipSchedule = campaign.send_immediately && isFirstEmail;

    if (shouldSkipSchedule) {
      console.log(`[EXECUTOR]   ⚡ Skipping schedule check (send_immediately + first email)`);
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
        await this.handleConditionStep(campaignContact, campaign, step);
        break;
      default:
        console.error(`[EXECUTOR] ❌ Unknown step type: ${step.step_type}`);
    }
  }

  // Handle email step
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
      console.log(`[EXECUTOR]         Email Account ID: ${campaign.email_account_id}`);

      // Send email
      console.log(`[EXECUTOR]      📤 Sending email via emailService...`);
      const result = await emailService.sendEmail({
        emailAccountId: campaign.email_account_id,
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

      // Increment emails_sent counter
      const newEmailsSent = (campaignContact.emails_sent || 0) + 1;
      await supabase
        .from('campaign_contacts')
        .update({ emails_sent: newEmailsSent })
        .eq('id', campaignContact.id);
      console.log(`[EXECUTOR]      📊 Updated emails_sent to ${newEmailsSent}`);

      // Move to next step
      console.log(`[EXECUTOR]      ➡️  Moving to next step...`);
      await this.moveToNextStep(campaignContact, campaign.id, step);
    } catch (error) {
      console.error(`[EXECUTOR]      ❌ Failed to send email to ${contact.email}`);
      console.error(`[EXECUTOR]         Error: ${error.message}`);
      console.error(`[EXECUTOR]         Stack: ${error.stack}`);

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
    // Get wait duration components (default to 1 hour if nothing set)
    const waitDays = step.wait_days || 0;
    const waitHours = step.wait_hours || 0;
    const waitMinutes = step.wait_minutes || 0;

    // Calculate total milliseconds
    const totalMs = (waitDays * 24 * 60 * 60 * 1000) +
                   (waitHours * 60 * 60 * 1000) +
                   (waitMinutes * 60 * 1000);

    // Default to 1 hour if total is 0
    const actualDelayMs = totalMs > 0 ? totalMs : (60 * 60 * 1000);

    const nextSendTime = new Date(Date.now() + actualDelayMs);

    // Format duration for logging
    const durationParts = [];
    if (waitDays > 0) durationParts.push(`${waitDays}d`);
    if (waitHours > 0) durationParts.push(`${waitHours}h`);
    if (waitMinutes > 0) durationParts.push(`${waitMinutes}m`);
    const durationStr = durationParts.length > 0 ? durationParts.join(' ') : '1h (default)';

    // Get next step
    const { data: nextStep } = await supabase
      .from('campaign_steps')
      .select('id')
      .eq('campaign_id', campaign.id)
      .eq('step_order', step.step_order + 1)
      .single();

    if (nextStep) {
      await supabase
        .from('campaign_contacts')
        .update({
          current_step_id: nextStep.id,
          next_send_time: nextSendTime.toISOString()
        })
        .eq('id', campaignContact.id);

      console.log(`[EXECUTOR] ⏱ Wait ${durationStr} for contact ${campaignContact.contact_id}`);
      console.log(`[EXECUTOR]   Next send time: ${nextSendTime.toISOString()}`);
    } else {
      // No more steps, mark as completed
      await supabase
        .from('campaign_contacts')
        .update({ status: 'completed' })
        .eq('id', campaignContact.id);

      console.log(`[EXECUTOR] ✓ Campaign completed for contact ${campaignContact.contact_id}`);
    }
  }

  // Handle condition step - supports multiple condition branches
  async handleConditionStep(campaignContact, campaign, step) {
    // Get events for this contact
    const { data: events } = await supabase
      .from('email_events')
      .select('event_type')
      .eq('campaign_id', campaign.id)
      .eq('contact_id', campaignContact.contact_id);

    const eventTypes = events?.map(e => e.event_type) || [];
    const hasOpened = eventTypes.includes('opened');
    const hasClicked = eventTypes.includes('clicked');
    const hasReplied = eventTypes.includes('replied');

    console.log(`[EXECUTOR] 🔀 Evaluating conditions for contact ${campaignContact.contact_id}`);
    console.log(`[EXECUTOR]   Events: ${eventTypes.join(', ') || 'none'}`);

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

    // Check if we have new-style condition_branches
    let branches = step.condition_branches;
    if (typeof branches === 'string') {
      try { branches = JSON.parse(branches); } catch(e) { branches = null; }
    }

    let nextStepId = null;
    let matchedCondition = null;

    if (branches && Array.isArray(branches) && branches.length > 0) {
      // New multi-branch evaluation
      console.log(`[EXECUTOR]   Evaluating ${branches.length} condition branches...`);

      for (const branch of branches) {
        const conditionMet = evaluateCondition(branch.condition);
        console.log(`[EXECUTOR]   - ${branch.condition}: ${conditionMet ? '✅ MATCH' : '❌ no match'}`);

        if (conditionMet) {
          matchedCondition = branch.condition;
          nextStepId = branch.next_step_id;
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
      await supabase
        .from('campaign_contacts')
        .update({
          current_step_id: nextStepId,
          next_send_time: new Date().toISOString()
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

  // Move to next step in sequence
  async moveToNextStep(campaignContact, campaignId, currentStep) {
    const { data: nextStep } = await supabase
      .from('campaign_steps')
      .select('id')
      .eq('campaign_id', campaignId)
      .eq('step_order', currentStep.step_order + 1)
      .single();

    if (nextStep) {
      await supabase
        .from('campaign_contacts')
        .update({
          current_step_id: nextStep.id,
          next_send_time: new Date().toISOString()
        })
        .eq('id', campaignContact.id);
    } else {
      // No more steps, mark as completed
      await supabase
        .from('campaign_contacts')
        .update({ status: 'completed' })
        .eq('id', campaignContact.id);
    }
  }

  // Helper to update next send time
  async updateNextSendTime(campaignContactId, nextTime) {
    await supabase
      .from('campaign_contacts')
      .update({ next_send_time: nextTime.toISOString() })
      .eq('id', campaignContactId);
  }
}

module.exports = new CampaignExecutor();
