-- better-auth inserts new rows into "user" without a username, so the column
-- cannot be NOT NULL at the DB level. The handle is assigned by the app right
-- after sign-up (PUT /api/me/profile). The unique index already permits NULLs.
ALTER TABLE "user" ALTER COLUMN username DROP NOT NULL;
