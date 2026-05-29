# 标准化绘本提示词模板与使用说明

## 适用范围

本说明适用于当前项目的四条生成链路：

1. 故事生成 `generateStory()`
2. 分镜生成 `generateStoryboard()`
3. 资产生成 `generateAssetImage()`
4. 页面生成 `generatePageImage()`

所有核心提示词已统一由 `src/prompts/` 管理，并通过以下结构组织：

- `builders/`：负责面向场景组装最终提示词
- `specs/`：负责年龄、风格、题材、连续性、合规、模型参数规则
- `testing/`：负责样例集与验证执行器

## 标准模板结构

### 1. 基础设定层

输入字段：

- `title`
- `targetAge`
- `artStyle`
- `aspectRatio`
- `pageCount`
- `genre`
- `educationalGoal`
- `tone`
- `culturalTone`

作用：

- 定义绘本主题、受众与叙事目标
- 为故事、分镜、资产和页面提供统一语义基线

### 2. 视觉规范层

来源：

- `specs/age-spec.ts`
- `specs/style-spec.ts`

作用：

- 将年龄段与风格枚举转换成可执行视觉规则
- 统一色彩、构图、材质、镜头和文本安全区要求

### 3. 连续性控制层

来源：

- `specs/continuity-spec.ts`

作用：

- 锁定角色外观、场景结构、关键道具状态与跨页镜头衔接

### 4. 合规校验层

来源：

- `specs/compliance-spec.ts`

作用：

- 提供儿童绘本业务级正向规范和负向限制
- 同时输出提示词合规块和 `negativePrompt`

### 5. 自定义参数层

来源：

- `PromptCustomParams`

可选字段：

- `genre`
- `educationalGoal`
- `tone`
- `culturalTone`
- `colorOverride`
- `safetyLevel`
- `adaptationPolicy`
- `extraVisualRules`
- `extraComplianceRules`

## 使用方式

### 故事生成

```ts
const story = await generateStory(projectInfo, {
  genre: "原创童话",
  educationalGoal: "帮助孩子理解分享与耐心",
  safetyLevel: "strict",
});
```

### 分镜生成

```ts
const storyboard = await generateStoryboard(story.data, projectInfo, {
  genre: "原创童话",
  educationalGoal: "帮助孩子理解分享与耐心",
});
```

### 资产生成

```ts
const image = await generateAssetImage(asset, projectInfo, {
  genre: "原创童话",
  culturalTone: "温暖、治愈、自然",
});
```

### 页面生成

```ts
const page = await generatePageImage(pageItem, assets, projectInfo, storyboardPage, {
  genre: "原创童话",
  educationalGoal: "帮助孩子理解分享与耐心",
  safetyLevel: "strict",
});
```

## 推荐配置

### 3-6 岁

- 风格优先：`水彩温暖风`、`蜡笔童趣风`
- 重点：主体清晰、动作明确、表情外显、背景不要过满

### 6-9 岁

- 风格优先：`极简线条风`、`日系清新风`、`水墨东方风`
- 重点：适度提升空间层次和探索感，但保持阅读路径清楚

### 9-12 岁

- 风格优先：`日系清新风`、`水墨东方风`
- 重点：允许更强叙事密度和构图变化，但不能牺牲适龄安全

### 0-3 岁

- 风格优先：`蜡笔童趣风`、`极简线条风`
- 重点：单页单焦点、大轮廓、低复杂度、低刺激色彩

## 验证方式

项目已内置验证执行器：

- 入口模块：`src/prompts/testing/prompt-evaluator.ts`
- 样例集：`src/prompts/testing/sample-cases.ts`
- 测试接口：`POST /api/studio/prompt-validation`

验证内容包括：

- 5 组固定样例
- 每组 4 页连续页面
- 一致性、风格还原度、合规性三项评分

## 维护建议

- 新增风格时，必须同步补充 `style-spec.ts` 和 `prompt-enhancer.ts`
- 新增年龄策略时，必须补充 `age-spec.ts`
- 新增题材时，必须补充 `genre-spec.ts`
- 修改合规口径时，优先修改 `compliance-spec.ts`
- 任何重大提示词调整后，都建议重新跑一次验证执行器
