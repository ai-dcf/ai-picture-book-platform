# SQLite 项目数据存储设计文档

**日期**: 2026-05-13
**状态**: 设计中
**负责人**: AI Assistant

---

## 一、摘要

本设计文档描述如何将 AI 绘本工作室的项目数据从 localStorage 迁移到 SQLite 数据库存储。主要改动包括：

1. 集成 NextAuth.js 实现用户认证系统
2. 设计关系型数据库表结构存储项目全量数据
3. 创建 REST API 路由提供项目 CRUD 操作
4. 修改前端组件使用 API 而非 localStorage
5. 支持图片二进制数据直接存储在数据库中

---

## 二、当前状态分析

### 2.1 现有数据存储方式

当前系统使用 localStorage 存储项目数据，存在以下问题：

- **数据隔离**: 同一浏览器不同设备间无法共享数据
- **容量限制**: localStorage 限制约为 5-10MB，大型图片数据受限
- **安全风险**: 数据存储在客户端，可被篡改或清除
- **无法备份**: 缺乏服务端备份机制

### 2.2 现有数据类型

根据 `PictureBookState` 结构，数据包含：

| 数据类型 | 字段 | 描述 |
|---------|------|------|
| 项目信息 | projectInfo | 标题、年龄段、页数、艺术风格等 |
| 故事数据 | story | 一句话故事、角色、场景、情感曲线 |
| 分镜数据 | storyboard | 跨页结构、页面文本、视觉目标 |
| 素材数据 | assets | 角色和场景的生成图片、候选历史 |
| 页面数据 | pages | 每页的故事文本、引用素材、生成图片 |
| 编辑器状态 | editorStates | 文本样式、布局、确认状态 |

### 2.3 现有文件结构

```
src/
├── modules/
│   ├── project-history/
│   │   ├── types.ts          # ProjectHistoryEntry 类型
│   │   └── use-project-history.ts  # localStorage 操作 Hook
│   └── studio/presentation/context/
│       └── StudioContext.tsx  # 项目状态管理和 localStorage 保存
├── app/
│   ├── components/
│   │   └── HeroPage.tsx      # 首页项目列表展示
│   └── providers.tsx          # 全局 Provider 配置
```

---

## 三、数据库架构设计

### 3.1 数据库选型

**SQLite** 适合本项目原因：
- 零配置、嵌入式数据库，部署简单
- 支持 BLOB 类型存储图片二进制数据
- 适合单租户或中等规模数据量
- 可使用 `better-sqlite3` 或 `libsql` 在 Node.js 环境中运行

### 3.2 表结构设计

