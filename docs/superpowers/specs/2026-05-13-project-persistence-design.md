# 项目持久化存储设计

**日期**: 2026-05-13  
**状态**: 设计完成  
**负责人**: AI Assistant

---

## 概述

本设计实现项目数据的数据库持久化存储，确保用户创建的绘本项目可以安全保存和加载。

---

## 设计原则

1. **简化原则** - 移除冗余的 `project_history` 表，只用 `projects` 表
2. **单一数据源** - 完全依赖数据库，不使用 localStorage 作为回退
3. **平衡存储** - 结构化字段 + JSON 混合存储方案
4. **多阶段保存** - 在项目创建和各阶段完成时都触发保存

---

## 数据库 Schema 设计

### 简化后的 `projects` 表

```sql
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  target_age TEXT NOT NULL DEFAULT '3-6',
  page_count INTEGER NOT NULL DEFAULT 24,
  art_style TEXT NOT NULL DEFAULT '水彩温暖风',
  aspect_ratio TEXT NOT NULL DEFAULT '3:4',
  project_status TEXT NOT NULL DEFAULT 'draft',
  current_stage INTEGER NOT NULL DEFAULT 1,
  stage_statuses TEXT NOT NULL DEFAULT '{}',
  full_state TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_updated_at ON projects(updated_at DESC);
```

**字段说明**：
- 基础字段：用于首页快速展示和查询
- `full_state`：JSON 字段，存储完整的 `PictureBookState` 状态
- 其他表：保留用于后续扩展（故事、分镜、素材等独立表）

---

## 数据保存触发点

### 1. 阶段 1 项目创建时

**位置**：[Stage1Init.tsx](file:///workspace/src/components/studio/stages/Stage1Init.tsx#L47) 的 `handleCreate` 函数

**流程**：
1. 用户填写项目信息并点击"创建草稿并继续"
2. 立即保存项目到数据库
3. 标记阶段 1 为完成，进入阶段 2

### 2. 每个阶段完成时

**位置**：[StudioContext.tsx](file:///workspace/src/modules/studio/presentation/context/StudioContext.tsx#L326) 的 `COMPLETE_STAGE` action

**流程**：
1. 用户完成当前阶段并点击下一步
2. 更新阶段状态
3. 触发数据库保存

### 3. 实时保存（保留）

**位置**：[StudioContext.tsx](file:///workspace/src/modules/studio/presentation/context/StudioContext.tsx#L910) 的 useEffect

**流程**：
1. 状态变化时自动保存到数据库
2. 保留防抖机制（800ms延迟）避免频繁写入

---

## 数据加载流程

### 项目加载优先级

```
数据库 → 无数据时创建初始状态 → 加载成功
```

**具体流程**：
1. 尝试从数据库加载项目
2. 如果数据库无该项目，创建新的初始状态
3. 将加载的状态设置到 StudioContext
4. **完全移除 localStorage 回退机制**

---

## API 端点设计

### 更新现有端点

**`PUT /api/projects/[id]/state`**
- 更新：支持完整状态保存
- 返回：`{ success: boolean, data?: ProjectHistoryEntry }`

### 新增端点

**`GET /api/projects/[id]`**
- 获取单个项目的完整状态
- 返回：`{ success: boolean, data?: PictureBookState }`

---

## Repository 层设计

### 扩展 `ProjectRepository`

**位置**：[project-repository.ts](file:///workspace/src/lib/db/repositories/project-repository.ts)

**新增方法**：

```typescript
// 保存完整状态
saveFullState(projectId: string, state: PictureBookState): void

// 加载完整状态
loadFullState(projectId: string): PictureBookState | null

// 创建新项目（带完整状态）
createProjectWithState(userId: string, state: PictureBookState): ParsedProject
```

---

## 实现清单

### 数据库层
- [ ] 更新 schema.sql，移除 project_history 表
- [ ] 扩展 ProjectRepository 支持完整状态存取

### API 层
- [ ] 更新 PUT /api/projects/[id]/state 端点
- [ ] 新增 GET /api/projects/[id] 端点
- [ ] 确保所有端点正确初始化数据库

### 前端层
- [ ] 修改 Stage1Init 的 handleCreate 立即保存
- [ ] 修改 StudioContext 的加载流程，只从数据库加载
- [ ] 移除 localStorage 相关的回退代码
- [ ] 在 COMPLETE_STAGE action 中触发保存

---

## 兼容性考虑

1. **旧项目迁移**：暂时不需要，这是新功能
2. **错误处理**：数据库操作失败时显示友好提示
3. **性能**：JSON 存储不会有性能问题，项目数量不会很大

---

## 验收标准

1. ✅ 点击"创建草稿并继续"后，项目立即保存到数据库
2. ✅ 每个阶段完成时，数据都保存到数据库
3. ✅ 刷新页面后，项目状态可以从数据库完整恢复
4. ✅ 首页显示的项目列表从数据库查询
5. ✅ 完全不依赖 localStorage 存储项目数据
