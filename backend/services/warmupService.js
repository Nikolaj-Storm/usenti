const supabase = require('../config/supabase');
const emailService = require('./emailService');
const warmupTemplates = require('../utils/warmupTemplates');

function getRandomItem(array) {
    return array[Math.floor(Math.random() * array.length)];
}

function generateWarmupContent(tag) {
    return warmupTemplates.generateDynamicContent(tag);
}

/**
 * Main function to process the sending side of warmup.
 * Ran continuously via cron.
 */
async function processWarmup() {
    console.log('[WARMUP-SERVICE] 🚀 Starting warmup send cycle...');

    try {
        // 1. Get all active warmup settings where network_opt_in is true
        const { data: settings, error: settingsError } = await supabase
            .from('email_warmup_settings')
            .select('*, email_accounts!inner(*)')
            .eq('status', 'active')
            .eq('network_opt_in', true);

        if (settingsError) throw settingsError;
        if (!settings || settings.length === 0) {
            console.log('[WARMUP-SERVICE] No active warmup accounts found.');
            return;
        }

        // 2. Identify potential peers (active accounts in warmup pool)
        const activePeers = settings.map(s => s.email_accounts);
        if (activePeers.length < 2) {
            console.log('[WARMUP-SERVICE] Not enough active peers to send warmup emails.');
            return;
        }

        // Time logic for scheduling
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const msPassedToday = now.getTime() - startOfDay.getTime();
        const minutesPassedToday = Math.floor(msPassedToday / 60000);
        // Assuming cron runs every 15 mins
        const ticksRemainingToday = Math.max(1, Math.ceil((1440 - minutesPassedToday) / 15));

        for (const setting of settings) {
            const sender = setting.email_accounts;

            // Update ramp-up if needed
            let currentLimit = setting.current_daily_limit;
            const lastRampDate = new Date(setting.last_ramp_up_date);
            const today = new Date();

            if (lastRampDate.toDateString() !== today.toDateString()) {
                if (currentLimit < setting.daily_send_limit) {
                    currentLimit = Math.min(setting.daily_send_limit, currentLimit + setting.ramp_up_per_day);
                    await supabase
                        .from('email_warmup_settings')
                        .update({
                            current_daily_limit: currentLimit,
                            last_ramp_up_date: today.toISOString().split('T')[0]
                        })
                        .eq('id', setting.id);
                    console.log(`[WARMUP-SERVICE] 📈 Ramped up limit for ${sender.email_address} to ${currentLimit}`);
                }
            }

            // Check how many we sent today
            const { count: sentToday, error: countError } = await supabase
                .from('email_warmup_logs')
                .select('*', { count: 'exact', head: true })
                .eq('sender_account_id', sender.id)
                .eq('action_type', 'sent')
                .gte('created_at', today.toISOString().split('T')[0]);

            if (countError) {
                console.error(`[WARMUP-SERVICE] Error checking sent count for ${sender.email_address}:`, countError);
                continue;
            }

            if (sentToday >= currentLimit) {
                console.log(`[WARMUP-SERVICE] ⏸️ ${sender.email_address} reached daily limit (${sentToday}/${currentLimit})`);
                continue;
            }

            // Calculate precise probability based on remaining day and remaining emails
            const emailsRemaining = currentLimit - sentToday;
            const probability = Math.min(1.0, emailsRemaining / ticksRemainingToday);

            console.log(`[WARMUP-SERVICE] ${sender.email_address} needs ${emailsRemaining} more. Ticks left: ${ticksRemainingToday}. Prob: ${(probability * 100).toFixed(1)}%`);

            // Execute probability check
            if (Math.random() > probability) continue;

            // Pick a random peer that is NOT this sender
            const peers = activePeers.filter(p => p.id !== sender.id);
            if (peers.length === 0) continue;

            const recipient = getRandomItem(peers);

            // Calculate a random delay up to 14 minutes (840,000 ms) 
            // so emails fire at completely random, specific times between cron ticks.
            const maxDelayMs = 14 * 60 * 1000;
            const delayMs = Math.floor(Math.random() * maxDelayMs);

            console.log(`[WARMUP-SERVICE] 🕒 Scheduled warmup email from ${sender.email_address} to fire in ${(delayMs / 1000).toFixed(0)} seconds...`);

            setTimeout(async () => {
                // Double check it wasn't cancelled or anything? Not strictly necessary for this scale.
                await sendWarmupEmail(sender, recipient, setting.warmup_tag);
            }, delayMs);
        }

    } catch (err) {
        console.error('[WARMUP-SERVICE] ❌ Fatal error in processWarmup:', err);
    }
}

