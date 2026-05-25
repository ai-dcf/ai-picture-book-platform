# 项目目录结构重构设计方案

## 一、现状问题诊断

### 1.1 当前目录结构总览

```
src/
├── app/                    # Next.js 路由层
├── components/             # UI 组件（editor/ + studio/ + ui/）
├── config/                 # 仅含 age-spec.ts
├── hooks/                  # 通用 hooks
├── lib/                    # 大杂烩：db + 工具 + 厂商预设 + 引用解析
├── modules/                # 业务模块（studio / model-config / project-history）
├── platform/               # AI 网关 + 配置加载
├── prompts/                # 提示词工程
├── providers/              # 全局 Provider
├── types/                  # 仅含 picturebook.ts + next-auth.d.ts
├── auth.ts                 # 认证配置（根目录散落）
└── middleware.ts            # 路由守卫（根目录散落）
```

### 1.2 核心问题清单

| # | 问题 | 严重程度 | 具体表现 |
|---|------|---------|---------|
| 1 | **配置项散布** | 🔴 高 | 默认年龄在 `age-spec.ts`，默认画风在 `prompts/context.ts`，默认比例在 `context.ts` 和 `StudioContext.tsx` 各写一次，Auth Secret 在 `auth.ts` 和 `middleware.ts` 重复硬编码 |
| 2 | **类型重复定义** | 🔴 高 | `ModelCredentialConfig/ModelItemConfig/ModelDomainConfig/ModelsConfig` 在 `platform/config/loaders/model-loader.ts` 和 `modules/model-config/presentation/types.ts` 两处各定义一份 |
| 3 | **lib/ 职责不清** | 🟡 中 | `db.ts`(框架基础设施)、`image-vendor-presets.ts`(AI策略配置)、`prompt-ref-parser.ts`(业务逻辑)、`utils.ts`(通用工具) 混在一起 |
| 4 | **platform/ 与 lib/ 边界模糊** | 🟡 中 | `platform/ai/strategies/openai-compatible.ts` 引用 `lib/image-vendor-presets.ts`，但 vendor-presets 本应是 platform 层的一部分 |
| 5 | **God File** | 🔴 高 | `StudioContext.tsx` 1171 行、`picturebook.ts` 306 行、`openai-compatible.ts` 628 行 |
| 6 | **模块结构不一致** | 🟡 中 | `studio/` 有 application/domain/infrastructure/presentation 四层，`model-config/` 只有 presentation，`project-history/` 完全扁平 |
| 7 | **框架代码与业务代码未分离** | 🔴 高 | `auth.ts`、`middleware.ts`、`db.ts` 是框架层代码，但散落在 src 根目录和 lib 中间 |
| 8 | **prompts/ 跨层引用** | 🟡 中 | 提示词既是领域知识(specs/builders)，又被 presentation 层 StudioContext 直接 import |

---

## 二、重构设计原则

