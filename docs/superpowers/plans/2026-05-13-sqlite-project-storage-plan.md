# SQLite 项目数据存储实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 AI 绘本工作室的项目数据从 localStorage 迁移到 SQLite 数据库，支持图片多版本和描述管理

**Architecture:** 基于现有 Next.js 项目，集成 better-sqlite3 和 NextAuth.js，创建 Repository 层抽象数据库访问，实现 REST API 路由支持项目 CRUD 和图片管理

**Tech Stack:** 
- Next.js 15 (App Router)
- SQLite (better-sqlite3)
- NextAuth.js v5
- TypeScript

---

## 阶段一：基础设施搭建

### Task 1: 项目依赖安装

**Files:**
- Modify: `package.json`

- [ ] **Step 1: 安装 SQLite 和认证依赖**

```bash
npm install better-sqlite3 next-auth@beta @auth/sqlite-adapter uuid
npm install -D @types/better-sqlite3 @types/uuid
```

- [ ] **Step 2: 验证依赖安装成功**

Run: `npm list better-sqlite3 next-auth @auth/sqlite-adapter uuid`
Expected: 所有包已安装

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: add SQLite and NextAuth dependencies"
```

---

### Task 2: 数据库连接和初始化

**Files:**
- Create: `src/lib/db.ts`
- Create: `src/lib/db/schema.sql`
- Create: `src/lib/db/types.ts`

- [ ] **Step 1: 创建数据库 schema 定义**

创建 `src/lib/db/schema.sql`，包含完整的表结构定义（从设计文档复制）

```sql
-- 用户表 (NextAuth 自动管理)
-- 项目主表
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
    save_status TEXT NOT NULL DEFAULT 'saved',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- 其他表结构... (从设计文档复制完整 schema)
```

- [ ] **Step 2: 创建数据库类型定义**

创建 `src/lib/db/types.ts`

```typescript
export interface DbProject {
  id: string;
  user_id: string;
  title: string;
  target_age: string;
  page_count: number;
  art_style: string;
  aspect_ratio: string;
  project_status: string;
  current_stage: number;
  stage_statuses: string;
  save_status: string;
  created_at: number;
  updated_at: number;
}

export interface DbImageVersion {
  id: string;
  owner_type: string;
  owner_id: string;
  version_number: number;
  image_blob: Buffer | null;
  image_url: string | null;
  description: string | null;
  description_edited: number;
  created_at: number;
}

// ... 其他类型定义
```

- [ ] **Step 3: 创建数据库连接和初始化逻辑**

创建 `src/lib/db.ts`

```typescript
import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join } from 'path';

const DB_PATH = process.env.DATABASE_PATH || './data/picturebook.db';

let db: Database.Database | null = null;

export function getDatabase(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initializeSchema(db);
  }
  return db;
}

function initializeSchema(database: Database.Database) {
  const schemaPath = join(__dirname, 'db', 'schema.sql');
  const schema = readFileSync(schemaPath, 'utf-8');
  database.exec(schema);
}

export function closeDatabase() {
  if (db) {
    db.close();
    db = null;
  }
}
```

- [ ] **Step 4: 创建数据库目录**

Run: `mkdir -p data`

- [ ] **Step 5: 测试数据库连接**

Run: `npx tsx -e "import { getDatabase } from './src/lib/db'; console.log(getDatabase().name)"`
Expected: 输出数据库路径

- [ ] **Step 6: Commit**

```bash
git add src/lib/db.ts src/lib/db/schema.sql src/lib/db/types.ts
mkdir -p data && echo "data/" >> .gitignore
git add data/.gitignore
git commit -m "feat: add SQLite database connection and schema"
```

---

### Task 3: NextAuth 认证配置

**Files:**
- Create: `src/auth.ts`
- Create: `src/app/api/auth/[...nextauth]/route.ts`
- Create: `src/middleware.ts`
- Modify: `src/app/providers.tsx`

- [ ] **Step 1: 创建 NextAuth 配置文件**

创建 `src/auth.ts`

```typescript
import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { sqliteAdapter } from "@auth/sqlite-adapter";
import { getDatabase } from "@/lib/db";

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: sqliteAdapter(getDatabase()),
  providers: [
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
    }),
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
    // 开发环境使用的简单凭证 provider
    Credentials({
      name: "Dev Credentials",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "dev@example.com" },
      },
      async authorize(credentials) {
        if (process.env.NODE_ENV === "development") {
          return { id: "1", email: credentials?.email as string, name: "Dev User" };
        }
        return null;
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/auth/signin",
  },
  callbacks: {
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
      }
      return token;
    },
  },
});
```

- [ ] **Step 2: 创建 NextAuth API 路由**

创建 `src/app/api/auth/[...nextauth]/route.ts`

```typescript
import { handlers } from "@/auth";

