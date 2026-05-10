---
name: nextjs-project-builder
description: 基于 Next.js 技术栈快速创建完整项目的技能。只要用户提到 Next.js、nextjs、App Router、全栈项目、管理后台、官网、SaaS、AI 应用、落地页、控制台、后台系统、内容站、项目脚手架、从 0 到 1 搭项目，或者希望根据需求快速生成一套可运行的 Next.js 项目结构、页面、路由、接口、状态管理和工程配置，就应优先使用本技能。即使用户没有明确说“创建项目”，只要需求本质是在用 Next.js 快速搭建一个完整应用，也应主动触发本技能。
metadata:
  priority: 5
  pathPatterns:
    - 'next.config.*'
    - 'next-env.d.ts'
    - 'app/**'
    - 'src/app/**'
    - 'pages/**'
    - 'src/pages/**'
    - 'components/**'
    - 'src/components/**'
    - 'tailwind.config.*'
    - 'postcss.config.*'
    - 'tsconfig.json'
    - 'package.json'
  promptSignals:
    phrases:
      - "next.js"
      - "nextjs"
      - "app router"
      - "创建 next 项目"
      - "搭建 nextjs 项目"
      - "nextjs 脚手架"
      - "nextjs 管理后台"
      - "nextjs 官网"
      - "nextjs ai 应用"
    anyOf:
      - "从0到1"
      - "完整项目"
      - "快速搭建"
      - "落地页"
      - "后台系统"
      - "dashboard"
      - "saas"
      - "博客"
      - "cms"
      - "项目结构"
    noneOf: []
    minScore: 6
---

# Next.js Project Builder

用于根据用户需求，快速设计并创建一套完整、可运行、可扩展的 Next.js 项目。重点不是只生成几页页面，而是帮助用户在短时间内拿到“能开发、能扩展、能部署”的完整工程骨架。

## 核心目标

- 根据用户业务目标快速判断项目类型。
- 选择合适的 Next.js 技术组合，而不是无脑堆库。
- 生成合理的目录结构、路由结构、页面骨架、组件层次和服务端接口组织方式。
- 默认遵守 App Router、Server Component、Route Handler、Node.js runtime 等最佳实践。
- 在用户需求涉及 AI、鉴权、后台、内容管理、营销站点时，给出成体系的工程落地方案。

## 适用场景

当用户提出以下任务时，应优先使用本技能：

- “帮我从 0 创建一个 Next.js 项目”
- “做一个 Next.js SaaS 后台”
- “给我搭一个官网 + 博客 + 管理后台”
- “做一个 Next.js 的 AI 聊天应用”
- “按需求快速起一个完整的 Web 项目”
- “帮我生成 nextjs 项目结构和基础代码”

## 第一步先判断项目类型

先把需求归到以下一种或多种类型，再决定技术方案：

1. 营销官网 / 落地页
2. 后台系统 / 控制台 / Dashboard
3. 内容站 / 博客 / 文档站
4. SaaS 产品前台 + 后台
5. AI 应用（聊天、工作流、生成式内容）
6. 电商 / 表单 / 多步骤业务系统

如果用户需求不明确，先补齐这些信息：

- 项目目标是什么？
- 主要用户是谁？
- 需要哪些核心页面？
- 是否需要登录与权限？
- 是否需要数据库？
- 是否需要 AI 能力？
- 是否需要后台管理？
- 是否有部署目标，如 Vercel、自托管、Docker？

## 默认技术栈建议

若用户没有特别限制，优先推荐以下默认组合：

- Next.js 最新稳定版 + App Router
- TypeScript
- Tailwind CSS
- ESLint
- `src/` 目录模式
- Route Handlers 处理对外 API
- Server Components 优先
- 客户端状态只在必要时引入，如 Zustand
- 服务端数据管理优先用 Server Components / Route Handlers，必要时再加 React Query

按场景补充：

- 后台系统：可加 `shadcn/ui`
- 复杂表单：可加 `react-hook-form` + `zod`
- AI 应用：可加模型网关层、流式接口、可观测性
- 多租户 / SaaS：可加权限模型、租户上下文、审计日志

## 项目创建的工作流程

当用户要求“快速创建完整项目”时，按这个流程执行：

### 1. 识别需求并拆成工程能力

把用户需求翻译成这些工程维度：