```
┌──────────────────────────────────────────────────────────┐
│  分层原则：上层可依赖下层，下层不可依赖上层，跨层通过接口解耦   │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Layer 4: Presentation（表现层）                          │
│           components / hooks / pages                     │
│           ↕ 只通过接口/use-case 调用                      │
│  Layer 3: Application（应用层/用例层）                     │
│           use-cases / api-routes                         │
│           ↕ 只依赖 domain 接口                            │
│  Layer 2: Domain（领域层）                                │
│           types / prompts / parsers / errors             │
│           ↕ 无外部依赖，纯业务逻辑                         │
│  Layer 1: Infrastructure（基础设施层/框架层）              │
│           db / auth / ai-gateway / config / utils        │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

**三条铁律：**
1. **配置单一源** — 每个配置值只在 `core/config/` 一处定义，其他位置只 import 引用
2. **框架业务分离** — 框架代码（DB、Auth、AI 网关）放在 `core/`，业务代码（绘本领域逻辑）放在 `domain/`，绝不交叉
3. **模块独立可拔插** — 每个功能模块有明确边界，模块间通过类型接口通信，不直接引用内部实现

---

## 三、目标目录结构

```
src/
│
├── core/                              # 【框架层】与业务无关的基础设施
│   ├── config/                        #   全局配置中心（唯一配置源）
│   │   ├── defaults.ts                #     业务默认值集中维护
│   │   ├── env.ts                     #     环境变量统一解析
│   │   └── index.ts                   #     统一导出
│   │
│   ├── db/                            #   数据库基础设施
│   │   ├── connection.ts              #     连接管理（原 lib/db.ts）
│   │   ├── schema.ts                  #     Drizzle schema（原 lib/db/schema-drizzle.ts）
│   │   ├── schema.sql                 #     SQL schema
│   │   └── index.ts
│   │
│   ├── auth/                          #   认证基础设施
│   │   ├── nextauth.ts                #     NextAuth 配置（原 src/auth.ts）
│   │   ├── middleware.ts              #     路由守卫（原 src/middleware.ts）
│   │   └── index.ts
│   │
│   ├── ai/                            #   AI 网关基础设施（原 platform/ai + lib/部分）
│   │   ├── contracts/                 #     接口契约
│   │   │   ├── text-gateway.ts
│   │   │   ├── image-gateway.ts
│   │   │   ├── model-health.ts
│   │   │   ├── types.ts              #     共享模型配置类型（消除重复定义）
│   │   │   └── index.ts
│   │   ├── registry/                  #     策略注册与工厂
│   │   │   ├── model-factory.ts
│   │   │   └── index.ts
│   │   ├── strategies/                #     策略实现
│   │   │   └── openai-compatible/     #       拆分为子目录（原 628 行单文件）
│   │   │       ├── text-strategy.ts
│   │   │       ├── image-strategy.ts
│   │   │       ├── image-size-mapper.ts
│   │   │       ├── vendor-presets.ts  #         图像厂商预设（原 lib/image-vendor-presets.ts）
│   │   │       └── index.ts
│   │   ├── loader/                    #     模型配置加载
│   │   │   ├── model-loader.ts
│   │   │   └── index.ts
│   │   ├── init.ts                    #     模型初始化编排
│   │   └── index.ts
│   │
│   └── utils/                         #   通用工具
│       ├── cn.ts                      #     className 合并
│       └── index.ts
│
├── domain/                            # 【领域层】核心业务逻辑（不依赖任何框架实现）
│   ├── picturebook/                   #   绘本领域
│   │   ├── types/                     #     领域类型（拆分原 306 行 god-file）
│   │   │   ├── enums.ts              #       枚举：TargetAge, ArtStyle, PageCount...
│   │   │   ├── constants.ts          #       常量：TARGET_AGES, ART_STYLES, STAGE_LABELS...
│   │   │   ├── project.ts            #       ProjectInfo, ProjectStatus
│   │   │   ├── story.ts              #       StoryData, StoryEntry, EmotionCurvePoint
│   │   │   ├── storyboard.ts         #       StoryboardData, StoryboardPageData
│   │   │   ├── asset.ts              #       AssetItem, AssetsData, ImageRef
│   │   │   ├── page.ts               #       PageItem, PageStatus, CoverData
│   │   │   ├── editor.ts             #       EditorPageState, TextBoxStyle, TextBoxLayout
│   │   │   ├── state.ts              #       PictureBookState（根状态）
│   │   │   └── index.ts              #       统一导出（保持 @/types/picturebook 兼容）
│   │   │
│   │   ├── prompts/                   #     提示词工程
│   │   │   ├── builders/             #       提示词构建器
│   │   │   │   ├── story.ts
│   │   │   │   ├── storyboard.ts
│   │   │   │   ├── asset.ts
│   │   │   │   ├── page.ts
│   │   │   │   ├── project-config-recommend.ts
│   │   │   │   ├── shared.ts
│   │   │   │   └── index.ts
│   │   │   ├── specs/                #       规则规格
│   │   │   │   ├── compliance-spec.ts
│   │   │   │   ├── continuity-spec.ts
│   │   │   │   ├── genre-spec.ts
│   │   │   │   ├── model-spec.ts
│   │   │   │   ├── style-spec.ts
│   │   │   │   └── index.ts
│   │   │   ├── context.ts            #       提示词上下文构建
│   │   │   ├── enhancer.ts           #       提示词增强
│   │   │   ├── types.ts              #       提示词类型
│   │   │   └── index.ts
│   │   │
│   │   ├── parsers/                   #     响应解析器
│   │   │   ├── story-parser.ts
│   │   │   ├── storyboard-parser.ts
│   │   │   ├── project-config-recommend-parser.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── ref-parser/               #     引用标签解析（原 lib/prompt-ref-parser.ts）
│   │   │   └── index.ts
│   │   │
│   │   ├── age-spec/                  #     年龄分组规格（原 config/age-spec.ts）
│   │   │   └── index.ts
│   │   │
│   │   └── errors/                    #     领域错误
│   │       ├── generate-errors.ts
│   │       └── index.ts
│   │
│   └── studio/                        #   Studio 子域
│       ├── use-cases/                 #     业务用例
│       │   ├── generate-story.ts
│       │   ├── generate-storyboard.ts
│       │   ├── generate-asset-image.ts
│       │   ├── generate-page-image.ts
│       │   ├── generate-page-prompt.ts
│       │   ├── generate-cover.ts
│       │   ├── recommend-project-config.ts
│       │   ├── helpers.ts
│       │   └── index.ts
│       └── export/                    #     导出功能
│           └── export-book.ts
│
├── modules/                           # 【功能模块层】可组合的业务模块
│   ├── project/                       #   项目管理
│   │   ├── repository.ts             #     项目仓库（原 lib/db/repositories/project-repository.ts）
│   │   ├── db-types.ts               #     DB 行类型（原 lib/db/types.ts）
│   │   ├── types.ts                  #     项目历史类型
│   │   └── index.ts
│   │
│   ├── user/                          #   用户管理
│   │   ├── repository.ts             #     用户仓库（原 lib/db/repositories/user-repository.ts）
│   │   └── index.ts
│   │
│   └── model-config/                  #   模型配置管理
│       ├── presentation/
│       │   ├── components/
│       │   │   └── ModelsConfigPage.tsx
│       │   ├── hooks/
│       │   │   ├── use-model-config.ts
│       │   │   └── use-model-health.ts
│       │   ├── vendor-presets.ts      #     前端用厂商预设
│       │   ├── utils.ts
│       │   └── types.ts              #     引用 core/ai/contracts/types 的类型
│       └── index.ts
│
├── app/                               # 【路由层】Next.js App Router（保持不变）
│   ├── layout.tsx
│   ├── page.tsx
│   ├── studio/
│   ├── editor/
│   ├── login/
│   ├── ...（页面路由不变）
│   └── api/                           #   API 路由（仅做参数校验 + 调用用例）
│       ├── studio/
│       │   ├── generate-story/route.ts
│       │   └── ...
│       ├── projects/
│       ├── model-config/
│       └── ...
│
├── components/                        # 【共享 UI 层】
│   ├── ui/                            #   基础 UI 组件（shadcn，不变）
│   ├── studio/                        #   Studio 业务组件
│   │   ├── stages/
│   │   │   ├── Stage1Init.tsx
│   │   │   └── ...
│   │   ├── LeftSidebar.tsx
│   │   ├── TopBar.tsx
│   │   ├── ModelConfigBanner.tsx
│   │   ├── PromptEditor.tsx
│   │   └── PromptRefPicker.tsx
│   └── editor/                        #   Editor 业务组件
│       ├── EditorCanvas.tsx
│       └── EditorControlPanel.tsx
│
├── features/                          # 【功能切片层】按功能聚合的 UI+逻辑
│   └── studio/                        #   Studio 功能切片
│       ├── context/                   #     状态管理（拆分原 1171 行 StudioContext）
│       │   ├── StudioContext.tsx      #       Provider + 基础 dispatch
│       │   ├── reducer.ts            #       Reducer 逻辑提取
│       │   ├── actions.ts            #       Action 类型定义
│       │   ├── initial-state.ts      #       初始状态构建
│       │   ├── cascade-logic.ts      #       级联更新逻辑
│       │   └── index.ts
│       ├── hooks/
│       │   ├── use-studio.ts
│       │   ├── use-studio-generate.ts
│       │   └── use-studio-save.ts    #       自动保存逻辑提取
│       └── components/
│           └── StudioPage.tsx
│
├── hooks/                             # 【全局共享 Hooks】
│   ├── use-mobile.tsx
│   └── use-toast.ts
│
├── providers/                         # 【全局 Provider】
│   ├── query-provider.tsx
│   └── session-provider.tsx
│
└── types/                             # 【全局类型补丁】
    └── next-auth.d.ts                 #   仅保留第三方类型扩展
