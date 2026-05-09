# 大模型模块对接设计文档

## 背景与目标

当前项目已经具备模型配置骨架（YAML 配置、模型工厂、API 路由、配置页），且 `openai-compatible` 策略实现已在代码中落地。本次工作目标从“从零接入”调整为“方案A端到端联调优先”，即尽快形成可用闭环：

- 配置页可管理模型并热更新
- 健康检查可验证连通性
- 文本与图像生成接口均可用
- Studio 工作流可消费上述能力

## 方案确认

已确认采用 **方案A：端到端联调优先**。

## 决策记录

| 决策项 | 选择 | 理由 |
|---|---|---|
| 联调策略 | 方案A（端到端） | 以最短路径交付“可用链路”，问题就地修复 |
| 页面范围 | 只覆盖 `/settings/models` 与 Studio 工作流 | 聚焦绘本生产主路径，不新增独立 chat/image 页面 |
| 策略标准 | 统一 OpenAI-compatible | 阿里云百炼、火山引擎均可兼容，策略层保持统一 |
| 流式输出 | 预留，不在本次实现 | 降低联调复杂度，先保证非流式稳定可用 |
| 错误治理 | 统一错误码映射 | 减少前端分支判断，提升提示一致性 |

## 联调分层设计（已确认）

### 第1层：配置层

- 入口：`/settings/models`
- 目标：完成新增、编辑、启用、禁用，并写回 `config/models.yaml`
- 要求：保存后触发后端热重载，后续请求立即生效

### 第2层：健康层

- 入口：`POST /api/health/model`
- 目标：按 alias 对单模型做连通性探测
- 输出：统一 `status(ok/down)`、`latencyMs`、`error(code/message)`
- 用途：作为“可调用”前置门禁

### 第3层：能力层

- 文本：`POST /api/text-models/generate`
- 图像：`POST /api/image-models/generate`
- 目标：验证工厂可正确按 alias + strategy 分发到 `openai-compatible` 策略

### 第4层：业务层

- 入口：Studio 相关生成节点（故事、分镜、出图）
- 目标：业务调用统一走项目 API，不直接触达厂商端点
- 要求：失败可提示、可回退、可重试

### 第5层：回归层

- 固化五类回归场景：空配置、错误密钥、模型不存在、429 限流、正常生成
- 每次改动后复跑，确保联调质量可重复

## 接口与错误处理设计（已确认）

### 统一调用约束

- 前端仅调用本项目 API：
  - `GET/PUT /api/model-config`
  - `POST /api/health/model`
  - `POST /api/text-models/generate`
  - `POST /api/image-models/generate`
- 前端不得直接请求厂商 endpoint

### 工厂分发规则

- 后端以 alias 加载模型配置
- 通过配置中的 `strategy` 进行策略实例分发
- 禁止由前端直接传 strategy 决定后端行为

### 最小参数闭环

- 文本请求：`alias` + (`prompt` 或 `messages`) + 可选 `systemPrompt`
- 图像请求：`alias` + `prompt` + 可选 `size/quality/style`
- 统一响应结构：`success`、`data`、`error(code,message)`

### 错误码映射标准

| 场景 | 统一错误码 | 说明 |
|---|---|---|
| 401 | `API_KEY_INVALID` | 密钥无效或已过期 |
| 403 | `PERMISSION_DENIED` | 账号权限不足 |
| 404 | `MODEL_OR_ENDPOINT_INVALID` | 模型名错误或 endpoint 配置错误 |
| 429 | `RATE_LIMITED` | 触发限流 |
| 5xx | `PROVIDER_INTERNAL_ERROR` | 服务商内部异常 |
| 网络/超时 | `NETWORK_OR_TIMEOUT` | 链路不可达或请求超时 |

### 前端展示策略

- 配置页与 Studio 共享同一套错误文案映射
- 429/网络类错误提供重试入口
- 401/403/404 提示跳转模型配置进行修复

### 可观测性要求

- 记录字段：`modelAlias`、`strategy`、`latencyMs`、`statusCode`、`errorCode`
- 安全要求：日志中不记录 API Key，不回传敏感字段
- 健康检查支持短期缓存，避免探活请求打满配额

## 实施清单（执行版）

1. 配置面联调：验证模型配置读写、启停与热重载
2. 健康检查联调：验证成功路径与各类错误映射
3. 文本生成联调：跑通成功路径与关键失败路径
4. 图像生成联调：跑通成功路径与关键失败路径
5. Studio 集成联调：将故事/分镜/出图统一接入生成服务
6. 回归固化：形成固定联调清单并沉淀结果

## 验收标准（DoD）

- 至少 1 个文本模型可配置、可健康检查、可成功生成
- 至少 1 个图像模型可配置、可健康检查、可成功生成
- Studio 至少 1 条完整创作链路可从输入到文本与图片输出
- 401/403/404/429/5xx/超时均有正确错误码与可理解提示
- 敏感信息不泄露（API Key 不入日志、不回前端）

## 范围边界

### 本次包含

- 模型配置页与 YAML 热更新闭环
- 健康检查统一响应与错误映射
- 文本/图像非流式生成链路
- Studio 对文本/图像能力的调用打通
- 联调回归清单固化

### 本次不包含

- 流式输出实现（`generateStream`）
- 附件与多模态输入
- 配置导入导出
- 新增独立 chat/image 业务页面
