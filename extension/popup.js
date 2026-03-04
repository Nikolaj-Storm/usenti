document.addEventListener('DOMContentLoaded', async () => {
    const linkBtn = document.getElementById('link-btn');
    const statusEl = document.getElementById('connection-status');
    const taskCountEl = document.getElementById('task-count');
    const userRow = document.getElementById('user-email-row');
    const userEmail = document.getElementById('user-email');
    const lastPollRow = document.getElementById('last-poll-row');
    const lastPollEl = document.getElementById('last-poll');
    const activitySection = document.getElementById('activity-section');
    const activityList = document.getElementById('activity-list');

    // Load existing state
    const data = await chrome.storage.local.get(['usentiToken', 'usentiUser', 'lastPollTime', 'recentActivity']);

    if (data.usentiToken && data.usentiUser) {
        updateUIConnected(data.usentiUser);
    }

    if (data.lastPollTime) {
        updateLastPoll(data.lastPollTime);
    }

    if (data.recentActivity && data.recentActivity.length > 0) {
        renderActivity(data.recentActivity);
    }

    updateTaskCount();

    linkBtn.addEventListener('click', async () => {
        // Check if already linked — if so, unlink
        const current = await chrome.storage.local.get(['usentiToken']);
        if (current.usentiToken) {
            await chrome.storage.local.remove(['usentiToken', 'usentiUser', 'recentActivity', 'lastPollTime']);
            location.reload();
            return;
        }

        // Try to find an open Usenti tab
        const tabs = await chrome.tabs.query({
            url: [
                "http://localhost:3000/*",
                "https://nikolaj-storm.github.io/*",
                "https://*.usenti.com/*",
                "https://usenti.com/*"
            ]
        });

        if (tabs.length === 0) {
            alert("Please open your Usenti Dashboard and log in first.");
            chrome.tabs.create({ url: "https://nikolaj-storm.github.io/usenti/" });
            return;
        }

        try {
            const results = await chrome.scripting.executeScript({
                target: { tabId: tabs[0].id },
                func: () => {
                    return {
                        token: localStorage.getItem('usenti_live_token'),
                        user: JSON.parse(localStorage.getItem('usenti_live_user') || 'null')
                    };
                }
            });

            const { token, user } = results[0].result;

            if (token && user) {
                await chrome.storage.local.set({ usentiToken: token, usentiUser: user });
                updateUIConnected(user);
                chrome.runtime.sendMessage({ type: 'LINK_EXTENSION' });
            } else {
                alert("You must be logged into Usenti first.");
            }
        } catch (e) {
            alert("Error linking account: " + e.message);
        }
    });

    function updateUIConnected(user) {
        statusEl.innerHTML = '<span class="status-indicator status-active"></span> Linked';
        statusEl.style.color = '#34D399';
        linkBtn.textContent = 'Unlink Account';
        linkBtn.className = 'btn btn-danger';
        userRow.style.display = 'flex';
        userEmail.textContent = user.email;
        lastPollRow.style.display = 'flex';
        activitySection.style.display = 'block';
    }

    function updateLastPoll(timestamp) {
        if (!timestamp) return;
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 1) {
            lastPollEl.textContent = 'Just now';
        } else if (diffMins < 60) {
            lastPollEl.textContent = `${diffMins}m ago`;
        } else {
            lastPollEl.textContent = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
    }

    function renderActivity(activities) {
        if (!activities || activities.length === 0) {
            activityList.innerHTML = '<div class="empty-activity">No recent activity</div>';
            return;
        }

        activityList.innerHTML = activities.slice(0, 5).map(a => {
            const dotClass = a.status === 'completed' ? 'dot-success' : a.status === 'failed' ? 'dot-error' : 'dot-pending';
            const timeStr = new Date(a.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const label = a.type === 'linkedin_dm' ? 'DM sent' : a.type === 'linkedin_connection_request' ? 'Connect sent' : a.type;
            return `<div class="activity-item">
                <div class="activity-dot ${dotClass}"></div>
                <span class="activity-text">${label}</span>
                <span class="activity-time">${timeStr}</span>
            </div>`;
        }).join('');
    }

    function updateTaskCount() {
        chrome.storage.local.get(['pendingTasksCount', 'lastPollTime', 'recentActivity'], (res) => {
            taskCountEl.textContent = res.pendingTasksCount || 0;
            if (res.lastPollTime) updateLastPoll(res.lastPollTime);
            if (res.recentActivity) renderActivity(res.recentActivity);
        });
    }

    // Update count every 5 seconds while popup is open
    setInterval(updateTaskCount, 5000);
});
