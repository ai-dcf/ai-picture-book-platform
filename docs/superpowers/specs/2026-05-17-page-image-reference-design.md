# 页面生成提示词图片引用设计

**日期**: 2026-05-17
**状态**: 设计完成
**方案**: 方案 C — 内联卡片编辑器 + 引用数据层

---

## 一、需求背景

当前逐页生成（Stage 5）的页面提示词仅包含文字描述，调用图片生成 API 时不携带参考图，导致同一角色在不同页面中外观不一致。

核心需求：在页面提示词中支持 `${素材名称}` 图片引用语法，生成图片时将素材正式图作为参考图传给 API，保持角色一致性。

---

## 二、需求澄清结果

| 维度 | 决定 |
|------|------|
| 引用语法 | 用户界面用 `${名称}`（如 `${跳跳}`），调用 API 时按 imageRefs 数组顺序传入 URL，参考图预览区显示对应序号 |
| 参考图来源 | 使用素材正式图（officialImageUrl），无正式图的素材不可引用 |
| 手动输入 | 输入 `#` 触发素材选择器，列出所有有正式图的素材供选择 |
| 自动识别 | 自动生成提示词时扫描 characterRefs/sceneRefs 并插入引用；用户编辑后扫描并弹窗提示"检测到可引用素材，是否添加？" |
| UI 展示 | 提示词中引用以内联卡片形式展示（类似 Notion @mention） |
| API 支持 | 火山引擎 Seedream API 的 `image` 参数支持传入参考图（URL/Base64，最多14张） |

---

## 三、数据层

### 3.1 新增类型

```typescript
// src/types/picturebook.ts

export interface ImageRef {
  assetId: string;                          // 素材 ID
  assetName: string;                        // 素材名称，如 "跳跳"
  assetType: 'character' | 'scene';         // 素材类型
  imageUrl: string;                         // 参考图 URL（officialImageUrl）
}
```

### 3.2 PageItem 扩展

```typescript
export interface PageItem {
  // ... 现有字段不变
  imageRefs: ImageRef[];                    // 新增：本页引用的素材参考图列表
}
```

### 3.3 StudioContext 改造

- `buildInitialPages` 初始化时 `imageRefs: []`
- `UPDATE_PAGE_CONFIG` action 已支持 `Partial<PageItem>`，天然支持更新 `imageRefs`
- 新增 `SCAN_IMAGE_REFS` action：扫描提示词文本中已有的 `${名称}` 引用，与 assets 匹配后生成 `ImageRef[]`，更新到 `page.imageRefs`。同时对比 `characterRefs`/`sceneRefs`，返回未引用的素材列表供 UI 提示

### 3.4 数据持久化

- `imageRefs` 序列化为 JSON 字符串存入 pages 表的 `image_refs` 列（TEXT 类型）
- 读取时反序列化回 `ImageRef[]`
- 旧数据无 `image_refs` 列时默认 `imageRefs: []`

---

## 四、提示词引用解析与自动插入

### 4.1 引用语法

- 用户界面格式：`${素材名称}`，如 `${跳跳}`、`${森林}`
- 同一素材在同一提示词中可多次引用，解析时只收集一次参考图
- 调用 API 时，prompt 中的 `${名称}` 替换为素材的文字描述（保留语义），同时将该素材的 officialImageUrl 作为 `image` 参数传入

### 4.2 解析流程

```
提示词文本 → 正则扫描 ${xxx} → 匹配 assets 中的素材 → 生成 ImageRef[]
```

正则模式：`\$\{([^}]+)\}`

解析步骤：
1. 用正则提取所有 `${...}` 中的名称
2. 在 `assets.characters` 和 `assets.scenes` 中按名称匹配
3. 匹配成功且有 `officialImageUrl` 的，生成 `ImageRef`
4. 匹配失败或无正式图的，保留原始文本不替换

### 4.3 buildPagePrompt 自动插入

在 `src/modules/studio/domain/services/prompt/asset-page-prompts.ts` 的 `buildPagePrompt` 中：

- 当 `characterRefs` / `sceneRefs` 非空时，在 `storyText` 中对应角色/场景名称出现的位置自动插入 `${名称}` 引用标记
- 插入策略：在故事文本中首次出现角色名时，在该名称之后插入 `${名称}`
- 示例：原始文本 `跳跳仰起头练习威风的大吼` → `跳跳${跳跳}仰起头练习威风的大吼`

### 4.4 用户编辑后扫描提示

当用户手动编辑提示词后（`promptUserEdited = true`）：

1. 扫描提示词中已有的 `${名称}` 引用
2. 扫描 `characterRefs`/`sceneRefs` 中存在但提示词中未引用的素材
3. 如果发现未引用的素材，在 UI 上显示提示条：「检测到 N 个可引用的素材（跳跳、森林…），是否添加？」
4. 用户点击「添加」后，自动在提示词末尾或合适位置插入 `${名称}` 引用，并更新 `imageRefs`

