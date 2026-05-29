# 页面生成提示词图片引用 — 实施计划

**日期**: 2026-05-17
**设计文档**: docs/superpowers/specs/2026-05-17-page-image-reference-design.md

---

## 实施步骤

### Step 1: 数据层 — 类型和持久化

**文件改动**：
1. `src/types/picturebook.ts` — 新增 `ImageRef` 接口，`PageItem` 增加 `imageRefs` 字段
2. `src/lib/db/schema.sql` — `pages` 表增加 `image_refs TEXT NOT NULL DEFAULT '[]'` 列
3. `src/lib/db/schema-drizzle.ts` — 如有 pages 表定义则同步增加字段

**验证**：TypeScript 编译通过，数据库 schema 无语法错误

---

### Step 2: 引用解析器

**新建文件**：
1. `src/lib/prompt-ref-parser.ts` — `${名称}` 引用解析器

**功能**：
- `parseRefTags(text: string)` — 正则提取所有 `${...}` 中的名称
- `resolveRefTags(text, characters, scenes)` — 匹配素材，返回 `ImageRef[]` 和未匹配列表
- `replaceRefTagsWithDescription(text, imageRefs, assets)` — 将 `${名称}` 替换为素材描述
- `injectRefTags(text, names: string[])` — 在文本中首次出现名称后插入 `${名称}`
- `removeRefTag(text, name: string)` — 从文本中删除指定 `${名称}`

**验证**：单元测试覆盖核心解析、替换、注入场景

---

### Step 3: StudioContext 改造

**文件改动**：
1. `src/modules/studio/presentation/context/StudioContext.tsx`

**改动内容**：
- `buildInitialPages` 中增加 `imageRefs: []`
- Action 类型新增 `SCAN_IMAGE_REFS`
- `SCAN_IMAGE_REFS` handler：调用 `prompt-ref-parser` 解析 prompt，更新 `page.imageRefs`，返回未引用素材列表
- `SYNC_PAGES_FROM_STORYBOARD` 同步时，使用改造后的 `buildPagePrompt` 结果更新 `imageRefs`

**验证**：现有页面生成流程不受影响，新增 action 可正确解析和更新 imageRefs

---

### Step 4: buildPagePrompt 自动插入引用

**文件改动**：
1. `src/modules/studio/domain/services/prompt/asset-page-prompts.ts`

**改动内容**：
- `buildPagePrompt` 中，当 `characterRefs`/`sceneRefs` 非空时：
  - 在 `storyText` 中首次出现角色/场景名称后插入 `${名称}` 引用标记
  - 同时构建 `imageRefs: ImageRef[]`，从 assets 中匹配有 `officialImageUrl` 的素材
- `BuildPagePromptParams` 的 `page` 类型扩展，增加可选 `imageRefs`
- 返回值从 `string` 扩展为 `{ prompt: string; imageRefs: ImageRef[] }`

**调用方适配**：
- `Stage5Pages.tsx` 中的 `buildPagePrompt` 调用处同步更新
- `StudioContext.tsx` 中 `SYNC_PAGES_FROM_STORYBOARD` 适配新返回值

**验证**：自动生成的提示词中包含 `${名称}` 引用，imageRefs 正确填充

---

### Step 5: ImageModelGateway 接口扩展

**文件改动**：
1. `src/platform/ai/contracts/image-model-gateway.ts` — 新增 `ImageRefInput` 接口，`ImageGenerateParams` 增加 `images` 字段
2. `src/platform/ai/contracts/index.ts` — 导出新类型

**验证**：TypeScript 编译通过，现有调用方无报错（`images` 为可选字段）

---

### Step 6: OpenAI Compatible 策略改造 — 支持参考图

**文件改动**：
1. `src/platform/ai/strategies/openai-compatible.ts`

**改动内容**：
- `OpenAICompatibleImageStrategy.generate` 中：
  - 检测 `params.images` 非空时，绕过 `DallEAPIWrapper`，直接调用原生 API
  - 原生 API 调用：`POST {endpoint}/images/generations`，请求体包含 `model`, `prompt`, `image`, `size`, `response_format`, `watermark`, `sequential_image_generation`
  - `image` 字段：始终传 URL 数组（`string[]`）
  - 无参考图时保持现有逻辑不变
- 错误处理：参考图请求失败时降级为纯文生图

**验证**：无参考图时行为不变；有参考图时正确调用原生 API

---

### Step 7: generate-page-image.ts 改造

**文件改动**：
1. `src/modules/studio/application/use-cases/generate-page-image.ts`

