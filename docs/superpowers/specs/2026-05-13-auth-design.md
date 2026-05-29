# 用户认证与个人中心设计

**日期**: 2026-05-13  
**状态**: 设计完成  
**负责人**: AI Assistant

---

## 概述

实现用户注册登录、个人资料和设置功能，使用邮箱/密码认证，数据存储在 SQLite 数据库中。

---

## 架构设计

### 技术栈

- **认证**: NextAuth 5 (Credentials Provider)
- **ORM**: Drizzle ORM (用于用户表管理)
- **数据库**: SQLite (现有)
- **密码哈希**: bcrypt
- **UI**: React + shadcn/ui (现有)

### 目录结构

```
src/
├── lib/
│   ├── db/
│   │   ├── schema.sql          # 数据库 schema（更新）
│   │   ├── schema-drizzle.ts   # Drizzle schema（新增）
│   │   └── repositories/
│   │       ├── project-repository.ts（现有）
│   │       └── user-repository.ts（新增）
│   └── db.ts（更新）
├── app/
│   ├── actions/
│   │   └── auth.ts（新增）
│   ├── login/
│   │   └── page.tsx（新增）
│   ├── register/
│   │   └── page.tsx（新增）
│   ├── profile/
│   │   └── page.tsx（新增）
│   └── settings/
│       └── page.tsx（新增）
├── components/
│   └── studio/
│       └── TopBar.tsx（更新）
└── auth.ts（更新）
```

---

## 数据库设计

### 新增表

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

### Drizzle Schema

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
```

---

## 功能设计

### 1. 注册功能

**页面**: `/register`

**流程**:
1. 用户输入邮箱、昵称、密码、确认密码
2. 前端验证格式
3. 调用 `registerUser` action
4. 检查邮箱唯一性
5. 密码哈希（bcrypt）
6. 创建用户记录
7. 自动登录
8. 跳转到首页

**表单验证**:
- 邮箱格式有效
- 密码至少 6 位
- 密码和确认密码一致

---

### 2. 登录功能

**页面**: `/login`

**流程**:
1. 用户输入邮箱、密码
2. 调用 NextAuth signIn
3. 验证用户存在
4. 验证密码
5. 创建会话
6. 跳转到回调 URL

---

### 3. 个人资料页面

**页面**: `/profile`

**功能**:
- 显示用户头像（可上传）
- 显示/编辑昵称
- 显示邮箱（只读）
- 显示注册日期
- 更新个人信息

---

### 4. 用户设置页面

**页面**: `/settings`

**功能**:
- 修改密码
- 修改邮箱（可选）
- 删除账号（可选）
- 深色/浅色模式切换（如果还没有）

---

### 5. 顶部导航更新

**更新**: [`TopBar.tsx`](file:///workspace/src/components/studio/TopBar.tsx)

**功能**:
- 显示用户头像
- 下拉菜单包含：
  - 个人资料
  - 设置
  - 登出

---

## NextAuth 配置更新

### 认证流程

1. **Credentials Provider**
   - 支持登录
   - 集成用户 Repository
   - 密码验证

2. **Session & JWT**
   - 包含: id, email, nickname, avatarUrl
   - 30 天过期

3. **页面路由**
   - `/login` - 登录页
   - `/register` - 注册页

---

## Server Actions

### auth.ts Actions

```typescript
// 注册用户
async function registerUser(data: {
  email: string;
  nickname: string;
  password: string;
}): Promise<{ success: boolean; error?: string }>

// 更新个人资料
async function updateProfile(data: {
  nickname?: string;
  avatarUrl?: string;
}): Promise<{ success: boolean; error?: string }>

// 修改密码
async function changePassword(data: {
  currentPassword: string;
  newPassword: string;
}): Promise<{ success: boolean; error?: string }>
```

---

## 安全性

### 密码处理

- 使用 bcrypt 哈希密码
- 最小工作因子 10
- 不在会话中存储明文密码

### 会话管理

- JWT 会话，30 天过期
- 所有敏感操作验证用户身份
- 使用 NextAuth 的安全机制

---

## 实现清单

### 数据库层
- [ ] 更新 schema.sql，添加用户相关表
- [ ] 创建 Drizzle schema 文件
- [ ] 创建 user-repository.ts
- [ ] 更新 db.ts，初始化 Drizzle

### 认证层
- [ ] 更新 auth.ts，集成用户 Repository
- [ ] 创建 Server Actions (auth.ts)
- [ ] 安装 bcrypt 依赖

### 页面层
- [ ] 创建登录页面
- [ ] 创建注册页面
- [ ] 创建个人资料页面
- [ ] 创建用户设置页面
- [ ] 更新 TopBar 组件

### 集成测试
- [ ] 测试注册流程
- [ ] 测试登录流程
- [ ] 测试个人资料更新
- [ ] 测试密码修改
- [ ] 测试登出功能

---

## 兼容性考虑

- 保持现有项目 Repository 不变
- 向后兼容硬编码的 admin/user 用户（过渡期）
- 项目的 user_id 字段已存在，无需改动

---

## 验收标准

1. ✅ 用户可以注册新账号
2. ✅ 用户可以登录/登出
3. ✅ 用户可以访问个人资料页面
4. ✅ 用户可以编辑昵称和头像
5. ✅ 用户可以修改密码
6. ✅ 顶部导航显示用户信息
7. ✅ 未登录用户被重定向到登录页
8. ✅ 已登录用户看不到登录/注册链接
