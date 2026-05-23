# 故事参数推荐与故事生成拆分设计

## 背景

当前 Studio 在项目初始化阶段和故事架构阶段都复用了同一个 `generateStory()` 能力：

1. `Stage1Init` 在“创建项目并继续”时调用 `generateStory()`，目的是获取年龄、风格、页数推荐值。
2. `Stage2Story` 在进入故事架构阶段后再次调用 `generateStory()`，目的是生成角色、场景、情绪曲线与故事大纲。

这导致当前实现出现了明显的职责混用：

- 第 1 轮为了拿推荐参数，额外生成了一整份故事框架，但结果不会被保留。
- 第 2 轮会重新生成一份新的故事框架，和第 1 轮内容可能完全不同。
- 推荐字段 `recommendedTargetAge`、`recommendedArtStyle`、`recommendedPageCount` 被混入 `StoryData`，导致类型职责不清。
- 推荐风格未进行严格枚举约束与运行时校验，模型返回别名时可能污染项目状态，并影响下游风格规则。

本设计旨在将“参数推荐”和“故事生成”拆分为两个独立阶段和两个独立文件，使每个阶段只承担单一职责，并修复推荐值校验与类型边界问题。

## 目标

- 将第 1 轮拆分为纯参数推荐流程，只输出推荐年龄、风格、页数。
- 将第 2 轮保留为纯故事生成流程，只输出角色、场景、情绪曲线和故事大纲。
- 将两阶段的 prompt builder、解析器、use-case 拆分为独立文件，避免职责交叉。
- 为推荐结果增加明确的枚举约束、运行时校验和别名兼容映射。
- 清理 `StoryData` 中不属于故事结构的推荐字段，消除 Stage2 中的死代码。

## 非目标

- 不调整 Studio 的大阶段顺序，仍保持项目初始化 -> 故事架构 -> 分镜拆页 -> 资产生成 -> 页面生成。
- 不引入流式推荐、缓存复用或多模型协同策略。
- 不新增复杂的前端确认弹窗或推荐理由解释 UI。
- 不在本次设计中改造分镜、资产、页面生成流程本身。

## 核心问题

### 1. 第 1 轮职责错误

项目初始化阶段实际只需要产出项目配置推荐，但当前却调用完整故事生成逻辑，造成 token、耗时和生成内容浪费。

### 2. 第 2 轮输入被推荐污染

第 1 轮的推荐值会直接写入 `projectInfo`。如果推荐风格不是业务枚举内的合法值，下游 `getStyleSpec()` 可能取不到风格规则，导致故事、分镜、资产、页面生成丢失风格约束。

### 3. 数据结构职责不清

`StoryData` 同时承载了“故事结构”和“项目推荐”，使 Stage2 组件被迫处理与本阶段无关的逻辑，也让 API 的返回语义变得模糊。

### 4. Prompt 约束不完整

年龄和页数推荐已经显式列出合法选项，但风格推荐只写了“现有风格列表中的一个”，没有把列表本身提供给模型，导致模型容易输出自然语言别名而非业务枚举值。

## 决策记录

| 决策项 | 选择 | 理由 |
|---|---|---|
| 阶段拆分方式 | 拆成两个独立 use-case 和两个独立 prompt 文件 | 让推荐与故事生成职责清晰，便于维护 |
| Stage1 行为 | 只做项目参数推荐，不生成故事框架 | 与页面职责一致，避免浪费生成 |
| Stage2 行为 | 只生成故事框架，不再修改推荐参数 | 保证故事阶段的输入稳定 |
| 推荐结果存放 | 单独定义推荐类型，不混入 `StoryData` | 保持数据模型单一职责 |
| 风格校验 | Prompt 枚举 + 运行时白名单 + 别名映射 | 同时解决模型输出偏差与脏数据问题 |
| 推荐失败处理 | 继续沿用当前降级思路，允许项目继续创建 | 降低失败阻塞，兼顾用户体验 |

## 设计方案

### 总体流程

```text
Stage1Init
  -> recommendStoryConfig(projectInfo)
    -> buildStoryRecommendSystemPrompt()
    -> buildStoryRecommendUserPrompt()
    -> parseStoryRecommendResponse()
  -> 回填仍为 auto 的项目参数
  -> 保存项目并进入 Stage2

Stage2Story
  -> generateStory(projectInfo)
    -> buildStorySystemPrompt()
    -> buildStoryUserPrompt()
    -> parseStoryResponse()
  -> 保存故事框架
```

