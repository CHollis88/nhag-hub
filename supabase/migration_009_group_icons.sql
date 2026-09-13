-- NHAG Church Hub — Ministry icons + tile color
-- A small image per group (same idea as the app's own logo), shown
-- alongside its name on Home's ministry tiles and inside its own header.
-- tile_color lets each ministry pick its own accent color for that tile,
-- rather than every tile looking identical.

alter table groups add column if not exists image_url text;
alter table groups add column if not exists tile_color text;

-- tile_color is a plain hex string (e.g. "#8B1E2F"), validated at the
-- application layer, not the database -- no fixed palette, any color a
-- ministry leader or admin picks. Null falls back to the app's default
-- accent color.
