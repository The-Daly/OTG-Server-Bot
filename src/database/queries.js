const { readDB, writeDB } = require('./local');

// ── Users ──────────────────────────────────────────────────────────────────────

async function getOrCreateUser(discordId) {
  const db = readDB();
  let user = db.users.find(u => u.discord_id === discordId);

  if (!user) {
    user = { discord_id: discordId, xp: 0, lesson_progress: 0, trades_logged: 0 };
    db.users.push(user);
    writeDB(db);
  }

  return user;
}

async function updateUserXP(discordId, xpToAdd) {
  const db = readDB();
  let user = db.users.find(u => u.discord_id === discordId);

  if (!user) {
    user = { discord_id: discordId, xp: 0, lesson_progress: 0, trades_logged: 0 };
    db.users.push(user);
  }

  user.xp += xpToAdd;
  writeDB(db);
  return user;
}

async function incrementTradesLogged(discordId) {
  const db = readDB();
  const user = db.users.find(u => u.discord_id === discordId);
  if (user) {
    user.trades_logged += 1;
    writeDB(db);
  }
  return user;
}

// ── Portfolio Activity ─────────────────────────────────────────────────────────

async function logTrade(discordId, portfolioSizeUsed, gainLossPercent) {
  await getOrCreateUser(discordId);
  const db = readDB();

  const trade = {
    user_id: discordId,
    portfolio_size_used: portfolioSizeUsed,
    gain_loss_percent: gainLossPercent,
    date: new Date().toISOString(),
  };

  db.portfolio_activity.push(trade);
  writeDB(db);

  await incrementTradesLogged(discordId);
  await updateUserXP(discordId, 10);

  return trade;
}

async function getRecentTrades(discordId, limit = 10) {
  const db = readDB();
  return db.portfolio_activity
    .filter(t => t.user_id === discordId)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, limit);
}

async function getTradeStats(discordId) {
  const trades = await getRecentTrades(discordId, 1000);

  if (trades.length === 0) {
    return { totalTrades: 0, avgGainLoss: 0, winRate: 0, wins: 0, losses: 0 };
  }

  const wins = trades.filter(t => t.gain_loss_percent > 0);
  const totalGainLoss = trades.reduce((sum, t) => sum + t.gain_loss_percent, 0);

  return {
    totalTrades: trades.length,
    avgGainLoss: +(totalGainLoss / trades.length).toFixed(2),
    winRate: +((wins.length / trades.length) * 100).toFixed(1),
    wins: wins.length,
    losses: trades.length - wins.length,
  };
}

// ── Lesson Progress ────────────────────────────────────────────────────────────

async function getLessonProgress(discordId) {
  const db = readDB();
  return db.lesson_progress
    .filter(l => l.user_id === discordId)
    .sort((a, b) => a.lesson_number - b.lesson_number);
}

async function completeLesson(discordId, lessonNumber) {
  await getOrCreateUser(discordId);
  const db = readDB();

  let entry = db.lesson_progress.find(
    l => l.user_id === discordId && l.lesson_number === lessonNumber
  );

  if (entry?.completed) return entry;

  if (entry) {
    entry.completed = true;
  } else {
    entry = { user_id: discordId, lesson_number: lessonNumber, completed: true };
    db.lesson_progress.push(entry);
  }

  writeDB(db);
  await updateUserXP(discordId, 25);

  // Update lesson_progress count on user
  const progress = db.lesson_progress.filter(l => l.user_id === discordId && l.completed);
  const dbFresh = readDB();
  const user = dbFresh.users.find(u => u.discord_id === discordId);
  if (user) {
    user.lesson_progress = progress.length;
    writeDB(dbFresh);
  }

  return entry;
}

module.exports = {
  getOrCreateUser,
  updateUserXP,
  incrementTradesLogged,
  logTrade,
  getRecentTrades,
  getTradeStats,
  getLessonProgress,
  completeLesson,
};
