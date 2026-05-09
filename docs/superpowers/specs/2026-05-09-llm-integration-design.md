# 大模型能力接入 Studio 工作流设计

## 背景

AI 绘本工作室项目已具备模型配置骨架（YAML 存储、策略工厂、API 路由、前端配置页）和 OpenAI-compatible 策略实现，但 Studio 6 阶段工作流仍使用 `simulation.ts` 的模拟生成。本设计将真实大模型调用接入 Studio 各阶段，替换模拟逻辑。

## 决策记录

| 决策项 | 选择 | 理由 |
|---|---|---|
| 接入范围 | 文本+图像一起打通 | 用户需求，完整替换模拟 |
| 模型选择 | 全局默认（enabledOrder[0]） | 简化交互，MVP 阶段够用 |
| 流式输出 | 全部非流式 | 降低实现复杂度 |
| 失败处理 | 显示错误+重试按钮 | 用户体验与实现成本平衡 |
| 未配置引导 | 进入 Studio 时检查并引导 | 避免用户困惑 |
| 架构方案 | Service 层封装 | 与现有 model-factory 架构契合，prompt 逻辑安全留在后端 |
| 实施策略 | 前后端一起做 | 一步到位 |

## 架构

```
Stage2-5 组件
  → useStudioGenerate hook
    → POST /api/studio/generate-{story|storyboard|asset-image|page-image}
      → GenerateService
        → prompt-builders (组装 prompt)
        → ModelFactory.get(enabledOrder[0])
          → OpenAICompatibleTextStrategy / OpenAICompatibleImageStrategy
            → 大模型 API
```

## 后端设计

### GenerateService

新增 `src/server/services/generate-service.ts`，提供 4 个方法：

| 方法 | 输入 | 调用策略 | 输出 |
|---|---|---|---|
| `generateStory(projectInfo)` | 项目信息 | textStrategy.generate() | StoryData |
| `generateStoryboard(story, projectInfo)` | 故事+项目信息 | textStrategy.generate() | StoryboardData |
| `generateAssetImage(asset)` | 资产项 | imageStrategy.generate() | imageUrl |
| `generatePageImage(page)` | 页面数据 | imageStrategy.generate() | imageUrl |

模型选择：从 factory 获取 `enabledOrder[0]` 策略实例。无可用模型则抛 `NO_MODEL_CONFIGURED` 错误。

### API Routes

新增 4 个场景专用路由：

- `POST /api/studio/generate-story` — 请求体：`{ projectInfo }`
- `POST /api/studio/generate-storyboard` — 请求体：`{ story, projectInfo }`
- `POST /api/studio/generate-asset-image` — 请求体：`{ asset }`
- `POST /api/studio/generate-page-image` — 请求体：`{ page, assets, projectInfo, storyboardPage? }`

每个路由：解析请求 → 调用 GenerateService → 返回统一格式 `{ success, data?, error? }`。

### 错误码

| code | 含义 |
|---|---|
| `NO_MODEL_CONFIGURED` | 未配置任何模型 |
| `MODEL_UNAVAILABLE` | 模型策略实例不存在 |
| `GENERATION_FAILED` | 模型调用失败（含厂商原始错误） |
| `INVALID_REQUEST` | 请求参数缺失 |

### Prompt 设计

**故事生成**：
- 系统提示：定义绘本编剧角色 + 要求输出 JSON 格式
- 用户提示：注入主题、年龄、风格、页数
- 输出解析：解析为 `{ oneLineStory, characters, scenes, emotionCurve, storyOutline }`

**分镜生成**：
- 系统提示：定义分镜导演角色 + 要求输出 JSON 格式
- 用户提示：注入故事大纲、角色、场景、页数
- 输出解析：解析为 `{ pages: [{ text, visualGoal, characterRefs, sceneRefs }] }`

**资产图/页面图**：复用现有 `prompt-builders.ts` 的 `buildAssetPrompt` / `buildPagePrompt`，直接传入策略。

## 前端设计

### Hook：use-studio-generate.ts

