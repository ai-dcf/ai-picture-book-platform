# AIPictureBookStudio 项目结构重构设计 v1

> 已补充 Next.js App Router 架构约束与检查结论。

## 1. 背景与目标

当前代码目录存在“技术分层”和“业务分层”并存的情况。随着模型接入、生成流程、编辑能力持续增加，若不明确边界，后续会出现：

- 业务编排和底层模型调用耦合，修改风险扩大。
- 公共目录（如 `lib`、`server`）不断膨胀，职责不清。
- 新功能接入时难以判断代码归属，维护成本上升。

本设计目标：

- 明确“上层业务”和“底层能力”边界。
- 让模型调用（LangChain）成为可替换基础设施。
- 支持分阶段迁移，保证现有功能稳定。

## 2. 设计原则

- 单向依赖：上层可依赖下层，下层不可反向依赖上层。
- 业务优先：先按业务域组织，再在域内做分层。
- 平台收敛：模型、配置、日志等底层能力统一到 `platform`。
- 渐进演进：保持 API 对外协议稳定，分阶段迁移内部实现。

## 3. 目标目录结构

```text
src/
  app/                                   # Next.js 框架入口层（页面 / 布局 / 错误边界 / API）
    api/
      studio/
        generate-story/route.ts
        generate-storyboard/route.ts
        generate-asset-image/route.ts
        generate-page-image/route.ts
      model-config/route.ts
      health/model/route.ts

  modules/                               # 业务域模块
    studio/
      application/                       # 用例编排层
        use-cases/
          generate-story.ts
          generate-storyboard.ts
          generate-asset-image.ts
          generate-page-image.ts
      domain/                            # 领域模型与规则
        entities/
        services/
        errors/
      infrastructure/                    # 业务域内基础设施实现
        mappers/
      presentation/                      # 前端业务表现层
        components/
        hooks/

    model-config/
      application/
      domain/
      infrastructure/
      presentation/

  platform/                              # 底层平台能力（可复用、可替换）
    ai/
      contracts/                         # 网关接口定义
        text-model-gateway.ts
        image-model-gateway.ts
      langchain/                         # LangChain 客户端封装
        chat-client.ts
        image-client.ts
      strategies/                        # 供应商策略
        openai-compatible.ts
      registry/                          # 模型注册/工厂/初始化
        model-factory.ts
        model-init.ts
    config/
      loaders/
      validators/
    observability/
      logger.ts
      trace.ts

  shared/                                # 跨域通用能力（无业务语义）
    types/
    utils/
    constants/
```

## 4. 分层职责定义

### 4.1 `app`（框架入口层）

- 承担 Next.js App Router 的入口职责，包括 `page.tsx`、`layout.tsx`、`loading.tsx`、`error.tsx`、`not-found.tsx` 与 `route.ts`。
- 其中 `route.ts` 负责 HTTP 请求解析、参数校验、状态码与响应格式映射。
- `page/layout` 负责页面级组合与路由入口，不承载底层基础设施实现。
- `app` 层不直接调用 LangChain，不拼接 Prompt，不实现可复用业务用例。

### 4.2 `modules/*/application`（业务用例层）

- 负责业务流程编排，例如故事生成 -> 解析 -> 结果组装。
- 依赖领域服务和平台网关接口，不依赖具体供应商实现。

### 4.3 `modules/*/domain`（领域层）

- 放置业务对象、规则、错误码和纯函数逻辑。
- 不出现 `fetch`、数据库、LangChain SDK 等外部依赖。

### 4.4 `platform`（基础设施层）

- 统一封装 LangChain 调用、模型注册、配置加载、日志追踪。
- 提供稳定接口给业务层使用，屏蔽供应商差异。

### 4.5 `shared`（跨域共享层）

- 仅放无业务语义的工具与类型。
- 禁止把 `studio` 或 `model-config` 的业务逻辑放入 `shared`。

## 5. 依赖规则（必须遵守）

- `app` -> `modules/*/application` -> `modules/*/domain`
- `modules/*/application` -> `platform/*`（仅通过 contracts/interface）
- `platform/*` 不得依赖 `modules/*`
- `shared/*` 不得依赖 `modules/*` 与 `platform/*` 的具体实现

建议通过 ESLint `import/no-restricted-paths` 配置目录级约束。

## 5.1 Next.js 运行边界规则（新增）

### 服务端专属目录

以下目录默认视为服务端代码，不允许直接进入 Client Component：

- `platform/**`
- `modules/*/application/**`
- `modules/*/domain/**`
- `modules/*/infrastructure/**`

建议在这些文件顶部引入 `server-only`，防止被客户端误导入。

### 客户端专属目录

以下目录若使用 React hooks、浏览器 API、事件处理器，应显式使用 `'use client'`：

- `modules/*/presentation/hooks/**`
- `modules/*/presentation/components/**` 中包含交互逻辑的组件

### 导入约束

- `presentation` 不得直接导入 `platform/ai/**`
- Client Component 不得直接导入 `platform/**`、配置加载器、LangChain SDK、文件系统相关模块
- `app/api/**` 可导入 `modules/*/application`，但不应越层直接调用 `platform/ai/strategies/*`

## 5.2 Route Handler 与 Server Action 选择规则（新增）

