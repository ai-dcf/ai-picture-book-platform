# PictureBook - AI Picture Book Generator

一个基于 AI 的儿童绘本生成器。

## 环境配置

### 1. 复制环境变量文件

```bash
cp .env.local.example .env.local
```

### 2. 配置环境变量

编辑 `.env.local` 文件，配置以下环境变量：

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `AUTH_SECRET` | NextAuth 加密密钥 | your-secret-key-here |
| `NEXTAUTH_URL` | 应用 URL | http://localhost:3000 |
| `AUTH_ADMIN_USERNAME` | 管理员用户名 | admin |
| `AUTH_ADMIN_PASSWORD` | 管理员密码 | admin123 |
| `AUTH_USER_USERNAME` | 普通用户用户名 | user |
| `AUTH_USER_PASSWORD` | 普通用户密码 | user123 |

### 3. 生成安全的 AUTH_SECRET

可以使用以下命令生成一个安全的密钥：

```bash
openssl rand -base64 32
```

## 初始化数据库

数据库会在首次启动时自动初始化。

SQLite 数据库文件位于 `data/sqlite.db`。

## 启动开发服务器

```bash
npm install
npm run dev
```

访问 http://localhost:3000 查看应用。

## 用户登录

- **管理员账号**：用户名 `admin`，密码 `admin123`
- **普通用户账号**：用户名 `user`，密码 `user123`

## 技术栈

- **框架**：Next.js 15 (App Router)
- **语言**：TypeScript
- **样式**：Tailwind CSS
- **数据库**：SQLite (better-sqlite3)
- **认证**：NextAuth.js v5
- **状态管理**：TanStack Query
- **动画**：Framer Motion
