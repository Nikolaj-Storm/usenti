document.addEventListener('DOMContentLoaded', async () => {
    const linkBtn = document.getElementById('link-btn');
    const statusEl = document.getElementById('connection-status');
    const taskCountEl = document.getElementById('task-count');
    const userRow = document.getElementById('user-email-row');
    const userEmail = document.getElementById('user-email');

    // Load existing state
    const data = await chrome.storage.local.get(['usentiToken', 'usentiUser']);

    if (data.usentiToken && data.usentiUser) {
        updateUIConnected(data.usentiUser);
    }

    // Fetch latest task count
    updateTaskCount();

    linkBtn.addEventListener('click', async () => {
        // Determine the frontend URL (could be local or prod)
        // We try to find an open Usenti tab to extract the token
        const tabs = await chrome.tabs.query({ url: ["http://localhost:3000/*", "https://nikolaj-storm.github.io/*"] });

        if (tabs.length === 0) {
            alert("Please open your Usenti Dashboard and log in first.");
            chrome.tabs.create({ url: "https://nikolaj-storm.github.io/usenti/" });
            return;
        }

        // Extract token from the active tab's localStorage
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

                // Notify background worker to register the extension ID
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
        linkBtn.onclick = async () => {
            await chrome.storage.local.remove(['usentiToken', 'usentiUser']);
            window.close(); // Refresh popup
        };
        userRow.style.display = 'flex';
        userEmail.textContent = user.email;
    }

    function updateTaskCount() {
        chrome.storage.local.get(['pendingTasksCount'], (res) => {
            taskCountEl.textContent = res.pendingTasksCount || 0;
        });
    }

    // Update count every 5 seconds while popup is open
    setInterval(updateTaskCount, 5000);
});
