-- SQLite Project Storage Schema
-- Design: docs/superpowers/specs/2026-05-13-sqlite-project-storage-design.md

-- 用户表 (NextAuth 自动管理)
-- 需要安装 @auth/sqlite-adapter

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
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 故事数据表
CREATE TABLE IF NOT EXISTS story_data (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL UNIQUE,
    one_line_story TEXT NOT NULL DEFAULT '',
    characters TEXT NOT NULL DEFAULT '[]',
    story_outline TEXT NOT NULL DEFAULT '',
    emotion_curve TEXT NOT NULL DEFAULT '[]',
    scenes TEXT NOT NULL DEFAULT '[]',
    generating INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- 分镜数据表
CREATE TABLE IF NOT EXISTS storyboard_data (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL UNIQUE,
    spreads TEXT NOT NULL DEFAULT '[]',
    pages TEXT NOT NULL DEFAULT '[]',
    generating INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- 素材数据表
CREATE TABLE IF NOT EXISTS assets_data (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL UNIQUE,
    characters TEXT NOT NULL DEFAULT '[]',
    scenes TEXT NOT NULL DEFAULT '[]',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- 页面数据表
CREATE TABLE IF NOT EXISTS pages (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    page_index INTEGER NOT NULL,
    story_text TEXT NOT NULL DEFAULT '',
    character_refs TEXT NOT NULL DEFAULT '[]',
    scene_refs TEXT NOT NULL DEFAULT '[]',
    prompt TEXT NOT NULL DEFAULT '',
    prompt_user_edited INTEGER NOT NULL DEFAULT 0,
    image_url TEXT,
    image_blob BLOB,
    page_status TEXT NOT NULL DEFAULT 'idle',
    generating INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    UNIQUE(project_id, page_index)
);

-- 编辑器状态表
CREATE TABLE IF NOT EXISTS editor_states (
    id TEXT PRIMARY KEY,
    page_id TEXT NOT NULL UNIQUE,
    text_content TEXT NOT NULL DEFAULT '',
    style TEXT NOT NULL DEFAULT '{}',
    layout TEXT NOT NULL DEFAULT '{}',
    confirmed INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE CASCADE
);

-- 图片版本表 (用于历史记录)
CREATE TABLE IF NOT EXISTS image_versions (
    id TEXT PRIMARY KEY,
    owner_type TEXT NOT NULL,
    owner_id TEXT NOT NULL,
    version_number INTEGER NOT NULL,
    image_blob BLOB NOT NULL,
    image_url TEXT,
    description TEXT,
    description_edited INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (owner_id) REFERENCES pages(id) ON DELETE CASCADE
);

-- 场景候选组表 (一组候选图片)
CREATE TABLE IF NOT EXISTS scene_candidate_groups (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    asset_id TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- 场景候选表 (单个候选)
CREATE TABLE IF NOT EXISTS scene_candidates (
    id TEXT PRIMARY KEY,
    group_id TEXT NOT NULL,
    index_in_group INTEGER NOT NULL,
    image_blob BLOB NOT NULL,
    image_url TEXT,
    description TEXT,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (group_id) REFERENCES scene_candidate_groups(id) ON DELETE CASCADE
);

-- 项目历史表 (用于首页快速查询)
CREATE TABLE IF NOT EXISTS project_history (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL UNIQUE,
    user_id TEXT NOT NULL,
    thumbnail_blob BLOB,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_updated_at ON projects(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_pages_project_id ON pages(project_id);
CREATE INDEX IF NOT EXISTS idx_image_versions_owner ON image_versions(owner_type, owner_id, version_number DESC);
CREATE INDEX IF NOT EXISTS idx_scene_candidate_groups_project ON scene_candidate_groups(project_id, asset_id);
CREATE INDEX IF NOT EXISTS idx_scene_candidates_group ON scene_candidates(group_id, index_in_group);
CREATE INDEX IF NOT EXISTS idx_project_history_user_id ON project_history(user_id);
