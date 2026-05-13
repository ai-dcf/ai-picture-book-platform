import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";

const loginSchema = z.object({
  username: z.string().min(1, "用户名不能为空"),
  password: z.string().min(1, "密码不能为空"),
});

export const { handlers, signIn, signOut, auth } = NextAuth({
  secret: process.env.AUTH_SECRET || "development-secret-key-change-in-production",
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        username: { label: "用户名", type: "text" },
        password: { label: "密码", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);

        if (!parsed.success) {
          return null;
        }

        const { username, password } = parsed.data;

        if (
          username === (process.env.AUTH_ADMIN_USERNAME || "admin") &&
          password === (process.env.AUTH_ADMIN_PASSWORD || "admin123")
        ) {
          return {
            id: "1",
            name: username,
            email: `${username}@admin.local`,
            role: "admin",
          };
        }

        if (
          username === (process.env.AUTH_USER_USERNAME || "user") &&
          password === (process.env.AUTH_USER_PASSWORD || "user123")
        ) {
          return {
            id: "2",
            name: username,
            email: `${username}@user.local`,
            role: "user",
          };
        }

        return null;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as { role?: string }).role;
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = token.role as string;
        session.user.id = token.id as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
  },
});
