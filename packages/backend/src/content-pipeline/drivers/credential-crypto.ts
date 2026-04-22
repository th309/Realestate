import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGO = 'aes-256-gcm';

export class CredentialCrypto {
  private readonly key: Buffer;

  constructor() {
    const b64 = process.env.PLATFORM_CREDENTIALS_ENCRYPTION_KEY;
    if (!b64)
      throw new Error('PLATFORM_CREDENTIALS_ENCRYPTION_KEY is required');
    this.key = Buffer.from(b64, 'base64');
    if (this.key.length !== 32)
      throw new Error('encryption key must decode to 32 bytes');
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv(ALGO, this.key, iv);
    const enc = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return [iv, tag, enc].map((b) => b.toString('base64')).join('.');
  }

  decrypt(payload: string): string {
    const [ivB64, tagB64, encB64] = payload.split('.');
    const iv = Buffer.from(ivB64, 'base64');
    const tag = Buffer.from(tagB64, 'base64');
    const enc = Buffer.from(encB64, 'base64');
    const decipher = createDecipheriv(ALGO, this.key, iv);
    decipher.setAuthTag(tag);
    const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
    return dec.toString('utf8');
  }
}
