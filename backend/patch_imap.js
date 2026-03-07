const fs = require('fs');
const file = './services/imapMonitor.js';
let code = fs.readFileSync(file, 'utf8');

const helperMethod = `
  // Helper to fetch credentials or OAuth token for IMAP
  async getImapAuthParams(account, requestId = '') {
    if (account.provider_type === 'gmail_oauth' || account.provider_type === 'microsoft_oauth') {
      try {
        const service = account.provider_type === 'gmail_oauth' 
          ? require('./gmailService') 
          : require('./microsoftService');
        const { accessToken } = await service.getValidAccessToken(account.id);
        
        // Build SASL XOAUTH2 token
        const xoauth2Token = Buffer.from([
          \`user=\${account.email_address}\`,
          \`auth=Bearer \${accessToken}\`,
          '',
          ''
        ].join('\\x01'), 'utf-8').toString('base64');
        
        console.log(\`[IMAP \${requestId}] Using OAuth2 token for \${account.email_address}\`);
        return { xoauth2: xoauth2Token };
      } catch (err) {
        console.error(\`[IMAP \${requestId}] OAuth token fetch failed: \${err.message}\`);
        throw new Error('Failed to fetch OAuth access token for IMAP');
      }
    } else {
      if (!account.imap_password) {
        throw new Error('No IMAP password configured');
      }
      const decrypted = decrypt(account.imap_password);
      if (!decrypted) {
        throw new Error('Password decryption failed');
      }
      return { password: decrypted };
    }
  }

  // Start monitoring a single email account
`;

// Inject helper method
code = code.replace(/\/\/ Start monitoring a single email account\n/, helperMethod);

// In startMonitoring, change parameters and signature
code = code.replace(/startMonitoring\(account\) \{/, 'async startMonitoring(account) {');
code = code.replace(
  /\/\/ Decrypt password with error handling\s+let decryptedPassword;[\s\S]+?\/\/ Check if this is a Zoho account - if so, try multiple regional hosts/m,
  `// Get auth params
    let authParams;
    try {
      authParams = await this.getImapAuthParams(account);
    } catch (err) {
      console.error(\`[IMAP] ✗ Auth setup failed for \${account.email_address}: \${err.message}\`);
      return;
    }

    // Check if this is a Zoho account - if so, try multiple regional hosts`
);

// startMonitoringZoho signature
code = code.replace(/async startMonitoringZoho\(account, decryptedPassword\) \{/, 'async startMonitoringZoho(account, authParams) {');
code = code.replace(/const success = await this\.tryConnectHost\(account, host, decryptedPassword\);/g, 'const success = await this.tryConnectHost(account, host, authParams);');

// tryConnectHost signature
code = code.replace(/tryConnectHost\(account, host, decryptedPassword\) \{/, 'tryConnectHost(account, host, authParams) {');
code = code.replace(/password: decryptedPassword,/g, '...authParams,');

// startMonitoringSingleHost signature
code = code.replace(/startMonitoringSingleHost\(account, host, decryptedPassword\) \{/, 'startMonitoringSingleHost(account, host, authParams) {');
code = code.replace(/console\.log\(`\[IMAP\]   - Password[\s\S]*?\);/g, `console.log(\`[IMAP]   - Auth: \${authParams.xoauth2 ? 'OAuth2' : 'Password'}\`);`);

// Replace other instances of 'password: decryptedPassword' with '...authParams'
code = code.replace(/password: decryptedPassword,/g, '...authParams,');

// Fix syncInbox
code = code.replace(
  /\/\/ Decrypt password with error handling[\s\S]+?\/\/ Resolve the correct IMAP host \(handles Zoho regional fallback\)/m,
  `// Get auth params
        let authParams;
        try {
          authParams = await this.getImapAuthParams(account, requestId);
        } catch (err) {
          return reject(err);
        }

        // Resolve the correct IMAP host (handles Zoho regional fallback)`
);
code = code.replace(/resolveImapHost\(account, decryptedPassword\)/g, 'resolveImapHost(account, authParams)');

// Fix searchSpamAndMoveToInbox (assume line ~1380 starts with Decrypt password)
code = code.replace(
  /let decryptedPassword;\s+try \{\s+if \(!account\.imap_password\) \{[\s\S]+?\} catch \(decryptError\) \{[\s\S]+?\}\s+\/\//m,
  `let authParams;
        try {
          authParams = await this.getImapAuthParams(account, requestId);
        } catch (err) {
          return reject(err);
        }
        //`
);

// Fix applyWarmupEngagement (assume line ~1510 starts with Decrypt password)
code = code.replace(
  /let decryptedPassword;\s+try \{\s+if \(!account\.imap_password\) \{[\s\S]+?\} catch \(decryptError\) \{[\s\S]+?\}\s+\/\//gm,
  `let authParams;
        try {
          authParams = await this.getImapAuthParams(account, requestId);
        } catch (err) {
          return reject(err);
        }
        //`
);

code = code.replace(
  /resolveImapHost\(account, decryptedPassword\)/g,
  'resolveImapHost(account, authParams)'
);

code = code.replace(/tryConnectHost\(account, host, authParams\)/g, 'tryConnectHost(account, host, authParams)'); // already done

fs.writeFileSync(file, code);
console.log('patched');
