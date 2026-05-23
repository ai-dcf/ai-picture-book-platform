## 背景

当前 `Stage5Pages` 的中间编辑区仍以“本页故事文字 + 页面生成提示词”为核心，页面 prompt 的自动生成也主要依赖现有 `storyText` 与 `storyboardPage.visualGoal` 的直接拼装。这与新的业务目标不一致：

- 页面编辑顺序需要调整为“画面文字 -> 画面内容描述 -> 分割线 -> 重新生成 AI 绘画提示词 -> AI 绘画提示词 -> 角色引用 -> 场景引用”。
- `Stage5Pages` 需要直接承接 `Stage3Storyboard` 的分页结果，但允许在当前页面继续编辑。
- 一旦页面在 `Stage5Pages` 被编辑，其分镜内容不应再被 `Stage3Storyboard` 自动覆盖。
- 页面 AI 绘画提示词需要在进入页面时按需自动生成，并支持用户在修改画面内容描述后手动重生成。
- 页面 AI 绘画提示词中的“画面风格提示词”处理方式和取数方式，必须与 `Stage4Assets` 中角色 AI 绘画提示词保持一致。

## 目标

- 调整 `Stage5Pages` 中间编辑区布局，使其符合新的操作顺序。
- 让 `Stage5Pages` 的“画面文字”和“画面内容描述”首次同步自 `Stage3Storyboard`，同步后允许页内编辑。
- 引入页面级字段保存 `Stage5Pages` 自己的分镜数据，并用显式标记阻止后续被 `Stage3Storyboard` 覆盖。
- 将页面 AI 绘画提示词生成拆分为独立能力，支持“无 prompt 时自动生成”和“点击按钮后明确覆盖重生成”。
- 让页面 AI 绘画提示词的风格前缀构造、项目风格取数、模型生成职责分层，与角色 prompt 生成链路保持一致。
- 为 `AI绘画提示词` 输入框补充 `#` 触发的手动图片引用选择能力，支持在前端按已有编号复用或追加新编号。

## 用户已确认的规则

- `Stage5Pages` 中的“画面文字”和“画面内容描述”从 `Stage3Storyboard` 同步后，可在当前页继续编辑。
- 若某页已在 `Stage5Pages` 编辑过，则该页后续不再被 `Stage3Storyboard` 自动覆盖。
- 进入 `Stage5Pages` 时，仅当某页 `prompt` 为空时才自动生成 AI 绘画提示词。
- `AI绘画提示词` 文本框允许手动编辑；点击“重新生成AI绘画提示词”时，用当前页最新内容重新生成并覆盖。
- 页面 prompt 中的 `镜头构图`、`光影/色调` 不新增独立字段，而是从当前页 `visualGoal` 文本中理解提取。
- 页面 prompt 的“画面风格提示词”处理方式和数据来源，完全对齐 `Stage4Assets` 里角色 prompt 的实现方式。
- 在 `AI绘画提示词` 输入框中输入 `#` 时，在输入框下方展开选择面板。
- 选择面板按“角色”“场景”分组展示素材列表，每项展示名称和图片。
- 没有图片的素材仍需展示，但必须置灰不可选。
- 选择某个素材时，需替换刚输入的 `#`。
- 若该素材已存在于当前 `imageRefs` 中，则复用已有 `图片N` 编号；若不存在，则追加到 `imageRefs` 末尾并生成新的 `图片N` 编号。
- 同一个 `#(图片N)` 允许在同一提示词中多次插入。
- 选择面板不需要显示“已使用 · 图片N”等额外状态文案。
- 选择面板不需要做关键词搜索或实时过滤，始终展示完整列表。

## 方案

### 1. 页面数据结构扩展

- 扩展 `PageItem`，新增以下字段：
  - `pageText: string`：当前页在 `Stage5Pages` 使用的画面文字。
  - `visualGoal: string`：当前页在 `Stage5Pages` 使用的画面内容描述。
  - `storyboardEdited: boolean`：该页是否已经在 `Stage5Pages` 手动编辑过分镜内容。
- 保留现有 `storyText`、`prompt`、`promptUserEdited`、`characterRefs`、`sceneRefs`、`aspectRatio` 等字段，避免影响既有页面出图与编辑页逻辑。
- `storyText` 后续仍可保留用于兼容旧链路，但 `Stage5Pages` 的展示与页面 prompt 构造应优先切换到 `pageText`。

### 2. Stage3 到 Stage5 的同步规则

- 更新 `SYNC_PAGES_FROM_STORYBOARD`：
  - 若某页 `storyboardEdited = false`，则将 `storyboard.pages[index].text` 同步到 `pageText`，将 `storyboard.pages[index].visualGoal` 同步到 `visualGoal`。
  - 若某页 `storyboardEdited = true`，则保留该页当前 `pageText` 和 `visualGoal`，不再接受 `Stage3Storyboard` 覆盖。
