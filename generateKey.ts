import crypto from 'crypto';

function generateEncryptionKey() {
  return crypto.randomBytes(16).toString('hex');
}

const encryptionKey = generateEncryptionKey();
console.log('Your ENCRYPTION_KEY:');
console.log(encryptionKey);