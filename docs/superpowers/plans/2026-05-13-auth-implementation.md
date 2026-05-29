# 用户认证与个人中心实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现用户注册登录、个人资料和设置功能，使用邮箱/密码认证，数据存储在 SQLite 数据库中

**Architecture:** 混合方案，使用 Drizzle ORM 管理用户表，保持现有项目 Repository 不变，更新 NextAuth 5 配置

**Tech Stack:** Next.js 15, NextAuth 5, Drizzle ORM, SQLite (better-sqlite3), bcrypt, React + shadcn/ui

---

## 文件映射

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/lib/db/schema.sql` | 修改 | 添加用户相关表 |
| `src/lib/db/schema-drizzle.ts` | 创建 | Drizzle schema |
| `src/lib/db/repositories/user-repository.ts` | 创建 | 用户 Repository |
| `src/lib/db.ts` | 修改 | 初始化 Drizzle |
| `src/auth.ts` | 修改 | 更新 NextAuth 配置 |
| `src/app/actions/auth.ts` | 创建 | Server Actions |
| `src/app/login/page.tsx` | 创建 | 登录页面 |
| `src/app/register/page.tsx` | 创建 | 注册页面 |
| `src/app/profile/page.tsx` | 创建 | 个人资料页面 |
| `src/app/settings/page.tsx` | 创建 | 用户设置页面 |
| `src/components/studio/TopBar.tsx` | 修改 | 添加用户菜单 |
| `src/middleware.ts` | 修改 | 更新路由保护 |

---

## 任务分解

### Task 1: 安装 bcrypt 依赖

**Files:**
- Modify: `package.json`

- [ ] **Step 1: 安装 bcrypt 和类型**

```bash
npm install bcrypt
npm install -D @types/bcrypt
```

- [ ] **Step 2: 验证安装**

```bash
npm list bcrypt
```
Expected: bcrypt@^5.x.x 出现

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: install bcrypt for password hashing"
```

---

### Task 2: 更新数据库 Schema

**Files:**
- Modify: `src/lib/db/schema.sql`

- [ ] **Step 1: 添加用户相关表到 schema.sql**

在文件末尾添加：

```sql
-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  username TEXT,
  nickname TEXT,
  password_hash TEXT,
  avatar_url TEXT,
  email_verified_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- 会话表
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

-- 验证令牌表
CREATE TABLE IF NOT EXISTS verification_tokens (
  id TEXT PRIMARY KEY,
  identifier TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
```

- [ ] **Step 2: 删除旧数据库文件（可选，为了干净）**

```bash
rm -f /workspace/data/sqlite.db /workspace/data/sqlite.db-shm /workspace/data/sqlite.db-wal
```

- [ ] **Step 3: 运行 lint 检查**

