## 背景

`Stage6Finalize` 和编辑页的导出能力都复用了 `src/modules/studio/infrastructure/export-book.ts`。当前导出流程会在浏览器侧直接使用远程图片 URL 创建 `Image` 对象，再将图片绘制到 `canvas` 后导出 PNG 或 ZIP。

当页面插画图片来自第三方对象存储时，如果目标源没有返回 `Access-Control-Allow-Origin`，浏览器会阻止这张图片被安全绘制到 `canvas`。当前项目中的火山 TOS 图片地址就属于这种情况，因此页面虽然可以在 `<img>` 中正常预览，但在导出时会报 CORS 错误并失败。

## 目标

- 修复页面导出时因远程图片 CORS 限制导致的失败问题。
- 保持 `Stage6Finalize.tsx` 和编辑页现有导出按钮、交互与文案不变。
- 让单页 PNG 导出和批量 ZIP 导出同时受益于同一套修复方案。
- 将改动范围限制在导出链路，不修改页面生成逻辑、项目存储结构和页面状态结构。

## 用户已确认的规则

- 采用同源图片代理方案修复导出失败。
- 新增本地 API 代理接口，由服务端拉取远程图片并返回给前端。
- `export-book.ts` 改为在导出时优先加载代理后的同源图片地址。
- `data:` 和 `blob:` 类型图片继续直连，不经过代理。
- 远程图片代理接口只服务于图片导出，不作为通用开放代理使用。

## 方案

### 1. 改动边界

- 新增 `src/app/api/image-proxy/route.ts`
- 修改 `src/modules/studio/infrastructure/export-book.ts`
- 不修改以下内容：
  - `src/components/studio/stages/Stage6Finalize.tsx`
  - `src/app/editor/page.tsx`
  - 页面图片生成与保存逻辑
  - 项目状态结构与数据库字段

### 2. 根因说明

- 当前导出实现位于 `export-book.ts`：
  - `loadImage(src)` 会用 `new Image()` 加载远程图片
  - 非 `data:` / `blob:` URL 会设置 `image.crossOrigin = 'anonymous'`
  - `renderPageToCanvas()` 再调用 `ctx.drawImage(image, ...)`
- 这个流程依赖远程图片源显式支持跨域。
- 火山 TOS 返回的图片 URL 不包含可供浏览器画布导出的 CORS 头，因此浏览器会在加载或绘制阶段直接失败。
- 这不是 `Stage6Finalize.tsx` 的按钮问题，而是导出基础设施的取图方式不适合第三方无 CORS 图片源。

### 3. 同源图片代理接口

- 新增 `GET /api/image-proxy?url=<remote-url>`。
- 接口职责：
  - 校验 `url` 参数是否存在且是合法的 `http` / `https` 地址
  - 服务端通过 `fetch` 拉取远程图片二进制
  - 校验响应状态必须成功
  - 校验 `content-type` 必须为 `image/*`
  - 将图片二进制和图片类型以同源响应返回
- 返回头建议包含：
  - `content-type`
  - 合理的 `cache-control`
- 错误情况统一返回明确的 JSON 错误或 HTTP 错误状态，便于导出侧识别失败。

### 4. 代理接口安全约束

- 仅允许代理 `http` / `https` 协议。
- 仅接受图片响应，非图片内容直接拒绝。
- 默认限制允许的远程主机名，至少覆盖当前项目实际使用的第三方图片源。
- 当前应优先放行火山 TOS 域名，例如：
  - `ark-acg-cn-beijing.tos-cn-beijing.volces.com`
- 后续如果项目接入新的图片源，可通过同一白名单机制扩展。
- 这样可以避免把该接口做成通用开放代理，减少滥用风险。

### 5. 导出模块接入方式

- 在 `export-book.ts` 中新增一个 URL 归一化函数，例如：
  - `resolveExportImageUrl(src: string): string`
- 规则如下：
  - 若 `src` 是 `data:` 或 `blob:`，直接返回原值
  - 若 `src` 是 `http(s)` 远程地址，返回 `/api/image-proxy?url=${encodeURIComponent(src)}`
  - 若 `src` 已是同源相对地址，也可直接返回原值
- `loadImage()` 不再直接加载第三方远程地址，而是加载归一化后的图片地址。
- `renderPageToCanvas()`、`exportPageAsPng()`、`exportAllPagesAsZip()` 不需要改变调用方式，只复用这一层归一化结果即可。

### 6. 失败处理

- 单页导出：
  - 若代理图片拉取失败，继续抛出 `ExportError('当前图片源不支持导出')` 或更明确的错误文案
  - 保持现有 toast 错误展示逻辑不变
- 批量导出：
  - 某一页代理失败时，记入 `failedPages`
  - 其他页面继续导出
  - 最终仍沿用现有“成功 / 失败 / 跳过”汇总提示

### 7. 兼容性

- `Stage6Finalize.tsx` 无需修改，因为它只是调用导出模块。
- 编辑页中的单页导出和批量导出同样复用 `export-book.ts`，会自动获得修复效果。
- 已经是 `data:` 或 `blob:` 的本地图像不会多走一层代理，因此不会影响已有本地导出能力。

## 涉及文件

- `src/app/api/image-proxy/route.ts`
  - 新增远程图片同源代理能力
- `src/modules/studio/infrastructure/export-book.ts`
  - 新增导出时的图片 URL 归一化逻辑
  - 让导出链路改为加载同源代理图片

## 验收标准

- 在 `Stage6Finalize` 页面点击“导出本页 PNG”时，第三方图片源不再因为 CORS 直接失败。
- 在 `Stage6Finalize` 页面点击“导出全部页面 ZIP”时，可成功导出可访问的页面。
- 编辑页中的单页导出和批量导出同时恢复可用。
- `data:` / `blob:` 图片导出行为保持不变。
- 当远程图片不可访问、超时或返回非图片内容时，导出会明确失败，但不会导致批量导出整体中断。

## 风险与取舍

- 增加一层服务端代理会带来额外的一次图片请求，但这是浏览器侧跨域导出最稳妥的方案。
- 白名单策略会让新图片源接入时需要补充域名配置，但这比开放任意代理更安全。
- 当前设计只解决导出链路的跨域问题，不处理图片链接过期或源站彻底失效等业务层问题。
