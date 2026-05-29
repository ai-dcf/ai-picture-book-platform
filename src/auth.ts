import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { UserRepository } from "@/lib/db/repositories/user-repository";
import bcrypt from "bcryptjs";

const loginSchema = z.object({
  email: z.string().email("请输入有效的邮箱"),
  password: z.string().min(1, "密码不能为空"),
});

const registerSchema = z.object({
  email: z.string().email("请输入有效的邮箱"),
  nickname: z.string().min(1, "昵称不能为空"),
  password: z.string().min(6, "密码至少6位"),
});

export const { handlers, signIn, signOut, auth } = NextAuth({
  secret: process.env.AUTH_SECRET || "development-secret-key-change-in-production",
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "邮箱", type: "email" },
        password: { label: "密码", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);

        if (!parsed.success) {
          return null;
        }

        const { email, password } = parsed.data;

        const user = await UserRepository.getUserByEmail(email);
        
        if (!user || !user.passwordHash) {
          // 向后兼容硬编码用户
          if (
            email === (process.env.AUTH_ADMIN_USERNAME || "admin") &&
            password === (process.env.AUTH_ADMIN_PASSWORD || "admin123")
          ) {
            return {
              id: "1",
              name: "admin",
              email: "admin@local",
              role: "admin",
            };
          }

          if (
            email === (process.env.AUTH_USER_USERNAME || "user") &&
            password === (process.env.AUTH_USER_PASSWORD || "user123")
          ) {
            return {
              id: "2",
              name: "user",
              email: "user@local",
              role: "user",
            };
          }

          return null;
        }

        const passwordMatch = await bcrypt.compare(password, user.passwordHash);
        
        if (!passwordMatch) {
          return null;
        }

        return {
          id: user.id,
          name: user.nickname || user.username || user.email.split('@')[0],
          email: user.email,
          nickname: user.nickname,
          avatarUrl: user.avatarUrl,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.nickname = (user as any).nickname;
        token.avatarUrl = (user as any).avatarUrl;
        token.role = (user as any).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
        (session.user as any).nickname = token.nickname;
        (session.user as any).avatarUrl = token.avatarUrl;
        session.user.role = token.role as string;
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
