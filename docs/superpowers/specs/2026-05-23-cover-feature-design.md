## 背景

当前工作流只有“正文分镜”和“正文页生成”两条主线：

- `Stage3Storyboard` 只负责 `storyboard.pages`
- `Stage5Pages` 只负责 `pages`
- `PictureBookState`、`StoryboardData`、`PageItem` 都没有封面专用状态

这与新的业务目标不一致。当前需要在 `Stage3Storyboard.tsx` 和 `Stage5Pages.tsx` 中补齐封面能力，并满足以下前提：

- 封面不占正文页码
- 封面在 `Stage3` 中单独编辑
- 封面在 `Stage5` 中单独生成
- `Stage5` 只生成纯插画封面，不直接要求模型把标题画进图里
- 本次不考虑旧数据兼容

## 目标

- 在根状态中新增独立 `cover` 对象，显式表达“封面不是第 0 页正文”。
- 在 `Stage3Storyboard` 中新增封面编辑区，支持维护封面标题和封面画面描述。
- 在 `Stage5Pages` 中新增封面生成入口，支持封面 prompt 自动生成与封面图片手动生成。
- 封面生成链路尽量复用现有页面 prompt 与页面出图能力，避免复制两套实现。
- 保持正文页的页码、同步、出图和编辑流程语义不变。

## 用户已确认的规则

- 封面采用独立对象方案，不占正文页码。
- `Stage3` 中的封面可编辑字段为：
  - `标题`
  - `画面描述`
- `Stage5` 生成的是纯插画封面，不要求 AI 在图中直接生成书名文字。
- 自动化策略采用“半自动”：
  - `Stage3` 自动生成封面标题与封面画面描述
  - `Stage5` 自动生成封面 prompt
  - 封面图片始终手动点击按钮生成
- `Stage5` 中的封面标题允许继续编辑，不强制用户回到 `Stage3` 修改。
- 本次不考虑旧数据兼容，也不为历史状态做迁移逻辑。

## 方案

### 1. 根状态新增独立 Cover 对象

- 在 `PictureBookState` 下新增 `cover` 字段，不放进 `storyboard.pages` 或 `pages`。
- 新增 `CoverData`（命名可调整，但应保持独立语义），建议字段如下：
  - `title: string`
  - `visualGoal: string`
  - `userModified: boolean`
  - `prompt: string`
  - `promptUserEdited: boolean`
  - `imageUrl: string | null`
  - `status: PageStatus`
  - `generating: boolean`
  - `aspectRatio: AspectRatio`
  - `imageRefs: ImageRef[]`
- `cover` 字段为新 schema 的必填项；初始化、保存、读取都直接基于该结构，不增加缺省补齐分支。
- 字段语义保持“独立对象，但字段形态尽量接近 `PageItem`”，以便复用 Stage5 现有 prompt、引用素材、出图和状态展示能力。

### 2. 状态初始化与同步规则

- 为封面新增初始化函数，例如：
  - `buildInitialCover(projectInfo: ProjectInfo): CoverData`
- 初始化默认值：
  - `title` 默认取 `projectInfo.title`
  - `visualGoal`、`prompt` 为空
  - `imageUrl = null`
  - `status = 'idle'`
  - `generating = false`
  - `aspectRatio = projectInfo.aspectRatio`
  - `imageRefs = []`
- `SET_PROJECT_INFO` 更新项目标题时：
  - 仅当 `cover.userModified = false` 且当前封面标题仍跟随项目标题语义时，自动同步 `cover.title`
  - 一旦用户在 `Stage3` 或 `Stage5` 手改过封面标题，就停止自动覆盖
- `SET_PROJECT_INFO` 更新 `aspectRatio` 时：
  - 若封面尚未手动改过比例，则同步更新 `cover.aspectRatio`
  - 若后续允许 Stage5 单独改封面比例，则沿用页面比例的“页面优先、项目默认兜底”策略

### 3. Reducer 与 Action 设计

