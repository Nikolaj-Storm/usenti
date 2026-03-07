const fs = require('fs');
let code = fs.readFileSync('services/imapMonitor.js', 'utf8');

const fallbackLogic = `
    // Fallback for OAuth accounts missing explicit IMAP settings
    if (account.provider_type === 'gmail_oauth') {
      account.imap_host = account.imap_host || 'imap.gmail.com';
      account.imap_username = account.imap_username || account.email_address;
      account.imap_port = account.imap_port || 993;
    } else if (account.provider_type === 'microsoft_oauth') {
      account.imap_host = account.imap_host || 'outlook.office365.com';
      account.imap_username = account.imap_username || account.email_address;
      account.imap_port = account.imap_port || 993;
    }
`;

// Inject into startMonitoring
code = code.replace(
  /async startMonitoring\(account\) \{[\s\S]*?\/\/ Skip if already monitoring/,
  `async startMonitoring(account) {` + fallbackLogic + `\n    // Skip if already monitoring`
);

// Inject into syncInbox (after fetching account)
code = code.replace(
  /if \(accountError \|\| !account\) \{[\s\S]+?return reject\(new Error\('Email account not found'\)\);\s+\}/,
  `if (accountError || !account) {
          console.error(\`[\${requestId}] Account not found:\`, accountError?.message);
          return reject(new Error('Email account not found'));
        }` + fallbackLogic
);

// Inject into fetchEmailContent (after fetching account)
code = code.replace(
  /if \(accountError \|\| !account\) \{[\s\S]+?return reject\(new Error\('Email account not found'\)\);\s+\}/g,
  `if (accountError || !account) {
          return reject(new Error('Email account not found'));
        }` + fallbackLogic
);

// Inject into searchSpamAndMoveToInbox (already has account prop passed in)
code = code.replace(
  /searchSpamAndMoveToInbox\(account, tag\) \{/,
  `searchSpamAndMoveToInbox(account, tag) {` + fallbackLogic
);

// Inject into applyWarmupEngagement (already has account prop passed in)
code = code.replace(
  /applyWarmupEngagement\(account, messageId, options = \{ markRead: true, markImportant: true, archive: true \}\) \{/,
  `applyWarmupEngagement(account, messageId, options = { markRead: true, markImportant: true, archive: true }) {` + fallbackLogic
);

fs.writeFileSync('services/imapMonitor.js', code);
