-- SQLite Project Storage Schema
-- Design: docs/superpowers/specs/2026-05-13-project-persistence-design.md

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
  full_state TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
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
  updated_at INTEGER NOT NULL
);

-- 分镜数据表
CREATE TABLE IF NOT EXISTS storyboard_data (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL UNIQUE,
  spreads TEXT NOT NULL DEFAULT '[]',
  pages TEXT NOT NULL DEFAULT '[]',
  generating INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- 素材数据表
CREATE TABLE IF NOT EXISTS assets_data (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL UNIQUE,
  characters TEXT NOT NULL DEFAULT '[]',
  scenes TEXT NOT NULL DEFAULT '[]',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
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
  image_refs TEXT NOT NULL DEFAULT '[]',
  image_url TEXT,
  image_blob BLOB,
  page_status TEXT NOT NULL DEFAULT 'idle',
  generating INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
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
  updated_at INTEGER NOT NULL
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
  created_at INTEGER NOT NULL
);

-- 场景候选组表 (一组候选图片)
CREATE TABLE IF NOT EXISTS scene_candidate_groups (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  asset_id TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- 场景候选表 (单个候选)
CREATE TABLE IF NOT EXISTS scene_candidates (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  index_in_group INTEGER NOT NULL,
  image_blob BLOB NOT NULL,
  image_url TEXT,
  description TEXT,
  created_at INTEGER NOT NULL
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_updated_at ON projects(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_pages_project_id ON pages(project_id);
CREATE INDEX IF NOT EXISTS idx_image_versions_owner ON image_versions(owner_type, owner_id, version_number DESC);
CREATE INDEX IF NOT EXISTS idx_scene_candidate_groups_project ON scene_candidate_groups(project_id, asset_id);
CREATE INDEX IF NOT EXISTS idx_scene_candidates_group ON scene_candidates(group_id, index_in_group);

-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  username TEXT,
  nickname TEXT,
  password_hash TEXT,
  avatar_url TEXT,
  email_verified_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- 会话表
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

-- 验证令牌表
CREATE TABLE IF NOT EXISTS verification_tokens (
  id TEXT PRIMARY KEY,
  identifier TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
