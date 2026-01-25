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
            condition_type,
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

  // Handle wait step
  async handleWaitStep(campaignContact, campaign, step) {
    const waitDays = step.wait_days || 3;
    const nextSendTime = new Date();
    nextSendTime.setDate(nextSendTime.getDate() + waitDays);

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

      console.log(`[EXECUTOR] ⏱ Wait ${waitDays} days for contact ${campaignContact.contact_id}`);
    } else {
      // No more steps, mark as completed
      await supabase
        .from('campaign_contacts')
        .update({ status: 'completed' })
        .eq('id', campaignContact.id);

      console.log(`[EXECUTOR] ✓ Campaign completed for contact ${campaignContact.contact_id}`);
    }
  }

  // Handle condition step
  async handleConditionStep(campaignContact, campaign, step) {
    // Get events for this contact
    const { data: events } = await supabase
      .from('email_events')
      .select('event_type')
      .eq('campaign_id', campaign.id)
      .eq('contact_id', campaignContact.contact_id);

    let conditionMet = false;

    // Evaluate condition
    switch (step.condition_type) {
      case 'if_opened':
        conditionMet = events.some(e => e.event_type === 'opened');
        break;
      case 'if_not_opened':
        conditionMet = !events.some(e => e.event_type === 'opened');
        break;
      case 'if_clicked':
        conditionMet = events.some(e => e.event_type === 'clicked');
        break;
      case 'if_replied':
        conditionMet = events.some(e => e.event_type === 'replied');
        break;
      default:
        conditionMet = false;
    }

    const nextStepId = conditionMet 
      ? step.next_step_if_true 
      : step.next_step_if_false;

    if (nextStepId) {
      await supabase
        .from('campaign_contacts')
        .update({
          current_step_id: nextStepId,
          next_send_time: new Date().toISOString()
        })
        .eq('id', campaignContact.id);

      console.log(`[EXECUTOR] 🔀 Condition ${step.condition_type}: ${conditionMet ? 'TRUE' : 'FALSE'}`);
    } else {
      // No next step defined, mark as completed
      await supabase
        .from('campaign_contacts')
        .update({ status: 'completed' })
        .eq('id', campaignContact.id);
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