```typescript
interface StudioGenerate {
  generateStory: (projectInfo: ProjectInfo) => Promise<StoryData>;
  generateStoryboard: (story: StoryData, projectInfo: ProjectInfo) => Promise<StoryboardData>;
  generateAssetImage: (asset: AssetItem) => Promise<string>;
  generatePageImage: (page: PageItem, assets: AssetsData, projectInfo: ProjectInfo, storyboardPage?: StoryboardPageData) => Promise<string>;
  isModelConfigured: boolean;
  loading: boolean;
  error: GenerateError | null;
}
```

每个方法：dispatch generating → fetch API → 成功 dispatch 数据 / 失败保存 error。

### 模型配置检查

StudioProvider 中增加 `useModelConfig` 检查，暴露 `isModelConfigured`。无模型时显示 `ModelConfigBanner` 引导横幅。

### 各 Stage 组件改造

| Stage | 替换内容 |
|---|---|
| Stage2 | `simulateGeneration` → `generateStory()` |
| Stage3 | 模拟 → `generateStoryboard()` |
| Stage4 | `simulateGeneration` → `generateAssetImage()` |
| Stage5 | `simulateGeneration` → `generatePageImage()` |

### 错误展示

生成失败时在对应 Stage 区域显示错误信息（中文映射）+ "重试"按钮。

## 数据流

以故事生成为例：

1. Stage2 组件调用 `generateStory(projectInfo)`
2. Hook dispatch `SET_STORY_GENERATING(true)`
3. fetch `POST /api/studio/generate-story { projectInfo }`
4. API route 调用 `GenerateService.generateStory()`
5. Service 调用 `buildStoryPrompt()` 组装 prompt
6. Service 获取默认文本模型策略 → `strategy.generate({ systemPrompt, prompt })`
7. 策略调用大模型 API → 返回文本
8. Service 解析 JSON → 返回 `StoryData`
9. API route 返回 `{ success: true, data: StoryData }`
10. Hook dispatch `SET_STORY(data)`

## 文件清单

### 新增

| 文件 | 说明 |
|---|---|
| `src/server/services/generate-service.ts` | 4 个生成方法 + prompt 构建 + 模型选择 |
| `src/app/api/studio/generate-story/route.ts` | 故事生成 API |
| `src/app/api/studio/generate-storyboard/route.ts` | 分镜生成 API |
| `src/app/api/studio/generate-asset-image/route.ts` | 资产图片生成 API |
| `src/app/api/studio/generate-page-image/route.ts` | 页面图片生成 API |
| `src/hooks/use-studio-generate.ts` | 前端生成调用 Hook |
| `src/components/studio/ModelConfigBanner.tsx` | 未配置模型引导横幅 |

### 修改

| 文件 | 说明 |
|---|---|
| `src/components/studio/stages/Stage2Story.tsx` | 替换模拟为真实调用 |
| `src/components/studio/stages/Stage3Storyboard.tsx` | 替换模拟为真实调用 |
| `src/components/studio/stages/Stage4Assets.tsx` | 替换模拟为真实调用 |
| `src/components/studio/stages/Stage5Pages.tsx` | 替换模拟为真实调用 |
| `src/context/StudioContext.tsx` | 增加模型配置检查 |

## 实施边界

### 本次包含

- 后端 GenerateService + 4 个 API route
- 前端 useStudioGenerate hook
- 4 个 Stage 组件替换模拟调用
- 模型配置检查 + 引导横幅
- 错误展示 + 重试按钮

### 本次不包含

- 流式输出（generateStream 继续留空）
- 多模型切换（只用全局默认）
- 生成结果的编辑/微调
- 导出功能改造

## 验收标准

1. 在 /settings/models 配置至少一个文本模型+一个图像模型
2. Stage2 生成故事返回真实文本
3. Stage3 生成返回结构化分镜
4. Stage4 生成角色/场景设定图返回真实图片
5. Stage5 生成页面插画返回真实图片
6. 未配置模型时显示引导横幅
7. 生成失败时显示错误信息+重试按钮
