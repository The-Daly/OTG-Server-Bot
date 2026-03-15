const fs = require('node:fs');
const path = require('node:path');

const DB_PATH = path.join(__dirname, '..', '..', 'data', 'db.json');

function ensureDataDir() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function readDB() {
  ensureDataDir();
  if (!fs.existsSync(DB_PATH)) {
    const empty = { users: [], portfolio_activity: [], lesson_progress: [] };
    fs.writeFileSync(DB_PATH, JSON.stringify(empty, null, 2));
    return empty;
  }
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
}

function writeDB(data) {
  ensureDataDir();
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

module.exports = { readDB, writeDB };
