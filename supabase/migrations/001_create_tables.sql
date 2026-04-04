-- Categories
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  group_name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#3b82f6',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Topics
CREATE TABLE topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  mission_type TEXT NOT NULL CHECK (mission_type IN ('concept', 'discussion', 'code')),
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  difficulty TEXT NOT NULL DEFAULT 'senior' CHECK (difficulty IN ('mid', 'senior', 'staff')),
  source_type TEXT NOT NULL DEFAULT 'manual' CHECK (source_type IN ('manual', 'rss', 'github', 'wanted', 'generated')),
  source_ref TEXT,
  code_snippet TEXT,
  is_used BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_topics_mission_type ON topics(mission_type);
CREATE INDEX idx_topics_category ON topics(category_id);
CREATE INDEX idx_topics_unused ON topics(is_used, mission_type);

-- Weeks
CREATE TABLE weeks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start DATE NOT NULL UNIQUE,
  goal_concept INTEGER NOT NULL DEFAULT 5,
  goal_discussion INTEGER NOT NULL DEFAULT 5,
  goal_code INTEGER NOT NULL DEFAULT 5,
  carried_over_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_weeks_start ON weeks(week_start DESC);

-- Missions
CREATE TABLE missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_id UUID NOT NULL REFERENCES weeks(id) ON DELETE CASCADE,
  topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  mission_type TEXT NOT NULL CHECK (mission_type IN ('concept', 'discussion', 'code')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'passed', 'failed')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_carried_over BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);
CREATE INDEX idx_missions_week ON missions(week_id, mission_type, status);

-- Attempts
CREATE TABLE attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id UUID NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  answer_text TEXT NOT NULL,
  eval_prompt TEXT NOT NULL,
  eval_result TEXT,
  score INTEGER CHECK (score >= 0 AND score <= 100),
  passed BOOLEAN NOT NULL DEFAULT false,
  feedback_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_attempts_mission ON attempts(mission_id, created_at DESC);

-- Articles
CREATE TABLE articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  source TEXT NOT NULL,
  summary TEXT,
  published_at TIMESTAMPTZ,
  is_read BOOLEAN NOT NULL DEFAULT false,
  is_bookmarked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_articles_source ON articles(source, created_at DESC);
CREATE INDEX idx_articles_unread ON articles(is_read, created_at DESC);

-- GitHub Releases
CREATE TABLE github_releases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repo TEXT NOT NULL,
  tag_name TEXT NOT NULL,
  release_name TEXT,
  body_summary TEXT,
  published_at TIMESTAMPTZ NOT NULL,
  url TEXT NOT NULL,
  topic_generated BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(repo, tag_name)
);
CREATE INDEX idx_releases_repo ON github_releases(repo, published_at DESC);

-- Wanted JDs
CREATE TABLE wanted_jds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wanted_id TEXT NOT NULL UNIQUE,
  company_name TEXT NOT NULL,
  position_title TEXT NOT NULL,
  required_skills TEXT[] NOT NULL DEFAULT '{}',
  preferred_skills TEXT[] NOT NULL DEFAULT '{}',
  experience_range TEXT,
  raw_description TEXT,
  url TEXT NOT NULL,
  crawled_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_jds_crawled ON wanted_jds(crawled_at DESC);

-- JD Skill Trends
CREATE TABLE jd_skill_trends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start DATE NOT NULL,
  skill_name TEXT NOT NULL,
  mention_count INTEGER NOT NULL DEFAULT 0,
  sample_jd_ids UUID[] NOT NULL DEFAULT '{}',
  UNIQUE(week_start, skill_name)
);
CREATE INDEX idx_trends_week ON jd_skill_trends(week_start DESC, mention_count DESC);

-- Notifications
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('article', 'release', 'jd_report', 'goal_progress', 'gap_alert')),
  title TEXT NOT NULL,
  body TEXT,
  ref_url TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_unread ON notifications(is_read, created_at DESC);

-- Settings
CREATE TABLE settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  carry_over_limit INTEGER NOT NULL DEFAULT 5,
  weekly_goal_concept INTEGER NOT NULL DEFAULT 5,
  weekly_goal_discussion INTEGER NOT NULL DEFAULT 5,
  weekly_goal_code INTEGER NOT NULL DEFAULT 5,
  pass_score INTEGER NOT NULL DEFAULT 80,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO settings DEFAULT VALUES;

-- Learning Skills
CREATE TABLE learning_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_name TEXT NOT NULL UNIQUE,
  total_missions INTEGER NOT NULL DEFAULT 0,
  passed_missions INTEGER NOT NULL DEFAULT 0,
  last_practiced_at TIMESTAMPTZ,
  confidence_level TEXT DEFAULT 'unknown' CHECK (confidence_level IN ('unknown', 'weak', 'moderate', 'strong'))
);