```sql
-- 用户表 (NextAuth 自动管理)
-- 需要安装 @auth/sqlite-adapter

-- 项目主表
CREATE TABLE projects (
    id TEXT PRIMARY KEY,                    -- UUID
    user_id TEXT NOT NULL,                  -- NextAuth 用户 ID
    title TEXT NOT NULL DEFAULT '',
    target_age TEXT NOT NULL DEFAULT '3-6',
    page_count INTEGER NOT NULL DEFAULT 24,
    art_style TEXT NOT NULL DEFAULT '水彩温暖风',
    aspect_ratio TEXT NOT NULL DEFAULT '3:4',
    project_status TEXT NOT NULL DEFAULT 'draft',
    current_stage INTEGER NOT NULL DEFAULT 1,
    stage_statuses TEXT NOT NULL DEFAULT '{}',  -- JSON: {"1": "in-progress", ...}
    save_status TEXT NOT NULL DEFAULT 'saved',
    created_at INTEGER NOT NULL,            -- Unix timestamp
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 故事数据表
CREATE TABLE story_data (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL UNIQUE,
    one_line_story TEXT NOT NULL DEFAULT '',
    characters TEXT NOT NULL DEFAULT '[]',   -- JSON: StoryEntry[]
    story_outline TEXT NOT NULL DEFAULT '',
    emotion_curve TEXT NOT NULL DEFAULT '[]', -- JSON: EmotionCurvePoint[]
    scenes TEXT NOT NULL DEFAULT '[]',        -- JSON: StoryEntry[]
    generating INTEGER NOT NULL DEFAULT 0,   -- Boolean as 0/1
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- 分镜数据表
CREATE TABLE storyboard_data (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL UNIQUE,
    spreads TEXT NOT NULL DEFAULT '[]',       -- JSON: SpreadItem[]
    pages TEXT NOT NULL DEFAULT '[]',         -- JSON: StoryboardPageData[]
    generating INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- 素材数据表
CREATE TABLE assets_data (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL UNIQUE,
    characters TEXT NOT NULL DEFAULT '[]',   -- JSON: AssetItem[]
    scenes TEXT NOT NULL DEFAULT '[]',       -- JSON: AssetItem[]
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- 页面数据表
CREATE TABLE pages (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    page_index INTEGER NOT NULL,
    story_text TEXT NOT NULL DEFAULT '',
    character_refs TEXT NOT NULL DEFAULT '[]', -- JSON: string[]
    scene_refs TEXT NOT NULL DEFAULT '[]',     -- JSON: string[]
    prompt TEXT NOT NULL DEFAULT '',
    prompt_user_edited INTEGER NOT NULL DEFAULT 0,
    image_url TEXT,                           -- 可为 NULL
    image_blob BLOB,                           -- 图片二进制数据
    page_status TEXT NOT NULL DEFAULT 'idle',
    generating INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    UNIQUE(project_id, page_index)
);

-- 编辑器状态表
CREATE TABLE editor_states (
    id TEXT PRIMARY KEY,
    page_id TEXT NOT NULL UNIQUE,
    text_content TEXT NOT NULL DEFAULT '',
    style TEXT NOT NULL DEFAULT '{}',         -- JSON: TextBoxStyle
    layout TEXT NOT NULL DEFAULT '{}',         -- JSON: TextBoxLayout
    confirmed INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE CASCADE
);

-- 项目历史表 (用于首页快速查询)
CREATE TABLE project_history (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL UNIQUE,
    user_id TEXT NOT NULL,
    thumbnail_blob BLOB,                       -- 缩略图二进制
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 索引
CREATE INDEX idx_projects_user_id ON projects(user_id);
CREATE INDEX idx_projects_updated_at ON projects(updated_at DESC);
CREATE INDEX idx_pages_project_id ON pages(project_id);
CREATE INDEX idx_project_history_user_id ON project_history(user_id);
```

### 3.3 数据类型映射

| TypeScript 类型 | SQLite 类型 | 说明 |
|----------------|------------|------|
| string | TEXT | 使用 JSON.stringify 存储 |
| number | INTEGER / REAL | 根据精度选择 |
| boolean | INTEGER | 0/1 表示 |
| Date | INTEGER | Unix timestamp (ms) |
| Blob | BLOB | 图片二进制数据 |
| null | NULL | 空值 |

---

## 四、API 设计

### 4.1 认证相关

```
POST /api/auth/[...nextauth]  # NextAuth 路由处理器
```

### 4.2 项目管理 API

#### 获取用户项目列表
```
GET /api/projects
Response: {
  projects: ProjectHistoryEntry[]
}
```

#### 创建新项目
```
POST /api/projects
Request: { title?: string }
Response: { project: ProjectSummary }
```

#### 获取项目详情
```
GET /api/projects/:id
Response: { project: PictureBookState }
```

#### 更新项目信息
```
PATCH /api/projects/:id
Request: { ...Partial<ProjectInfo> }
Response: { success: true }
```

#### 删除项目
```
DELETE /api/projects/:id
Response: { success: true }
```

#### 保存完整项目状态
```
PUT /api/projects/:id/state
Request: { ...PictureBookState }
Response: { success: true }
```

### 4.3 素材图片 API

#### 上传图片
```
POST /api/projects/:id/pages/:pageIndex/image
Content-Type: multipart/form-data
Request: { image: File }
Response: { imageUrl: string }
```

#### 获取图片
```
GET /api/images/:imageId
Response: Binary image data
```

---

## 五、实施计划

### 5.1 依赖安装

```bash
npm install next-auth @auth/sqlite-adapter better-sqlite3
npm install -D @types/better-sqlite3
```

### 5.2 新增文件清单

