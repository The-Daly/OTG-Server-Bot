const fs = require('node:fs');
const path = require('node:path');

const CHECKIN_PATH = path.join(__dirname, '..', '..', 'data', 'checkins.json');
const STATE_PATH = path.join(__dirname, '..', '..', 'data', 'checkin-state.json');

function ensureDir() {
  const dir = path.dirname(CHECKIN_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// ── State (active message, last post date) ──────────────────────────────────
function getState() {
  ensureDir();
  if (!fs.existsSync(STATE_PATH)) return { activeMessageId: null, lastPostDate: null, reminderSentDate: null };
  return JSON.parse(fs.readFileSync(STATE_PATH, 'utf-8'));
}

function saveState(state) {
  ensureDir();
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

function setActiveMessage(messageId, date) {
  const state = getState();
  state.activeMessageId = messageId;
  state.lastPostDate = date;
  saveState(state);
}

function markReminderSent(date) {
  const state = getState();
  state.reminderSentDate = date;
  saveState(state);
}

// ── Check-in Data ───────────────────────────────────────────────────────────
function loadCheckins() {
  ensureDir();
  if (!fs.existsSync(CHECKIN_PATH)) {
    fs.writeFileSync(CHECKIN_PATH, '{}');
    return {};
  }
  return JSON.parse(fs.readFileSync(CHECKIN_PATH, 'utf-8'));
}

function saveCheckins(data) {
  ensureDir();
  fs.writeFileSync(CHECKIN_PATH, JSON.stringify(data, null, 2));
}

/**
 * Process a user check-in.
 * Returns { success, xp, streak, bias, alreadyCheckedIn }
 */
function processCheckin(userId, bias) {
  const data = loadCheckins();
  const today = new Date().toISOString().split('T')[0];

  if (!data[userId]) {
    data[userId] = {
      xp: 0,
      streak: 0,
      longestStreak: 0,
      lastCheckin: null,
      totalCheckins: 0,
      biasHistory: [],
    };
  }

  const user = data[userId];

  // Already checked in today
  if (user.lastCheckin === today) {
    return { success: false, alreadyCheckedIn: true, streak: user.streak, xp: user.xp, bias };
  }

  // Calculate streak
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  if (user.lastCheckin === yesterdayStr) {
    user.streak += 1;
  } else {
    user.streak = 1; // reset streak
  }

  // Bonus XP for streaks
  let xpGain = 10;
  if (user.streak >= 30) xpGain = 25;
  else if (user.streak >= 7) xpGain = 20;
  else if (user.streak >= 3) xpGain = 15;

  user.xp += xpGain;
  user.lastCheckin = today;
  user.totalCheckins += 1;
  if (user.streak > user.longestStreak) user.longestStreak = user.streak;

  // Save bias
  user.biasHistory.push({ date: today, bias });
  // Keep only last 30 entries
  if (user.biasHistory.length > 30) user.biasHistory = user.biasHistory.slice(-30);

  saveCheckins(data);

  return {
    success: true,
    alreadyCheckedIn: false,
    xp: user.xp,
    xpGain,
    streak: user.streak,
    longestStreak: user.longestStreak,
    bias,
  };
}

/**
 * Get today's sentiment stats
 */
function getTodaySentiment() {
  const data = loadCheckins();
  const today = new Date().toISOString().split('T')[0];

  let bullish = 0, bearish = 0, neutral = 0;

  for (const userId of Object.keys(data)) {
    const user = data[userId];
    if (user.lastCheckin === today && user.biasHistory.length > 0) {
      const lastBias = user.biasHistory[user.biasHistory.length - 1];
      if (lastBias.date === today) {
        if (lastBias.bias === 'bullish') bullish++;
        else if (lastBias.bias === 'bearish') bearish++;
        else neutral++;
      }
    }
  }

  const total = bullish + bearish + neutral;
  return {
    bullish,
    bearish,
    neutral,
    total,
    bullishPct: total ? Math.round((bullish / total) * 100) : 0,
    bearishPct: total ? Math.round((bearish / total) * 100) : 0,
    neutralPct: total ? Math.round((neutral / total) * 100) : 0,
  };
}

/**
 * Get leaderboard data
 */
function getLeaderboard() {
  const data = loadCheckins();
  const users = Object.entries(data).map(([id, u]) => ({
    id,
    xp: u.xp,
    streak: u.streak,
    longestStreak: u.longestStreak,
    totalCheckins: u.totalCheckins,
  }));

  const byXP = [...users].sort((a, b) => b.xp - a.xp).slice(0, 10);
  const byStreak = [...users].sort((a, b) => b.streak - a.streak).slice(0, 10);

  return { byXP, byStreak };
}

/**
 * Get a user's check-in data
 */
function getUserData(userId) {
  const data = loadCheckins();
  return data[userId] || { xp: 0, streak: 0, longestStreak: 0, totalCheckins: 0, biasHistory: [] };
}

module.exports = {
  getState,
  setActiveMessage,
  markReminderSent,
  processCheckin,
  getTodaySentiment,
  getLeaderboard,
  getUserData,
};
