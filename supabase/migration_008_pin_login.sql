-- NHAG Church Hub — PIN sign-in
--
-- Magic links can't reach an already-installed iOS home-screen app --
-- tapping the email link always opens Safari, which has separate,
-- isolated storage from the installed app, by Apple's design. A PIN you
-- type directly inside the installed app sidesteps that entirely.
--
-- This is a SECOND way in, not a replacement for magic links -- someone
-- sets a PIN (in Settings) only after they've already verified their
-- email once via a real magic-link sign-in.

alter table users add column if not exists pin_hash text;

-- Format: "<scrypt-hash-hex>:<salt-hex>", produced by Node's built-in
-- crypto.scrypt -- no new dependency needed for something this simple.
-- Null means "no PIN set yet," which is the default and permanent state
-- for anyone who never opts in.
