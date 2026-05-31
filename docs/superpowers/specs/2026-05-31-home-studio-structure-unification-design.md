# Home 与 Studio 目录风格统一设计

日期：2026-05-31

## 背景

当前项目在 `home` 与 `studio` 两个核心用户入口上，同时混用了三种目录组织方式：

- `src/app/page.tsx` 通过 `src/app/components/HeroPage.tsx` 渲染首页
- `src/app/studio/page.tsx` 通过 `src/modules/studio/presentation/components/StudioPage.tsx` 渲染工作台页
- `src/modules/studio/presentation/components/StudioPage.tsx` 又继续依赖 `src/components/studio/*`

这会导致以下问题：

- 同一业务功能的代码分散在 `app / components / modules` 三处，阅读路径不稳定
- 首页与 Studio 的组织风格不一致，新增代码时缺少明确归属
- `src/components` 同时承载“通用组件”和“业务组件”，语义变得模糊
- `app` 目录既像路由层，又像页面业务层，边界不清楚

用户希望本次只整理 `home + studio` 两块，顺手统一目录风格，不扩展到全仓。

## 目标

- 将 `home` 与 `studio` 的页面、业务组件、hooks、utils 尽量收口到 `src/modules/<feature>/presentation/...`
- 让 `src/app` 回归“路由入口 / layout / providers / api”的职责
- 保持首页与 Studio 的目录风格一致，降低后续新增与维护成本
- 在不改业务行为的前提下完成目录统一，避免把这次工作扩张成业务重构

## 用户已确认的规则

- 本次范围仅覆盖 `home + studio`
- 统一目录风格采用“收口到 `modules`”
- `src/app` 只保留路由入口，不再继续承载首页业务页面组件
- 不借本次机会全量重构 `model-config`、`editor`、`ui`、`project-history` 等其他模块

## 方案

### 1. 总体方案

采用“方案 1：双 feature 对齐”：

- 新建 `src/modules/home/presentation/components/HomePage.tsx`
- 将当前首页页面组件从 `src/app/components/HeroPage.tsx` 迁移到 `src/modules/home/presentation/components/HomePage.tsx`
- 将当前 `src/components/studio/*` 业务组件整体收口到 `src/modules/studio/presentation/components/*`
- `src/app/page.tsx` 与 `src/app/studio/page.tsx` 都只保留轻量路由转发职责

这样可以让 `home` 与 `studio` 两个入口都遵循同一套 feature 结构：

- `app` 负责路由
- `modules/<feature>` 负责业务
- `components/ui` 负责通用基础组件

### 2. 目标目录结构

本次整理后的目标结构如下：

```text
src/
  app/
    page.tsx
    studio/page.tsx
    ...
  components/
    ui/
      ...
  modules/
    home/
      presentation/
        components/
          HomePage.tsx
    studio/
      presentation/
        components/
          StudioPage.tsx
          TopBar.tsx
          ProjectProgress.tsx
          ModelConfigBanner.tsx
          LeftSidebar.tsx
          PromptEditor.tsx
          PromptRefPicker.tsx
          FixedImagePreview.tsx
          StageActionHeader.tsx
          stages/
            Stage1Init.tsx
            Stage2Story.tsx
            Stage4Assets.tsx
            Stage5Pages.tsx
            Stage6Finalize.tsx
        context/
          StudioContext.tsx
        hooks/
          use-studio.ts
          use-studio-generate.ts
        utils/
          create-studio-project-state.ts
```

说明：

- `src/components/ui` 保留不动
- `src/components/studio` 迁空或最终删除
- `src/app/components` 迁空或最终删除
- `src/components/editor` 本次不动

### 3. 首页迁移设计

首页部分的统一方式：

- `HeroPage.tsx` 重命名并迁移为 `modules/home/presentation/components/HomePage.tsx`
- `src/app/page.tsx` 改为从 `@/modules/home/presentation/components/HomePage` 导入
- 首页自身如果还依赖 `useProjectHistory`、`useStudioGenerate`、`createStudioProjectState`，继续通过模块路径引用，不额外抽壳

迁移原则：

- 首页只做“物理位置调整 + 名称统一”
- 不在这次目录整理中再次改首页交互和视觉
- 避免把“目录统一”和“首页二次改版”耦合在一次提交里

### 4. Studio 迁移设计

Studio 侧采用“收拢 presentation 组件”的方式：

- 将 `src/components/studio/*` 迁移到 `src/modules/studio/presentation/components/*`
- `stages/*` 子目录整体迁到 `src/modules/studio/presentation/components/stages/*`
- `StudioPage.tsx` 改为只引用同 feature 下的 presentation 组件
- 其它仍引用 Studio 组件的文件，统一切换为 `@/modules/studio/presentation/components/...`

