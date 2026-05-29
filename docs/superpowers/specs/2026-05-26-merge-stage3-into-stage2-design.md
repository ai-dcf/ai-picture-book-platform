# 合并 Stage3Storyboard 到 Stage2Story（6 阶段 → 5 阶段）设计

日期：2026-05-26

## 背景与目标

当前 Studio 的创作流程为 6 个阶段，阶段 3 为“分镜拆页”（组件 `Stage3Storyboard.tsx`），阶段 2 为“故事架构”（组件 `Stage2Story.tsx`）。需求是：

1. 将 `Stage3Storyboard.tsx` 的页面内容与能力合并到 `Stage2Story.tsx`。
2. 去掉单独的 `Stage3Storyboard.tsx` 页面。
3. 将流程从 6 阶段改为 5 阶段（阶段编号整体前移），且不兼容旧数据。

## 非目标

1. 不做旧项目数据迁移与兼容（旧项目可能出现阶段错位，属于预期内行为）。
2. 不改变 AI 生成能力本身（仅调整 UI、阶段编排、状态流转）。

## 现状摘要

- `StudioPage.tsx` 按 `state.currentStage` 渲染 `Stage1..Stage6`。
- `LeftSidebar.tsx` 使用 `STAGES: [1..6]` 与 `STAGE_LABELS` 展示阶段导航。
- `StudioContext.tsx` reducer 中 `COMPLETE_STAGE` 会：
  - 将完成阶段置为 `done`
  - 将下一个阶段从 `idle` 推进到 `in-progress`
  - 更新 `projectInfo.projectStatus`（阶段 2/3/4/5 对应不同状态）
- `Stage2Story.tsx` 在编辑角色/场景时会在下游阶段存在时标记待复查（目前检查 stageStatuses[3]/[4]）。
- `Stage3Storyboard.tsx` 负责：
  - 自动/手动生成 storyboard 和 cover
  - 编辑封面标题/封面画面描述
  - 编辑每页分镜画面描述与页面文字
  - 确认分镜后 dispatch INIT_ASSETS + COMPLETE_STAGE(3)

## 目标设计（推荐方案 A）

### 1) 阶段体系（6 → 5）

`StageNumber` 变为：

- 1：项目初始化
- 2：故事架构 + 分镜拆页（合并）
- 3：素材设定（原 4）
- 4：逐页生成（原 5）
- 5：编辑定稿与导出（原 6）

对应调整：

- `STAGE_LABELS` 更新为以上 5 项
- `LeftSidebar` 的 `STAGES` 改为 `[1, 2, 3, 4, 5]`
- `StudioPage` 渲染阶段组件为 5 个：`Stage1Init`, `Stage2Story`, `Stage4Assets`, `Stage5Pages`, `Stage6Finalize`（文件名可暂不改，但 stage id 映射需要更新）
- `StudioPage` 的布局判定 `isFullWidth` 需要随阶段前移：逐页生成与定稿阶段应保持全宽展示
- `LeftSidebar` 对“逐页生成阶段”展示页列表的判断从旧阶段 5 调整到新阶段 4

说明：组件文件名保持不动（减少改动），但它们在渲染与 stage id 上的意义发生前移：

- 旧 Stage4Assets 作为新阶段 3 渲染
- 旧 Stage5Pages 作为新阶段 4 渲染
- 旧 Stage6Finalize 作为新阶段 5 渲染

### 2) 合并页面结构（Stage2Story）

`Stage2Story` 在一个页面内呈现两个区域：

- 故事架构区：保留原有生成、错误提示、4 项编辑（大纲/情绪曲线/角色/场景）
- 分镜拆页区：嵌入原 `Stage3Storyboard` 的生成、错误提示、封面编辑与逐页分镜编辑

交互与文案：

- 生成按钮：
  - 故事架构区：仍为“一键生成故事架构/重新生成”
  - 分镜拆页区：仍为“整本生成分镜/重新生成”
- 确认按钮：
  - 合并为一个底部确认：“确认故事与分镜，进入素材设定”
  - 触发：
    - dispatch INIT_ASSETS（与原 Stage3 一致）
    - dispatch COMPLETE_STAGE(2)（因为合并后 stage2 即代表 story+storyboard confirmed）

### 3) projectStatus 推进

由于不再存在“单独的 storyboard 阶段”，projectStatus 的推进逻辑调整为：

- 完成阶段 1：draft
- 完成阶段 2：storyboard_confirmed（直接跨过 story_confirmed，或者保留 story_confirmed 但不再用于阶段推进）
- 完成阶段 3：assets_confirmed
- 完成阶段 4：creating
- 完成阶段 5：不变（由既有逻辑决定后续 exportable/review 等）

推荐：完成阶段 2 时直接设为 `storyboard_confirmed`，与当前数据模型最贴近，且避免引入新的状态枚举。

### 4) 下游复查（review/invalid）前移

当前 `markDownstreamReview` / 以及 `UPDATE_CHARACTER_DESC`、`UPDATE_SCENE_DESC` 的下游检查基于旧的阶段编号。

合并后规则为：

- 当故事架构区内容发生变化，且下游（素材设定/逐页生成/定稿）已非 idle 时，需要将下游标为 review/invalid（维持现有策略，但 stage id 整体前移）
- 由于 stage3 取消，原先 “if stageStatuses[3] !== 'idle'” 的判断应改为检查新阶段 3/4/5 的状态

### 4.1) reducer 基础流转

`StudioContext.tsx` 的 `COMPLETE_STAGE` 里 `next = Math.min(completed + 1, 6)` 需要调整为 `5`，避免阶段 5 之后被推进到不存在的阶段。

### 5) 删除 Stage3Storyboard 页面

- `StudioPage` 不再引用/渲染 `Stage3Storyboard`
- 删除 `Stage3Storyboard.tsx` 文件
- 清理引用与未使用 import

## 风险与已知限制

1. 不兼容旧数据：旧项目若 `currentStage` 或 `stageStatuses` 存在 6 阶段编号，可能导致 UI 渲染错位或锁定逻辑异常。
2. 组件文件名与阶段编号语义不一致：短期用“渲染映射”解决，长期可考虑重命名文件/组件以匹配新的阶段编号（非本次目标）。

## 验收标准

1. UI 仅展示 5 个阶段，侧边栏与顶部进度一致。
2. 阶段 2 页面同时包含故事架构与分镜拆页，且分镜相关功能可正常生成/编辑/保存。
3. 点击确认后进入“素材设定”（新阶段 3），并初始化 assets（INIT_ASSETS）。
4. TypeScript 无编译错误，页面可正常运行。
