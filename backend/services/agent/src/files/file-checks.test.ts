import { describe, expect, it } from 'vitest';
import { displayName, matchesSignature, storageKey } from './file-checks.ts';

describe('file checks', () => {
  it('cleans display names and forces the real extension', () => {
    expect(displayName('C:\\\\Users\\\\me\\\\Q3 report.final.PDF', 'application/pdf')).toBe(
      'Q3 report.final.pdf',
    );
    expect(displayName('../../etc/passwd', 'image/png')).toBe('passwd.png');
    expect(displayName('<script>.jpg', 'image/jpeg')).toBe('script.jpg');
    expect(displayName('...', 'image/webp')).toBe('file.webp');
    expect(displayName('new\nline\u0007.pdf', 'application/pdf')).toBe('newline.pdf');
  });

  it('builds keys from IDs only', () => {
    expect(storageKey('u1', 'upload', 'f1')).toBe('users/u1/uploads/f1');
  });

  it('knows each type by its first bytes', () => {
    expect(matchesSignature('application/pdf', Buffer.from('%PDF-1.7'))).toBe(true);
    expect(matchesSignature('image/jpeg', Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe(true);
    expect(matchesSignature('image/webp', Buffer.from('RIFF\0\0\0\0WEBPVP8 '))).toBe(true);
    expect(matchesSignature('image/png', Buffer.from('%PDF-1.7'))).toBe(false);
  });
});
