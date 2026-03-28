const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, GatewayIntentBits, Partials, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
require('dotenv').config({ override: true });

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildEmojisAndStickers,
  ],
  partials: [Partials.Message, Partials.Reaction, Partials.User],
});

// Auto-react off by default
client.autoReactEnabled = false;

// Store news items so "Learn More" buttons can reference them
// Map<messageId, { items: [...], channelKey: string }>
client.newsContext = new Map();

// ── Load Commands ──────────────────────────────────────────────────────────────
client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));

for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  if (command.data && command.execute) {
    client.commands.set(command.data.name, command);
    console.log(`Loaded command: ${command.data.name}`);
  }
}

// ── Load Events ────────────────────────────────────────────────────────────────
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(f => f.endsWith('.js'));

for (const file of eventFiles) {
  const event = require(path.join(eventsPath, file));
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args));
  } else {
    client.on(event.name, (...args) => event.execute(...args));
  }
  console.log(`Loaded event: ${event.name}`);
}

// ── Alert Scheduler ────────────────────────────────────────────────────────────
const { getDueAlerts, markAlertSent, formatEventTime } = require('./services/scheduler');

client.once('ready', () => {
  setInterval(async () => {
    try {
      const alerts = getDueAlerts();
      for (const { event, type, message } of alerts) {
        try {
          const channel = await client.channels.fetch(event.channelId);
          if (!channel) continue;

          const displayTime = formatEventTime(event.dateTime, event.timezone);
          const embed = new EmbedBuilder().setTimestamp();

          if (type === 'now') {
            embed.setColor(0x57F287)
              .setTitle(`🔴 LIVE NOW: ${event.title}`)
              .setDescription(`${event.description || 'A scheduled event is starting now!'}\n\n🕐 **Scheduled:** ${displayTime}`);
          } else {
            embed.setColor(0xFEE75C)
              .setTitle(`⏰ ${event.title} — Starting in ${message}!`)
              .setDescription(`${event.description || 'Get ready!'}\n\n🕐 **Starts:** ${displayTime}`);
          }
          embed.setFooter({ text: 'OTG Trading Academy | Session Alert' });

          await channel.send({ embeds: [embed] });
          markAlertSent(event.id, type);
          console.log(`Alert sent: ${type} for "${event.title}"`);
        } catch (err) {
          console.error(`Failed to send alert for event ${event.id}:`, err);
        }
      }
    } catch (err) {
      console.error('Scheduler loop error:', err);
    }
  }, 60 * 1000);
});

// ── Daily Check-In (disabled — no longer auto-posts) ────────────────────────
const checkin = require('./services/checkin');

// ── Auto-Post System (every 3 hours) ───────────────────────────────────────────
const autopost = require('./services/autopost');
const marketdata = require('./services/marketdata');

const AUTOPOST_CHANNELS = {
  'watcher-breakdown': '1474613738706571448',
  'world-news': '1474609901140578449',
  'large-cap': '1474611011204939878',
};

// Channels to keep in BOT / SCANNER category — delete any others
const KEEP_CHANNELS = ['watcher-breakdown', 'world-news', 'large-cap'];

const IMPACT_COLORS = {
  bullish: 0x57F287,
  bearish: 0xED4245,
  neutral: 0x99AAB5,
};

const IMPACT_EMOJI = {
  bullish: '🟢',
  bearish: '🔴',
  neutral: '⚪',
};

const CONFIDENCE_EMOJI = {
  high: '🔥',
  medium: '📊',
  low: '📌',
};

