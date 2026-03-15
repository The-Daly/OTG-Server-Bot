-- OTG Trading Academy — Supabase Schema
-- Run this in the Supabase SQL Editor to create all required tables.

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  discord_id TEXT UNIQUE NOT NULL,
  xp INTEGER DEFAULT 0,
  lesson_progress INTEGER DEFAULT 0,
  trades_logged INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Portfolio activity (trade log)
CREATE TABLE IF NOT EXISTS portfolio_activity (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(discord_id),
  portfolio_size_used INTEGER NOT NULL,
  gain_loss_percent INTEGER NOT NULL,
  date TIMESTAMPTZ DEFAULT NOW()
);

-- Lesson progress
CREATE TABLE IF NOT EXISTS lesson_progress (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(discord_id),
  lesson_number INTEGER NOT NULL CHECK (lesson_number BETWEEN 1 AND 3),
  completed BOOLEAN DEFAULT FALSE,
  UNIQUE (user_id, lesson_number)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_portfolio_user ON portfolio_activity(user_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_date ON portfolio_activity(date DESC);
CREATE INDEX IF NOT EXISTS idx_lesson_user ON lesson_progress(user_id);

-- Enable Row Level Security (optional — disable if using service role key)
-- ALTER TABLE users ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE portfolio_activity ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE lesson_progress ENABLE ROW LEVEL SECURITY;
