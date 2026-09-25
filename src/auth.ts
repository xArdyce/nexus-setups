import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

const REMEMBERED_SESSION_SECONDS = 30 * 24 * 60 * 60;
const TEMPORARY_SESSION_SECONDS = 8 * 60 * 60;

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,

  session: {
    strategy: "jwt",
    maxAge: REMEMBERED_SESSION_SECONDS,
  },

  jwt: {
    maxAge: REMEMBERED_SESSION_SECONDS,
  },

  providers: [
    Credentials({
      credentials: {
        email: {},
        password: {},
        rememberSession: {},
      },

      async authorize(credentials) {
        if (
          typeof credentials?.email !== "string" ||
          typeof credentials?.password !== "string"
        ) {
          return null;
        }

        const email = credentials.email.trim().toLowerCase();

        if (!email || !credentials.password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: {
            email,
          },
        });

        if (!user || !user.password) {
          return null;
        }

        const passwordMatches = await bcrypt.compare(
          credentials.password,
          user.password
        );

        if (!passwordMatches) {
          return null;
        }

        const rememberSession =
          credentials.rememberSession === "true";

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          accountType: user.accountType,
          rememberSession,
        };
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const authenticatedUser = user as typeof user & {
          rememberSession?: boolean;
        };

        const rememberSession =
          authenticatedUser.rememberSession === true;

        const lifetimeSeconds = rememberSession
          ? REMEMBERED_SESSION_SECONDS
          : TEMPORARY_SESSION_SECONDS;

        token.accountType = user.accountType;
        token.name = user.name;
        token.email = user.email;
        token.rememberSession = rememberSession;
        token.sessionExpiresAt =
          Date.now() + lifetimeSeconds * 1000;
        token.sessionExpired = false;
      }

      const sessionExpiresAt = Number(
        token.sessionExpiresAt || 0
      );

      if (
        sessionExpiresAt > 0 &&
        Date.now() >= sessionExpiresAt
      ) {
        token.sessionExpired = true;
        token.sub = undefined;
        return token;
      }

      /*
       * Keep JWT profile fields synchronized with the database.
       * The stable token.sub user ID lets account settings safely
       * change the user's name or email without breaking API auth.
       */
      if (token.sub) {
        const currentUser = await prisma.user.findUnique({
          where: {
            id: token.sub,
          },
          select: {
            name: true,
            email: true,
            accountType: true,
          },
        });

        if (currentUser) {
          token.name = currentUser.name;
          token.email = currentUser.email;
          token.accountType = currentUser.accountType;
        }
      }

      return token;
    },

    async session({ session, token }) {
      if (
        token.sessionExpired === true ||
        !token.sub
      ) {
        return {
          ...session,
          user: undefined,
        } as unknown as typeof session;
      }

      if (session.user) {
        session.user.id = token.sub;
        session.user.name = token.name || null;
        session.user.email =
          token.email || session.user.email || "";
        session.user.accountType = token.accountType!;
      }

      return session;
    },
  },
});