import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { compare } from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  users,
  accounts,
  sessions,
  verificationTokens,
  subscriptions,
  usage,
} from "@/lib/db/schema";
import { loginSchema } from "@/lib/validators/auth";
import { authConfig } from "./auth.config";

function getCurrentPeriod() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,

  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),

  providers: [
    ...authConfig.providers,
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const user = await db.query.users.findFirst({
          where: eq(users.email, parsed.data.email),
        });

        if (!user?.passwordHash) return null;

        const valid = await compare(parsed.data.password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
        };
      },
    }),
  ],

  callbacks: {
    ...authConfig.callbacks,

    async signIn({ user, account }) {
      // On first OAuth sign-in, auto-create subscription + usage record
      if (account?.provider !== "credentials" && user.id) {
        const existing = await db.query.subscriptions.findFirst({
          where: eq(subscriptions.userId, user.id),
        });

        if (!existing) {
          await db.insert(subscriptions).values({
            userId: user.id,
            plan: "free",
            status: "active",
          });

          await db.insert(usage).values({
            userId: user.id,
            period: getCurrentPeriod(),
          });
        }
      }

      return true;
    },

    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id;
      }

      // Look up plan on initial sign-in or when session is updated
      if ((user || trigger === "update") && token.id) {
        const sub = await db.query.subscriptions.findFirst({
          where: eq(subscriptions.userId, token.id as string),
          columns: { plan: true },
        });
        token.plan = sub?.plan ?? "free";
      }

      return token;
    },

    session({ session, token }) {
      if (token.id) {
        session.user.id = token.id as string;
      }
      session.user.plan =
        (token.plan as "free" | "studio" | "pro" | "founding") ?? "free";
      return session;
    },
  },
});