### 4.5 API 调用时的提示词处理

在 `src/modules/studio/application/use-cases/generate-page-image.ts` 中：

1. 从 `page.imageRefs` 获取所有引用的素材
2. 构建 `image` 参数：收集所有 `officialImageUrl`，以 URL 数组传入
3. 构建 `prompt`：将 `${名称}` 替换为素材的详细描述文字
4. 替换规则：`${跳跳}` → `跳跳（一只善良可爱的小兔子，穿着蓝色背带裤）`
5. 替换后的 prompt 保持语义完整，无 `${}` 残留

---

## 五、UI 交互设计

### 5.1 内联引用编辑器

替换 `Stage5Pages.tsx` 中当前的 `<Textarea>` 为自定义的 `<PromptEditor>` 组件。

**核心机制**：基于 `contentEditable` 的轻量富文本编辑器，不引入 TipTap 等重量级库。

**渲染逻辑**：
- 提示词以纯文本形式存储在 `page.prompt` 中，`${跳跳}` 作为原始文本保存
- 编辑器渲染时，扫描文本中的 `${...}` 模式，将其替换为不可编辑的内联卡片节点
- 内联卡片样式：带圆角边框的小标签，左侧显示素材缩略图（16x16），右侧显示素材名称，背景色区分角色（蓝色系）和场景（绿色系）
- 卡片不可编辑但可删除（Backspace/Delete 删除整个卡片）

**组件结构**：
```
PromptEditor
├── contentEditable 区域（文本 + 内联卡片）
├── # 触发的 Popover 素材选择器
└── 未引用素材提示条
```

### 5.2 `#` 触发素材选择器

**触发机制**：
- 用户在编辑器中输入 `#` 字符时，在光标位置弹出 Popover
- Popover 列出所有有 `officialImageUrl` 的素材（角色在前，场景在后）
- 每个选项显示：素材缩略图（32x32）+ 名称 + 类型标签（角色/场景）
- 支持键盘上下键选择、Enter 确认

**选中行为**：
- 删除刚输入的 `#` 字符
- 在光标位置插入内联卡片
- 同步更新 `page.prompt`（插入 `${名称}` 文本）和 `page.imageRefs`（添加 ImageRef）
- 光标移到卡片之后

**过滤**：
- 如果提示词中已引用某素材，选择器中该选项标记为「已引用」但仍可选（允许重复引用）

### 5.3 未引用素材提示条

位于编辑器下方，条件显示：

- **触发条件**：`characterRefs`/`sceneRefs` 中存在有正式图但提示词中未引用的素材
- **显示内容**：`检测到 2 个可引用素材：跳跳、森林`
- **操作按钮**：「全部添加」点击后自动在提示词末尾追加 `${名称}` 引用
- **关闭按钮**：可关闭提示条，本次编辑会话内不再显示

### 5.4 参考图预览区

在编辑器下方、提示条之上，新增一个紧凑的参考图预览区：

- **显示条件**：`page.imageRefs.length > 0`
- **布局**：横向排列的缩略图列表，每个缩略图 48x48，带圆角
- **交互**：hover 显示素材名称 tooltip，点击可预览大图
- **标签**：每个缩略图右上角显示序号（对应 API 调用时的 image 顺序）
- **删除**：hover 时右上角显示 × 按钮，点击移除引用（同时从 prompt 中删除对应的 `${名称}`）

---

## 六、API 集成层

### 6.1 ImageModelGateway 接口扩展

```typescript
// src/platform/ai/contracts/image-model-gateway.ts

export interface ImageGenerateParams {
  prompt: string;
  negativePrompt?: string;
  size?: string;
  quality?: string;
  style?: string;
  seed?: number;
  headers?: Record<string, string>;
  images?: ImageRefInput[];                // 新增：参考图列表
}

export interface ImageRefInput {
  url: string;                              // 图片 URL
  name?: string;                            // 素材名称（日志用）
  type?: 'character' | 'scene';             // 素材类型（日志用）
}
```

### 6.2 OpenAI Compatible 策略改造

在 `src/platform/ai/strategies/openai-compatible.ts` 的 `OpenAICompatibleImageStrategy.generate` 中：

- 检测 `params.images` 是否非空
- 如果有参考图：绕过 `DallEAPIWrapper`，直接调用火山引擎原生 API（`POST /api/v3/images/generations`），因为 `DallEAPIWrapper` 不支持 `image` 参数
- 如果无参考图：保持现有 `DallEAPIWrapper` 调用逻辑不变，向后兼容

**原生 API 请求体**：
```json
{
  "model": "doubao-seedream-5.0-lite",
  "prompt": "<处理后的提示词>",
  "image": ["url1", "url2"],
  "size": "1728x2304",
  "response_format": "url",
  "watermark": false,
  "sequential_image_generation": "disabled"
}
```

**关键细节**：
- `image` 字段：统一传入 URL 字符串数组（即使单张也用数组），2-14张
- 参考图数量限制：Seedream 最多 14 张，需在 `generate-page-image.ts` 中校验
- 错误处理：参考图 URL 不可访问时，返回明确错误信息