### 阶段 1：参数推荐

新增一条独立的推荐链路，输入仍然是 `ProjectInfo`，但输出变为专门的推荐结果类型，例如：

```ts
interface StoryRecommendation {
  recommendedTargetAge?: Exclude<TargetAge, "auto">;
  recommendedArtStyle?: Exclude<ArtStyle, "auto">;
  recommendedPageCount?: Exclude<PageCount, "auto">;
}
```

这一阶段的 prompt 必须满足以下规则：

- 不再要求输出 `characters`、`scenes`、`emotionCurve`、`storyOutline`。
- 仅要求输出推荐字段。
- 显式列出合法年龄段、页数和风格枚举值。
- 用户已明确选择的字段不要求模型重复推荐。
- 允许模型依据标题和题材线索进行推荐，但不要求展开故事内容。

这一阶段的 use-case 只负责：

- 选择默认文本模型。
- 调用推荐 prompt。
- 解析并校验推荐结果。
- 将合法结果返回给 `Stage1Init`。

### 阶段 2：故事生成

现有 `generateStory()` 保留，但回归单一职责：

- 输入使用已经确定下来的 `projectInfo`。
- 输出只包含故事结构：
  - `characters`
  - `scenes`
  - `emotionCurve`
  - `storyOutline`
- 不再要求输出任何 `recommended*` 字段。
- `Stage2Story` 不再尝试根据故事响应修改项目参数。

这样可确保第 2 轮始终是“在确定配置前提下生成故事框架”，避免与项目初始化行为交叉。

## 文件边界

### 新增文件

| 文件 | 说明 |
|---|---|
| `src/prompts/builders/story-recommend.ts` | 构建阶段 1 的推荐 system prompt 和 user prompt |
| `src/modules/studio/application/use-cases/recommend-story-config.ts` | 推荐用例，负责调用模型获取推荐配置 |
| `src/modules/studio/domain/services/parsers/story-recommend-parser.ts` | 推荐结果解析与运行时校验 |

### 修改文件

| 文件 | 说明 |
|---|---|
| `src/prompts/builders/story.ts` | 移除推荐字段相关拼接，让其只负责故事生成 |
| `src/prompts/index.ts` | 导出新的推荐 prompt builder |
| `src/modules/studio/application/use-cases/index.ts` | 导出新的推荐 use-case |
| `src/modules/studio/domain/services/parsers/index.ts` | 导出新的推荐解析器 |
| `src/modules/studio/application/use-cases/generate-story.ts` | 调整日志与返回语义，去掉推荐字段依赖 |
| `src/modules/studio/presentation/hooks/use-studio-generate.ts` | 增加 `recommendStoryConfig()` |
| `src/components/studio/stages/Stage1Init.tsx` | 使用推荐接口替代故事生成接口 |
| `src/components/studio/stages/Stage2Story.tsx` | 删除推荐参数回填与相关死代码 |
| `src/types/picturebook.ts` | 从 `StoryData` 中移除 `recommended*`，新增推荐类型 |
| `src/prompts/context.ts` | 保持现有 normalize 行为，但确保进入 Stage2 的推荐值为合法枚举 |

## 运行时校验与兼容策略

### 枚举白名单

推荐解析器必须对三个字段做白名单校验：

- `recommendedTargetAge` 只能是 `0-3 / 3-6 / 6-9 / 9-12`
- `recommendedPageCount` 只能是 `8 / 12 / 16 / 24 / 32`
- `recommendedArtStyle` 只能是现有风格枚举：
  - `水彩温暖风`
  - `蜡笔童趣风`
  - `剪纸拼贴风`
  - `日系清新风`
  - `素描淡彩风`
  - `波普大胆风`
  - `水墨东方风`
  - `极简线条风`

### 风格别名兼容

考虑到模型可能输出自然语言近义表达，推荐解析器应提供有限的兼容映射，例如：

- `温暖手绘水彩风格` -> `水彩温暖风`
- `温暖水彩风` -> `水彩温暖风`

兼容策略原则：