```

---

## 四、配置集中化方案（核心改动）

### 4.1 `core/config/defaults.ts` — 业务默认值唯一源

```typescript
// 所有业务默认值集中在此文件，其他位置只 import 引用

export const DEFAULTS = {
  targetAge: "3-5" as const,
  artStyle: "水彩温暖风" as const,
  pageCount: 16 as const,
  aspectRatio: "16:9" as const,
  pageTextPrompt: "...",  // 从 age-spec 迁移

  auth: {
    secret: process.env.AUTH_SECRET || "development-secret-key-change-in-production",
    adminUsername: process.env.AUTH_ADMIN_USERNAME || "admin",
    adminPassword: process.env.AUTH_ADMIN_PASSWORD || "admin123",
    userUsername: process.env.AUTH_USER_USERNAME || "user",
    userPassword: process.env.AUTH_USER_PASSWORD || "user123",
    sessionMaxAge: 30 * 24 * 60 * 60,
  },

  db: {
    dir: "data",
    filename: "sqlite.db",
  },

  export: {
    imageSize: 2048,
    fontFamily: "'Noto Serif SC', serif",
  },

  middleware: {
    publicPaths: ["/login", "/register", "/api/auth", "/api/studio/prompt-validation", "/"],
    apiPublicPrefixes: ["/api/projects"],
  },
} as const;
```

### 4.2 当前配置散布位置 → 迁移对照表

| 配置项 | 当前位置 | 迁移到 |
|--------|---------|--------|
| 默认目标年龄 `"3-5"` | `config/age-spec.ts` | `core/config/defaults.ts` |
| 默认画风 `"水彩温暖风"` | `prompts/context.ts` | `core/config/defaults.ts` |
| 默认页数 `16` | `prompts/context.ts` | `core/config/defaults.ts` |
| 默认宽高比 `"16:9"` | `prompts/context.ts` + `StudioContext.tsx` | `core/config/defaults.ts` |
| Auth Secret | `auth.ts` + `middleware.ts` 重复 | `core/config/defaults.ts` → 两处引用 |
| DB 路径 | `lib/db.ts` 硬编码 | `core/config/defaults.ts` |
| 导出尺寸/字体 | `studio/infrastructure/export-book.ts` 硬编码 | `core/config/defaults.ts` |
| 公开路由列表 | `middleware.ts` 硬编码 | `core/config/defaults.ts` |

### 4.3 类型重复定义消除

```
当前：
  platform/config/loaders/model-loader.ts  定义 ModelCredentialConfig, ModelItemConfig, ...
  modules/model-config/presentation/types.ts  也定义了一份几乎一样的

