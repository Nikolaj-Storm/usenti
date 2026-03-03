// content.js - Injected into linkedin.com pages

console.log('[Usenti Content] Content script loaded on LinkedIn.');

// Helper for human-like random delays
const sleep = (min, max) => new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * (max - min + 1) + min)));

// Simulates a human typing by sending keystroke events
async function simulateTyping(element, text) {
    element.focus();
    element.value = ''; // clear it
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        element.value += char;
        // Dispatch input event to trigger React state updates on LinkedIn
        element.dispatchEvent(new Event('input', { bubbles: true }));
        // Wait between 30ms to 100ms between keystrokes
        await sleep(30, 100);
    }
}

// Main dispatcher
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'EXECUTE_LINKEDIN_ACTION') {
        console.log('[Usenti Content] Received task:', message.task);
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
        console.error('[Usenti Content] Task failed:', error);
        chrome.runtime.sendMessage({
            type: 'TASK_FAILED',
            taskId: task.id,
            error: error.message
        });
    }
}

// ----------------------------------------------------------------------------
// ACTION: Send Direct Message
// ----------------------------------------------------------------------------
async function sendLinkedInMessage(task) {
    const messageText = task.payload.message;
    console.log('[Usenti Content] Attempting to send DM...');

    // 1. Wait on page load and do a human-like scroll
    await sleep(1000, 3000);
    window.scrollTo({ top: 300, behavior: 'smooth' });
    await sleep(1000, 2000);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    await sleep(500, 1500);

    // 2. Find the "Message" button on the profile
    // Note: LinkedIn changes these class names frequently. This is a best-effort selector set based on standard layouts.
    const messageButton = document.querySelector('button.pv-s-profile-actions--message')
        || document.querySelector('button[aria-label^="Message"]')
        || Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Message'));

    if (!messageButton) {
        throw new Error('Could not find the Message button on this profile. Might not be connected.');
    }

    // 3. Click it and wait for the chat box to open
    messageButton.click();
    await sleep(2000, 4000);

    // 4. Find the message input area (often a contenteditable div)
    const messageInput = document.querySelector('.msg-form__contenteditable')
        || document.querySelector('div[role="textbox"][aria-label="Write a message…"]');

    if (!messageInput) {
        throw new Error('Message chat box did not open properly.');
    }

    // 5. Simulate typing the personalized message
    // For contenteditable, we update the p tag or textContent
    if (messageInput.isContentEditable) {
        messageInput.focus();
        messageInput.innerHTML = `<p>${messageText}</p>`;
        // dispatch an input event so their React stack catches it
        messageInput.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
        await simulateTyping(messageInput, messageText);
    }

    await sleep(1000, 2500);

    // 6. Click send
    const sendButton = document.querySelector('button.msg-form__send-button')
        || Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Send'));

    if (!sendButton || sendButton.disabled) {
        throw new Error('Send button not found or disabled.');
    }

    sendButton.click();
    console.log('[Usenti Content] Message sent successfully!');

    // 7. Mark complete with extension
    chrome.runtime.sendMessage({
        type: 'TASK_COMPLETED',
        taskId: task.id,
        result: { success: true, timestamp: new Date().toISOString() }
    });
}

// ----------------------------------------------------------------------------
// ACTION: Send Connection Request
// ----------------------------------------------------------------------------
async function sendConnectionRequest(task) {
    const messageText = task.payload.message || '';
    console.log('[Usenti Content] Attempting to send Connection Request...');

    // 1. Wait on page load and do a human-like scroll
    await sleep(1000, 3000);
    window.scrollTo({ top: 300, behavior: 'smooth' });
    await sleep(1000, 2000);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    await sleep(500, 1500);

    // 2. Find the "Connect" button on the profile
    let connectButton = document.querySelector('button.pv-s-profile-actions--connect')
        || document.querySelector('button[aria-label^="Invite"]')
        || Array.from(document.querySelectorAll('button')).find(b => b.innerText.trim() === 'Connect' || b.innerText.trim() === 'Pending');

    if (connectButton && connectButton.innerText.trim() === 'Pending') {
        throw new Error('Connection request is already pending.');
    }

    if (!connectButton) {
        // Try looking inside the "More" dropdown
        const moreButton = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('More'));
        if (moreButton) {
            moreButton.click();
            await sleep(500, 1000);
            connectButton = Array.from(document.querySelectorAll('.artdeco-dropdown__item')).find(b => b.innerText.includes('Connect'));
        }
    }

    if (!connectButton) {
        throw new Error('Could not find the Connect button on this profile.');
    }

    // 3. Click "Connect"
    connectButton.click();
    await sleep(1500, 3000);

    // 4. Handle "Add a note" vs "Send" modal
    const addNoteButton = document.querySelector('button[aria-label="Add a note"]')
        || Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Add a note'));

    if (addNoteButton && messageText.trim() !== '') {
        addNoteButton.click();
        await sleep(1000, 2000);

        const customMessageInput = document.querySelector('textarea[name="message"]')
            || document.querySelector('#custom-message');

        if (customMessageInput) {
            await simulateTyping(customMessageInput, messageText);
            await sleep(1000, 2000);
        }
    }

    // 5. Click "Send"
    const sendButton = document.querySelector('button[aria-label="Send now"]')
        || document.querySelector('button[aria-label="Send invitation"]')
        || Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Send') && !b.innerText.includes('message'));

    if (!sendButton || sendButton.disabled) {
        throw new Error('Send button not found or disabled in the connection modal.');
    }

    sendButton.click();
    console.log('[Usenti Content] Connection request sent successfully!');

    // 6. Mark complete with extension
    chrome.runtime.sendMessage({
        type: 'TASK_COMPLETED',
        taskId: task.id,
        result: { success: true, timestamp: new Date().toISOString() }
    });
}
