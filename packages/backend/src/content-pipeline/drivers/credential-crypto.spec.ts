import { CredentialCrypto } from './credential-crypto';
import { randomBytes } from 'crypto';

describe('CredentialCrypto', () => {
  beforeEach(() => {
    process.env.PLATFORM_CREDENTIALS_ENCRYPTION_KEY =
      randomBytes(32).toString('base64');
  });

  it('roundtrips a token', () => {
    const c = new CredentialCrypto();
    const plaintext = '1//0abcdef-refresh-token';
    expect(c.decrypt(c.encrypt(plaintext))).toBe(plaintext);
  });

  it('throws when key is missing', () => {
    delete process.env.PLATFORM_CREDENTIALS_ENCRYPTION_KEY;
    expect(() => new CredentialCrypto()).toThrow();
  });

  it('throws when key is not 32 bytes', () => {
    process.env.PLATFORM_CREDENTIALS_ENCRYPTION_KEY =
      Buffer.from('short').toString('base64');
    expect(() => new CredentialCrypto()).toThrow(/must decode to 32 bytes/);
  });

  it('different plaintexts produce different ciphertexts', () => {
    const c = new CredentialCrypto();
    const a = c.encrypt('secret-one');
    const b = c.encrypt('secret-two');
    expect(a).not.toBe(b);
  });

  it('same plaintext produces different ciphertexts due to IV', () => {
    const c = new CredentialCrypto();
    const a = c.encrypt('same-text');
    const b = c.encrypt('same-text');
    expect(a).not.toBe(b);
  });
});