- 不建议把封面硬塞进现有 `UPDATE_PAGE_*` action。
- 推荐新增封面专用 action：
  - `SET_COVER`
  - `UPDATE_COVER_STORYBOARD_FIELDS`
  - `UPDATE_COVER_CONFIG`
  - `SET_COVER_GENERATING`
  - `SET_COVER_IMAGE`
  - `SET_COVER_STATUS`
- 其中：
  - `UPDATE_COVER_STORYBOARD_FIELDS` 只处理 `title`、`visualGoal`、`userModified`
  - `UPDATE_COVER_CONFIG` 处理 `prompt`、`promptUserEdited`、`imageRefs`、`aspectRatio` 等 Stage5 配置字段
  - `SET_COVER_GENERATING` / `SET_COVER_IMAGE` 对齐现有正文页图片生成状态流
- 封面编辑后，若当前 `cover.status` 为 `generated` 或 `finalized`，则沿用正文页规则打回 `review`。

### 4. Stage3 封面编辑区

- 在 `Stage3Storyboard` 的正文页列表上方新增“封面设置”卡片。
- 卡片包含：
  - `封面标题` 输入框
  - `封面画面描述` 输入框
  - `重新生成封面内容` 按钮
- 首次进入 `Stage3` 时，若 `cover.userModified = false` 且 `cover.visualGoal` 为空，则自动触发一次封面内容生成。
- 自动生成时允许基于故事信息重写 `cover.title`，不强制保留初始化时从 `projectInfo.title` 带入的默认标题。
- 自动生成成功后：
  - 写入 `cover.title`
  - 写入 `cover.visualGoal`
  - `cover.userModified = false`
- 用户手动编辑任一封面字段后：
  - 更新对应值
  - `cover.userModified = true`
- 正文页分镜列表继续保持当前折叠编辑体验；封面不混入“第 1 页、第 2 页...”序列。
- `确认分镜，进入素材设定` 的可放行条件需要包含封面内容已具备基本可用值：
  - `cover.title` 非空
  - `cover.visualGoal` 非空

### 5. Stage5 封面入口与选择模型

- `Stage5Pages` 左侧“页面列表”顶部新增固定入口 `封面`，其下方仍为正文页列表。
- 当前选中项不再是单纯的数字页码，而是两类之一：
  - `cover`
  - `page:<index>`
- 选中封面时：
  - 中间编辑区显示封面专用表单
  - 右侧预览区显示封面图
- 选中正文页时：
  - 继续走现有正文页流程
  - 尽量不改正文页现有交互顺序和行为

### 6. Stage5 封面编辑与生成界面

- 选中 `封面` 时，中间编辑区包含：
  - `封面标题`
  - `封面画面描述`
  - `AI绘画提示词`
  - `引用角色`
  - `引用场景`
- `封面标题` 在 `Stage5` 中允许继续编辑。
- 选中 `封面` 时，右侧预览区包含：
  - 封面图片预览
  - 比例选择（若保留页面级比例覆盖能力）
  - `生成封面插画` / `重新生成封面`
- 封面 prompt 编辑器优先复用 `PromptEditor`，继续支持 `imageRefs` 预览与引用能力。
- 封面状态徽标沿用 `PageStatus` 映射方式展示。

### 7. 封面 Prompt 与图片生成链路

- 不建议新开一整套封面 API 路径；优先复用现有页面 prompt 与页面出图能力。
- 推荐在现有调用参数中增加 `kind: 'cover' | 'page'`，或引入等价的轻量输入类型，由 builder 和 use case 识别分支。
- `generatePagePrompt` 在 `cover` 模式下的输入来源为：
  - `cover.title`
  - `cover.visualGoal`
  - `assets`
  - `projectInfo`
- `generatePageImage` 在 `cover` 模式下的输入来源为：
  - `cover.prompt`
  - `cover.imageRefs`
  - `projectInfo`
  - `assets`
- 封面模式不依赖 `storyboard.pages[index]`，也不依赖正文页索引。
- 封面 prompt 的目标是生成“纯插画封面提示词”，允许利用标题理解主题，但不要求模型在图上输出文字。