- 页面体系
- 路由体系
- 数据来源
- 接口需求
- 鉴权与权限
- UI 设计系统
- 状态管理
- 部署方式
- 第三方服务

### 2. 给出最小可运行版本

优先生成一个“第一天就能跑起来”的版本，不要一开始就把所有高级能力都塞进去。

应至少包括：

- 目录结构
- 首页或主入口页面
- 关键页面骨架
- 公共布局
- 基础组件
- 必要的 API 路由
- 环境变量模板
- 运行与部署说明

### 3. 决定渲染与数据模式

默认规则：

- 静态内容优先 Server Components
- 用户态数据优先服务端获取
- 表单提交和内部 mutation 评估是否用 Server Action
- 对外 API、流式输出、Webhook 场景优先 Route Handlers

### 4. 设计目录结构

默认优先推荐：

```text
src/
  app/
    (marketing)/
    (dashboard)/
    api/
  components/
    ui/
    shared/
    business/
  features/
    auth/
    dashboard/
    ai/
  lib/
    utils/
    config/
    api/
  hooks/
  types/
```

如果项目复杂度较高，再进一步按业务域细分。

## AI 应用场景的额外规则

如果用户要做 Next.js AI 应用，必须主动补充这些内容：

- 使用 Route Handlers 或专门的服务端层处理模型请求
- 默认使用 Node.js runtime，不随意切 Edge
- 将模型供应商调用集中到 `lib/api/ai` 或 `features/ai/server`
- 统一封装：
  - provider
  - model
  - timeout
  - retry
  - requestId
  - traceId
  - stream / non-stream
- 前端不要直接暴露敏感 key
- 流式接口优先设计为 SSE 或分块流返回

## 输出时必须包含的内容

当你基于用户需求给出完整项目方案或直接生成项目时，优先按下面结构输出：

## 项目目标
- 简述产品目标与核心用户

## 技术栈
- 列出框架、样式、状态、数据、鉴权、部署方案

## 目录结构
- 给出可运行项目的目录树

## 核心页面
- 列出首页、列表页、详情页、后台页、设置页等

## 路由与数据流
- 说明页面如何取数、哪些是服务端、哪些是客户端

## 服务端接口
- 说明 Route Handlers 或 Server Actions 的职责

## 开发步骤
- 按顺序给出初始化、页面搭建、接口接入、部署的执行步骤

## 可直接生成的内容
- 如果用户要求直接落地，应进一步生成：
  - `package.json`
  - `src/app` 关键页面
  - `components` 基础组件
  - `api` 路由骨架
  - 环境变量说明

## 决策规则

### 什么时候优先用 Server Components

- 页面主要用于展示
- 数据来自服务端
- 不需要浏览器交互状态

### 什么时候需要 Client Components

- 使用 `useState`、`useEffect`
- 需要浏览器事件交互
- 需要依赖 DOM API

### 什么时候优先 Route Handlers

- 对外 API
- 第三方 webhook
- 流式输出
- 文件上传下载

### 什么时候考虑 Server Actions

- 站内表单提交
- 内部 mutation
- 不需要单独暴露 HTTP API

## 默认项目模板建议

### 官网 / 落地页

- App Router
- Server Components 优先
- `app/(marketing)`
- `components/shared`
- `next/image`
- `metadata` / `generateMetadata`

### 后台系统

- `app/(dashboard)`
- 登录页 + 控制台布局 + 菜单导航
- 表格、筛选、分页、表单
- 权限边界
- Route Handlers + 服务端数据获取

### AI 应用

- 聊天页 / 历史记录 / 设置页
- 流式返回接口
- 模型配置
- 请求日志与错误码
- 供应商适配层

## 主动提醒用户的风险点

- 不要一开始就把所有页面都做成 Client Components
- 不要在客户端直接调用模型供应商 API
- 不要混用太多状态管理方案
- 不要把所有业务代码都塞进 `app/`
- 不要忽略部署环境、环境变量和 runtime 差异
- 不要在项目初始化阶段引入过重、暂时用不到的依赖

## 简短示例

**用户说：**
“帮我快速搭一个 Next.js 的 AI SaaS 项目，要有官网、登录、聊天页和后台设置页。”

**你应该重点给出：**

- 推荐技术栈
- 可运行的目录结构
- 官网与后台的路由分组
- AI 接口放在哪一层
- 流式输出与 Node runtime 约束
- 可以直接开始编码的初始化步骤
