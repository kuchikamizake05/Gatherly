import passport from "passport";
import { Strategy as GoogleStrategy, type Profile } from "passport-google-oauth20";

import { env } from "../../config/env.js";
import { resolveGoogleUser } from "./auth.service.js";

export const googleAuthConfigured = Boolean(
  env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_CALLBACK_URL,
);

if (googleAuthConfigured) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: env.GOOGLE_CLIENT_ID!,
        clientSecret: env.GOOGLE_CLIENT_SECRET!,
        callbackURL: env.GOOGLE_CALLBACK_URL!,
      },
      async (_accessToken, _refreshToken, profile: Profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          const googlePayload = profile._json as { email_verified?: boolean; verified_email?: boolean };
          const verified = Boolean(googlePayload.email_verified ?? googlePayload.verified_email);
          if (!email) return done(null, false);
          const user = await resolveGoogleUser({
            id: profile.id,
            displayName: profile.displayName,
            email,
            emailVerified: verified,
          });
          done(null, user);
        } catch (error) {
          done(error as Error);
        }
      },
    ),
  );
}

export { passport };