### 6.3 generate-page-image.ts 改造

**改造前**：
```
prompt → strategy.generate({ prompt, size })
```

**改造后**：
```
1. 从 page.imageRefs 收集参考图
2. 校验参考图数量（≤14）
3. 处理 prompt：将 ${名称} 替换为素材描述
4. strategy.generate({ prompt, size, images: [{url, name, type}] })
```

**回退机制**：
- 如果 `page.imageRefs` 为空（旧数据兼容），行为与当前完全一致
- 如果某个素材的 `officialImageUrl` 已失效（404），跳过该参考图并记录日志

### 6.4 前端到后端数据传递

当前调用链无需改动：`page.imageRefs` 作为 `PageItem` 的一部分，已自然包含在请求体中传递到后端。

---

## 七、错误处理与边界情况

### 7.1 参考图校验

| 场景 | 处理方式 |
|------|----------|
| 参考图数量 > 14 | 返回错误：「参考图不能超过 14 张，当前引用了 N 张」 |
| 素材无 officialImageUrl | 从 imageRefs 中过滤掉，不传给 API，并在日志中记录 |
| 参考图 URL 无法访问 | 跳过该参考图，记录日志，继续生成（降级为无参考图或少参考图） |
| imageRefs 全部无效 | 降级为纯文生图，不传 image 参数 |

### 7.2 数据兼容性

| 场景 | 处理方式 |
|------|----------|
| 旧项目 pages 无 image_refs 列 | 读取时默认 `imageRefs: []`，不影响现有功能 |
| page.imageRefs 为空 | 走现有纯文生图逻辑，向后兼容 |
| 用户未手动编辑提示词（promptUserEdited=false） | buildPagePrompt 自动插入引用，imageRefs 自动填充 |
| 用户手动编辑删除了 ${名称} 但 imageRefs 未更新 | 编辑器同步机制：删除内联卡片时同时移除 imageRefs 对应项 |

### 7.3 编辑器边界情况

| 场景 | 处理方式 |
|------|----------|
| 用户手动输入 `${跳跳}` 但跳跳不是素材 | 渲染为普通文本（不识别为卡片），不生成 ImageRef |
| 素材名称被修改 | 已有的 ${旧名称} 引用失效，显示为「未知引用」卡片（红色边框），提示用户重新选择 |
| 素材正式图被重新生成 | imageRefs 中的 imageUrl 在下次生成时从 assets 重新获取最新值 |
| 同一素材多次引用 | imageRefs 去重，prompt 中可多次出现 ${名称}，但 API 只传一张参考图 |

### 7.4 数据流总结

```
用户编辑提示词（输入 # 或自动生成）
  → PromptEditor 更新 page.prompt（含 ${名称} 文本）
  → 同步更新 page.imageRefs（ImageRef[]）
  → 保存到 DB（image_refs 列存 JSON）

生成页面图片时：
  → generate-page-image.ts 读取 page.imageRefs
  → 校验 + 过滤无效引用
  → prompt 中 ${名称} 替换为素材描述
  → 收集 officialImageUrl 构建 images 参数
  → strategy.generate({ prompt, size, images })
  → Seedream API: image 参数传入参考图 URL
```

---

## 八、涉及文件清单

| 文件路径 | 改动类型 | 描述 |
|---------|---------|------|
| `src/types/picturebook.ts` | 修改 | 新增 ImageRef 类型，PageItem 增加 imageRefs 字段 |
| `src/modules/studio/presentation/context/StudioContext.tsx` | 修改 | buildInitialPages 增加 imageRefs，新增 SCAN_IMAGE_REFS action |
| `src/modules/studio/domain/services/prompt/asset-page-prompts.ts` | 修改 | buildPagePrompt 自动插入 ${名称} 引用 |
| `src/modules/studio/application/use-cases/generate-page-image.ts` | 修改 | 解析引用、收集参考图、替换 prompt、传 images 参数 |
| `src/platform/ai/contracts/image-model-gateway.ts` | 修改 | ImageGenerateParams 增加 images 字段，新增 ImageRefInput 类型 |
| `src/platform/ai/strategies/openai-compatible.ts` | 修改 | 有参考图时调用原生 Seedream API |
| `src/components/studio/stages/Stage5Pages.tsx` | 修改 | Textarea 替换为 PromptEditor |
| `src/components/studio/PromptEditor.tsx` | 新增 | 内联引用编辑器组件 |
| `src/components/studio/AssetSelector.tsx` | 新增 | # 触发的素材选择器 Popover |
| `src/components/studio/ImageRefPreview.tsx` | 新增 | 参考图预览区组件 |
| `src/lib/prompt-ref-parser.ts` | 新增 | ${名称} 引用解析器 |
| `src/lib/db/schema-drizzle.ts` | 修改 | pages 表增加 image_refs 列 |
