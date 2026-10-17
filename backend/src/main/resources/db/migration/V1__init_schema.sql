-- V1__init_schema.sql

CREATE TABLE IF NOT EXISTS courses (
    id UUID PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    exam_date DATE,
    daily_minutes INT NOT NULL DEFAULT 20,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    raw_text TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE'
);

CREATE TABLE IF NOT EXISTS units (
    id UUID PRIMARY KEY,
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    sort_order INT NOT NULL DEFAULT 0,
    title VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS sections (
    id UUID PRIMARY KEY,
    unit_id UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
    sort_order INT NOT NULL DEFAULT 0,
    title VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS lessons (
    id UUID PRIMARY KEY,
    section_id UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
    sort_order INT NOT NULL DEFAULT 0,
    title VARCHAR(255) NOT NULL,
    source_text TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'locked',
    scheduled_date DATE,
    best_score INT,
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS items (
    id UUID PRIMARY KEY,
    lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
    prompt TEXT NOT NULL,
    intro TEXT,
    answer TEXT NOT NULL,
    distractors TEXT NOT NULL, -- JSON array of 3 strings: ["distractor1", "distractor2", "distractor3"]
    explanation TEXT,
    source_quote VARCHAR(500)
);

CREATE TABLE IF NOT EXISTS item_states (
    item_id UUID PRIMARY KEY REFERENCES items(id) ON DELETE CASCADE,
    ease DOUBLE PRECISION NOT NULL DEFAULT 2.5,
    interval_days INT NOT NULL DEFAULT 0,
    repetitions INT NOT NULL DEFAULT 0,
    lapses INT NOT NULL DEFAULT 0,
    due_at TIMESTAMP WITH TIME ZONE,
    last_result VARCHAR(50),
    introduced BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS review_logs (
    id UUID PRIMARY KEY,
    item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    correct BOOLEAN NOT NULL,
    response_ms BIGINT NOT NULL,
    at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE IF NOT EXISTS profiles (
    id VARCHAR(50) PRIMARY KEY, -- singleton: 'default'
    xp INT NOT NULL DEFAULT 0,
    streak INT NOT NULL DEFAULT 0,
    best_streak INT NOT NULL DEFAULT 0,
    last_active_date DATE,
    daily_goal_xp INT NOT NULL DEFAULT 20,
    xp_today INT NOT NULL DEFAULT 0,
    timezone VARCHAR(100) NOT NULL DEFAULT 'Asia/Ho_Chi_Minh'
);
