# 阶段四素材设定：角色基础形象 & 场景候选图历史版本管理

## 背景

当前阶段四的 `CharacterCard` 中，点击"重新生成基础形象"会直接覆盖 `baseImageUrl`，旧图片丢失无法回溯。`SceneCard` 的"重新生成候选图"同理，3 张候选图整体覆盖。用户无法对比不同版本的生成结果，也无法回退到之前满意的版本。

## 需求

1. 重新生成时保留旧版本作为历史记录
2. 历史版本列表支持查看、选择，用户可从中选择任意版本设为当前使用版本
3. 当前选中版本有明确视觉标识
4. 历史版本显示生成时间戳，按时间倒序排列
5. 历史版本数量上限 10 个，超出自动删除最旧版本
6. 图片懒加载确保性能
7. 选择历史版本时需二次确认
8. 适用范围：角色基础形象 + 场景候选图全覆盖

## 方案选择

**方案 A（已采纳）：在 `AssetItem` 上扩展 `history` 字段**

在现有 `AssetItem` 类型中新增 `baseImageHistory` 和 `candidateHistory` 字段，直接挂在状态树上。Reducer 层面修改 `SET_CHARACTER_BASE_IMAGE` 等 action，每次生成新图片时将旧值推入历史而非覆盖。

理由：最小改动原则，完全契合当前 `useReducer` + 单一 context 架构，数据流一致。

备选方案（未采纳）：
- 方案 B：独立 `AssetHistoryContext` — 两个 context 协同增加复杂度，违背单一 context 模式
- 方案 C：AssetItem 扩展 + localStorage 持久化 — 当前项目无 localStorage 使用先例，5MB 限制可能不足

## 数据模型变更

### 新增类型

```typescript
// src/types/picturebook.ts

export interface BaseImageHistoryEntry {
  imageUrl: string;
  timestamp: number;
}

export interface CandidateHistoryEntry {
  candidates: string[];
  timestamp: number;
}
```

### AssetItem 新增字段

```typescript
export interface AssetItem {
  // ...existing fields

  baseImageHistory: BaseImageHistoryEntry[];   // 基础形象历史，时间倒序
  candidateHistory: CandidateHistoryEntry[];   // 候选图历史，时间倒序
}
```

### 常量

```typescript
export const BASE_IMAGE_HISTORY_LIMIT = 10;
export const CANDIDATE_HISTORY_LIMIT = 10;
```

### 初始值

`INIT_ASSETS` 时，`baseImageHistory: []`，`candidateHistory: []`。

### 关键规则

- `baseImageUrl` 始终是"最新生成的那张"，`officialImageUrl` 才是"最终确认的形象"
- 历史列表不包含当前 `baseImageUrl`（它独立展示），历史只存被替换掉的旧版本
- 选择历史版本时，将历史版本的 imageUrl 赋值给 `baseImageUrl`，同时从历史列表中移除该条目，当前 `baseImageUrl` 推入历史

## Reducer Action 变更

### 现有 Action 修改

**`SET_CHARACTER_BASE_IMAGE`**

生成新基础形象时，旧的 `baseImageUrl`（非 null）推入 `baseImageHistory`，再设置新值：

```
1. 如果 a.baseImageUrl 非 null，构造 { imageUrl: a.baseImageUrl, timestamp: Date.now() }
2. 将该条目插入 baseImageHistory 头部
3. .slice(0, BASE_IMAGE_HISTORY_LIMIT) 裁剪
4. 设置 baseImageUrl = action.payload.imageUrl
```

**`SET_SCENE_CANDIDATES`**

生成新候选图时，旧的 `candidates`（非空数组）推入 `candidateHistory`，再设置新值：

```
1. 如果 a.candidates.length > 0，构造 { candidates: a.candidates, timestamp: Date.now() }
2. 将该条目插入 candidateHistory 头部
3. .slice(0, CANDIDATE_HISTORY_LIMIT) 裁剪
4. 设置 candidates = action.payload.candidates
```

### 新增 Action

**`SELECT_BASE_IMAGE_FROM_HISTORY`**

```typescript
{ type: 'SELECT_BASE_IMAGE_FROM_HISTORY'; payload: { id: string; historyIndex: number } }
```

处理逻辑：
1. 从 `baseImageHistory[historyIndex]` 取出 imageUrl
2. 将当前 `baseImageUrl` 推入历史头部（排在最前面）
3. 移除该历史条目（historyIndex 处）
4. 清空 `turnaroundImages`（三视图需重新生成）
5. 将 `status` 设为 `candidates_generated`

**`SELECT_CANDIDATE_FROM_HISTORY`**

```typescript
{ type: 'SELECT_CANDIDATE_FROM_HISTORY'; payload: { id: string; historyIndex: number } }
```