迁移后的依赖方向应为：

- `app/studio/page.tsx` -> `modules/studio/presentation/components/StudioPage.tsx`
- `StudioPage.tsx` -> `modules/studio/presentation/components/*`
- `Stage*` 页面 -> `modules/studio/presentation/hooks/*`、`context/*`、`utils/*`

不再出现：

- `modules/studio/presentation/components/*` 反向依赖 `src/components/studio/*`

### 5. 导入策略

本次统一时，导入路径遵循以下规则：

- feature 内部优先使用 `@/modules/<feature>/presentation/...`
- 共享基础组件继续使用 `@/components/ui/...`
- 跨 feature 的复用 hook 或工具，继续沿用已有模块路径
- 不新增新的“临时中转导出文件”来掩盖目录问题

执行时建议：

1. 先迁首页文件并修正 `app/page.tsx`
2. 再整体迁移 `components/studio` 到 `modules/studio/presentation/components`
3. 最后统一替换 import，并做 lint / diagnostics 校验

### 6. 迁移清单

#### Home

- `src/app/components/HeroPage.tsx`
  -> `src/modules/home/presentation/components/HomePage.tsx`
- `src/app/page.tsx`
  -> 更新导入路径

#### Studio

- `src/components/studio/FixedImagePreview.tsx`
- `src/components/studio/LeftSidebar.tsx`
- `src/components/studio/ModelConfigBanner.tsx`
- `src/components/studio/ProjectProgress.tsx`
- `src/components/studio/PromptEditor.tsx`
- `src/components/studio/PromptRefPicker.tsx`
- `src/components/studio/StageActionHeader.tsx`
- `src/components/studio/TopBar.tsx`
- `src/components/studio/stages/Stage1Init.tsx`
- `src/components/studio/stages/Stage2Story.tsx`
- `src/components/studio/stages/Stage4Assets.tsx`
- `src/components/studio/stages/Stage5Pages.tsx`
- `src/components/studio/stages/Stage6Finalize.tsx`

迁移后需要同步更新引用这些文件的模块：

- `src/modules/studio/presentation/components/StudioPage.tsx`
- `src/app/editor/page.tsx`
- `src/components/editor/EditorCanvas.tsx`
- `src/components/editor/EditorControlPanel.tsx`
- 以及任何仍引用旧 `@/components/studio/...` 路径的文件

### 7. 异常与边界

本次目录整理的边界如下：

- 不修改业务状态机逻辑
- 不调整接口结构
- 不重新设计首页或 Studio 交互
- 不同步处理 `editor` 目录风格
- 不把 `project-history` 从 `modules` 挪到别处

如果迁移过程中发现以下情况，则停止扩大范围：

- 某些 `studio` 组件其实被 `editor` 或其他模块广泛复用
- 某些文件迁移会引发大面积循环依赖
- 某些 import 改动需要连带重构 feature 边界

处理方式：

- 保持迁移在 `home + studio presentation` 范围内
- 对跨模块共享但语义不明确的组件，先保留原位并记录为后续议题

### 8. 风险与处理

#### 风险 1：文件迁移后 import 大量失效

处理：

- 先按目录批量迁移，再统一替换路径
- 完成后立即执行 `GetDiagnostics` 与 `npm run lint`

#### 风险 2：Studio 组件被 editor 间接依赖，迁移后遗漏引用

处理：

- 在迁移前先全局搜索 `@/components/studio/`
- 将受影响文件纳入一次性替换范围

#### 风险 3：首页与 Studio 完成迁移后，旧空目录残留造成误导

处理：

- 若目录已无保留价值，则删除空目录
- 若暂需过渡，明确只允许短期存在，不继续向旧目录新增文件

#### 风险 4：目录统一演变成 feature 再设计

处理：

- 严格限制本次只做“归位”和“命名统一”
- 不借机拆更多 hooks、不顺手改更深的架构

### 9. 验收标准

- `src/app/page.tsx` 不再依赖 `src/app/components/*`
- 首页页面组件迁入 `src/modules/home/presentation/components`
- `src/components/studio/*` 业务组件迁入 `src/modules/studio/presentation/components/*`
- `StudioPage.tsx` 不再依赖 `@/components/studio/*`
- `home` 与 `studio` 两个入口都采用“`app` 路由入口 -> `modules/<feature>/presentation/components` 页面容器”的统一模式
- 不引入新的 TypeScript、JSX、lint 错误
- 首页与 Studio 的运行行为在本次整理后保持一致

## 非目标

- 本次不统一 `editor` 的目录风格
- 本次不统一 `model-config` 的目录风格
- 本次不重构 `project-history` 的模块形态
- 本次不调整 `components/ui` 的组织方式
- 本次不扩展为整仓结构重构