- 首次进入 `Stage5Pages` 时，未编辑页面仍会被同步，因此能够自然承接 `Stage3Storyboard` 的数据。
- 现有页面 prompt 自动同步逻辑需要改为优先基于 `pageText + visualGoal`，不能再只依赖 `storyText + storyboardPage.visualGoal`。

### 3. 页面分镜编辑 action

- 保留 `UPDATE_PAGE_CONFIG` 处理 prompt、比例、引用、图片引用等通用配置。
- 新增专用 action，例如 `UPDATE_PAGE_STORYBOARD_FIELDS`，只负责更新：
  - `pageText`
  - `visualGoal`
  - `storyboardEdited = true`
- 当页面已处于 `generated` 或 `finalized` 状态时，编辑 `pageText` 或 `visualGoal` 仍沿用现有规则，将页面状态打回 `review`。
- 修改 `pageText` 或 `visualGoal` 时只做保存，不自动触发 prompt 重生成。

### 4. Stage5 页面布局调整

- 保持 `Stage5Pages` 左侧页码列表与右侧插画预览区总体结构不变。
- 调整中间编辑区的布局顺序为：
  - `画面文字`
  - `画面内容描述`
  - 分割线
  - `重新生成AI绘画提示词` 按钮
  - `AI绘画提示词`
  - `本页角色引用`
  - `本页场景引用`
- `画面文字` 文本框绑定 `page.pageText`。
- `画面内容描述` 文本框绑定 `page.visualGoal`。
- `AI绘画提示词` 文本框继续允许手动编辑，编辑后设定 `promptUserEdited = true`。
- 引用素材区仍保留现有可预览素材图的交互。

### 5. 页面 Prompt 生成链路

- 新增独立的页面 prompt 生成能力，而不是复用图片生成接口顺带产出 prompt。
- 前端新增 `generatePagePrompt(page, assets, projectInfo)`，模式对齐现有 `generateCharacterPrompt(...)`。
- 新增接口：`/api/studio/generate-page-prompt`。
- 新增 use case：例如 `generate-page-prompt.ts`。

### 6. 页面风格提示词处理方式对齐角色 Prompt

- 页面 prompt 必须采用与角色 prompt 相同的“两段式”生成方式：
  - 第一步：从 `projectInfo` 中构造页面统一风格片段。
  - 第二步：调用文本模型，只生成“本页主体画面描述部分”，不重复风格片段。
  - 第三步：将“统一风格片段 + 页面主体描述 + 固定约束”拼为最终页面 prompt。
- 页面风格片段的取数方式必须与角色 prompt 保持一致：
  - 统一通过 `buildPromptRuleBundle(projectInfo, customParams)` 获取风格、年龄、题材、合规规则。
  - 传入的 `projectInfo` 需和角色 prompt 一样，合并当前页面 `aspectRatio`，即 `{ ...projectInfo, aspectRatio: page.aspectRatio }`。
- 页面 prompt 的风格前缀必须只来自 `projectInfo + aspectRatio` 的规则包，不允许从 `visualGoal` 中直接拼接风格标签。
- `visualGoal` 仅提供画面内容、镜头构图、光影/色调等页面主体信息；这些内容由模型在第二步生成页面主体描述时吸收和表达。

### 7. 页面 Prompt Builder 的职责拆分

- 新增页面版 builder，职责对齐角色 prompt：
  - `buildPageProjectStylePrefix(...)`：构造页面统一风格片段。
  - `buildPagePromptGenerationSystemPrompt()`：约束模型只输出页面主体描述，不重复风格片段。
  - `buildPagePromptGenerationUserPrompt(...)`：组织页面文字、画面内容描述、角色引用、场景引用及其描述。
  - `buildPageFinalPrompt(...)`：拼接最终页面 prompt。
- 最终页面 prompt 的数据来源：
  - 页面文字：`page.pageText`
  - 画面内容描述：`page.visualGoal`
  - 角色引用：`page.characterRefs + assets.characters`
  - 场景引用：`page.sceneRefs + assets.scenes`
  - 项目风格：`projectInfo`
  - 画面比例：`page.aspectRatio`
- 若页面级字段为空，可回退到 `storyboardPage.text` 与 `storyboardPage.visualGoal`，但优先级必须低于页面级字段。

### 8. 自动生成与手动重生成规则

- 自动生成：
  - 进入某页或切换到某页时，若该页 `prompt` 为空且当前不在 prompt 生成中，则自动生成 prompt。
  - 自动生成成功后，将 `promptUserEdited` 设为 `false`。
- 手动重生成：
  - 点击“重新生成AI绘画提示词”按钮后，使用当前页最新的 `pageText`、`visualGoal`、引用素材、项目风格、页面比例重新生成 prompt。
  - 生成成功后覆盖当前 `prompt`，并将 `promptUserEdited` 设为 `false`。
- 手动编辑 prompt：
  - 用户编辑 `AI绘画提示词` 文本框后，保持现有逻辑，将 `promptUserEdited` 设为 `true`。