export const { GET, POST } = handlers;
```

- [ ] **Step 3: 创建认证中间件**

创建 `src/middleware.ts`

```typescript
export { auth as middleware } from "@/auth";

export const config = {
  matcher: ["/studio/:path*", "/editor/:path*"],
};
```

- [ ] **Step 4: 更新 Providers**

修改 `src/app/providers.tsx`

```typescript
"use client";

import { SessionProvider } from "next-auth/react";
import { AppQueryProvider } from "@/providers/query-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <AppQueryProvider>
        <TooltipProvider>
          {children}
          <Toaster />
          <Sonner />
        </TooltipProvider>
      </AppQueryProvider>
    </SessionProvider>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add src/auth.ts src/app/api/auth/ src/middleware.ts src/app/providers.tsx
git commit -m "feat: add NextAuth.js authentication"
```

---

## 阶段二：Repository 层开发

### Task 4: 项目 Repository

**Files:**
- Create: `src/lib/db/repositories/project-repository.ts`
- Create: `src/lib/db/repositories/types.ts`

- [ ] **Step 1: 创建 Repository 类型定义**

创建 `src/lib/db/repositories/types.ts`

```typescript
import type { PictureBookState, ProjectInfo } from "@/types/picturebook";

export interface ProjectSummary {
  id: string;
  userId: string;
  title: string;
  targetAge: string;
  pageCount: number;
  artStyle: string;
  aspectRatio: string;
  projectStatus: string;
  currentStage: number;
  createdAt: number;
  updatedAt: number;
  thumbnailUrl?: string;
}

export interface ProjectDetail extends ProjectSummary {
  storyData: string;
  storyboardData: string;
  assetsData: string;
  pagesData: string;
  editorStatesData: string;
}
```

- [ ] **Step 2: 创建项目 Repository**

创建 `src/lib/db/repositories/project-repository.ts`

```typescript
import { getDatabase } from "@/lib/db";
import type { ProjectSummary, ProjectDetail } from "./types";
import type { PictureBookState } from "@/types/picturebook";
import { v4 as uuidv4 } from "uuid";