client.once('ready', async () => {
  // ── Channel cleanup: delete unlisted bot channels, create missing ones ──
  try {
    const guildId = process.env.DISCORD_GUILD_ID;
    if (guildId) {
      const guild = await client.guilds.fetch(guildId);
      const channels = await guild.channels.fetch();

      // Find the BOT / SCANNER category
      const { ChannelType } = require('discord.js');
      let botCategory = channels.find(ch =>
        ch && ch.type === ChannelType.GuildCategory &&
        ch.name.toLowerCase().includes('bot') && ch.name.toLowerCase().includes('scanner')
      );

      // If no category found, try just "bot" or "scanner"
      if (!botCategory) {
        botCategory = channels.find(ch =>
          ch && ch.type === ChannelType.GuildCategory &&
          (ch.name.toLowerCase().includes('bot') || ch.name.toLowerCase().includes('scanner'))
        );
      }

      if (botCategory) {
        console.log(`Found category: ${botCategory.name} (${botCategory.id})`);

        // Delete channels in this category that are NOT in the keep list
        const categoryChildren = channels.filter(ch =>
          ch && ch.parentId === botCategory.id && ch.type === ChannelType.GuildText
        );

        for (const [, ch] of categoryChildren) {
          if (!KEEP_CHANNELS.includes(ch.name)) {
            console.log(`Deleting unlisted channel: #${ch.name} (${ch.id})`);
            await ch.delete('Bot cleanup — channel not in BOT/SCANNER list');
          }
        }

        // Create missing channels
        for (const name of KEEP_CHANNELS) {
          const exists = channels.find(ch =>
            ch && ch.name === name && ch.parentId === botCategory.id
          );
          if (!exists) {
            const created = await guild.channels.create({
              name,
              type: ChannelType.GuildText,
              parent: botCategory.id,
            });
            console.log(`Created channel: #${name} (${created.id})`);
            // Update AUTOPOST_CHANNELS with new ID
            AUTOPOST_CHANNELS[name] = created.id;
          }
        }

        console.log('Bot channel cleanup complete');
      } else {
        console.log('BOT/SCANNER category not found — skipping channel cleanup');
      }
    }
  } catch (err) {
    console.error('Channel cleanup error:', err);
  }

  async function runAutoPost() {
    if (!autopost.shouldRun()) {
      console.log('Auto-post: Skipping — less than 1 hour since last run');
      return;
    }

    // Only post on weekends (Saturday=6, Sunday=0) in ET
    const now = new Date();
    const etDay = parseInt(now.toLocaleString('en-US', { weekday: 'narrow', timeZone: 'America/New_York' }).charAt(0));
    const etDayName = now.toLocaleString('en-US', { weekday: 'long', timeZone: 'America/New_York' });
    const dayOfWeek = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].indexOf(etDayName);
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      console.log(`Auto-post: Skipping — ${etDayName} is a weekday (weekend only)`);
      return;
    }

    console.log('Auto-post cycle starting...');
    autopost.markRan();
    const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/New_York' });
    const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'America/New_York' });

    const CHANNEL_LABELS = {
      'watcher-breakdown': '📡 Watcher Breakdown',
      'world-news': '🌍 World News',
      'large-cap': '💰 Large-Cap',
    };

    // Get current ET hour for time-based filtering
    const etHour = parseInt(now.toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: 'America/New_York' }));

    for (const [channelKey, channelId] of Object.entries(AUTOPOST_CHANNELS)) {
      try {
        const channel = await client.channels.fetch(channelId);
        if (!channel) {
          console.error(`Auto-post: Channel ${channelKey} (${channelId}) not found`);
          continue;
        }

        // Skip watcher-breakdown and large-cap after 8 PM ET
        if ((channelKey === 'watcher-breakdown' || channelKey === 'large-cap') && etHour >= 20) {
          console.log(`Auto-post: Skipping ${channelKey} — after 8 PM ET`);
          continue;
        }

        const label = CHANNEL_LABELS[channelKey] || channelKey;

        // Get AI-generated content
        const items = await autopost.generateChannelContent(channelKey);

        // For watcher-breakdown and world-news: only post if truly important
        if (!items && (channelKey === 'watcher-breakdown' || channelKey === 'world-news')) {
          console.log(`Auto-post: Nothing important for #${channelKey} — skipping`);
          continue;
        }

        // Build market data for large-cap and watcher-breakdown
        let marketSection = '';
        if (channelKey === 'large-cap') {
          try {
            const movers = await marketdata.getLargeCapMovers();
            if (movers.length > 0) {
              marketSection = movers.slice(0, 5).map(q => {
                const arrow = q.changePct >= 0 ? '📈' : '📉';
                return `${arrow} **${q.symbol}** $${q.price?.toFixed(2)} (${q.changePct >= 0 ? '+' : ''}${q.changePct?.toFixed(2)}%)`;
              }).join('\n');
            }
          } catch (err) {
            console.error('Yahoo Finance error:', err.message);
          }
        }
        if (channelKey === 'watcher-breakdown') {
          try {
            const indices = await marketdata.getMarketOverview();
            if (indices.length > 0) {
              marketSection = indices.map(q => {
                const arrow = (q.changePct || 0) >= 0 ? '📈' : '📉';
                const name = q.symbol === '^GSPC' ? 'S&P' : q.symbol === '^IXIC' ? 'NDX' : q.symbol === '^DJI' ? 'DOW' : q.symbol === '^VIX' ? 'VIX' : q.name;
                return `${arrow} ${name} ${q.price?.toFixed(2)} (${(q.changePct || 0) >= 0 ? '+' : ''}${q.changePct?.toFixed(2)}%)`;
              }).join(' · ');
            }
          } catch (err) {
            console.error('Yahoo Finance error:', err.message);
          }
        }

        // Build clean, compact embed
        let description = '';
        let hasBreaking = false;

        if (marketSection) {
          description += `${marketSection}\n\n`;
        }

        if (items) {
          for (const item of items) {
            const impactEmoji = IMPACT_EMOJI[item.impact] || '⚪';
            if (item.breaking && item.confidence === 'high') hasBreaking = true;
            const prefix = item.breaking ? '🚨 ' : '';
            description += `${prefix}**${item.title}** · \`${item.ticker}\` ${impactEmoji}\n${item.summary}\n\n`;
          }
        } else if (channelKey === 'large-cap') {
          description += 'No major large-cap moves this hour.';
        }

        if (description.length > 4000) description = description.substring(0, 4000) + '...';

        const embed = new EmbedBuilder()
          .setColor(hasBreaking ? 0xED4245 : 0x2B2D31)
          .setAuthor({ name: `${label} · ${timeStr} ET` })
          .setDescription(description.trim())
          .setTimestamp();

        // Add "Learn More" button if there are news items
        const components = [];
        if (items && items.length > 0) {
          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('news_learn_more')
              .setLabel('📖 Explain More')
              .setStyle(ButtonStyle.Secondary),
          );
          components.push(row);
        }

        let sentMsg;
        if (hasBreaking) {
          sentMsg = await channel.send({ content: '@here', embeds: [embed], components });
        } else {
          sentMsg = await channel.send({ embeds: [embed], components });
        }

        // Store context so the button handler can expand on it
        if (items && sentMsg) {
          client.newsContext.set(sentMsg.id, { items, channelKey, label: CHANNEL_LABELS[channelKey] || channelKey });
          // Clean up after 6 hours to avoid memory buildup
          setTimeout(() => client.newsContext.delete(sentMsg.id), 6 * 60 * 60 * 1000);
        }

        console.log(`Auto-post: posted to #${channelKey}`);
      } catch (err) {
        console.error(`Auto-post error for #${channelKey}:`, err);
      }

      // Small delay between channels to avoid rate limits
      await new Promise(r => setTimeout(r, 3000));
    }

    console.log('Auto-post cycle complete');
  }

  // Run first cycle 60s after startup, then check every 5 min (gates on 30-min cooldown)
  setTimeout(runAutoPost, 60 * 1000);
  setInterval(runAutoPost, 5 * 60 * 1000);
});

// ── Login ──────────────────────────────────────────────────────────────────────
client.login(process.env.DISCORD_TOKEN);
