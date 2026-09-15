import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,

  providers: [
    Credentials({
      credentials: {
        email: {},
        password: {},
      },

      async authorize(credentials) {
        if (
          typeof credentials?.email !== "string" ||
          typeof credentials?.password !== "string"
        ) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: {
            email: credentials.email.toLowerCase(),
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

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          accountType: user.accountType,
        };
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.accountType = user.accountType;
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub!;
        session.user.accountType = token.accountType!;
      }

      return session;
    },
  },
});