const fs = require('fs');
let code = fs.readFileSync('services/imapMonitor.js', 'utf8');

const fallback = `    // Fallback for OAuth accounts missing explicit IMAP settings
    if (account.provider_type === 'gmail_oauth') {
      account.imap_host = account.imap_host || 'imap.gmail.com';
      account.imap_username = account.imap_username || account.email_address;
      account.imap_port = account.imap_port || 993;
    } else if (account.provider_type === 'microsoft_oauth') {
      account.imap_host = account.imap_host || 'outlook.office365.com';
      account.imap_username = account.imap_username || account.email_address;
      account.imap_port = account.imap_port || 993;
    }`;

const doubleFallback = fallback + '\n\n' + fallback;

code = code.replace(doubleFallback, fallback);

fs.writeFileSync('services/imapMonitor.js', code);