#### 基础设施层
| 文件路径 | 描述 |
|---------|------|
| `src/lib/db.ts` | SQLite 数据库连接和初始化 |
| `src/lib/db/schema.sql` | 数据库表结构定义 |
| `src/lib/db/migrations/` | 数据库迁移脚本 |
| `src/lib/db/repositories/project-repository.ts` | 项目数据访问层 |
| `src/lib/db/repositories/page-repository.ts` | 页面数据访问层 |

#### 认证模块
| 文件路径 | 描述 |
|---------|------|
| `src/auth.ts` | NextAuth 配置 |
| `src/app/api/auth/[...nextauth]/route.ts` | NextAuth API 路由 |
| `src/middleware.ts` | 认证中间件 |

#### API 路由
| 文件路径 | 描述 |
|---------|------|
| `src/app/api/projects/route.ts` | 项目列表 CRUD |
| `src/app/api/projects/[id]/route.ts` | 单个项目 CRUD |
| `src/app/api/projects/[id]/state/route.ts` | 完整状态保存 |
| `src/app/api/projects/[id]/pages/[pageIndex]/image/route.ts` | 页面图片上传 |
| `src/app/api/images/[id]/route.ts` | 图片获取 |

#### 前端改造
| 文件路径 | 描述 |
|---------|------|
| `src/app/providers.tsx` | 添加 SessionProvider |
| `src/modules/project-history/use-project-history.ts` | 改为调用 API |
| `src/modules/studio/presentation/context/StudioContext.tsx` | 使用服务端持久化 |

---

## 六、关键设计决策

### 6.1 为什么分离表而非 JSON 存储

分离表结构优势：
- 支持按页面、角色等细粒度查询
- 便于添加索引优化查询性能
- 数据更新时可只修改变更的部分
- 符合数据库设计范式

### 6.2 图片存储策略

采用 BLOB 存储原因：
- SQLite 支持直接存储二进制数据
- 减少外部文件依赖
- 数据完全自包含，便于备份迁移
- 单文件数据库简化部署

注意：大型项目可能需要考虑：
- 使用 `EXTERNAL` 表存储大 BLOB
- 设置 `soft_heap_limit` 避免内存问题
- 考虑 CDN 缓存优化访问

### 6.3 认证集成

使用 NextAuth.js 原因：
- 支持多种登录提供商（GitHub, Google, 邮箱等）
- 自动处理会话管理和安全 Cookie
- 提供 TypeScript 类型支持
- 与 Next.js App Router 深度集成

---

## 七、向后兼容性

### 7.1 localStorage 保留

- 保留 `StudioContext.tsx` 中的 localStorage 逻辑作为降级方案
- 检测 API 可用性，API 不可用时回退到 localStorage
- 未来版本可完全移除 localStorage 逻辑

### 7.2 数据迁移路径

1. Phase 1: 新用户使用 SQLite，历史用户继续 localStorage
2. Phase 2: 添加迁移工具，允许用户手动导入
3. Phase 3: 评估后完全移除 localStorage

---

## 八、测试计划

### 8.1 单元测试
- 数据库 Repository 层的 CRUD 操作
- 数据转换函数 (TypeScript <-> SQLite)
- API 路由处理逻辑

### 8.2 集成测试
- 完整的项目创建-保存-加载流程
- 图片上传和检索流程
- 多用户数据隔离验证

### 8.3 E2E 测试
- 用户注册/登录流程
- 创建新项目并完整编辑流程
- 页面刷新后数据持久化验证

---

## 九、风险与缓解

| 风险 | 影响 | 缓解措施 |
|-----|------|---------|
| SQLite 并发写入 | 高 | SQLite 支持多读单写，考虑未来迁移到 PostgreSQL |
| BLOB 性能 | 中 | 添加图片缓存层，按需加载 |
| 数据库文件损坏 | 高 | 定期备份，实现 WAL 模式 |
| NextAuth 配置复杂度 | 低 | 使用默认配置逐步定制 |

---

## 十、后续优化方向

1. **性能优化**: 添加数据库索引，优化大查询
2. **数据导出**: 实现项目导出为 JSON/ZIP 格式
3. **版本控制**: 记录项目历史版本，支持撤销
4. **多端同步**: 实现 WebSocket 实时同步