处理逻辑：
1. 从 `candidateHistory[historyIndex]` 取出 candidates
2. 将当前 `candidates` 推入历史
3. 移除该历史条目
4. 重置 `officialIndex` 为 null

## UI 交互设计

### CharacterCard — 基础形象历史区

在"确认基础形象"按钮下方，新增可折叠区域：

- 折叠区标题：`▸ 历史版本 (N)` — N 为历史数量，0 时隐藏整个区域
- 默认收起，点击展开
- 缩略图网格：2~5 列自适应，每个缩略图带 aspect ratio + 时间戳（HH:mm 格式）
- 选中态标识：
  - 当前 `officialImageUrl` 对应的条目：`border-primary` 蓝色边框 + 右上角蓝色圆形 ✓ 图标
  - 其余条目：默认细边框，hover 时 `border-primary/40`
- 点击缩略图 → 弹出确认对话框

### SceneCard — 候选图历史区

在候选图选择区域下方，新增可折叠区域：

- 折叠区标题：`▸ 候选图历史 (N)`
- 每条历史展示为"第 N 轮 + 时间" + 3 张小缩略图横排
- 点击某轮 → 弹确认对话框 → 确认后整轮替换当前 candidates

### 确认对话框

使用 `AlertDialog` 组件：

**角色基础形象：**
- 标题：切换基础形象
- 内容：预览所选图片 + "切换后，当前三视图将被清除，需要重新生成。确定切换？"
- 按钮：[取消] [确认切换]

**场景候选图：**
- 标题：切换候选图
- 内容：预览所选轮次 3 张图片 + "切换后，当前已选的正式版本将被重置。确定切换？"
- 按钮：[取消] [确认切换]

### 图片懒加载

- 历史缩略图添加 `loading="lazy"` 原生属性
- 使用 `useLazyImage` hook（Intersection Observer）延迟设置 img src
- 折叠区收起时不加载图片

## 组件拆分

### 新增组件（定义在 Stage4Assets.tsx 内部）

| 组件 | 职责 |
|---|---|
| `BaseImageHistoryPanel` | 基础形象历史折叠区 + 缩略图网格 + 选中态 |
| `CandidateHistoryPanel` | 候选图历史折叠区 + 每轮缩略图 + 选中态 |
| `HistoryImageThumbnail` | 统一缩略图组件（懒加载 + 点击选中 + 时间戳） |
| `SwitchBaseImageDialog` | 切换基础形象确认对话框 |
| `SwitchCandidateDialog` | 切换候选图确认对话框 |

### 新增 Hook

**`useLazyImage`** — 封装 Intersection Observer 懒加载逻辑

```typescript
function useLazyImage(imgRef: RefObject<HTMLImageElement>) {
  const [isVisible, setIsVisible] = useState(false);
  // Intersection Observer：isVisible 为 true 时才设置 img src
  return isVisible;
}
```

### 现有组件修改

- **`CharacterCard`**：在操作按钮下方插入 `<BaseImageHistoryPanel>`
- **`SceneCard`**：在候选图区域下方插入 `<CandidateHistoryPanel>`
- **`Stage4Assets`**：新增确认对话框的 state 管理

### 引用的已有 UI 组件

- `Collapsible` / `CollapsibleTrigger` / `CollapsibleContent`
- `AlertDialog` / `AlertDialogAction` / `AlertDialogCancel` / `AlertDialogContent` / `AlertDialogDescription` / `AlertDialogFooter` / `AlertDialogHeader` / `AlertDialogTitle`
- `getAspectClass`、`cn` 等工具函数

## 边界情况

| 场景 | 处理策略 |
|---|---|
| 历史为空 | 隐藏折叠区，不展示入口 |
| 历史达上限后再生成 | `.slice(0, LIMIT)` 自动裁剪最旧条目 |
| historyIndex 越界 | reducer 做边界检查，越界不操作 |
| baseImageUrl 为 null 推历史 | 不推入（只有非 null 才入历史） |
| candidates 为空数组推历史 | 不推入（只有非空才入历史） |
| 图片 URL 失效 | 缩略图显示 fallback 占位 + "图片已失效"提示 |
| 生成中点击历史 | 按钮已 disabled（asset.generating 为 true） |
| 选择历史后点"确认基础形象" | 正常走 CONFIRM_CHARACTER_BASE 流程 |

## 不涉及

- 不处理跨 asset 的历史迁移
- 不处理历史版本的手动删除（只通过 FIFO 自动淘汰）
- 不处理历史版本的编辑/备注
- 不引入额外数据持久化（与当前内存 useReducer 一致）
- 三视图不单独做历史管理（选择历史基础形象时清空，重新生成后覆盖）
