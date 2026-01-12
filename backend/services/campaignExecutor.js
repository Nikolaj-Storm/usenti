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
    console.log('[EXECUTOR] Starting campaign execution cycle...');

    try {
      // Get pending campaign contacts that are ready to send
      const { data: pending, error } = await supabase
        .from('campaign_contacts')
        .select(`
          *,
          campaigns!inner(
            id,
            name,
            email_account_id,
            send_schedule,
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

      if (error) throw error;

      if (!pending || pending.length === 0) {
        console.log('[EXECUTOR] No pending emails to send');
        return;
      }

      console.log(`[EXECUTOR] Found ${pending.length} emails to process`);

      for (const item of pending) {
        try {
          await this.processCampaignContact(item);
        } catch (err) {
          console.error(`[EXECUTOR] Error processing contact ${item.id}:`, err.message);
        }
      }

      console.log('[EXECUTOR] Cycle complete');
    } catch (error) {
      console.error('[EXECUTOR] Execution error:', error);
    } finally {
      this.processing = false;
    }
  }

  // Process a single campaign contact
  async processCampaignContact(campaignContact) {
    const { campaigns: campaign, contacts: contact, campaign_steps: step } = campaignContact;

    // Check if within send schedule
    if (!emailService.isWithinSchedule(campaign.send_schedule)) {
      console.log(`[EXECUTOR] Outside schedule for campaign ${campaign.id}, rescheduling...`);
      const nextTime = emailService.getNextSendTime(campaign.send_schedule);
      await this.updateNextSendTime(campaignContact.id, nextTime);
      return;
    }

    // Check daily limit
    const withinLimit = await emailService.checkDailyLimit(
      campaign.email_account_id,
      campaign.id
    );

    if (!withinLimit) {
      console.log(`[EXECUTOR] Daily limit reached for campaign ${campaign.id}`);
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0);
      await this.updateNextSendTime(campaignContact.id, tomorrow);
      return;
    }

    // Process based on step type
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
        console.error(`[EXECUTOR] Unknown step type: ${step.step_type}`);
    }
  }

  // Handle email step
  async handleEmailStep(campaignContact, campaign, contact, step) {
    try {
      // Personalize content
      const personalizedSubject = emailService.personalizeContent(
        step.subject || 'No Subject',
        contact
      );
      const personalizedBody = emailService.personalizeContent(
        step.body || '',
        contact
      );

      // Send email
      await emailService.sendEmail({
        emailAccountId: campaign.email_account_id,
        to: contact.email,
        subject: personalizedSubject,
        body: personalizedBody,
        campaignId: campaign.id,
        contactId: contact.id,
        trackOpens: true,
        trackClicks: true
      });

      console.log(`[EXECUTOR] ✓ Sent email to ${contact.email} (Campaign: ${campaign.name})`);

      // Move to next step
      await this.moveToNextStep(campaignContact, campaign.id, step);
    } catch (error) {
      console.error(`[EXECUTOR] ✗ Failed to send to ${contact.email}:`, error.message);
      
      // Mark as failed
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
