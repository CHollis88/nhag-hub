import crypto from "crypto";

// scrypt is built into Node -- no bcrypt/argon2 dependency needed for a
// PIN this short. Format stored: "<hash-hex>:<salt-hex>".
export function hashPin(pin) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(pin, salt, 64).toString("hex");
  return `${hash}:${salt}`;
}

export function verifyPin(pin, stored) {
  if (!stored) return false;
  const [hash, salt] = stored.split(":");
  if (!hash || !salt) return false;
  const attempt = crypto.scryptSync(pin, salt, 64).toString("hex");
  // Constant-time comparison -- avoids leaking how many leading
  // characters matched via response-timing differences.
  const a = Buffer.from(hash, "hex");
  const b = Buffer.from(attempt, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
