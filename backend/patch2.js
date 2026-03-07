const fs = require('fs');
let code = fs.readFileSync('services/imapMonitor.js', 'utf8');

// In startMonitoring
code = code.replace(
  /this\.startMonitoringZoho\(account, decryptedPassword\);/g,
  'this.startMonitoringZoho(account, authParams);'
);
code = code.replace(
  /this\.startMonitoringSingleHost\(account, account\.imap_host, decryptedPassword\);/g,
  'this.startMonitoringSingleHost(account, account.imap_host, authParams);'
);

// In resolveImapHost
code = code.replace(/async resolveImapHost\(account, decryptedPassword\) \{/, 'async resolveImapHost(account, authParams) {');
code = code.replace(/this\.quickTestHost\(host, account, decryptedPassword\)/g, 'this.quickTestHost(host, account, authParams)');

// In quickTestHost
code = code.replace(/quickTestHost\(host, account, decryptedPassword\) \{/, 'quickTestHost(host, account, authParams) {');
code = code.replace(/password: decryptedPassword,/g, '...authParams,');

// In searchSpamAndMoveToInbox
code = code.replace(
  /let decryptedPassword;\s+try \{\s+decryptedPassword = decrypt\(account\.imap_password\);\s+\} catch \(decryptError\) \{[\s\S]+?\}\s+try \{/m,
  `let authParams;
      try {
        authParams = await this.getImapAuthParams(account, requestId);
      } catch (err) {
        return reject(err);
      }
      try {`
);

// In applyWarmupEngagement
code = code.replace(
  /let decryptedPassword;\s+try \{\s+decryptedPassword = decrypt\(account\.imap_password\);\s+\} catch \(decryptError\) \{[\s\S]+?\}\s+try \{/m,
  `let authParams;
      try {
        authParams = await this.getImapAuthParams(account, requestId);
      } catch (err) {
        return reject(err);
      }
      try {`
);

fs.writeFileSync('services/imapMonitor.js', code);
