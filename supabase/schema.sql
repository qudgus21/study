-- Supabase Schema for Study Tool
-- Run this in Supabase SQL Editor

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- categories
-- ============================================================
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  source_type TEXT NOT NULL CHECK (source_type IN ('ai', 'jd', 'article', 'manual')),
  source_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_categories_source_type_created ON categories (source_type, created_at DESC);
CREATE INDEX idx_categories_created_at_desc ON categories (created_at DESC);

-- ============================================================
-- missions
-- ============================================================
CREATE TABLE missions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  category_name TEXT NOT NULL DEFAULT '',
  mission_type TEXT NOT NULL CHECK (mission_type IN ('concept', 'discussion', 'code')),
  title TEXT NOT NULL,
  description TEXT,
  code_snippet TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'passed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_missions_category_id ON missions (category_id);
CREATE INDEX idx_missions_created_at_desc ON missions (created_at DESC);

-- ============================================================
-- attempts
-- ============================================================
CREATE TABLE attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  mission_id UUID NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  answer_text TEXT NOT NULL,
  eval_prompt TEXT,
  eval_result TEXT,
  score NUMERIC,
  passed BOOLEAN NOT NULL DEFAULT false,
  feedback_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_attempts_mission_id ON attempts (mission_id);

-- ============================================================
-- articles
-- ============================================================
CREATE TABLE articles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  url TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  source TEXT NOT NULL,
  published_at TIMESTAMPTZ NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  is_bookmarked BOOLEAN NOT NULL DEFAULT false,
  topic_generated BOOLEAN NOT NULL DEFAULT false,
  topic_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  memo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_articles_published_at_desc ON articles (published_at DESC);
CREATE INDEX idx_articles_source_published ON articles (source, published_at DESC);
CREATE INDEX idx_articles_is_read_published ON articles (is_read, published_at DESC);
CREATE INDEX idx_articles_is_bookmarked_published ON articles (is_bookmarked, published_at DESC);

-- ============================================================
-- learning_skills
-- ============================================================
CREATE TABLE learning_skills (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  skill_name TEXT NOT NULL UNIQUE,
  total_missions INTEGER NOT NULL DEFAULT 0,
  passed_missions INTEGER NOT NULL DEFAULT 0,
  confidence_level INTEGER NOT NULL DEFAULT 0 CHECK (confidence_level BETWEEN 0 AND 100),
  last_practiced_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- settings (single-row table)
-- ============================================================
CREATE TABLE settings (
  id TEXT PRIMARY KEY DEFAULT 'global' CHECK (id = 'global'),
  pass_score INTEGER NOT NULL DEFAULT 80,
  article_keywords TEXT[] NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO settings (id) VALUES ('global') ON CONFLICT DO NOTHING;

-- ============================================================
-- wanted_jds
-- ============================================================
CREATE TABLE wanted_jds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wanted_id TEXT NOT NULL UNIQUE,
  company_name TEXT NOT NULL,
  position_title TEXT NOT NULL,
  raw_description TEXT NOT NULL,
  required_skills TEXT[] NOT NULL DEFAULT '{}',
  preferred_skills TEXT[] NOT NULL DEFAULT '{}',
  crawled_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- jd_skill_trends
-- ============================================================
CREATE TABLE jd_skill_trends (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  collected_date DATE NOT NULL,
  skill_name TEXT NOT NULL,
  mention_count INTEGER NOT NULL DEFAULT 0,
  sample_jd_ids TEXT[] NOT NULL DEFAULT '{}',
  UNIQUE (collected_date, skill_name)
);

CREATE INDEX idx_jd_skill_trends_date_desc ON jd_skill_trends (collected_date DESC);

-- ============================================================
-- jd_insights
-- ============================================================
CREATE TABLE jd_insights (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  collected_date DATE NOT NULL,
  total_jds INTEGER NOT NULL DEFAULT 0,
  competencies JSONB NOT NULL DEFAULT '[]',
  responsibilities JSONB NOT NULL DEFAULT '[]',
  qualifications JSONB NOT NULL DEFAULT '[]',
  preferred JSONB NOT NULL DEFAULT '[]',
  culture JSONB NOT NULL DEFAULT '[]',
  domains JSONB NOT NULL DEFAULT '[]',
  summary TEXT NOT NULL DEFAULT ''
);

CREATE INDEX idx_jd_insights_date_desc ON jd_insights (collected_date DESC);