export class ProjectRepository {
  create(userId: string, title?: string): ProjectSummary {
    const db = getDatabase();
    const id = uuidv4();
    const now = Date.now();

    db.prepare(`
      INSERT INTO projects (id, user_id, title, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, userId, title || "新项目", now, now);

    // 初始化其他表
    db.prepare(`INSERT INTO story_data (id, project_id, created_at, updated_at) VALUES (?, ?, ?, ?)`)
      .run(uuidv4(), id, now, now);
    db.prepare(`INSERT INTO storyboard_data (id, project_id, created_at, updated_at) VALUES (?, ?, ?, ?)`)
      .run(uuidv4(), id, now, now);
    db.prepare(`INSERT INTO assets_data (id, project_id, created_at, updated_at) VALUES (?, ?, ?, ?)`)
      .run(uuidv4(), id, now, now);

    // 初始化页面
    for (let i = 0; i < 24; i++) {
      db.prepare(`
        INSERT INTO pages (id, project_id, page_index, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(uuidv4(), id, i, now, now);

      db.prepare(`
        INSERT INTO editor_states (id, page_id, created_at, updated_at)
        VALUES (?, ?, ?, ?)
      `).run(uuidv4(), `${id}_page_${i}`, now, now);
    }

    return this.getById(id, userId)!;
  }

  getById(id: string, userId: string): ProjectSummary | null {
    const db = getDatabase();
    const project = db.prepare(`
      SELECT p.*, ph.thumbnail_url as thumbnail_url
      FROM projects p
      LEFT JOIN project_history ph ON p.id = ph.project_id
      WHERE p.id = ? AND p.user_id = ?
    `).get(id, userId) as any;

    if (!project) return null;

    return {
      id: project.id,
      userId: project.user_id,
      title: project.title,
      targetAge: project.target_age,
      pageCount: project.page_count,
      artStyle: project.art_style,
      aspectRatio: project.aspect_ratio,
      projectStatus: project.project_status,
      currentStage: project.current_stage,
      createdAt: project.created_at,
      updatedAt: project.updated_at,
      thumbnailUrl: project.thumbnail_url,
    };
  }

  getByIdWithFullState(id: string, userId: string): PictureBookState | null {
    const db = getDatabase();
    const project = db.prepare(`
      SELECT * FROM projects WHERE id = ? AND user_id = ?
    `).get(id, userId) as any;

    if (!project) return null;

    const storyData = db.prepare(`
      SELECT * FROM story_data WHERE project_id = ?
    `).get(id) as any;

    const storyboardData = db.prepare(`
      SELECT * FROM storyboard_data WHERE project_id = ?
    `).get(id) as any;

    const assetsData = db.prepare(`
      SELECT * FROM assets_data WHERE project_id = ?
    `).get(id) as any;

    const pages = db.prepare(`
      SELECT * FROM pages WHERE project_id = ? ORDER BY page_index
    `).all(id) as any[];

    const editorStates = pages.map((page: any) => {
      return db.prepare(`
        SELECT * FROM editor_states WHERE page_id = ?
      `).get(`${id}_page_${page.page_index}`) as any;
    });

    // 构建 PictureBookState
    return this.buildPictureBookState(project, storyData, storyboardData, assetsData, pages, editorStates);
  }

  getByUser(userId: string, limit = 50): ProjectSummary[] {
    const db = getDatabase();
    const projects = db.prepare(`
      SELECT p.*, ph.thumbnail_url as thumbnail_url
      FROM projects p
      LEFT JOIN project_history ph ON p.id = ph.project_id
      WHERE p.user_id = ?
      ORDER BY p.updated_at DESC
      LIMIT ?
    `).all(userId, limit) as any[];

    return projects.map((p: any) => ({
      id: p.id,
      userId: p.user_id,
      title: p.title,
      targetAge: p.target_age,
      pageCount: p.page_count,
      artStyle: p.art_style,
      aspectRatio: p.aspect_ratio,
      projectStatus: p.project_status,
      currentStage: p.current_stage,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
      thumbnailUrl: p.thumbnail_url,
    }));
  }

  update(id: string, userId: string, data: Partial<ProjectInfo>): boolean {
    const db = getDatabase();
    const updates: string[] = [];
    const values: any[] = [];

    if (data.title !== undefined) {
      updates.push("title = ?");
      values.push(data.title);
    }
    if (data.targetAge !== undefined) {
      updates.push("target_age = ?");
      values.push(data.targetAge);
    }
    // ... 其他字段

    if (updates.length === 0) return false;

    updates.push("updated_at = ?");
    values.push(Date.now());
    values.push(id, userId);

    const result = db.prepare(`
      UPDATE projects SET ${updates.join(", ")} WHERE id = ? AND user_id = ?
    `).run(...values);

    return result.changes > 0;
  }

  delete(id: string, userId: string): boolean {
    const db = getDatabase();
    const result = db.prepare(`
      DELETE FROM projects WHERE id = ? AND user_id = ?
    `).run(id, userId);
    return result.changes > 0;
  }

  saveFullState(id: string, userId: string, state: PictureBookState): boolean {
    const db = getDatabase();
    const now = Date.now();

    try {
      db.prepare(`
        UPDATE projects SET 
          title = ?, target_age = ?, page_count = ?, art_style = ?,
          aspect_ratio = ?, project_status = ?, current_stage = ?,
          stage_statuses = ?, save_status = ?, updated_at = ?
        WHERE id = ? AND user_id = ?
      `).run(
        state.projectInfo.title,
        state.projectInfo.targetAge,
        state.projectInfo.pageCount,
        state.projectInfo.artStyle,
        state.projectInfo.aspectRatio,
        state.projectInfo.projectStatus,
        state.currentStage,
        JSON.stringify(state.stageStatuses),
        state.projectInfo.saveStatus,
        now,
        id,
        userId
      );

      // 保存 story_data
      db.prepare(`UPDATE story_data SET one_line_story = ?, characters = ?, story_outline = ?, emotion_curve = ?, scenes = ?, generating = ?, updated_at = ? WHERE project_id = ?`)
        .run(
          state.story.oneLineStory,
          JSON.stringify(state.story.characters),
          state.story.storyOutline,
          JSON.stringify(state.story.emotionCurve),
          JSON.stringify(state.story.scenes),
          state.story.generating ? 1 : 0,
          now,
          id
        );

      // ... 保存其他数据

      return true;
    } catch (error) {
      console.error("Failed to save project state:", error);
      return false;
    }
  }

  private buildPictureBookState(
    project: any,
    storyData: any,
    storyboardData: any,
    assetsData: any,
    pages: any[],
    editorStates: any[]
  ): PictureBookState {
    return {
      projectInfo: {
        projectId: project.id,
        title: project.title,
        targetAge: project.target_age,
        pageCount: project.page_count,
        artStyle: project.art_style,
        aspectRatio: project.aspect_ratio,
        projectStatus: project.project_status,
        saveStatus: project.save_status,
      },
      currentStage: project.current_stage,
      stageStatuses: JSON.parse(project.stage_statuses || "{}"),
      story: {
        oneLineStory: storyData?.one_line_story || "",
        characters: JSON.parse(storyData?.characters || "[]"),
        storyOutline: storyData?.story_outline || "",
        emotionCurve: JSON.parse(storyData?.emotion_curve || "[]"),
        scenes: JSON.parse(storyData?.scenes || "[]"),
        generating: Boolean(storyData?.generating),
      },
      storyboard: {
        spreads: JSON.parse(storyboardData?.spreads || "[]"),
        pages: JSON.parse(storyboardData?.pages || "[]"),
        generating: Boolean(storyboardData?.generating),
      },
      assets: {
        characters: JSON.parse(assetsData?.characters || "[]"),
        scenes: JSON.parse(assetsData?.scenes || "[]"),
      },
      pages: pages.map((p: any) => ({
        index: p.page_index,
        storyText: p.story_text,
        characterRefs: JSON.parse(p.character_refs || "[]"),
        sceneRefs: JSON.parse(p.scene_refs || "[]"),
        prompt: p.prompt,
        promptUserEdited: Boolean(p.prompt_user_edited),
        imageUrl: p.image_url,
        pageStatus: p.page_status,
        generating: Boolean(p.generating),
      })),
      editorStates: editorStates.map((e: any) => ({
        textContent: e?.text_content || "",
        style: JSON.parse(e?.style || "{}"),
        layout: JSON.parse(e?.layout || "{}"),
        confirmed: Boolean(e?.confirmed),
      })),
    };
  }
}

export const projectRepository = new ProjectRepository();
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/db/repositories/
git commit -m "feat: add project repository with CRUD operations"
```

---

### Task 5: 图片 Repository（含描述）

**Files:**
- Create: `src/lib/db/repositories/image-repository.ts`

- [ ] **Step 1: 创建图片描述生成服务**

创建 `src/lib/image-description-service.ts`

```typescript
import { getDatabase } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";

const IMAGE_HISTORY_LIMIT = 10;

export interface ImageVersion {
  id: string;
  ownerType: "page" | "character_base" | "scene_candidate";
  ownerId: string;
  versionNumber: number;
  imageBlob: Buffer | null;
  imageUrl: string | null;
  description: string | null;
  descriptionEdited: boolean;
  createdAt: number;
}

export class ImageRepository {
  async saveImageWithDescription(
    ownerType: "page" | "character_base" | "scene_candidate",
    ownerId: string,
    imageData: Buffer,
    description?: string
  ): Promise<ImageVersion> {
    const db = getDatabase();
    const id = uuidv4();
    const now = Date.now();

    // 获取当前最大版本号
    const maxVersion = db.prepare(`
      SELECT MAX(version_number) as max FROM image_versions
      WHERE owner_type = ? AND owner_id = ?
    `).get(ownerType, ownerId) as any;

    const versionNumber = (maxVersion?.max || 0) + 1;

    // 如果超过限制，删除最旧的版本
    await this.pruneOldVersions(ownerType, ownerId, IMAGE_HISTORY_LIMIT);

    // 插入新版本
    db.prepare(`
      INSERT INTO image_versions 
      (id, owner_type, owner_id, version_number, image_blob, image_url, description, description_edited, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, ownerType, ownerId, versionNumber, imageData, null, description || null, description ? 1 : 0, now);

    // 如果需要，自动生成描述
    let finalDescription = description;
    if (!finalDescription && imageData) {
      finalDescription = await this.generateImageDescription(imageData);
      db.prepare(`UPDATE image_versions SET description = ? WHERE id = ?`)
        .run(finalDescription, id);
    }

    return {
      id,
      ownerType,
      ownerId,
      versionNumber,
      imageBlob: imageData,
      imageUrl: null,
      description: finalDescription,
      descriptionEdited: Boolean(description),
      createdAt: now,
    };
  }

  getVersions(
    ownerType: "page" | "character_base" | "scene_candidate",
    ownerId: string
  ): ImageVersion[] {
    const db = getDatabase();
    const versions = db.prepare(`
      SELECT * FROM image_versions
      WHERE owner_type = ? AND owner_id = ?
      ORDER BY version_number DESC
    `).all(ownerType, ownerId) as any[];

    return versions.map((v) => ({
      id: v.id,
      ownerType: v.owner_type,
      ownerId: v.owner_id,
      versionNumber: v.version_number,
      imageBlob: v.image_blob,
      imageUrl: v.image_url,
      description: v.description,
      descriptionEdited: Boolean(v.description_edited),
      createdAt: v.created_at,
    }));
  }

  getById(imageId: string): ImageVersion | null {
    const db = getDatabase();
    const image = db.prepare(`SELECT * FROM image_versions WHERE id = ?`).get(imageId) as any;

    if (!image) return null;

    return {
      id: image.id,
      ownerType: image.owner_type,
      ownerId: image.owner_id,
      versionNumber: image.version_number,
      imageBlob: image.image_blob,
      imageUrl: image.image_url,
      description: image.description,
      descriptionEdited: Boolean(image.description_edited),
      createdAt: image.created_at,
    };
  }

  updateDescription(imageId: string, description: string): boolean {
    const db = getDatabase();
    const result = db.prepare(`
      UPDATE image_versions SET description = ?, description_edited = 1 WHERE id = ?
    `).run(description, imageId);
    return result.changes > 0;
  }

  async restoreVersion(imageId: string): Promise<ImageVersion | null> {
    const currentVersion = this.getById(imageId);
    if (!currentVersion) return null;

    // 复制当前版本到新版本
    return this.saveImageWithDescription(
      currentVersion.ownerType,
      currentVersion.ownerId,
      currentVersion.imageBlob!,
      currentVersion.description || undefined
    );
  }

  private async pruneOldVersions(
    ownerType: string,
    ownerId: string,
    limit: number
  ): Promise<void> {
    const db = getDatabase();
    db.prepare(`
      DELETE FROM image_versions
      WHERE id IN (
        SELECT id FROM image_versions
        WHERE owner_type = ? AND owner_id = ?
        ORDER BY version_number ASC
        LIMIT MAX(0, (SELECT COUNT(*) FROM image_versions WHERE owner_type = ? AND owner_id = ?) - ?)
      )
    `).run(ownerType, ownerId, ownerType, ownerId, limit);
  }

  private async generateImageDescription(imageData: Buffer): Promise<string> {
    // TODO: 调用 AI 图像描述服务
    // 目前返回空字符串，后续集成图像描述 API
    return "";
  }
}

export const imageRepository = new ImageRepository();
```

- [ ] **Step 2: 创建图片引用解析服务**

创建 `src/lib/image-reference-parser.ts`

```typescript
import { imageRepository } from "./image-repository";
import { projectRepository } from "./db/repositories/project-repository";

export interface ImageReference {
  match: string;
  imageId: string;
  description: string;
  ownerType: string;
  ownerId: string;
}

export interface ParsedTextResult {
  parsedText: string;
  references: ImageReference[];
}

export class ImageReferenceParser {
  parseReferences(
    text: string,
    projectId: string,
    userId: string
  ): ParsedTextResult {
    const references: ImageReference[] = [];
    let parsedText = text;

    // 匹配模式 1: [图片N] 或 [img_xxxxx]
    const idPattern = /\[(图片?\d+|[a-zA-Z0-9_-]+)\]/g;
    let match;

    while ((match = idPattern.exec(text)) !== null) {
      const matchStr = match[0];
      const identifier = match[1];

      // 查找对应的图片
      const image = this.findImageByIdentifier(identifier, projectId, userId);
      if (image) {
        references.push({
          match: matchStr,
          imageId: image.id,
          description: image.description || "",
          ownerType: image.ownerType,
          ownerId: image.ownerId,
        });

        // 替换为描述
        if (image.description) {
          parsedText = parsedText.replace(matchStr, image.description);
        }
      }
    }

    // 匹配模式 2: [角色名] 或 [场景名]
    const namePattern = /\[([^\]]+)\]/g;
    while ((match = namePattern.exec(text)) !== null) {
      const matchStr = match[0];
      const name = match[1];

      // 跳过已处理的 ID 引用
      if (references.some(r => r.match === matchStr)) continue;

      // 查找对应的素材图片
      const asset = this.findAssetByName(name, projectId, userId);
      if (asset) {
        references.push({
          match: matchStr,
          imageId: asset.imageId,
          description: asset.description,
          ownerType: asset.ownerType,
          ownerId: asset.ownerId,
        });

        if (asset.description) {
          parsedText = parsedText.replace(matchStr, asset.description);
        }
      }
    }

    return { parsedText, references };
  }

  private findImageByIdentifier(
    identifier: string,
    projectId: string,
    userId: string
  ) {
    // 先尝试作为 ID 直接查找
    const byId = imageRepository.getById(identifier);
    if (byId) return byId;

    // 尝试作为索引查找
    const index = parseInt(identifier.replace(/图片?/g, "")) - 1;
    if (!isNaN(index)) {
      // 获取项目的所有页面图片
      const state = projectRepository.getByIdWithFullState(projectId, userId);
      if (state) {
        const page = state.pages[index];
        if (page?.imageUrl) {
          // 从 URL 中提取 ID 或使用索引
          return {
            id: `page_${projectId}_${index}`,
            ownerType: "page" as const,
            ownerId: `${projectId}_page_${index}`,
            description: page.storyText?.substring(0, 100) || "",
          };
        }
      }
    }

    return null;
  }

  private findAssetByName(name: string, projectId: string, userId: string) {
    const state = projectRepository.getByIdWithFullState(projectId, userId);
    if (!state) return null;

    // 查找角色
    const character = state.assets.characters.find(
      (c) => c.name === name && c.officialImageUrl
    );
    if (character) {
      return {
        imageId: character.id,
        description: character.description,
        ownerType: "character_base" as const,
        ownerId: character.id,
      };
    }

    // 查找场景
    const scene = state.assets.scenes.find(
      (s) => s.name === name && s.officialImageUrl
    );
    if (scene) {
      return {
        imageId: scene.id,
        description: scene.description,
        ownerType: "scene_candidate" as const,
        ownerId: scene.id,
      };
    }

    return null;
  }
}

export const imageReferenceParser = new ImageReferenceParser();
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/image-repository.ts src/lib/image-description-service.ts src/lib/image-reference-parser.ts
git commit -m "feat: add image repository with version and description support"
```

---

## 阶段三：API 路由开发

### Task 6: 项目管理 API

**Files:**
- Create: `src/app/api/projects/route.ts`
- Create: `src/app/api/projects/[id]/route.ts`
- Create: `src/app/api/projects/[id]/state/route.ts`

- [ ] **Step 1: 创建项目列表和创建 API**

创建 `src/app/api/projects/route.ts`

```typescript
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { projectRepository } from "@/lib/db/repositories/project-repository";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const projects = projectRepository.getByUser(session.user.id);
    return NextResponse.json({ projects });
  } catch (error) {
    console.error("Failed to get projects:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { title } = body;

    const project = projectRepository.create(session.user.id, title);
    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    console.error("Failed to create project:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

- [ ] **Step 2: 创建单个项目 CRUD API**

创建 `src/app/api/projects/[id]/route.ts`

```typescript
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { projectRepository } from "@/lib/db/repositories/project-repository";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const project = projectRepository.getByIdWithFullState(id, session.user.id);

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json({ project });
  } catch (error) {
    console.error("Failed to get project:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    const success = projectRepository.update(id, session.user.id, body);

    if (!success) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update project:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const success = projectRepository.delete(id, session.user.id);

    if (!success) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete project:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

- [ ] **Step 3: 创建完整状态保存 API**

创建 `src/app/api/projects/[id]/state/route.ts`

```typescript
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { projectRepository } from "@/lib/db/repositories/project-repository";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    const success = projectRepository.saveFullState(id, session.user.id, body);

    if (!success) {
      return NextResponse.json({ error: "Failed to save state" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to save project state:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/projects/
git commit -m "feat: add project CRUD API routes"
```

---

### Task 7: 图片管理 API

**Files:**
- Create: `src/app/api/projects/[id]/pages/[pageIndex]/image/route.ts`
- Create: `src/app/api/projects/[id]/pages/[pageIndex]/image-versions/route.ts`
- Create: `src/app/api/projects/[id]/pages/[pageIndex]/restore-version/route.ts`
- Create: `src/app/api/images/[id]/route.ts`
- Create: `src/app/api/images/[id]/description/route.ts`
- Create: `src/app/api/text/parse-image-references/route.ts`

- [ ] **Step 1: 创建页面图片上传 API**

创建 `src/app/api/projects/[id]/pages/[pageIndex]/image/route.ts`

```typescript
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { imageRepository } from "@/lib/image-repository";
import { projectRepository } from "@/lib/db/repositories/project-repository";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; pageIndex: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, pageIndex } = await params;
    const formData = await request.formData();
    const imageFile = formData.get("image") as File;
    const saveToHistory = formData.get("saveToHistory") !== "false";

    if (!imageFile) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    const arrayBuffer = await imageFile.arrayBuffer();
    const imageBuffer = Buffer.from(arrayBuffer);

    const ownerId = `${id}_page_${pageIndex}`;
    const version = await imageRepository.saveImageWithDescription(
      "page",
      ownerId,
      imageBuffer
    );

    // 更新页面记录
    const db = require("@/lib/db").getDatabase();
    db.prepare(`
      UPDATE pages SET image_url = ?, updated_at = ? WHERE project_id = ? AND page_index = ?
    `).run(`/api/images/${version.id}`, Date.now(), id, parseInt(pageIndex));

    return NextResponse.json({
      imageUrl: `/api/images/${version.id}`,
      versionId: version.id,
      description: version.description,
    });
  } catch (error) {
    console.error("Failed to upload page image:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

- [ ] **Step 2: 创建图片获取 API**

创建 `src/app/api/images/[id]/route.ts`

```typescript
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { imageRepository } from "@/lib/image-repository";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const image = imageRepository.getById(id);

    if (!image) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }

    if (image.imageBlob) {
      return new NextResponse(image.imageBlob, {
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "public, max-age=31536000",
        },
      });
    }

    return NextResponse.json({ error: "No image data" }, { status: 404 });
  } catch (error) {
    console.error("Failed to get image:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

- [ ] **Step 3: 创建图片描述 API**

创建 `src/app/api/images/[id]/description/route.ts`

```typescript
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { imageRepository } from "@/lib/image-repository";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { description } = body;

    if (!description) {
      return NextResponse.json({ error: "Description required" }, { status: 400 });
    }

    const success = imageRepository.updateDescription(id, description);

    if (!success) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, description });
  } catch (error) {
    console.error("Failed to update description:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const image = imageRepository.getById(id);

    if (!image) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }

    // TODO: 调用 AI 图像描述服务
    const description = "图片描述生成服务待实现";

    imageRepository.updateDescription(id, description);

    return NextResponse.json({ description });
  } catch (error) {
    console.error("Failed to generate description:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

- [ ] **Step 4: 创建图片引用解析 API**

创建 `src/app/api/text/parse-image-references/route.ts`

```typescript
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { imageReferenceParser } from "@/lib/image-reference-parser";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { text, projectId } = body;

    if (!text || !projectId) {
      return NextResponse.json(
        { error: "Text and projectId required" },
        { status: 400 }
      );
    }

    const result = imageReferenceParser.parseReferences(
      text,
      projectId,
      session.user.id
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to parse image references:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/projects/[id]/pages/ src/app/api/images/ src/app/api/text/
git commit -m "feat: add image management API routes with description support"
```

---

## 阶段四：前端集成

### Task 8: 修改 Project History Hook

**Files:**
- Modify: `src/modules/project-history/use-project-history.ts`

- [ ] **Step 1: 更新 Project History Hook 使用 API**

修改 `src/modules/project-history/use-project-history.ts`

```typescript
"use client";

import { useState, useEffect, useCallback } from "react";
import type { ProjectHistoryEntry } from "./types";

export function useProjectHistory() {
  const [projects, setProjects] = useState<ProjectHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProjects = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/projects");
      
      if (!response.ok) {
        throw new Error("Failed to load projects");
      }

      const data = await response.json();
      setProjects(data.projects || []);
      setError(null);
    } catch (err) {
      console.error("Failed to load projects:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
      // 回退到 localStorage
      loadFromLocalStorage();
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadFromLocalStorage = () => {
    try {
      const stored = localStorage.getItem("ai-picturebook-projects");
      if (stored) {
        const parsed = JSON.parse(stored);
        setProjects(Array.isArray(parsed) ? parsed : []);
      }
    } catch (error) {
      console.error("Failed to load from localStorage:", error);
      setProjects([]);
    }
  };

  const saveProject = useCallback(async (project: ProjectHistoryEntry) => {
    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: project.title }),
      });

      if (response.ok) {
        await loadProjects();
        return;
      }
    } catch (error) {
      console.error("Failed to save project to API:", error);
    }

    // 回退到 localStorage
    setProjects((prev) => {
      const existingIndex = prev.findIndex(
        (p) => p.projectId === project.projectId
      );
      let updated;
      if (existingIndex >= 0) {
        updated = [...prev];
        updated[existingIndex] = project;
      } else {
        updated = [project, ...prev];
      }
      try {
        localStorage.setItem("ai-picturebook-projects", JSON.stringify(updated));
      } catch (error) {
        console.error("Failed to save project:", error);
      }
      return updated;
    });
  }, []);

