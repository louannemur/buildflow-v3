import type { NextAuthConfig } from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";

/**
 * Edge-compatible auth config used by middleware.
 * Does NOT include Credentials provider (requires bcrypt / Node runtime).
 * The full config in auth.ts spreads this and adds Credentials.
 */
export const authConfig = {
  pages: {
    signIn: "/login",
    newUser: "/signup",
  },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
    }),
  ],
  callbacks: {
    session({ session, token }) {
      if (token.id) {
        session.user.id = token.id as string;
      }
      session.user.plan =
        (token.plan as "free" | "studio" | "pro" | "founding") ?? "free";
      return session;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
  },
  session: { strategy: "jwt" },
} satisfies NextAuthConfig;
