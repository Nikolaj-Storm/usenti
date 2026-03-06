const cron = require('node-cron');
const warmupService = require('../services/warmupService');

/**
 * Initializes the warmup cron jobs.
 * This should be called from server.js when ready to enable the feature.
 */
function initWarmupCron() {
    console.log('[WARMUP-CRON] 🕒 Initializing warmup cron jobs...');

    // 1. Process sending warmup emails. 
    // Runs every 15 minutes, but the service logic has probabilistic backoff 
    // to ensure sends are distributed throughout the day.
    cron.schedule('*/15 * * * *', async () => {
        console.log('[WARMUP-CRON] 🔄 Triggering processWarmup()...');
        try {
            await warmupService.processWarmup();
        } catch (err) {
            console.error('[WARMUP-CRON] Error running processWarmup:', err);
        }
    });

    // 2. Process incoming warmup emails (mark important, reply)
    // Runs every 10 minutes to quickly catch unread emails.
    cron.schedule('*/10 * * * *', async () => {
        console.log('[WARMUP-CRON] 📥 Triggering processIncomingWarmup()...');
        try {
            await warmupService.processIncomingWarmup();
        } catch (err) {
            console.error('[WARMUP-CRON] Error running processIncomingWarmup:', err);
        }
    });

    console.log('[WARMUP-CRON] ✅ Warmup cron jobs scheduled.');
}

module.exports = {
    initWarmupCron
};