- 只处理已明确确认的少量高频别名。
- 不能进行模糊猜测式映射，避免把不确定值写入项目状态。
- 无法识别的值直接丢弃，不回填。

## 前端交互设计

### Stage1Init

`Stage1Init` 的“创建项目并继续”按钮行为改为：

1. 组装当前表单为 `tempProjectInfo`。
2. 调用 `recommendStoryConfig(tempProjectInfo)`。
3. 对仍为 `auto` 的字段尝试使用推荐结果回填。
4. 将最终 `projectInfo` 存入全局状态。
5. 创建草稿并进入 Stage2。

若推荐失败：

- 不阻断项目创建。
- 保持当前降级策略。
- 用户已经显式选择的字段维持不变。
- 仍为 `auto` 的字段可继续保留 `auto`，由后续默认 normalize 逻辑兜底。

### Stage2Story

`Stage2Story` 首次进入时仍自动生成故事，但仅关注故事结果：

- 成功时更新 `story`。
- 失败时显示当前已有的错误提示和重试按钮。
- 不再更新 `projectInfo.targetAge`、`projectInfo.artStyle`、`projectInfo.pageCount`。

## 错误处理

### 推荐阶段

- 若无可用模型，沿用统一错误结构返回 `NO_MODEL_CONFIGURED`。
- 若模型返回空文本或非法 JSON，返回 `GENERATION_FAILED`。
- 若推荐字段不合法，不抛异常，只忽略非法字段并返回剩余合法字段。
- 若三个推荐字段全部无效，则视为推荐失败，由前端走降级逻辑。

### 故事阶段

- 保持当前错误处理方式不变。
- 若模型返回的故事 JSON 缺字段，解析器继续使用当前默认值兜底。

## 数据结构调整

### StoryData

`StoryData` 调整为纯故事结构：

```ts
interface StoryData {
  characters: StoryEntry[];
  storyOutline: string;
  emotionCurve: EmotionCurvePoint[];
  scenes: StoryEntry[];
  generating: boolean;
}
```

### 推荐类型

新增独立推荐类型：

```ts
interface StoryRecommendation {
  recommendedTargetAge?: Exclude<TargetAge, "auto">;
  recommendedArtStyle?: Exclude<ArtStyle, "auto">;
  recommendedPageCount?: Exclude<PageCount, "auto">;
}
```

必要时可在 hook 层定义统一返回结构，但不应再把推荐字段塞回 `StoryData`。

## 测试与验证

本次实现完成后，应至少完成以下验证：

1. 第 1 轮推荐 prompt 不再包含故事框架字段要求。
2. 第 2 轮故事 prompt 不再包含 `recommended*` 字段要求。
3. 模型返回合法风格值时，`Stage1Init` 能正确回填到项目配置。
4. 模型返回风格别名时，解析器能映射为合法业务枚举。
5. 模型返回未知风格值时，系统不会写入非法风格，也不会导致 Stage2 异常。
6. `StoryData` 移除推荐字段后，Stage2 与相关类型检查通过。
7. `Stage2Story` 不再包含推荐回填逻辑。
8. 最近修改文件的 TypeScript/ESLint 诊断无新增错误。

## 风险与取舍

### 风险 1：推荐失败后仍可能保留 auto

如果第 1 轮失败且用户选择了 `auto`，Stage2 仍可能走默认 normalize 逻辑。这不是理想状态，但比错误写入非法推荐值更安全，因此本设计保留该兜底。

### 风险 2：推荐与故事之间仍存在风格主观差异

即使第 1 轮推荐了合法风格，第 2 轮故事文本内容仍带有模型主观生成特征。这属于内容生成天然波动，本设计只保证参数合法与职责清晰，不追求两阶段语义完全一致。

### 风险 3：别名映射维护成本

随着模型返回风格措辞变化，别名映射可能需要增补。本设计限制映射范围，以降低误匹配风险。

## 实施顺序

1. 新增推荐类型与推荐解析器。
2. 新增推荐 prompt builder 与推荐 use-case。
3. 修改 `useStudioGenerate` 暴露推荐方法。
4. 修改 `Stage1Init` 接入推荐流程。
5. 修改 `story.ts`、`generate-story.ts`、`Stage2Story.tsx`，清理推荐混用逻辑。
6. 更新类型导出与 parser 导出。
7. 执行类型检查与诊断修复。