/**
 * Sends a single warmup email between two accounts
 */
async function sendWarmupEmail(sender, recipient, tag) {
    console.log(`[WARMUP-SERVICE] ✉️ Sending warmup email from ${sender.email_address} to ${recipient.email_address}`);

    const content = generateWarmupContent(tag);

    try {
        const result = await emailService.sendEmail({
            emailAccountId: sender.id,
            to: recipient.email_address,
            subject: content.subject,
            body: content.body,
            trackOpens: false,
            trackClicks: false
        });

        // Log success
        await supabase.from('email_warmup_logs').insert({
            sender_account_id: sender.id,
            recipient_account_id: recipient.id,
            action_type: 'sent',
            message_id: result.messageId,
            status: 'success'
        });

    } catch (err) {
        console.error(`[WARMUP-SERVICE] ❌ Failed to send warmup email:`, err);
        await supabase.from('email_warmup_logs').insert({
            sender_account_id: sender.id,
            recipient_account_id: recipient.id,
            action_type: 'sent',
            status: 'failed',
            error_message: err.message
        });
    }
}

/**
 * Process incoming emails to find warmup emails and reply/mark important
 * This depends on inbox_messages being populated by IMAP monitor
 */
async function processIncomingWarmup() {
    console.log('[WARMUP-SERVICE] 📥 Processing incoming warmup emails...');

    try {
        // 1. Get active settings
        // 1. Get active settings opted into network
        const { data: settings, error: settingsError } = await supabase
            .from('email_warmup_settings')
            .select('*, email_accounts!inner(*)')
            .eq('status', 'active')
            .eq('network_opt_in', true);

        if (settingsError || !settings) return;

        for (const setting of settings) {
            const account = setting.email_accounts;
            const tag = setting.warmup_tag;

            // ========== ADVANCED: SPAM RESCUE ==========
            // Decide if we should do a spam rescue pass based on spam_save_rate_percent
            if (setting.spam_save_rate_percent > 0 && Math.random() * 100 <= setting.spam_save_rate_percent) {
                const imapMonitor = require('./imapMonitor');
                try {
                    const movedMessageIds = await imapMonitor.searchSpamAndMoveToInbox(account, tag);

                    if (movedMessageIds && movedMessageIds.length > 0) {
                        for (const msgUid of movedMessageIds) {
                            await supabase.from('email_warmup_logs').insert({
                                sender_account_id: account.id, // For 'moved_from_spam', this account is the actor
                                action_type: 'moved_from_spam',
                                message_id: `spam-rescue-uid-(IMAP_UID)`, // We don't have the explicit Message-ID easily from imap.move array
                                status: 'success'
                            });
                        }
                    }
                } catch (spamErr) {
                    console.error(`[WARMUP-SERVICE] Error rescuing from Spam for ${account.email_address}:`, spamErr);
                }
            }

            // ========== PROCESS INBOX ==========
            // Find unread inbox messages for this account that might be warmup emails
            // We check if the body contains the hidden tag
            const { data: messages, error: msgError } = await supabase
                .from('inbox_messages')
                .select('*')
                .eq('email_account_id', account.id)
                .eq('is_read', false)
                .ilike('body_html', `%[${tag}]%`)
                .limit(10);

            if (msgError || !messages || messages.length === 0) continue;

            for (const msg of messages) {
                console.log(`[WARMUP-SERVICE] Found warmup email for ${account.email_address} (Message ID: ${msg.message_id})`);

                // 1. Mark as read in DB
                await supabase
                    .from('inbox_messages')
                    .update({ is_read: true, is_answered: true })
                    .eq('id', msg.id);

                // 2. Apply IMAP Engagement (Read, Important, Archive)
                const imapMonitor = require('./imapMonitor');
                try {
                    await imapMonitor.applyWarmupEngagement(account, msg.message_id, {
                        markRead: true,
                        markImportant: true,
                        archive: true // Instantly typically archives to keep inbox clean
                    });
                } catch (engageErr) {
                    console.error(`[WARMUP-SERVICE] Failed to apply IMAP engagement for ${account.email_address}:`, engageErr);
                }

                // 3. We log the receive action. Must resolve the true sender_account_id from from_address
                let trueSenderId = account.id; // Fallback
                try {
                    const fromEmailMatch = msg.from_address.match(/<(.+)>/);
                    const cleanFromEmail = fromEmailMatch ? fromEmailMatch[1].trim() : msg.from_address.trim();

                    const { data: senderAccount } = await supabase
                        .from('email_accounts')
                        .select('id')
                        .eq('email_address', cleanFromEmail)
                        .single();

                    if (senderAccount) {
                        trueSenderId = senderAccount.id;
                    }
                } catch (e) {
                    console.error('[WARMUP-SERVICE] Failed to resolve true sender ID for receive log:', e);
                }

                await supabase.from('email_warmup_logs').insert({
                    sender_account_id: trueSenderId, // The actual person who sent it
                    recipient_account_id: account.id, // The person who received it
                    action_type: 'received',
                    message_id: msg.message_id,
                    status: 'success'
                });

                // 4. Decide to reply based on reply_rate_percent
                if (Math.random() * 100 <= setting.reply_rate_percent) {
                    // Calculate a random delay between 5 minutes and 45 minutes for realistic replies
                    const minReplyDelayMs = 5 * 60 * 1000;
                    const maxReplyDelayMs = 45 * 60 * 1000;
                    const replyDelayMs = Math.floor(Math.random() * (maxReplyDelayMs - minReplyDelayMs + 1)) + minReplyDelayMs;

                    console.log(`[WARMUP-SERVICE] 🕒 Scheduled reply to warmup email on ${account.email_address} in ${(replyDelayMs / 60000).toFixed(0)} minutes...`);

                    setTimeout(async () => {
                        // Use Spintax engine in Reply mode
                        const replyContent = warmupTemplates.generateDynamicContent(tag, true);

                        // Add standard threading headers based on original Message-ID
                        try {
                            const replyResult = await emailService.sendEmail({
                                emailAccountId: account.id,
                                to: msg.from_address,
                                subject: msg.subject.startsWith('Re:') ? msg.subject : `Re: ${msg.subject}`,
                                body: replyContent.body,
                                trackOpens: false,
                                trackClicks: false,
                                inReplyTo: msg.message_id,
                                references: msg.message_id
                            });

                            await supabase.from('email_warmup_logs').insert({
                                sender_account_id: account.id, // We are now the sender of the reply
                                recipient_account_id: trueSenderId, // Replying back to the original sender
                                action_type: 'replied',
                                message_id: replyResult.messageId,
                                status: 'success'
                            });
                        } catch (replyErr) {
                            console.error(`[WARMUP-SERVICE] ❌ Failed to reply:`, replyErr);
                        }
                    }, replyDelayMs);
                }
            }
        }
    } catch (err) {
        console.error('[WARMUP-SERVICE] ❌ Fatal error in processIncomingWarmup:', err);
    }
}

module.exports = {
    processWarmup,
    processIncomingWarmup,
    sendWarmupEmail,
    generateWarmupContent
};
