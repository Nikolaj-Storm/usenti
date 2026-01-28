const crypto = require('crypto');

// Check for encryption key at module load time
if (!process.env.ENCRYPTION_KEY) {
  console.error('[ENCRYPTION] ⚠️ WARNING: ENCRYPTION_KEY environment variable is not set!');
  console.error('[ENCRYPTION] ⚠️ This will cause password decryption to fail for stored credentials.');
  console.error('[ENCRYPTION] ⚠️ Please set ENCRYPTION_KEY in your environment variables.');
}

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY
  ? Buffer.from(process.env.ENCRYPTION_KEY, 'hex')
  : null;
const IV_LENGTH = 16;

function encrypt(text) {
  if (!text) return null;
  if (!ENCRYPTION_KEY) {
    throw new Error('ENCRYPTION_KEY environment variable is not set. Cannot encrypt.');
  }
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(text) {
  if (!text) return null;
  if (!ENCRYPTION_KEY) {
    throw new Error('ENCRYPTION_KEY environment variable is not set. Cannot decrypt.');
  }

  // Validate encrypted text format
  if (!text.includes(':')) {
    console.error(`[ENCRYPTION] ❌ Invalid encrypted text format - missing separator. Text length: ${text.length}`);
    throw new Error('Invalid encrypted text format - missing IV separator');
  }

  const parts = text.split(':');
  if (parts.length < 2) {
    console.error(`[ENCRYPTION] ❌ Invalid encrypted text format - not enough parts. Parts: ${parts.length}`);
    throw new Error('Invalid encrypted text format - not enough parts');
  }

  try {
    const iv = Buffer.from(parts.shift(), 'hex');
    const encryptedText = Buffer.from(parts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (error) {
    console.error(`[ENCRYPTION] ❌ Decryption failed: ${error.message}`);
    throw error;
  }
}

module.exports = { encrypt, decrypt };