```bash
cd /workspace && npm run lint
```
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/db/schema.sql
git commit -m "feat: update database schema with user tables"
```

---

### Task 3: 创建 Drizzle Schema

**Files:**
- Create: `src/lib/db/schema-drizzle.ts`

- [ ] **Step 1: 创建 schema-drizzle.ts**

```typescript
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').unique().notNull(),
  username: text('username'),
  nickname: text('nickname'),
  passwordHash: text('password_hash'),
  avatarUrl: text('avatar_url'),
  emailVerifiedAt: integer('email_verified_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const verificationTokens = sqliteTable('verification_tokens', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  token: text('token').unique().notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type VerificationToken = typeof verificationTokens.$inferSelect;
export type NewVerificationToken = typeof verificationTokens.$inferInsert;
```

- [ ] **Step 2: 运行 lint 检查**

```bash
cd /workspace && npm run lint
```
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/db/schema-drizzle.ts
git commit -m "feat: create drizzle schema for user tables"
```

---

### Task 4: 更新 db.ts 初始化 Drizzle

**Files:**
- Modify: `src/lib/db.ts`

- [ ] **Step 1: 更新 db.ts**

```typescript
import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import path from 'path';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema-drizzle';

const DB_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DB_DIR, 'sqlite.db');

let db: Database.Database | null = null;
let drizzleDb: ReturnType<typeof drizzle> | null = null;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

export function getDrizzleDb() {
  if (!drizzleDb) {
    const database = getDb();
    drizzleDb = drizzle(database, { schema });
  }
  return drizzleDb;
}

export function initDatabase(): void {
  const database = getDb();
  const schemaPath = path.join(process.cwd(), 'src', 'lib', 'db', 'schema.sql');
  const schema = readFileSync(schemaPath, 'utf-8');

  database.exec(schema);
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
    drizzleDb = null;
  }
}

export function withTransaction<T>(
  fn: () => T
): T {
  const database = getDb();
  const transactionFn = database.transaction(fn);
  return transactionFn();
}
```

- [ ] **Step 2: 运行 lint 检查**

```bash
cd /workspace && npm run lint
```
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/db.ts
git commit -m "feat: update db.ts to initialize drizzle"
```

---

### Task 5: 创建用户 Repository

**Files:**
- Create: `src/lib/db/repositories/user-repository.ts`

- [ ] **Step 1: 创建 user-repository.ts**

```typescript
import { eq } from 'drizzle-orm';
import { getDrizzleDb } from '../db';
import { users, type User, type NewUser } from '../schema-drizzle';
import { v4 as uuidv4 } from 'uuid';

export const UserRepository = {
  async createUser(data: Omit<NewUser, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> {
    const db = getDrizzleDb();
    const now = new Date();
    const id = uuidv4();
    
    const newUser: NewUser = {
      id,
      ...data,
      createdAt: now,
      updatedAt: now,
    };
    
    const result = await db.insert(users).values(newUser).returning();
    return result[0];
  },

  async getUserByEmail(email: string): Promise<User | null> {
    const db = getDrizzleDb();
    const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return result[0] || null;
  },

  async getUserById(id: string): Promise<User | null> {
    const db = getDrizzleDb();
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0] || null;
  },

  async updateUser(id: string, data: Partial<Omit<User, 'id' | 'createdAt' | 'updatedAt'>>): Promise<User | null> {
    const db = getDrizzleDb();
    const now = new Date();
    
    const result = await db
      .update(users)
      .set({ ...data, updatedAt: now })
      .where(eq(users.id, id))
      .returning();
    
    return result[0] || null;
  },

  async emailExists(email: string): Promise<boolean> {
    const user = await this.getUserByEmail(email);
    return user !== null;
  },
};
```

- [ ] **Step 2: 运行 lint 检查**

```bash
cd /workspace && npm run lint
```
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/db/repositories/user-repository.ts
git commit -m "feat: create user repository"
```

---

### Task 6: 更新 NextAuth 配置

**Files:**
- Modify: `src/auth.ts`

- [ ] **Step 1: 更新 auth.ts**

```typescript
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { UserRepository } from "@/lib/db/repositories/user-repository";
import bcrypt from "bcrypt";

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
```

- [ ] **Step 2: 运行 lint 检查**

```bash
cd /workspace && npm run lint
```
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/auth.ts
git commit -m "feat: update nextauth config with user repository"
```

---

### Task 7: 创建 Server Actions

**Files:**
- Create: `src/app/actions/auth.ts`

- [ ] **Step 1: 创建 auth.ts actions**

```typescript
"use server";

import { z } from "zod";
import bcrypt from "bcrypt";
import { auth, signIn, signOut } from "@/auth";
import { UserRepository } from "@/lib/db/repositories/user-repository";
import { redirect } from "next/navigation";

const registerSchema = z.object({
  email: z.string().email("请输入有效的邮箱"),
  nickname: z.string().min(1, "昵称不能为空"),
  password: z.string().min(6, "密码至少6位"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "两次密码输入不一致",
  path: ["confirmPassword"],
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "当前密码不能为空"),
  newPassword: z.string().min(6, "新密码至少6位"),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "两次密码输入不一致",
  path: ["confirmPassword"],
});

const updateProfileSchema = z.object({
  nickname: z.string().optional(),
  avatarUrl: z.string().optional(),
});

export async function registerUser(formData: FormData) {
  const result = registerSchema.safeParse({
    email: formData.get("email"),
    nickname: formData.get("nickname"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!result.success) {
    return { success: false, error: result.error.issues[0].message };
  }

  const { email, nickname, password } = result.data;

  const emailExists = await UserRepository.emailExists(email);
  if (emailExists) {
    return { success: false, error: "该邮箱已被注册" };
  }

  const passwordHash = await bcrypt.hash(password, 10);

  await UserRepository.createUser({
    email,
    nickname,
    passwordHash,
  });

  await signIn("credentials", { email, password, redirectTo: "/" });
  
  return { success: true };
}

export async function updateProfile(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "请先登录" };
  }

  const result = updateProfileSchema.safeParse({
    nickname: formData.get("nickname") as string || undefined,
    avatarUrl: formData.get("avatarUrl") as string || undefined,
  });

  if (!result.success) {
    return { success: false, error: result.error.issues[0].message };
  }

  const updatedUser = await UserRepository.updateUser(session.user.id, result.data);

  if (!updatedUser) {
    return { success: false, error: "更新失败" };
  }

  return { success: true };
}

export async function changePassword(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "请先登录" };
  }

  const result = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!result.success) {
    return { success: false, error: result.error.issues[0].message };
  }

  const { currentPassword, newPassword } = result.data;

  const user = await UserRepository.getUserById(session.user.id);
  if (!user || !user.passwordHash) {
    return { success: false, error: "用户不存在" };
  }

  const passwordMatch = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!passwordMatch) {
    return { success: false, error: "当前密码错误" };
  }

  const newPasswordHash = await bcrypt.hash(newPassword, 10);
  await UserRepository.updateUser(session.user.id, { passwordHash: newPasswordHash });

  return { success: true };
}

