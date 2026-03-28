const fs = require('node:fs');
const path = require('node:path');

const BASE44_URL = 'https://trade-mind-ai-copy-45442b24.base44.app/functions';
const HISTORY_PATH = path.join(__dirname, '..', '..', 'data', 'autopost-history.json');
const LASTRUN_PATH = path.join(__dirname, '..', '..', 'data', 'autopost-lastrun.json');

function ensureFile() {
  const dir = path.dirname(HISTORY_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(HISTORY_PATH)) fs.writeFileSync(HISTORY_PATH, '{}');
}

function loadHistory() {
  ensureFile();
  return JSON.parse(fs.readFileSync(HISTORY_PATH, 'utf-8'));
}

function saveHistory(data) {
  ensureFile();
  fs.writeFileSync(HISTORY_PATH, JSON.stringify(data, null, 2));
}

function addToHistory(channel, titles) {
  const history = loadHistory();
  if (!history[channel]) history[channel] = [];
  history[channel].push(...titles.map(t => ({ title: t, date: new Date().toISOString() })));
  // Keep only last 100 entries per channel
  if (history[channel].length > 100) history[channel] = history[channel].slice(-100);
  saveHistory(history);
}

function getRecentTitles(channel) {
  const history = loadHistory();
  if (!history[channel]) return [];
  // Only titles from last 24 hours
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  return history[channel]
    .filter(h => new Date(h.date).getTime() > cutoff)
    .map(h => h.title);
}

async function callBase44(prompt, context) {
  const response = await fetch(`${BASE44_URL}/answerTradingQuestion`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question: prompt, context: context || '' }),
  });

  if (!response.ok) throw new Error(`Base44 error: ${response.status}`);
  const data = await response.json();
  return data.answer || data.response || data.text || String(data);
}

// Channel-specific prompts
const CHANNEL_CONFIGS = {
  'watcher-breakdown': {
    prompt: `ONLY respond if there is truly significant market activity right now. You MUST respond with NO_UPDATES if nothing major is happening. Do NOT fabricate or exaggerate news.

Significant means: major index moves (1%+), unusual options flow (10x+ normal volume), key support/resistance breaks on major tickers, dark pool block trades, circuit breakers, or flash crashes.

If something significant IS happening, give 1-2 items max in this format:
TITLE: [short headline, under 60 chars]
TICKER: [symbol]
SUMMARY: [1-2 sentences, be specific with numbers]
IMPACT: [Bullish or Bearish or Neutral]
CONFIDENCE: [High or Medium or Low]
BREAKING: [Yes ONLY for crashes, Fed emergency, circuit breakers — otherwise No]
---

If nothing significant, respond with exactly: NO_UPDATES`,
    context: 'You are a market analyst for OTG Trading Academy. ONLY report truly significant activity. Most hours have nothing worth reporting — say NO_UPDATES. Never post filler. Today is ',
  },
  'world-news': {
    prompt: `ONLY respond if there is major global news that directly moves markets. You MUST respond with NO_UPDATES if nothing major is happening. Do NOT fabricate or exaggerate.

Major means: central bank rate decisions, CPI/jobs data surprises, geopolitical escalations, oil/gold 2%+ moves, trade war developments, sanctions, or crypto 5%+ moves.

If something major IS happening, give 1 item max in this format:
TITLE: [short headline, under 60 chars]
TICKER: [relevant symbol or "Global"]
SUMMARY: [1-2 sentences, why it matters for traders]
IMPACT: [Bullish or Bearish or Neutral]
CONFIDENCE: [High or Medium or Low]
BREAKING: [Yes ONLY for war, crashes, emergency rate cuts — otherwise No]
---

If nothing major, respond with exactly: NO_UPDATES`,
    context: 'You are a global news analyst for OTG Trading Academy. ONLY report market-moving global events. Most hours have nothing worth reporting — say NO_UPDATES. Never post filler. Today is ',
  },
  'large-cap': {
    prompt: `Give me 2 updates on large-cap stocks (AAPL, TSLA, NVDA, MSFT, AMZN, META, GOOGL, etc.). Focus on:
- Earnings reports or guidance changes
- Analyst upgrades/downgrades
- Product launches or major business moves
- Significant price action or technical breakouts
- Regulatory news affecting big tech

For each item provide EXACTLY this format:
TITLE: [short headline]
TICKER: [ticker symbol]
SUMMARY: [2-3 sentences max, trader-focused]
IMPACT: [Bullish or Bearish or Neutral]
CONFIDENCE: [High or Medium or Low]
BREAKING: [Yes ONLY for extreme market-moving events like crashes, Fed emergency actions, major company collapses, circuit breakers — otherwise No]
---

Only include recent, actionable large-cap news. If nothing notable, respond with exactly: NO_UPDATES`,
    context: 'You are a large-cap stock analyst for OTG Trading Academy. Focus on major stocks and their catalysts. Be specific with price levels and percentages. Today is ',
  },
};

function parseItems(raw) {
  if (!raw || raw.trim() === 'NO_UPDATES') return null;

  const items = [];
  const blocks = raw.split('---').filter(b => b.trim());

  for (const block of blocks) {
    const item = {};
    const lines = block.trim().split('\n');
    for (const line of lines) {
      const match = line.match(/^(TITLE|TICKER|SUMMARY|IMPACT|CONFIDENCE|BREAKING):\s*(.+)/i);
      if (match) {
        item[match[1].toLowerCase()] = match[2].trim();
      }
    }
    if (item.title && item.summary) {
      items.push({
        title: item.title,
        ticker: item.ticker || 'Market',
        summary: item.summary,
        impact: (item.impact || 'Neutral').toLowerCase(),
        confidence: (item.confidence || 'Medium').toLowerCase(),
        breaking: (item.breaking || 'No').toLowerCase() === 'yes',
      });
    }
  }

  return items.length > 0 ? items : null;
}

async function generateChannelContent(channelKey) {
  const config = CHANNEL_CONFIGS[channelKey];
  if (!config) return null;

  const recentTitles = getRecentTitles(channelKey);
  const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  let prompt = config.prompt;
  if (recentTitles.length > 0) {
    prompt += `\n\nDO NOT repeat these topics already posted today:\n${recentTitles.join('\n')}`;
  }

  const context = config.context + dateStr + '.';

  try {
    const raw = await callBase44(prompt, context);
    let items = parseItems(raw);

    // Limit to top 2 items per channel
    if (items && items.length > 2) {
      items = items.slice(0, 2);
    }

    if (items) {
      addToHistory(channelKey, items.map(i => i.title));
    }

    return items;
  } catch (error) {
    console.error(`Auto-post error for ${channelKey}:`, error);
    return null;
  }
}

function shouldRun() {
  ensureFile();
  try {
    if (!fs.existsSync(LASTRUN_PATH)) return true;
    const data = JSON.parse(fs.readFileSync(LASTRUN_PATH, 'utf-8'));
    const lastRun = new Date(data.lastRun).getTime();
    // Only run if 1 hour (minus 1 min buffer) have passed
    return Date.now() - lastRun >= (60 * 60 * 1000 - 60 * 1000);
  } catch {
    return true;
  }
}

function markRan() {
  ensureFile();
  fs.writeFileSync(LASTRUN_PATH, JSON.stringify({ lastRun: new Date().toISOString() }, null, 2));
}

module.exports = {
  generateChannelContent,
  shouldRun,
  markRan,
  CHANNEL_CONFIGS,
};
