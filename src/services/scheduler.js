const fs = require('node:fs');
const path = require('node:path');

const EVENTS_PATH = path.join(__dirname, '..', '..', 'data', 'events.json');

function ensureFile() {
  const dir = path.dirname(EVENTS_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(EVENTS_PATH)) fs.writeFileSync(EVENTS_PATH, '[]');
}

function loadEvents() {
  ensureFile();
  return JSON.parse(fs.readFileSync(EVENTS_PATH, 'utf-8'));
}

function saveEvents(events) {
  ensureFile();
  fs.writeFileSync(EVENTS_PATH, JSON.stringify(events, null, 2));
}

function createEvent({ title, description, dateTime, timezone, channelId, createdBy }) {
  const events = loadEvents();
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  const event = {
    id,
    title,
    description,
    dateTime,        // ISO string in UTC
    timezone,        // display timezone (e.g. "America/New_York")
    channelId,
    createdBy,
    alerts: {
      '30min': false,
      '5min': false,
      'now': false,
    },
    active: true,
    createdAt: new Date().toISOString(),
  };

  events.push(event);
  saveEvents(events);
  return event;
}

function getUpcomingEvents() {
  const events = loadEvents();
  const now = new Date();
  return events
    .filter(e => e.active && new Date(e.dateTime) > now)
    .sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime));
}

function getAllActiveEvents() {
  const events = loadEvents();
  return events
    .filter(e => e.active)
    .sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime));
}

function cancelEvent(eventId) {
  const events = loadEvents();
  const event = events.find(e => e.id === eventId);
  if (event) {
    event.active = false;
    saveEvents(events);
    return true;
  }
  return false;
}

function markAlertSent(eventId, alertType) {
  const events = loadEvents();
  const event = events.find(e => e.id === eventId);
  if (event) {
    event.alerts[alertType] = true;
    saveEvents(events);
  }
}

function getDueAlerts() {
  const events = loadEvents();
  const now = Date.now();
  const alerts = [];

  for (const event of events) {
    if (!event.active) continue;

    const eventTime = new Date(event.dateTime).getTime();
    const diff = eventTime - now;

    // 30 min alert (between 29-31 min before)
    if (!event.alerts['30min'] && diff > 0 && diff <= 31 * 60 * 1000 && diff >= 29 * 60 * 1000) {
      alerts.push({ event, type: '30min', message: '30 minutes' });
    }

    // 5 min alert (between 4-6 min before)
    if (!event.alerts['5min'] && diff > 0 && diff <= 6 * 60 * 1000 && diff >= 4 * 60 * 1000) {
      alerts.push({ event, type: '5min', message: '5 minutes' });
    }

    // Now alert (between 0-2 min after start)
    if (!event.alerts['now'] && diff <= 0 && diff >= -2 * 60 * 1000) {
      alerts.push({ event, type: 'now', message: null });
    }

    // Clean up old events (more than 1 hour past)
    if (diff < -60 * 60 * 1000) {
      event.active = false;
    }
  }

  saveEvents(events);
  return alerts;
}

// Common timezone abbreviations for display
const TIMEZONE_OPTIONS = [
  { label: 'Eastern (ET)', value: 'America/New_York' },
  { label: 'Central (CT)', value: 'America/Chicago' },
  { label: 'Mountain (MT)', value: 'America/Denver' },
  { label: 'Pacific (PT)', value: 'America/Los_Angeles' },
  { label: 'UTC', value: 'UTC' },
  { label: 'London (GMT/BST)', value: 'Europe/London' },
];

function formatEventTime(isoString, timezone) {
  const date = new Date(isoString);
  try {
    return date.toLocaleString('en-US', {
      timeZone: timezone,
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    });
  } catch {
    return date.toLocaleString('en-US');
  }
}

module.exports = {
  createEvent,
  getUpcomingEvents,
  getAllActiveEvents,
  cancelEvent,
  markAlertSent,
  getDueAlerts,
  formatEventTime,
  TIMEZONE_OPTIONS,
};
