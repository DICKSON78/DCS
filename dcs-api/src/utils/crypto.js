import crypto from 'node:crypto';

export const sha256 = (input) =>
  crypto.createHash('sha256').update(String(input)).digest('hex');

export const hmacSHA256 = (secret, payload) =>
  crypto.createHmac('sha256', secret).update(payload, 'utf8').digest('hex');

export const maskName = (fullName) => {
  if (!fullName) return null;
  const trimmed = fullName.trim();
  if (trimmed.length <= 2) return trimmed[0] + '*';
  const parts = trimmed.split(/\s+/);
  return parts
    .map((part) => {
      const first = part[0];
      const last = part[part.length - 1];
      if (part.length <= 2) return first + '*';
      return first + '*'.repeat(Math.min(3, part.length - 2)) + last;
    })
    .join(' ')
    .toUpperCase();
};

export const hashIdentifier = (identifier) => {
  return 'h_' + sha256(identifier);
};

export const uuid = () => crypto.randomUUID();

export const now = () => new Date();

export const constantTimeEqual = (a, b) => {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
};
