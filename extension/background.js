let pollInterval;
const POLL_MINUTES = 2; // Poll every 2 minutes

// Register an alarm to poll the server
chrome.runtime.onInstalled.addListener(() => {
    console.log('[Usenti Background] Extension installed/updated.');
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
        markTaskComplete(message.taskId, message.result);
        if (sender.tab && sender.tab.id) {
            chrome.tabs.remove(sender.tab.id);
        }
    } else if (message.type === 'TASK_FAILED') {
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

// In a real app, API_URL should be configurable or point to Prod
const API_URL = 'https://usenti-2-0.onrender.com/api';

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
            console.log('[Usenti Background] Extension registered successfully.');
        }
    } catch (e) {
        console.error('[Usenti Background] Registration failed:', e);
    }
}

async function pollForTasks() {
    const { usentiToken } = await getAuth();
    if (!usentiToken) return;

    console.log('[Usenti Background] Polling for tasks...');
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
        await chrome.storage.local.set({ pendingTasksCount: tasks.length });

        if (tasks.length > 0) {
            console.log(`[Usenti Background] Found ${tasks.length} pending tasks. Executing first one...`);
            executeTask(tasks[0]);
        }

    } catch (e) {
        console.error('[Usenti Background] Polling failed:', e);
    }
}

async function executeTask(task) {
    if (task.action_type !== 'linkedin_dm' && task.action_type !== 'linkedin_connection_request') {
        console.warn('Unknown task type:', task.action_type);
        return;
    }

    const linkedinUrl = task.payload.linkedin_url;
    if (!linkedinUrl || !linkedinUrl.includes('linkedin.com/in/')) {
        await markTaskFailed(task.id, 'Invalid LinkedIn URL');
        return;
    }

    console.log(`[Usenti Background] Opening tab for task ${task.id} -> ${linkedinUrl}`);

    // Open the LinkedIn profile in a new, inactive tab
    const tab = await chrome.tabs.create({ url: linkedinUrl, active: false });

    // Wait a few seconds for the page to load, then inject the content script action
    // In a real robust system, you'd use webNavigation events or let the content script ping background
    setTimeout(() => {
        console.log(`[Usenti Background] Sending action to tab ${tab.id}`);
        chrome.tabs.sendMessage(tab.id, {
            type: 'EXECUTE_LINKEDIN_ACTION',
            task: task
        });
    }, 10000); // Wait 10s for LinkedIn SPA to render
}

async function markTaskComplete(taskId, result) {
    const { usentiToken } = await getAuth();
    if (!usentiToken) return;

    await fetch(`${API_URL}/extension/task/${taskId}/complete`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${usentiToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ result })
    });
    console.log(`[Usenti Background] Task ${taskId} marked complete`);
}

async function markTaskFailed(taskId, errorMsg) {
    const { usentiToken } = await getAuth();
    if (!usentiToken) return;

    await fetch(`${API_URL}/extension/task/${taskId}/fail`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${usentiToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ error: errorMsg })
    });
    console.error(`[Usenti Background] Task ${taskId} marked failed: ${errorMsg}`);
}
