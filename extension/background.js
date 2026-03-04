let pollInterval;
const POLL_MINUTES = 2;

// Production API URL
const API_URL = 'https://snowman-2-0.onrender.com/api';

// Register alarm on install
chrome.runtime.onInstalled.addListener(() => {
    console.log('[Usenti] Extension installed/updated — v1.1.0');
    chrome.alarms.create('pollTasks', { periodInMinutes: POLL_MINUTES });
});

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'pollTasks') {
        pollForTasks();
    }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'LINK_EXTENSION') {
        registerExtension();
    } else if (message.type === 'TASK_COMPLETED') {
        logActivity(message.taskType || 'task', 'completed');
        markTaskComplete(message.taskId, message.result);
        if (sender.tab && sender.tab.id) {
            chrome.tabs.remove(sender.tab.id);
        }
    } else if (message.type === 'TASK_FAILED') {
        logActivity(message.taskType || 'task', 'failed');
        markTaskFailed(message.taskId, message.error);
        if (sender.tab && sender.tab.id) {
            chrome.tabs.remove(sender.tab.id);
        }
    }
    return true;
});

async function getAuth() {
    const data = await chrome.storage.local.get(['usentiToken', 'usentiUser']);
    return data;
}

async function registerExtension() {
    const { usentiToken } = await getAuth();
    if (!usentiToken) return;

    try {
        const res = await fetch(`${API_URL}/extension/register`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${usentiToken}`,
                'Content-Type': 'application/json'
            }
        });

        if (res.ok) {
            console.log('[Usenti] Extension registered successfully.');
        }
    } catch (e) {
        console.error('[Usenti] Registration failed:', e);
    }
}

async function pollForTasks() {
    const { usentiToken } = await getAuth();
    if (!usentiToken) return;

    console.log('[Usenti] Polling for tasks...');
    try {
        const res = await fetch(`${API_URL}/extension/ping`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${usentiToken}`,
                'Content-Type': 'application/json'
            }
        });

        if (!res.ok) throw new Error('Failed to fetch tasks');

        const { tasks } = await res.json();
        await chrome.storage.local.set({
            pendingTasksCount: tasks.length,
            lastPollTime: new Date().toISOString()
        });

        if (tasks.length > 0) {
            console.log(`[Usenti] Found ${tasks.length} pending tasks. Executing first...`);
            executeTask(tasks[0]);
        }

    } catch (e) {
        console.error('[Usenti] Polling failed:', e);
    }
}

async function executeTask(task) {
    if (task.action_type !== 'linkedin_dm' && task.action_type !== 'linkedin_connection_request') {
        console.warn('[Usenti] Unknown task type:', task.action_type);
        return;
    }

    const linkedinUrl = task.payload.linkedin_url;
    if (!linkedinUrl || !linkedinUrl.includes('linkedin.com/in/')) {
        await markTaskFailed(task.id, 'Invalid or missing LinkedIn profile URL');
        logActivity(task.action_type, 'failed');
        return;
    }

    console.log(`[Usenti] Opening tab for task ${task.id} -> ${linkedinUrl}`);
    logActivity(task.action_type, 'pending');

    // Open the LinkedIn profile in a background tab
    const tab = await chrome.tabs.create({ url: linkedinUrl, active: false });

    // Wait for the LinkedIn SPA to render, then send the action
    // Use a longer delay + retry logic for reliability
    setTimeout(() => {
        console.log(`[Usenti] Sending action to tab ${tab.id}`);
        chrome.tabs.sendMessage(tab.id, {
            type: 'EXECUTE_LINKEDIN_ACTION',
            task: task
        }).catch(err => {
            console.error(`[Usenti] Failed to send message to tab:`, err);
            // Retry once after another delay
            setTimeout(() => {
                chrome.tabs.sendMessage(tab.id, {
                    type: 'EXECUTE_LINKEDIN_ACTION',
                    task: task
                }).catch(retryErr => {
                    console.error(`[Usenti] Retry also failed:`, retryErr);
                    markTaskFailed(task.id, 'Content script not reachable');
                    logActivity(task.action_type, 'failed');
                    chrome.tabs.remove(tab.id).catch(() => { });
                });
            }, 5000);
        });
    }, 10000);
}

async function markTaskComplete(taskId, result) {
    const { usentiToken } = await getAuth();
    if (!usentiToken) return;

    try {
        await fetch(`${API_URL}/extension/task/${taskId}/complete`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${usentiToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ result })
        });
        console.log(`[Usenti] Task ${taskId} completed`);
    } catch (e) {
        console.error(`[Usenti] Failed to mark task complete:`, e);
    }
}

async function markTaskFailed(taskId, errorMsg) {
    const { usentiToken } = await getAuth();
    if (!usentiToken) return;

    try {
        await fetch(`${API_URL}/extension/task/${taskId}/fail`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${usentiToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ error: errorMsg })
        });
        console.error(`[Usenti] Task ${taskId} failed: ${errorMsg}`);
    } catch (e) {
        console.error(`[Usenti] Failed to report task failure:`, e);
    }
}

// Store recent activity for the popup to display
async function logActivity(type, status) {
    const { recentActivity = [] } = await chrome.storage.local.get('recentActivity');
    const entry = { type, status, timestamp: new Date().toISOString() };
    const updated = [entry, ...recentActivity].slice(0, 20);
    await chrome.storage.local.set({ recentActivity: updated });
}