**改动内容**：
- 从 `page.imageRefs` 收集参考图
- 校验参考图数量 ≤ 14
- 过滤无 `imageUrl` 的引用
- 调用 `replaceRefTagsWithDescription` 将 prompt 中 `${名称}` 替换为素材描述
- 构建 `images` 参数传给 `strategy.generate`

**验证**：有 imageRefs 时传 images 参数；无 imageRefs 时行为与改造前一致

---

### Step 8: PromptEditor 组件 — 内联引用编辑器

**新建文件**：
1. `src/components/studio/PromptEditor.tsx`

**功能**：
- 基于 `contentEditable` 的编辑器
- 渲染时将 `${名称}` 替换为内联卡片（span + 素材缩略图 + 名称）
- 卡片样式：圆角边框，角色蓝色系 / 场景绿色系
- 卡片不可编辑，Backspace/Delete 删除整个卡片
- 删除卡片时同步更新 `prompt` 和 `imageRefs`
- 输入 `#` 时触发 `AssetSelector`

**Props**：
```typescript
interface PromptEditorProps {
  value: string;                           // page.prompt
  imageRefs: ImageRef[];                   // page.imageRefs
  assets: AssetsData;                      // 全部素材
  onChange: (prompt: string, imageRefs: ImageRef[]) => void;
  characterRefs: string[];
  sceneRefs: string[];
  placeholder?: string;
  className?: string;
}
```

**验证**：编辑器正确渲染内联卡片，删除卡片同步更新数据

---

### Step 9: AssetSelector 组件 — # 素材选择器

**新建文件**：
1. `src/components/studio/AssetSelector.tsx`

**功能**：
- Popover 弹出，列出有 `officialImageUrl` 的素材
- 角色在前、场景在后
- 每项：缩略图（32x32）+ 名称 + 类型标签
- 已引用的素材标记「已引用」
- 支持键盘导航、搜索过滤
- 选中后回调 `(asset: AssetItem) => void`

**验证**：选择素材后正确插入引用

---

### Step 10: ImageRefPreview 组件 — 参考图预览区

**新建文件**：
1. `src/components/studio/ImageRefPreview.tsx`

**功能**：
- 横向缩略图列表，48x48，带圆角
- 右上角序号标签
- hover 显示名称 tooltip
- hover 显示 × 删除按钮
- 点击预览大图

**Props**：
```typescript
interface ImageRefPreviewProps {
  imageRefs: ImageRef[];
  onRemove: (assetId: string) => void;
}
```

**验证**：预览区正确展示参考图，删除功能正常

---

### Step 11: Stage5Pages.tsx 集成

**文件改动**：
1. `src/components/studio/stages/Stage5Pages.tsx`

**改动内容**：
- `<Textarea>` 替换为 `<PromptEditor>`
- `<PromptEditor>` 下方添加 `<ImageRefPreview>` 和未引用素材提示条
- `handlePromptChange` 适配新签名 `(prompt, imageRefs) => void`
- `handleGenerate` 传递 `page.imageRefs` 到 `generatePageImage`
- 未引用素材提示条：检测 `characterRefs`/`sceneRefs` 中未被引用的素材，显示提示

**验证**：完整流程 — 选择素材 → 插入引用 → 预览参考图 → 生成带参考图的页面

---

### Step 12: 数据迁移与兼容

**文件改动**：
1. `src/lib/db/schema.sql` — pages 表增加 `image_refs` 列（`ALTER TABLE` 迁移）
2. 数据读取层 — 反序列化 `image_refs`，无该列时默认 `[]`

**验证**：旧项目数据正常加载，imageRefs 默认为空数组

---

## 实施顺序和依赖关系

```
Step 1 (类型+持久化)
  → Step 2 (解析器)
    → Step 3 (StudioContext) + Step 4 (buildPagePrompt)
      → Step 5 (Gateway 接口)
        → Step 6 (策略改造) + Step 7 (generate-page-image)
      → Step 8 (PromptEditor) + Step 9 (AssetSelector) + Step 10 (ImageRefPreview)
        → Step 11 (Stage5Pages 集成)
          → Step 12 (数据迁移)
```

## 回归检查清单

- [ ] 无参考图时页面生成行为与改造前完全一致
- [ ] 旧项目数据加载正常（imageRefs 默认空数组）
- [ ] 自动生成提示词包含 `${名称}` 引用
- [ ] 手动 `#` 选择素材后正确插入引用和更新 imageRefs
- [ ] 删除内联卡片后 prompt 和 imageRefs 同步更新
- [ ] 参考图预览区正确展示和删除
- [ ] 未引用素材提示条正确触发和关闭
- [ ] 调用 API 时 prompt 中 `${名称}` 已替换为描述文字
- [ ] 调用 API 时 `image` 参数正确传入参考图 URL 数组
- [ ] 参考图 > 14 张时返回明确错误
