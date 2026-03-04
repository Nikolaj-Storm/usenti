// content.js — Injected into linkedin.com pages
// Performs LinkedIn actions (DM, connection request) on behalf of the user

console.log('[Usenti] Content script loaded on LinkedIn.');

// Human-like random delay
const sleep = (min, max) => new Promise(resolve =>
    setTimeout(resolve, Math.floor(Math.random() * (max - min + 1) + min))
);

// Wait for an element to appear with polling (up to 30s)
async function waitForElement(selectorOrFinder, timeoutMs = 30000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        let el;
        if (typeof selectorOrFinder === 'function') {
            el = selectorOrFinder();
        } else {
            el = document.querySelector(selectorOrFinder);
        }
        if (el) return el;
        await sleep(500, 1000);
    }
    return null;
}

// Simulate human typing with keystroke events
async function simulateTyping(element, text) {
    element.focus();
    element.value = '';
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        element.value += char;
        element.dispatchEvent(new Event('input', { bubbles: true }));
        await sleep(25, 90);
    }
}

// Main dispatcher
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'EXECUTE_LINKEDIN_ACTION') {
        console.log('[Usenti] Received task:', message.task.action_type);
        executeAction(message.task);
    }
});

async function executeAction(task) {
    try {
        if (task.action_type === 'linkedin_dm') {
            await sendLinkedInMessage(task);
        } else if (task.action_type === 'linkedin_connection_request') {
            await sendConnectionRequest(task);
        }
    } catch (error) {
        console.error('[Usenti] Task failed:', error.message);
        chrome.runtime.sendMessage({
            type: 'TASK_FAILED',
            taskId: task.id,
            taskType: task.action_type,
            error: error.message
        });
    }
}

// ---------------------------------------------------------------------------
// ACTION: Send Direct Message
// ---------------------------------------------------------------------------
async function sendLinkedInMessage(task) {
    const messageText = task.payload.message;
    console.log('[Usenti] Attempting to send DM...');

    // Wait for page to stabilize
    await sleep(2000, 4000);

    // Scroll naturally
    window.scrollTo({ top: 300, behavior: 'smooth' });
    await sleep(1000, 2000);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    await sleep(1000, 2000);

    // Find the Message button with robust selector chain
    const messageButton = await waitForElement(() => {
        return document.querySelector('button.pv-s-profile-actions--message')
            || document.querySelector('button[aria-label*="Message"]')
            || Array.from(document.querySelectorAll('button')).find(b =>
                b.innerText.trim() === 'Message' && !b.closest('.artdeco-dropdown')
            );
    }, 15000);

    if (!messageButton) {
        throw new Error('Could not find the Message button. The user may not be a connection.');
    }

    messageButton.click();
    await sleep(2500, 4000);

    // Find the message input area
    const messageInput = await waitForElement(() => {
        return document.querySelector('.msg-form__contenteditable')
            || document.querySelector('div[role="textbox"][aria-label*="message"]')
            || document.querySelector('div[role="textbox"][aria-label*="Message"]');
    }, 10000);

    if (!messageInput) {
        throw new Error('Message chat box did not open. The profile layout may have changed.');
    }

    // Type the personalized message
    if (messageInput.isContentEditable) {
        messageInput.focus();
        await sleep(300, 600);
        messageInput.innerHTML = `<p>${messageText}</p>`;
        messageInput.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
        await simulateTyping(messageInput, messageText);
    }

    await sleep(1500, 3000);

    // Click send
    const sendButton = await waitForElement(() => {
        return document.querySelector('button.msg-form__send-button')
            || document.querySelector('button[type="submit"][class*="msg-form"]')
            || Array.from(document.querySelectorAll('button')).find(b =>
                b.innerText.trim() === 'Send' && b.closest('.msg-form')
            );
    }, 5000);

    if (!sendButton || sendButton.disabled) {
        throw new Error('Send button not found or disabled.');
    }

    sendButton.click();
    console.log('[Usenti] Message sent successfully!');

    await sleep(1000, 2000);

    chrome.runtime.sendMessage({
        type: 'TASK_COMPLETED',
        taskId: task.id,
        taskType: task.action_type,
        result: { success: true, timestamp: new Date().toISOString() }
    });
}

// ---------------------------------------------------------------------------
// ACTION: Send Connection Request
// ---------------------------------------------------------------------------
async function sendConnectionRequest(task) {
    const messageText = task.payload.message || '';
    console.log('[Usenti] Attempting to send Connection Request...');

    // Wait for page to stabilize
    await sleep(2000, 4000);

    // Scroll naturally
    window.scrollTo({ top: 300, behavior: 'smooth' });
    await sleep(1000, 2000);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    await sleep(1000, 2000);

    // Find the Connect button
    let connectButton = await waitForElement(() => {
        const btn = document.querySelector('button.pv-s-profile-actions--connect')
            || document.querySelector('button[aria-label*="Invite"]')
            || document.querySelector('button[aria-label*="Connect"]')
            || Array.from(document.querySelectorAll('button')).find(b =>
                b.innerText.trim() === 'Connect' || b.innerText.trim() === 'Pending'
            );
        return btn;
    }, 10000);

    if (connectButton && connectButton.innerText.trim() === 'Pending') {
        throw new Error('Connection request is already pending for this profile.');
    }

    // If not found, look inside the "More" dropdown
    if (!connectButton) {
        const moreButton = Array.from(document.querySelectorAll('button')).find(b =>
            b.innerText.includes('More') || b.getAttribute('aria-label')?.includes('More actions')
        );
        if (moreButton) {
            moreButton.click();
            await sleep(800, 1500);
            connectButton = await waitForElement(() => {
                return Array.from(document.querySelectorAll('.artdeco-dropdown__item, [role="menuitem"]')).find(b =>
                    b.innerText.includes('Connect')
                );
            }, 5000);
        }
    }

    if (!connectButton) {
        throw new Error('Could not find the Connect button. You may already be connected.');
    }

    connectButton.click();
    await sleep(2000, 3500);

    // Handle "Add a note" vs direct "Send"
    if (messageText.trim() !== '') {
        const addNoteButton = await waitForElement(() => {
            return document.querySelector('button[aria-label="Add a note"]')
                || Array.from(document.querySelectorAll('button')).find(b =>
                    b.innerText.includes('Add a note')
                );
        }, 5000);

        if (addNoteButton) {
            addNoteButton.click();
            await sleep(1000, 2000);

            const customMessageInput = await waitForElement(() => {
                return document.querySelector('textarea[name="message"]')
                    || document.querySelector('#custom-message')
                    || document.querySelector('textarea[id*="custom-message"]');
            }, 5000);

            if (customMessageInput) {
                await simulateTyping(customMessageInput, messageText);
                await sleep(1000, 2000);
            }
        }
    }

    // Click Send
    const sendButton = await waitForElement(() => {
        return document.querySelector('button[aria-label="Send now"]')
            || document.querySelector('button[aria-label="Send invitation"]')
            || document.querySelector('button[aria-label*="Send"]')
            || Array.from(document.querySelectorAll('button')).find(b =>
                b.innerText.trim() === 'Send' && !b.innerText.includes('message')
            );
    }, 5000);

    if (!sendButton || sendButton.disabled) {
        throw new Error('Send button not found or disabled in the connection modal.');
    }

    sendButton.click();
    console.log('[Usenti] Connection request sent successfully!');

    await sleep(1000, 2000);

    chrome.runtime.sendMessage({
        type: 'TASK_COMPLETED',
        taskId: task.id,
        taskType: task.action_type,
        result: { success: true, timestamp: new Date().toISOString() }
    });
}