为避免所有服务端逻辑都堆积到 `app/api`，应明确规则：

- 使用 `Route Handler` 的场景：
  - 需要显式 HTTP 协议边界
  - 需要给前端之外的调用方复用
  - 需要流式响应、SSE、文件下载或第三方 webhook
  - 需要对外稳定 API 路径
- 使用 `Server Action` 的场景：
  - 仅由当前 Web 应用内部页面触发
  - 不需要暴露为独立 HTTP API
  - 更适合与表单、站内 mutation、页面刷新协同

当前项目中的模型生成能力、模型健康检查、模型配置读写，第一阶段仍保留为 `Route Handler`，避免迁移时同时改变调用协议。

## 5.3 Runtime 规则（新增）

- AI 相关 `Route Handler` 默认使用 Node.js runtime
- 不为模型生成、配置加载、LangChain 逻辑使用 Edge runtime
- 若未来单独引入 Edge 路由，必须在设计文档中单独声明并验证依赖兼容性

建议在 AI 相关路由中显式声明：

```ts
export const runtime = "nodejs";
```

## 5.4 API 路径兼容策略（新增）

为满足“分阶段迁移、保持现有调用稳定”的目标，第一阶段不调整现有 API 路径命名：

- 保留：
  - `/api/studio/generate-story`
  - `/api/studio/generate-storyboard`
  - `/api/studio/generate-asset-image`
  - `/api/studio/generate-page-image`

后续若要进行路径语义化调整，应采用以下任一方式：

- 方案 A：新增 `/api/v2/...`，保留旧路径兼容一段时间
- 方案 B：旧路径保留为兼容代理，内部转发到新实现

禁止在同一阶段同时进行“目录重构 + 前后端接口路径改名”。

## 6. 现有文件迁移映射（第一版）

- `src/server/services/generate-service.ts`
  - 拆分到 `modules/studio/application/use-cases/*`
  - 领域解析与规则放到 `modules/studio/domain/*`
- `src/server/strategies/openai-compatible.ts`
  - 迁移到 `platform/ai/strategies/openai-compatible.ts`
- `src/server/model-factory.ts`
  - 迁移到 `platform/ai/registry/model-factory.ts`
- `src/server/services/model-init.ts`
  - 迁移到 `platform/ai/registry/model-init.ts`
- `src/lib/prompt-builders.ts`
  - 迁移到 `modules/studio/domain/services/prompt/*`
- `src/hooks/use-studio-generate.ts`
  - 迁移到 `modules/studio/presentation/hooks/use-studio-generate.ts`

## 7. 分阶段实施计划

### 阶段 1：建立骨架与契约

- 创建 `modules`、`platform`、`shared` 目录结构。
- 定义 `TextModelGateway` 与 `ImageModelGateway` 接口。
- 为服务端目录补充 `server-only` 边界约束。
- 保持旧逻辑可运行，新增层先不切流量。

### 阶段 2：迁移 AI 平台层

- 将 LangChain 与模型注册逻辑迁移到 `platform/ai/*`。
- AI 相关 Route Handler 显式固定为 Node.js runtime。
- 保持 API 路由与前端调用路径不变。

### 阶段 3：拆分 Studio 用例

- 把 `generate-service` 拆为多个 use-case 文件。
- Prompt 构建与响应解析迁移到 `studio/domain`。

### 阶段 4：整理前端业务层

- 将 `studio` 相关 hooks/components 收敛到 `modules/studio/presentation`。
- API 调用函数按业务域分组，统一错误处理。
- 为交互组件与 hooks 明确 `'use client'` 边界。
- 将纯展示组件与客户端交互组件进一步分离，降低误导入风险。

### 阶段 5：清理与守卫

- 删除旧目录中已迁移文件，避免双写。
- 增加目录依赖 lint 规则与架构文档校验。

## 8. 验收标准

- 目录职责清晰：新功能可在 3 分钟内定位目标落点。
- 业务层无 LangChain 直接依赖。
- API 层不含业务流程编排代码。
- 迁移后功能行为与接口响应保持兼容。
- 新增供应商策略时，无需修改业务用例代码。
- Client Component 不误导入服务端专属模块。
- AI 相关路由均明确运行于 Node.js runtime。
- 第一阶段迁移完成后，前端现有请求路径保持不变。

## 9. 风险与回滚

- 风险：迁移期间路径变更导致 import 断裂。
  - 对策：按阶段迁移，每阶段执行类型检查与接口回归。
- 风险：旧逻辑和新逻辑并存造成重复调用。
  - 对策：设置迁移清单，完成后立即删除旧入口。
- 回滚策略：每阶段独立提交，可按阶段回退，不跨阶段混改。

## 10. 命名约定

- 用例文件：`verb-noun.ts`，如 `generate-story.ts`
- 网关接口：`*-gateway.ts`
- 供应商策略：`<vendor>-<capability>.ts`
- 路由文件仅保留 `route.ts`，业务语义由目录名表达

---

本设计文档为 v1，后续可在实施阶段补充：

- 目录级 lint 规则配置样例
- use-case 模板代码
- 错误码与日志字段规范
- `server-only` / `'use client'` 模板示例
- Route Handler / Server Action 决策清单