  const deleteProject = useCallback(async (projectId: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        await loadProjects();
        return;
      }
    } catch (error) {
      console.error("Failed to delete project from API:", error);
    }

    // 回退到 localStorage
    setProjects((prev) => {
      const updated = prev.filter((p) => p.projectId !== projectId);
      try {
        localStorage.setItem("ai-picturebook-projects", JSON.stringify(updated));
      } catch (error) {
        console.error("Failed to delete project:", error);
      }
      return updated;
    });
  }, [loadProjects]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  return {
    projects,
    isLoading,
    error,
    saveProject,
    deleteProject,
    loadProjects,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/modules/project-history/use-project-history.ts
git commit -m "feat: update useProjectHistory to use API with localStorage fallback"
```

---

### Task 9: 修改 Studio Context

**Files:**
- Modify: `src/modules/studio/presentation/context/StudioContext.tsx`

- [ ] **Step 1: 添加服务端持久化支持**

修改 `StudioContext.tsx`，添加保存到服务端的逻辑

```typescript
// 在 StudioProvider 中添加

const triggerSaveToServer = useCallback(async () => {
  if (!state.projectInfo.projectId) return;

  try {
    const response = await fetch(
      `/api/projects/${state.projectInfo.projectId}/state`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(state),
      }
    );

    if (!response.ok) {
      console.error("Failed to save to server");
    }
  } catch (error) {
    console.error("Failed to save to server:", error);
  }
}, [state]);

// 修改 triggerSave
const triggerSave = useCallback(() => {
  dispatch({ type: 'SET_SAVE_STATUS', payload: 'saving' });
  
  // 保存到 localStorage
  saveProjectToStorage(state);
  
  // 异步保存到服务端
  triggerSaveToServer();

  if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
  saveTimerRef.current = setTimeout(() => {
    dispatch({ type: 'SET_SAVE_STATUS', payload: 'saved' });
  }, 800);
}, [state, saveProjectToStorage, triggerSaveToServer]);
```

- [ ] **Step 2: Commit**

```bash
git add src/modules/studio/presentation/context/StudioContext.tsx
git commit -m "feat: add server-side persistence to StudioContext"
```

---

## 阶段五：测试和部署

### Task 10: 环境配置

**Files:**
- Create: `.env.local.example`

- [ ] **Step 1: 创建环境变量示例文件**

创建 `.env.local.example`

```env
# Database
DATABASE_PATH=./data/picturebook.db

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key-here

# OAuth Providers
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

- [ ] **Step 2: 更新 .gitignore**

```bash
# SQLite database
data/
*.db
*.db-wal
*.db-shm
```

- [ ] **Step 3: Commit**

```bash
git add .env.local.example
git commit -m "docs: add environment variables example"
```

---

## 实施总结

### 任务清单

**阶段一：基础设施搭建**
- [ ] Task 1: 项目依赖安装
- [ ] Task 2: 数据库连接和初始化
- [ ] Task 3: NextAuth 认证配置

**阶段二：Repository 层开发**
- [ ] Task 4: 项目 Repository
- [ ] Task 5: 图片 Repository（含描述）

**阶段三：API 路由开发**
- [ ] Task 6: 项目管理 API
- [ ] Task 7: 图片管理 API

**阶段四：前端集成**
- [ ] Task 8: 修改 Project History Hook
- [ ] Task 9: 修改 Studio Context

**阶段五：测试和部署**
- [ ] Task 10: 环境配置

### 下一步

1. 安装依赖并配置环境变量
2. 按任务顺序实现每个模块
3. 测试 API 端点
4. 集成到前端组件
5. 部署到生产环境

---

## 验收标准

1. ✅ 所有 API 端点正常工作
2. ✅ 用户可以注册/登录
3. ✅ 用户可以创建、编辑、删除项目
4. ✅ 项目数据持久化到 SQLite 数据库
5. ✅ 图片可以上传、存储、获取
6. ✅ 图片描述可以编辑和生成
7. ✅ 图片引用可以在文本中解析
8. ✅ 前端组件正确使用 API
9. ✅ localStorage 作为降级方案保留
10. ✅ 所有代码提交并测试通过