### 8. 封面自动触发与手动覆盖规则

- `Stage3` 自动生成规则：
  - 进入 `Stage3` 时，若 `cover.userModified = false`、`cover.visualGoal` 为空，且当前不在生成中，则自动生成一次封面内容
  - 若 `cover.userModified = true`，则不自动覆盖已有内容
- `Stage3` 手动重生成规则：
  - 点击 `重新生成封面内容` 后，用当前故事信息重新生成封面标题与封面画面描述
  - 生成成功后覆盖原值，并将 `userModified` 设回 `false`
- `Stage5` 自动生成规则：
  - 当选中 `封面` 且 `cover.prompt` 为空，并且 `cover.title` 或 `cover.visualGoal` 至少有一项非空时，自动生成一次封面 prompt
  - 自动生成成功后，将 `promptUserEdited = false`
- `Stage5` 手动重生成规则：
  - 点击“重新生成 AI 绘画提示词”后，使用当前封面标题、画面描述、项目风格、比例和引用素材重新生成 prompt
  - 成功后覆盖当前 `prompt`，并将 `promptUserEdited = false`
- 封面图片始终手动生成，不自动出图。

### 9. 进度与放行规则

- Stage5 的进度区不再只展示正文页数量。
- 推荐将进度拆成两部分：
  - `正文页生成进度`
  - `封面状态`
- “进入编辑定稿与导出”按钮的放行条件需要显式包含：
  - 正文页均已生成
  - 封面已生成
- 若后续编辑页不处理封面，本次仍要在 Stage5 上阻止“无封面直接进入最终阶段”的错误放行。

### 10. 对现有正文流程的约束

- 本次不改变正文页数组的索引语义。
- `storyboard.pages[index]` 仍只表示正文页。
- `pages[index]` 仍只表示正文页。
- 正文页的：
  - 分镜同步
  - 页面 prompt 自动生成
  - 页面图片生成
  - 状态统计
  - 编辑页跳转
  应保持现有行为不变，封面逻辑通过独立 `cover` 分支接入。

### 11. 验证方式

- 以定向回归为主，不新增大规模自动化测试。
- 至少需要验证：
  - 新项目进入 `Stage3` 后，能自动补封面标题与封面画面描述
  - 手动修改封面标题后，再修改 `projectInfo.title` 不会覆盖封面标题
  - 进入 `Stage5` 选中封面时，若 prompt 为空会自动生成封面 prompt
  - 封面图片可以手动生成，且不影响正文页生成
  - 正文页列表、页码、prompt、出图、进度统计不发生回归
  - Stage5 在封面未生成时不会错误放行到下一阶段

## 非目标

- 本次不把封面并入正文页数组，不引入“第 0 页封面”语义。
- 本次不要求 AI 直接生成带中文标题的完整封面图。
- 本次不改造 Stage6 或编辑页中的封面排版能力。
- 本次不做旧数据兼容、migration 或缺省状态补齐。
- 本次不扩展封底、扉页、版权页等更多书籍结构。

## 验收标准

- `PictureBookState` 中存在独立的 `cover` 状态对象，并作为新 schema 的必填字段。
- `Stage3Storyboard` 中出现独立的封面设置区，支持编辑封面标题和封面画面描述。
- 首次进入 `Stage3` 时，若封面为空，会自动生成封面内容。
- `Stage5Pages` 左侧列表中出现固定的 `封面` 入口，且不占正文页码。
- 选中封面时，`Stage5Pages` 可编辑封面标题、封面画面描述和封面 AI 绘画提示词。
- 选中封面且 prompt 为空时，`Stage5Pages` 会自动生成封面 prompt。
- 封面图片仅在点击按钮后手动生成，不会自动出图。
- 正文页的页码、同步、prompt 生成、图片生成和编辑页跳转不因本次改动产生回归。
- “进入编辑定稿与导出” 的放行条件包含封面已生成。
