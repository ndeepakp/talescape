import { betterAuth } from "better-auth";
import { Pool } from "pg";
import { deleteWallpapersForUser } from "@/lib/wallpaper";
import { deleteAvatarsForUser } from "@/lib/avatar";

// Origins better-auth will accept requests from (anti-CSRF check). Without this,
// only BETTER_AUTH_URL is trusted, so reaching the app on any other host — a
// different localhost port, or a public demo tunnel — fails with "Invalid
// origin". Dev/prod localhost and Cloudflare quick-tunnel subdomains are always
// allowed; set BETTER_AUTH_TRUSTED_ORIGINS (comma-separated) for real domains.
const trustedOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  "https://*.trycloudflare.com",
  ...(process.env.BETTER_AUTH_TRUSTED_ORIGINS?.split(",")
    .map((o) => o.trim())
    .filter(Boolean) ?? []),
];

export const auth = betterAuth({
  database: new Pool({ connectionString: process.env.DATABASE_URL }),
  trustedOrigins,
  emailAndPassword: {
    enabled: true,
  },
  user: {
    deleteUser: {
      // Allow an account to be deleted through the app. Deleting the "user" row
      // cascades to all of that account's data (stories, reactions, comments,
      // follows, sessions, …) via ON DELETE CASCADE foreign keys.
      enabled: true,
      // Files on disk aren't covered by the database cascade, so remove the
      // account's feed wallpaper(s) just before the row is deleted — otherwise
      // they'd be orphaned in public/uploads with no account pointing to them.
      // Note: this only runs for deletions made through the app; rows removed
      // directly in the database (e.g. manual psql cleanup) won't trigger it.
      beforeDelete: async (user) => {
        await deleteWallpapersForUser(user.id);
        await deleteAvatarsForUser(user.id);
      },
    },
  },
  session: {
    // Log users out after ~1 hour of inactivity. The session lives for 1 hour,
    // and each time it's used (at most once every 5 minutes) its expiry is
    // pushed forward — so active users stay signed in, but an idle session
    // dies after an hour and the next page load redirects to /login.
    expiresIn: 60 * 60, // 1 hour
    updateAge: 60 * 5, // refresh the expiry at most every 5 minutes
  },
  rateLimit: {
    // Throttle abusive request bursts. Enabled in all environments (not just
    // production) so brute-force protection is testable locally too.
    enabled: true,
    window: 60, // seconds
    max: 100, // default cap per IP per window
    customRules: {
      // Much tighter limits on the credential endpoints to slow password
      // guessing and signup spam.
      "/sign-in/email": { window: 60, max: 10 },
      "/sign-up/email": { window: 60, max: 10 },
    },
  },
});