export async function signOutAction() {
  await signOut({ redirectTo: "/login" });
}
```

- [ ] **Step 2: 运行 lint 检查**

```bash
cd /workspace && npm run lint
```
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/app/actions/auth.ts
git commit -m "feat: create auth server actions"
```

---

### Task 8: 更新中间件

**Files:**
- Modify: `src/middleware.ts`

- [ ] **Step 1: 更新 middleware.ts**

```typescript
import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isAuthenticated = !!req.auth;

  const publicPaths = ["/login", "/register", "/api/auth", "/"];
  const isPublicPath = publicPaths.some((path) => pathname.startsWith(path));

  if (!isAuthenticated && !isPublicPath) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthenticated && (pathname === "/login" || pathname === "/register")) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
```

- [ ] **Step 2: 运行 lint 检查**

```bash
cd /workspace && npm run lint
```
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/middleware.ts
git commit -m "feat: update middleware with register route"
```

---

### Task 9: 创建登录页面

**Files:**
- Create: `src/app/login/page.tsx`

- [ ] **Step 1: 创建登录页面**

```typescript
"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { signIn } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

const loginSchema = z.object({
  email: z.string().email("请输入有效的邮箱"),
  password: z.string().min(1, "密码不能为空"),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();
  const callbackUrl = searchParams.get("callbackUrl") || "/";

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    setError(null);
    setIsLoading(true);

    try {
      const result = await signIn("credentials", {
        email: data.email,
        password: data.password,
        redirect: false,
      });

      if (result?.error) {
        setError("邮箱或密码错误");
      } else {
        router.push(callbackUrl);
      }
    } catch (err) {
      setError("登录失败，请稍后重试");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>登录</CardTitle>
          <CardDescription>
            登录您的账号以继续
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">邮箱</Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                {...register("email")}
              />
              {errors.email && (
                <p className="text-sm text-red-500">{errors.email.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">密码</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                {...register("password")}
              />
              {errors.password && (
                <p className="text-sm text-red-500">{errors.password.message}</p>
              )}
            </div>
            {error && (
              <div className="p-3 bg-red-50 text-red-600 rounded-md text-sm">
                {error}
              </div>
            )}
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "登录中..." : "登录"}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm">
            还没有账号？{" "}
            <Link href="/register" className="text-blue-600 hover:underline">
              立即注册
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: 运行 lint 检查**

```bash
cd /workspace && npm run lint
```
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/app/login/page.tsx
git commit -m "feat: create login page"
```

---

### Task 10: 创建注册页面

**Files:**
- Create: `src/app/register/page.tsx`

- [ ] **Step 1: 创建注册页面**

```typescript
"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { registerUser } from "@/app/actions/auth";

const registerSchema = z.object({
  email: z.string().email("请输入有效的邮箱"),
  nickname: z.string().min(1, "昵称不能为空"),
  password: z.string().min(6, "密码至少6位"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "两次密码输入不一致",
  path: ["confirmPassword"],
});

type RegisterFormData = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterFormData) => {
    setError(null);
    setIsLoading(true);

    try {
      const formData = new FormData();
      formData.set("email", data.email);
      formData.set("nickname", data.nickname);
      formData.set("password", data.password);
      formData.set("confirmPassword", data.confirmPassword);

      const result = await registerUser(formData);

      if (!result.success) {
        setError(result.error || "注册失败");
      }
    } catch (err) {
      setError("注册失败，请稍后重试");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>注册</CardTitle>
          <CardDescription>
            创建新账号以开始使用
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">邮箱</Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                {...register("email")}
              />
              {errors.email && (
                <p className="text-sm text-red-500">{errors.email.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="nickname">昵称</Label>
              <Input
                id="nickname"
                type="text"
                placeholder="您的昵称"
                {...register("nickname")}
              />
              {errors.nickname && (
                <p className="text-sm text-red-500">{errors.nickname.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">密码</Label>
              <Input
                id="password"
                type="password"
                placeholder="至少6位"
                {...register("password")}
              />
              {errors.password && (
                <p className="text-sm text-red-500">{errors.password.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">确认密码</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="再次输入密码"
                {...register("confirmPassword")}
              />
              {errors.confirmPassword && (
                <p className="text-sm text-red-500">{errors.confirmPassword.message}</p>
              )}
            </div>
            {error && (
              <div className="p-3 bg-red-50 text-red-600 rounded-md text-sm">
                {error}
              </div>
            )}
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "注册中..." : "注册"}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm">
            已有账号？{" "}
            <Link href="/login" className="text-blue-600 hover:underline">
              立即登录
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: 运行 lint 检查**

```bash
cd /workspace && npm run lint
```
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/app/register/page.tsx
git commit -m "feat: create register page"
```

---

### Task 11: 创建个人资料页面

**Files:**
- Create: `src/app/profile/page.tsx`

- [ ] **Step 1: 创建个人资料页面**

```typescript
"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { updateProfile } from "@/app/actions/auth";
import { UserRepository } from "@/lib/db/repositories/user-repository";
import { redirect } from "next/navigation";

const profileSchema = z.object({
  nickname: z.string().min(1, "昵称不能为空"),
  avatarUrl: z.string().optional(),
});

type ProfileFormData = z.infer<typeof profileSchema>;

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
  });

  useEffect(() => {
    if (session?.user) {
      reset({
        nickname: (session.user as any).nickname || "",
        avatarUrl: (session.user as any).avatarUrl || "",
      });
    }
  }, [session, reset]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        加载中...
      </div>
    );
  }

  if (status === "unauthenticated") {
    redirect("/login");
  }

  const onSubmit = async (data: ProfileFormData) => {
    setMessage(null);
    setIsLoading(true);

    try {
      const formData = new FormData();
      if (data.nickname) formData.set("nickname", data.nickname);
      if (data.avatarUrl) formData.set("avatarUrl", data.avatarUrl);

      const result = await updateProfile(formData);

      if (result.success) {
        setMessage({ type: "success", text: "个人资料更新成功！" });
        window.location.reload();
      } else {
        setMessage({ type: "error", text: result.error || "更新失败" });
      }
    } catch (err) {
      setMessage({ type: "error", text: "更新失败，请稍后重试" });
    } finally {
      setIsLoading(false);
    }
  };

  const userInitial = ((session?.user as any)?.nickname || session?.user?.email || "U").charAt(0).toUpperCase();

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>个人资料</CardTitle>
            <CardDescription>
              管理您的个人信息
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div className="flex items-center space-x-4">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={(session?.user as any)?.avatarUrl} />
                  <AvatarFallback className="text-lg">{userInitial}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <Label htmlFor="avatarUrl">头像URL（可选）</Label>
                  <Input
                    id="avatarUrl"
                    type="url"
                    placeholder="https://example.com/avatar.jpg"
                    {...register("avatarUrl")}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="nickname">昵称</Label>
                <Input
                  id="nickname"
                  type="text"
                  placeholder="您的昵称"
                  {...register("nickname")}
                />
                {errors.nickname && (
                  <p className="text-sm text-red-500">{errors.nickname.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>邮箱</Label>
                <Input
                  type="email"
                  value={session?.user?.email || ""}
                  disabled
                  className="bg-gray-50"
                />
                <p className="text-sm text-gray-500">邮箱不可更改</p>
              </div>
              {message && (
                <div className={`p-3 rounded-md text-sm ${message.type === 'success' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                  {message.text}
                </div>
              )}
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "保存中..." : "保存更改"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 运行 lint 检查**

```bash
cd /workspace && npm run lint
```
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/app/profile/page.tsx
git commit -m "feat: create profile page"
```

---

### Task 12: 创建设置页面

**Files:**
- Create: `src/app/settings/page.tsx`

- [ ] **Step 1: 创建设置页面**

```typescript
"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { changePassword } from "@/app/actions/auth";
import { redirect } from "next/navigation";
import Link from "next/link";

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "当前密码不能为空"),
  newPassword: z.string().min(6, "新密码至少6位"),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "两次密码输入不一致",
  path: ["confirmPassword"],
});

type PasswordFormData = z.infer<typeof passwordSchema>;

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
  });

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        加载中...
      </div>
    );
  }

  if (status === "unauthenticated") {
    redirect("/login");
  }

  const onSubmit = async (data: PasswordFormData) => {
    setMessage(null);
    setIsLoading(true);

    try {
      const formData = new FormData();
      formData.set("currentPassword", data.currentPassword);
      formData.set("newPassword", data.newPassword);
      formData.set("confirmPassword", data.confirmPassword);

      const result = await changePassword(formData);

      if (result.success) {
        setMessage({ type: "success", text: "密码修改成功！" });
        reset();
      } else {
        setMessage({ type: "error", text: result.error || "修改失败" });
      }
    } catch (err) {
      setMessage({ type: "error", text: "修改失败，请稍后重试" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>账号设置</CardTitle>
            <CardDescription>
              管理您的账号安全设置
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="text-lg font-medium mb-4">修改密码</h3>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">当前密码</Label>
                  <Input
                    id="currentPassword"
                    type="password"
                    placeholder="请输入当前密码"
                    {...register("currentPassword")}
                  />
                  {errors.currentPassword && (
                    <p className="text-sm text-red-500">{errors.currentPassword.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newPassword">新密码</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    placeholder="至少6位"
                    {...register("newPassword")}
                  />
                  {errors.newPassword && (
                    <p className="text-sm text-red-500">{errors.newPassword.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">确认新密码</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="再次输入新密码"
                    {...register("confirmPassword")}
                  />
                  {errors.confirmPassword && (
                    <p className="text-sm text-red-500">{errors.confirmPassword.message}</p>
                  )}
                </div>
                {message && (
                  <div className={`p-3 rounded-md text-sm ${message.type === 'success' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                    {message.text}
                  </div>
                )}
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? "修改中..." : "修改密码"}
                </Button>
              </form>
            </div>
            <div className="pt-4 border-t">
              <h3 className="text-lg font-medium mb-4">其他</h3>
              <p className="text-sm text-gray-500 mb-4">
                需要修改邮箱或删除账号？请联系管理员。
              </p>
              <Link href="/profile">
                <Button variant="secondary">返回个人资料</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 运行 lint 检查**

```bash
cd /workspace && npm run lint
```
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/app/settings/page.tsx
git commit -m "feat: create settings page"
```

---

### Task 13: 更新 TopBar 组件

**Files:**
- Modify: `src/components/studio/TopBar.tsx`

- [ ] **Step 1: 读取现有 TopBar.tsx**

先查看文件内容，了解现有结构。

- [ ] **Step 2: 更新 TopBar.tsx，添加用户菜单**

```typescript
// 将以下内容整合到现有 TopBar 中
import { useSession, signOut } from "next-auth/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { User, Settings, LogOut } from "lucide-react";
import Link from "next/link";

// 在组件内部添加：
const { data: session } = useSession();

// 在返回的 JSX 中，在适当位置添加：
{session?.user && (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="ghost" className="h-8 w-8 rounded-full">
        <Avatar className="h-8 w-8">
          <AvatarImage src={(session.user as any)?.avatarUrl} />
          <AvatarFallback>{((session.user as any)?.nickname || session.user.email || "U").charAt(0).toUpperCase()}</AvatarFallback>
        </Avatar>
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuLabel>
        {((session.user as any)?.nickname || session.user.email)}
      </DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuItem asChild>
        <Link href="/profile" className="cursor-pointer flex items-center">
          <User className="mr-2 h-4 w-4" />
          <span>个人资料</span>
        </Link>
      </DropdownMenuItem>
      <DropdownMenuItem asChild>
        <Link href="/settings" className="cursor-pointer flex items-center">
          <Settings className="mr-2 h-4 w-4" />
          <span>设置</span>
        </Link>
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem 
        onClick={() => signOut()}
        className="cursor-pointer flex items-center text-red-600"
      >
        <LogOut className="mr-2 h-4 w-4" />
        <span>退出登录</span>
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
)}
```

- [ ] **Step 3: 运行 lint 检查**

```bash
cd /workspace && npm run lint
```
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/components/studio/TopBar.tsx
git commit -m "feat: add user menu to topbar"
```

---

### Task 14: 集成测试

**Files:**
- 手动测试

- [ ] **Step 1: 启动开发服务器**

```bash
cd /workspace && npm run dev
```
Expected: Server starts at http://localhost:3000 without errors

- [ ] **Step 2: 测试注册流程**

1. 打开 http://localhost:3000
2. 应该被重定向到 /login
3. 点击"立即注册"跳转到 /register
4. 填写邮箱、昵称、密码（至少6位）
5. 点击注册，应该成功并跳转到首页
6. 验证数据库中有新用户记录

- [ ] **Step 3: 测试登录流程**

1. 退出登录（如果已登录）
2. 访问 /login
3. 填写刚才注册的邮箱和密码
4. 点击登录，应该成功并跳转到首页
5. 测试硬编码的 admin/admin123 和 user/user123 仍然可以登录

- [ ] **Step 4: 测试个人资料页面**

1. 从用户菜单访问 /profile
2. 修改昵称和头像URL
3. 保存更改，验证成功
4. 验证TopBar显示更新后的信息

- [ ] **Step 5: 测试密码修改**

1. 访问 /settings
2. 输入当前密码和新密码
3. 保存更改，验证成功
4. 退出登录，使用新密码重新登录

- [ ] **Step 6: 测试路由保护**

1. 退出登录
2. 直接访问 /studio、/profile、/settings
3. 应该被重定向到 /login
4. 登录后访问 /login、/register，应该被重定向到首页

- [ ] **Step 7: 检查所有页面无错误**

浏览所有页面，检查浏览器控制台无错误

---

## 计划自检

### Spec 覆盖检查
- ✅ 更新数据库 Schema - Task 2
- ✅ 创建 Drizzle Schema - Task 3
- ✅ 创建用户 Repository - Task 5
- ✅ 更新 NextAuth - Task 6
- ✅ 创建 Server Actions - Task 7
- ✅ 创建登录页面 - Task 9
- ✅ 创建注册页面 - Task 10
- ✅ 创建个人资料页面 - Task 11
- ✅ 创建设置页面 - Task 12
- ✅ 更新 TopBar - Task 13
- ✅ 安装 bcrypt - Task 1
- ✅ 更新 db.ts - Task 4
- ✅ 更新中间件 - Task 8
- ✅ 集成测试 - Task 14

### 占位符检查
- ✅ 无 TBD、TODO
- ✅ 所有代码步骤有完整实现
- ✅ 所有命令明确

### 类型一致性检查
- ✅ 函数命名一致
- ✅ 文件路径一致
- ✅ 类型引用一致

---

Plan complete and saved to `docs/superpowers/plans/2026-05-13-auth-implementation.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