### 9. 页面出图衔接

- 保留现有 `generatePageImage` 出图能力。
- 页面出图时沿用现有优先级：
  - 若 `promptUserEdited = true` 且 `prompt` 非空，则直接使用当前 prompt。
  - 否则，基于新的页面级字段和页面 prompt builder 生成正式出图 prompt。
- 这样可以兼容：
  - 完全依赖系统生成 prompt 的用户；
  - 先重生成 prompt 再微调 prompt 的用户；
  - 修改 `visualGoal` 后手动重生成 prompt 再出图的用户。

### 10. 错误处理与状态管理

- 页面 prompt 生成失败时：
  - 保留当前 `pageText`、`visualGoal` 与已有 `prompt`。
  - 在 `Stage5Pages` 编辑区显示轻量错误提示，并提供 `重试` 操作。
- 页面 prompt 生成 loading 应与页面图片生成 loading 分离，避免混淆。
- 编辑 `pageText`、`visualGoal`、`prompt`、引用素材或比例时，若该页已处于 `generated` 或 `finalized`，继续沿用现有规则打回 `review`。
- `storyboardEdited` 仅表示“是否阻止继续被 `Stage3Storyboard` 自动覆盖”，不直接参与页面状态判断。

### 11. PromptEditor 的 `#` 手动引用选择交互

- `PromptEditor` 只支持 `#(图片N)` 语法，不再支持 `@名字` 语法。
- 当用户在 `AI绘画提示词` 输入框内输入单个 `#` 时：
  - 在输入框下方展开一个较大的选择面板；
  - 面板按 `角色`、`场景` 两组展示当前项目素材；
  - 每项展示缩略图与名称；
  - 若素材没有可用图片，则置灰且不可点击。
- 选择面板始终展示完整列表，不做关键词过滤，也不展示“已使用 · 图片N”等额外状态。
- 用户点击某个素材后：
  - 以当前输入位置附近最近一次输入的 `#` 为锚点；
  - 将这个 `#` 直接替换成目标 `#(图片N)`；
  - 若该素材已存在于 `page.imageRefs` 中，则复用原有 `refLabel/refToken`；
  - 若该素材尚未存在于 `page.imageRefs` 中，则在当前列表末尾追加一个新的 `ImageRef`，按现有最大序号分配下一个 `图片N`；
  - 插入完成后将光标移动到新插入引用之后，并关闭选择面板。
- 同一个素材可以在提示词中被多次插入；多次插入时必须复用同一个 `#(图片N)`。
- 行内渲染后的 `#(图片N)` 交互规则：
  - 点击缩略图本体时，打开预览大图；
  - 点击右上角 `×` 时，删除当前这一个行内引用 token；
  - 不允许点击图片本体时直接删除。
- 本次手动插入逻辑仅影响前端编辑体验，不改变后端接口格式，也不改变“自动生成 prompt 后再做编号引用识别”的链路。

## 非目标

- 本次不重构 `Stage3Storyboard` 页面结构或交互。
- 本次不引入 `镜头构图`、`光影/色调` 的独立结构化字段。
- 本次不改造编辑页主流程。
- 本次不做整本书页面 prompt 的批量并发预生成。
- 本次不重新引入 `@名字` 的手动素材插入模式。
- 本次不为 `#` 选择面板增加关键词搜索、键盘导航或“已使用状态”展示。

## 验收标准

- `Stage5Pages` 中间编辑区顺序调整为：画面文字、画面内容描述、分割线、重新生成AI绘画提示词按钮、AI绘画提示词、角色引用、场景引用。
- `Stage5Pages` 首次进入时，未编辑页面可从 `Stage3Storyboard` 正确同步 `text` 与 `visualGoal`。
- 某页在 `Stage5Pages` 编辑过后，不再被 `Stage3Storyboard` 自动覆盖。
- 页面 prompt 为空时，进入该页会自动生成 prompt；已有 prompt 时不会被自动覆盖。
- 点击“重新生成AI绘画提示词”按钮后，会按当前页最新内容重新生成并覆盖 prompt。
- 页面 prompt 的风格前缀和项目风格取数方式，与 `Stage4Assets` 角色 prompt 的实现方式一致。
- 用户手动修改 prompt 后，页面出图优先使用手动 prompt。
- 角色/场景引用、图片引用标签、页面出图、编辑页定稿与进度统计不因本次改动产生回归。
- 在 `AI绘画提示词` 输入框中输入 `#` 后，会在输入框下方展开角色/场景选择面板。
- 选择面板展示完整的角色/场景素材列表；无图素材置灰不可选。
- 点击某个可选素材后，会替换刚输入的 `#` 并插入 `#(图片N)`。
- 若素材已存在于 `imageRefs` 中，会复用已有编号；若不存在，会追加新的编号。
- 行内 `#(图片N)` 点击图片可预览，点击右上角 `×` 才会删除。
