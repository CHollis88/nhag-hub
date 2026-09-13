// Run with: npm run generate-vapid
// Prints a fresh VAPID key pair to paste into your environment variables.
const webpush = require("web-push");

const keys = webpush.generateVAPIDKeys();

console.log("\nAdd these to your environment variables (Vercel + .env.local):\n");
console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log("\n(NEXT_PUBLIC_VAPID_PUBLIC_KEY is the same value as VAPID_PUBLIC_KEY — the browser needs its own copy of the public key.)\n");