目标：
  core/ai/contracts/types.ts  — 唯一定义源
  model-loader.ts  → import from "@/core/ai/contracts/types"
  model-config/types.ts  → import from "@/core/ai/contracts/types"（re-export 前端兼容）
```

---

## 五、God File 拆分方案

### 5.1 `StudioContext.tsx` (1171 行) → 6 个文件

| 文件 | 职责 | 预估行数 |
|------|------|---------|
| `actions.ts` | Action 类型联合定义 | ~50 |
| `initial-state.ts` | 初始状态 + 初始构建函数 | ~80 |
| `cascade-logic.ts` | applyCascadeForCoreParams / applyCascadeForStyleParams / markDownstreamReview | ~120 |
| `reducer.ts` | Reducer 主函数 | ~500 |
| `StudioContext.tsx` | Provider + Context + 自动保存 | ~200 |
| `use-studio-save.ts` | triggerSaveToServer + 自动保存 hook | ~80 |

### 5.2 `picturebook.ts` (306 行) → 9 个文件

| 文件 | 内容 |
|------|------|
| `enums.ts` | TargetAge, PageCount, AspectRatio, ArtStyle, SaveStatus, ProjectStatus, StageStatus, StageNumber, PageStatus, AssetStatus |
| `constants.ts` | TARGET_AGES[], ART_STYLES[], STAGE_LABELS, PAGE_STATUS_LABELS, EMOTION_INTENSITY_MAP, BASE_IMAGE_HISTORY_LIMIT 等 |
| `project.ts` | ProjectInfo, ProjectConfigRecommendation |
| `story.ts` | StoryData, StoryEntry, EmotionCurvePoint |
| `storyboard.ts` | StoryboardData, StoryboardPageData |
| `asset.ts` | AssetItem, AssetsData, ImageRef |
| `page.ts` | PageItem, CoverData |
| `editor.ts` | EditorPageState, TextBoxStyle, TextBoxLayout |
| `state.ts` | PictureBookState（根状态） |

### 5.3 `openai-compatible.ts` (628 行) → 4 个文件

| 文件 | 内容 |
|------|------|
| `vendor-presets.ts` | imageModelConfigs + ImageAspectRatio/ImageSizeTier 类型 |
| `image-size-mapper.ts` | mapImageSizeForModel + parseSize + findClosestAspectRatio + 辅助函数 |
| `text-strategy.ts` | OpenAICompatibleTextStrategy 类 |
| `image-strategy.ts` | OpenAICompatibleImageStrategy 类 |

---

## 六、依赖关系与分层规则

### 6.1 层间依赖规则（严格单向）

```
┌─────────────────────────────────────────────────────┐
│  app/ (路由层)                                       │
│    可依赖：domain/*, modules/*, features/*, core/*    │
├─────────────────────────────────────────────────────┤
│  features/ (功能切片层)                               │
│    可依赖：domain/*, modules/*, components/*, core/*  │
│    不可依赖：app/*                                    │
├─────────────────────────────────────────────────────┤
│  modules/ (功能模块层)                                │
│    可依赖：domain/*, core/*                           │
│    不可依赖：features/*, app/*, components/*          │
├─────────────────────────────────────────────────────┤
│  domain/ (领域层)                                    │
│    可依赖：core/* （仅 core/config 和 core/utils）     │
│    不可依赖：modules/*, features/*, app/*, components  │
├─────────────────────────────────────────────────────┤
│  core/ (基础设施层)                                   │
│    不可依赖：任何上层模块                              │
│    仅依赖：外部 npm 包                                │
└─────────────────────────────────────────────────────┘
```

### 6.2 关键依赖链路示例

**故事生成完整链路：**
```
app/api/studio/generate-story/route.ts   ← 路由层：参数校验
  → domain/studio/use-cases/generate-story.ts  ← 用例层：编排流程
    → domain/picturebook/prompts/builders/story.ts  ← 领域层：构建提示词
    → domain/picturebook/parsers/story-parser.ts    ← 领域层：解析响应
    → core/ai/registry/model-factory.ts             ← 基础设施：获取模型
      → core/ai/strategies/openai-compatible/       ← 基础设施：调用 AI
```

**项目保存链路：**
```
features/studio/context/StudioContext.tsx  ← 功能切片：触发保存
  → modules/project/repository.ts          ← 模块层：数据持久化
    → core/db/connection.ts                ← 基础设施：DB 连接
```

---

## 七、迁移路径（分阶段执行）

### Phase 1：配置集中化（风险最低，收益最高）

1. 创建 `core/config/defaults.ts` + `core/config/env.ts`
2. 将所有散布的默认值迁移至 `defaults.ts`
3. 所有引用点改为 `import { DEFAULTS } from "@/core/config"`
4. 消除 `auth.ts` 和 `middleware.ts` 中重复的 Auth Secret
5. **验证**：`next build` 通过

### Phase 2：core/ 层建立（框架代码归位）

1. 创建 `core/db/`，迁移 `lib/db.ts` → `core/db/connection.ts`，`lib/db/schema-drizzle.ts` → `core/db/schema.ts`
2. 创建 `core/auth/`，迁移 `src/auth.ts` → `core/auth/nextauth.ts`，`src/middleware.ts` → `core/auth/middleware.ts`
3. 将 `platform/` 整体迁移至 `core/ai/`，同时：
   - 消除 `model-loader.ts` 和 `model-config/types.ts` 的类型重复
   - 拆分 `openai-compatible.ts` 为子目录
   - 迁移 `lib/image-vendor-presets.ts` → `core/ai/strategies/openai-compatible/vendor-presets.ts`
4. 创建 `core/utils/`，迁移 `lib/utils.ts`
5. **验证**：`next build` 通过

### Phase 3：domain/ 层建立（领域逻辑归位）

1. 创建 `domain/picturebook/types/`，拆分 `types/picturebook.ts` 为 9 个文件
2. 保持 `domain/picturebook/types/index.ts` 的 re-export 路径兼容
3. 迁移 `prompts/` → `domain/picturebook/prompts/`
4. 迁移 `config/age-spec.ts` → `domain/picturebook/age-spec/`
5. 迁移 `lib/prompt-ref-parser.ts` → `domain/picturebook/ref-parser/`
6. 迁移 `modules/studio/domain/` (parsers, errors) → `domain/picturebook/parsers/` 和 `domain/picturebook/errors/`
7. 迁移 `modules/studio/application/use-cases/` → `domain/studio/use-cases/`
8. 迁移 `modules/studio/infrastructure/export-book.ts` → `domain/studio/export/`
9. **验证**：`next build` 通过

### Phase 4：features/ 层建立（StudioContext 拆分）

1. 创建 `features/studio/`，迁移 `modules/studio/presentation/` 的 context + hooks + StudioPage
2. 拆分 `StudioContext.tsx` 为 6 个文件
3. 迁移 `modules/project-history/` → 重构为 `modules/project/` 的子部分
4. 清理空目录
5. **验证**：`next build` 通过

### Phase 5：路径别名更新（可选优化）

当前 `tsconfig.json` 只有 `@/*` → `./src/*`，可考虑增加分层别名：

```json
{
  "paths": {
    "@/*": ["./src/*"],
    "@core/*": ["./src/core/*"],
    "@domain/*": ["./src/domain/*"],
    "@modules/*": ["./src/modules/*"],
    "@features/*": ["./src/features/*"]
  }
}
```

这可以进一步在 import 时明确层级关系，但不是必须的。

---

## 八、重构收益预估

| 维度 | 改善 |
|------|------|
| **配置维护** | 新增/修改配置只改一处，不再需要全局搜索替换 |
| **类型安全** | 消除重复定义带来的类型不一致风险 |
| **代码导航** | 目录结构即架构，看到路径就知道代码属于哪一层 |
| **可扩展性** | 新增 AI 策略只需在 `core/ai/strategies/` 加目录；新增业务用例只需在 `domain/studio/use-cases/` 加文件 |
| **God File 消除** | 最大文件从 1171 行降至 ~500 行以内 |
| **编译速度** | 更细粒度的文件拆分 → 更精确的增量编译 |
| **团队协作** | 框架层、领域层、UI 层可由不同人并行开发，互不干扰 |

---

## 九、风险控制

1. **每个 Phase 完成后必须 `next build` 通过**，任何 Phase 失败都可回退到上一个 Phase 的稳定状态
2. **Phase 1-2 仅移动文件位置，不改代码逻辑**，通过 re-export 保持向后兼容
3. **Phase 3-4 的类型拆分通过 index.ts re-export 保持 `@/types/picturebook` 等老路径仍可用**，渐进式迁移
4. **建议每个 Phase 提交一次 Git commit**，确保可追溯

---

## 十、文件迁移映射表（完整）

### Phase 1：配置集中化

| 原路径 | 新路径 | 备注 |
|--------|--------|------|
| _(新建)_ | `core/config/defaults.ts` | 汇总所有散布的默认值 |
| _(新建)_ | `core/config/env.ts` | 环境变量统一解析 |
| _(新建)_ | `core/config/index.ts` | 统一导出 |

### Phase 2：core/ 层建立

| 原路径 | 新路径 | 备注 |
|--------|--------|------|
| `lib/db.ts` | `core/db/connection.ts` | |
| `lib/db/schema-drizzle.ts` | `core/db/schema.ts` | |
| `lib/db/schema.sql` | `core/db/schema.sql` | |
| `src/auth.ts` | `core/auth/nextauth.ts` | |
| `src/middleware.ts` | `core/auth/middleware.ts` | Next.js middleware 路径需特殊处理 |
| `platform/ai/contracts/text-model-gateway.ts` | `core/ai/contracts/text-gateway.ts` | |
| `platform/ai/contracts/image-model-gateway.ts` | `core/ai/contracts/image-gateway.ts` | |
| `platform/ai/contracts/model-health.ts` | `core/ai/contracts/model-health.ts` | |
| `platform/ai/contracts/index.ts` | `core/ai/contracts/index.ts` | 增加 types.ts 导出 |
| `platform/ai/registry/model-factory.ts` | `core/ai/registry/model-factory.ts` | |
| `platform/ai/registry/model-init.ts` | `core/ai/init.ts` | |
| `platform/ai/strategies/openai-compatible.ts` | `core/ai/strategies/openai-compatible/` | 拆分为 4 个文件 |
| `lib/image-vendor-presets.ts` | `core/ai/strategies/openai-compatible/vendor-presets.ts` | |
| `platform/config/loaders/model-loader.ts` | `core/ai/loader/model-loader.ts` | 类型定义移至 contracts/types.ts |
| `lib/utils.ts` | `core/utils/cn.ts` | |

### Phase 3：domain/ 层建立

| 原路径 | 新路径 | 备注 |
|--------|--------|------|
| `types/picturebook.ts` | `domain/picturebook/types/` | 拆分为 9 个文件 |
| `prompts/builders/*` | `domain/picturebook/prompts/builders/*` | |
| `prompts/specs/*` | `domain/picturebook/prompts/specs/*` | |
| `prompts/context.ts` | `domain/picturebook/prompts/context.ts` | |
| `prompts/types.ts` | `domain/picturebook/prompts/types.ts` | |
| `prompts/prompt-enhancer.ts` | `domain/picturebook/prompts/enhancer.ts` | |
| `prompts/index.ts` | `domain/picturebook/prompts/index.ts` | |
| `config/age-spec.ts` | `domain/picturebook/age-spec/index.ts` | |
| `lib/prompt-ref-parser.ts` | `domain/picturebook/ref-parser/index.ts` | |
| `modules/studio/domain/services/parsers/*` | `domain/picturebook/parsers/*` | |
| `modules/studio/domain/errors/*` | `domain/picturebook/errors/*` | |
| `modules/studio/application/use-cases/*` | `domain/studio/use-cases/*` | |
| `modules/studio/infrastructure/export-book.ts` | `domain/studio/export/export-book.ts` | |

### Phase 4：features/ 层建立

| 原路径 | 新路径 | 备注 |
|--------|--------|------|
| `modules/studio/presentation/context/StudioContext.tsx` | `features/studio/context/` | 拆分为 6 个文件 |
| `modules/studio/presentation/hooks/*` | `features/studio/hooks/*` | |
| `modules/studio/presentation/components/StudioPage.tsx` | `features/studio/components/StudioPage.tsx` | |
| `modules/project-history/types.ts` | `modules/project/types.ts` | |
| `modules/project-history/use-project-history.ts` | `modules/project/use-project-history.ts` | |
| `lib/db/repositories/project-repository.ts` | `modules/project/repository.ts` | |
| `lib/db/types.ts` | `modules/project/db-types.ts` | |
| `lib/db/repositories/user-repository.ts` | `modules/user/repository.ts` | |
