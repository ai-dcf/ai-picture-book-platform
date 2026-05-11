# 阶段四素材设定：画面比例独立调整 & 大图预览

## 背景

当前阶段四的 `CharacterCard` 和 `SceneCard` 中，图片预览框硬编码为 `aspect-square`（正方形）或 `aspect-video`，未跟随用户在阶段一选择的项目画面比例。此外，所有素材图片无法点击查看大图。

## 需求

1. 每个角色/场景卡片有独立的画面比例选择器，默认值取项目全局比例，允许单独覆盖
2. 修改比例同时影响基础形象和三视图的预览框及生成尺寸
3. 所有素材图片（基础形象、三视图、场景候选图）支持点击大图预览（Dialog 模态弹窗）
4. 修改比例后已有图片标记为「待复查」，保留不删除

## 数据模型变更

### AssetItem 新增字段

```typescript
// src/types/picturebook.ts
export interface AssetItem {
  // ...existing fields
  aspectRatio: AspectRatio;  // 新增：角色/场景独立画面比例
}
```

### 初始值

`INIT_ASSETS` 时，`aspectRatio` 初始化为 `state.projectInfo.aspectRatio`。

### Reducer 新增 Action

```typescript
// action payload
{
  type: 'UPDATE_ASSET_ASPECT_RATIO',
  payload: {
    type: 'characters' | 'scenes',
    id: string,
    aspectRatio: AspectRatio,
  }
}
```

处理逻辑：更新 `asset.aspectRatio`；如果该 asset 已有图片（`baseImageUrl` 存在或 `candidates.length > 0`），将 `status` 标记为 `review`。

## UI 布局变更

### 比例选择器位置（方案 A：内联式）

在"基础形象"标签行右侧放置 Select 下拉框，与标签同行：

```
[基础形象 标签]  [比例选择器 Select ↓]
```

CharacterCard：在"基础形象"标签行右侧。
SceneCard：在卡片标题行（`asset.name` 旁）右侧，因为场景卡片没有"基础形象/三视图"分区，候选图生成是整体操作。

### 预览框比例映射

所有图片预览框从硬编码 `aspect-square` / `aspect-video` 改为根据 `asset.aspectRatio` 动态计算：

```typescript
function getAspectClass(ratio: AspectRatio): string {
  const map: Record<AspectRatio, string> = {
    '3:4': 'aspect-[3/4]',
    '9:16': 'aspect-[9/16]',
    '16:9': 'aspect-[16/9]',
    '1:1': 'aspect-square',
  };
  return map[ratio] || 'aspect-square';
}
```

### 组件适配

- **LoadingTiles**：`aspect` 参数从 `'square' | 'video'` 扩展为支持 `AspectRatio`
- **EmptyPreview**：同上
- **图片展示 div**：统一使用 `getAspectClass(asset.aspectRatio)`

### 影响范围

- CharacterCard：基础形象预览、三视图 3 张预览
- SceneCard：候选图 3 张预览

## 大图预览功能

### 交互流程

1. 用户点击任意素材图片
2. 弹出 Dialog 模态弹窗，居中显示原图
3. 图片 `max-w-[90vw] max-h-[85vh] object-contain`，保持原始比例
4. 点击遮罩层 / 关闭按钮 / ESC 关闭

### 组件设计

```typescript
interface ImagePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageUrl: string;
  alt: string;
}
```

基于 `@/components/ui/dialog`，DialogContent 去掉默认 padding，右上有 X 关闭按钮。

### 状态管理

在 `Stage4Assets` 顶层维护：

```typescript
const [previewState, setPreviewState] = useState<{
  open: boolean;
  imageUrl: string;
  alt: string;
}>({ open: false, imageUrl: '', alt: '' });
```

### 可点击视觉反馈

- 所有支持预览的图片添加 `cursor-pointer`
- hover 时 `hover:scale-[1.02] transition-transform`
- hover 时半透明遮罩 + 放大图标（可选增强）

## 后端集成变更

### generateAssetImage

当前从 `projectInfo.aspectRatio` 读取比例 → 改为从 `asset.aspectRatio` 读取 size 映射：

```typescript
const sizeMap: Record<string, string> = {
  "3:4": "768x1024",
  "9:16": "768x1366",
  "16:9": "1366x768",
  "1:1": "1024x1024",
};
const size = sizeMap[asset.aspectRatio] || "1024x1024";
```

### generatePageImage

保持从 `projectInfo.aspectRatio` 读取，逐页生成跟随项目全局比例。

### 前端调用

`use-studio-generate.ts` 的 `generateAssetImage` 参数不变（传整个 asset 对象），asset 已含 `aspectRatio` 字段。

## 比例变更提示

当 `status` 被标记为 `review` 时，在 `AssetStatusBadge` 旁显示提示："画面比例已变更，建议重新生成"，使用 `text-amber-600` 样式。

## 不涉及

- 不修改项目全局比例在阶段四的入口（保留阶段一的修改机制）
- 不新增全屏覆盖层预览
- 不自动重新生成图片
