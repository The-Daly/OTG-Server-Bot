const { Events, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags, ChannelType } = require('discord.js');
const { PORTFOLIO_SIZES, GAIN_LOSS_OPTIONS } = require('../utils/constants');
const embeds = require('../utils/embeds');
const db = require('../database/queries');
const { generateTradeReview, generateChartExplanation, generateAICoachResponse, generateMarketNews } = require('../services/anthropic');
const { getRandomQuestion, getQuestion } = require('../services/chartTraining');
const { createEvent, getUpcomingEvents, getAllActiveEvents, cancelEvent, formatEventTime, TIMEZONE_OPTIONS } = require('../services/scheduler');
const { COLORS } = require('../utils/constants');
const { generateResearch } = require('../services/research');

// Temporary state for multi-step trade logging (keyed by user ID)
const tradeState = new Map();

// Helper to get timezone offset in ms
function getTimezoneOffset(timezone, date) {
  const utcStr = date.toLocaleString('en-US', { timeZone: 'UTC' });
  const tzStr = date.toLocaleString('en-US', { timeZone: timezone });
  return new Date(utcStr).getTime() - new Date(tzStr).getTime();
}

function backRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('back_main').setLabel('Back to Menu').setStyle(ButtonStyle.Secondary),
  );
}

function mainMenuComponents(isPremium = true) {
  if (isPremium) {
    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('otg_academy').setLabel('👉 Enter OTG Academy').setStyle(ButtonStyle.Success),
    );
    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('daily_checkin').setLabel('📋 Daily Check-In').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('support_ticket').setLabel('🎫 Support Ticket').setStyle(ButtonStyle.Danger),
    );
    const row3 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ai_coach_chat').setLabel('🤖 Ask AI Coach').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('market_news').setLabel('📰 Market News').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('custom_research').setLabel('🔎 Research').setStyle(ButtonStyle.Secondary),
    );
    return [row1, row2, row3];
  } else {
    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('otg_academy').setLabel('👉 Enter OTG Academy').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('support_ticket').setLabel('🎫 Support Ticket').setStyle(ButtonStyle.Danger),
    );
    return [row1];
  }
}

// Check if user has Executive, Premium, or Admin access
function hasOtgAccess(member) {
  if (!member) return false;
  if (member.permissions.has('Administrator')) return true;
  return member.roles.cache.some(r =>
    r.name.toLowerCase().includes('executive') || r.name.toLowerCase().includes('premium')
  );
}

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    // ── Slash Commands ───────────────────────────────────────────────────────
    if (interaction.isChatInputCommand()) {
      const command = interaction.client.commands.get(interaction.commandName);
      if (!command) return;

      try {
        await command.execute(interaction);
      } catch (error) {
        console.error(`Error executing ${interaction.commandName}:`, error);
        const reply = { content: 'Something went wrong. Please try again.', flags: MessageFlags.Ephemeral };
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(reply);
        } else {
          await interaction.reply(reply);
        }
      }
      return;
    }

    // ── Modal Submissions ────────────────────────────────────────────────────
    if (interaction.isModalSubmit()) {
      if (interaction.customId === 'ai_coach_modal') {
        try {
          await interaction.deferReply({ flags: MessageFlags.Ephemeral });
          await interaction.editReply({ content: '🤖 **Thinking...** This may take up to 45 seconds.' });

          const userMessage = interaction.fields.getTextInputValue('ai_coach_question');
          const discordId = interaction.user.id;

          const [stats, recentTrades] = await Promise.all([
            db.getTradeStats(discordId),
            db.getRecentTrades(discordId, 5),
          ]);

          const response = await generateAICoachResponse(userMessage, recentTrades, stats);

          await interaction.editReply({
            content: '',
            embeds: [embeds.aiCoachEmbed(userMessage, response)],
          });
        } catch (error) {
          console.error('AI Coach modal error:', error);
          try {
            const reply = { content: 'Something went wrong getting a response. Please try again.', flags: MessageFlags.Ephemeral };
            if (interaction.deferred || interaction.replied) {
              await interaction.editReply(reply);
            } else {
              await interaction.reply(reply);
            }
          } catch { /* interaction expired */ }
        }
      }

      if (interaction.customId === 'custom_research_modal') {
        try {
          await interaction.deferReply({ flags: MessageFlags.Ephemeral });
          await interaction.editReply({ content: '🔎 **Researching...** Pulling data from Yahoo Finance, StockTwits, SEC filings & more. This may take up to 60 seconds.' });

          const query = interaction.fields.getTextInputValue('research_query');
          const result = await generateResearch(query);

          // Discord embed max is 4096 chars for description
          let desc = result.response;
          if (desc.length > 4000) desc = desc.substring(0, 4000) + '...';

          const { EmbedBuilder } = require('discord.js');
          const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle(`🔎 Research: ${query.length > 50 ? query.substring(0, 50) + '...' : query}`)
            .setDescription(desc)
            .setFooter({ text: 'OTG Trading Academy | Sources: Yahoo Finance, StockTwits, SEC EDGAR, Finviz' })
            .setTimestamp();

          await interaction.editReply({
            content: '',
            embeds: [embed],
          });
        } catch (error) {
          console.error('Research modal error:', error);
          try {
            const reply = { content: 'Something went wrong with the research. Please try again.', flags: MessageFlags.Ephemeral };
            if (interaction.deferred || interaction.replied) {
              await interaction.editReply(reply);
            } else {
              await interaction.reply(reply);
            }
          } catch { /* interaction expired */ }
        }
      }

      if (interaction.customId === 'react_emojis_modal') {
        try {
          await interaction.deferReply({ flags: MessageFlags.Ephemeral });

          const messageId = interaction.fields.getTextInputValue('react_message_id').trim();

          // Get all custom emojis from the server
          const serverEmojis = interaction.guild.emojis.cache.filter(e => e.available);

          if (serverEmojis.size < 3) {
            await interaction.editReply({ content: 'This server needs at least 3 custom emojis for this feature.' });
            return;
          }

          // Pick 3 random unique emojis
          const emojiArray = [...serverEmojis.values()];
          const picked = [];
          while (picked.length < 3) {
            const rand = emojiArray[Math.floor(Math.random() * emojiArray.length)];
            if (!picked.includes(rand)) picked.push(rand);
          }

          // Search all text channels in the guild for the message
          let message = null;
          const textChannels = interaction.guild.channels.cache.filter(
            ch => ch.type === ChannelType.GuildText || ch.type === ChannelType.GuildAnnouncement
          );

          for (const [, channel] of textChannels) {
            try {
              message = await channel.messages.fetch(messageId);
              if (message) break;
            } catch {
              // Not in this channel, try next
            }
          }

          if (!message) {
            await interaction.editReply({ content: 'Could not find that message in any channel. Double-check the message ID.' });
            return;
          }

          for (const emoji of picked) {
            await message.react(emoji);
          }

          await interaction.editReply({
            content: `Reacted to message in #${message.channel.name} with ${picked.map(e => e.toString()).join(' ')}`,
          });
        } catch (error) {
          console.error('React modal error:', error);
          try {
            const reply = { content: 'Something went wrong adding reactions. Please try again.' };
            if (interaction.deferred || interaction.replied) {
              await interaction.editReply(reply);
            } else {
              await interaction.reply({ ...reply, flags: MessageFlags.Ephemeral });
            }
          } catch { /* interaction expired */ }
        }
      }

      if (interaction.customId === 'support_ticket_modal') {
        try {
          await interaction.deferReply({ flags: MessageFlags.Ephemeral });

          const subject = interaction.fields.getTextInputValue('ticket_subject');
          const description = interaction.fields.getTextInputValue('ticket_description');
          const user = interaction.user;

          const supportChannelId = process.env.SUPPORT_CHANNEL_ID;
          if (!supportChannelId) {
            await interaction.editReply({ content: 'Support tickets are not configured yet. Please contact an admin.' });
            return;
          }

          const supportChannel = await interaction.guild.channels.fetch(supportChannelId);
          if (!supportChannel) {
            await interaction.editReply({ content: 'Support channel not found. Please contact an admin.' });
            return;
          }

          // Post the ticket message in the support channel
          const { EmbedBuilder } = require('discord.js');
          const ticketEmbed = new EmbedBuilder()
            .setColor(0xff4444)
            .setTitle(`🎫 Support Ticket: ${subject}`)
            .setDescription(description)
            .addFields(
              { name: 'Submitted by', value: `<@${user.id}>`, inline: true },
              { name: 'Status', value: '🟡 Open', inline: true },
            )
            .setFooter({ text: `User ID: ${user.id}` })
            .setTimestamp();

          const ticketMessage = await supportChannel.send({
            content: `📢 **New Support Ticket** from <@${user.id}>`,
            embeds: [ticketEmbed],
          });

          // Create a private thread on the ticket message
          const thread = await ticketMessage.startThread({
            name: `🎫 ${subject} — ${user.username}`,
            autoArchiveDuration: 1440, // 24 hours
            reason: `Support ticket from ${user.tag}`,
          });

          // Send an initial message in the thread and ping the user
          await thread.send(`<@${user.id}> Your support ticket has been created. A team member will be with you shortly.\n\n**Subject:** ${subject}\n**Description:** ${description}`);

          await interaction.editReply({
            content: `✅ Your support ticket has been created! Head to <#${thread.id}> to follow up.`,
          });
        } catch (error) {
          console.error('Support ticket error:', error);
          try {
            const reply = { content: 'Something went wrong creating your ticket. Please try again.' };
            if (interaction.deferred || interaction.replied) {
              await interaction.editReply(reply);
            } else {
              await interaction.reply({ ...reply, flags: MessageFlags.Ephemeral });
            }
          } catch { /* interaction expired */ }
        }
      }

      // — Schedule Event Modal ————————————————————————————————————————————
      if (interaction.customId === 'schedule_event_modal') {
        try {
          await interaction.deferReply({ flags: MessageFlags.Ephemeral });

          const title = interaction.fields.getTextInputValue('event_title');
          const description = interaction.fields.getTextInputValue('event_description');
          const dateTimeStr = interaction.fields.getTextInputValue('event_datetime');
          const channelId = interaction.fields.getTextInputValue('event_channel_id').trim();
          const tzInput = interaction.fields.getTextInputValue('event_timezone').trim().toLowerCase();

          // Match timezone
          const tzMap = {
            'et': 'America/New_York', 'eastern': 'America/New_York', 'est': 'America/New_York', 'edt': 'America/New_York',
            'ct': 'America/Chicago', 'central': 'America/Chicago', 'cst': 'America/Chicago', 'cdt': 'America/Chicago',
            'mt': 'America/Denver', 'mountain': 'America/Denver', 'mst': 'America/Denver', 'mdt': 'America/Denver',
            'pt': 'America/Los_Angeles', 'pacific': 'America/Los_Angeles', 'pst': 'America/Los_Angeles', 'pdt': 'America/Los_Angeles',
            'utc': 'UTC', 'gmt': 'Europe/London', 'london': 'Europe/London',
          };
          const timezone = tzMap[tzInput] || tzInput || 'America/New_York';

          // Parse date/time — expect "MM/DD/YYYY HH:MM" or "YYYY-MM-DD HH:MM"
          let eventDate;
          try {
            // Try to parse with timezone context
            const dateStr = dateTimeStr.trim();
            const tempDate = new Date(dateStr);
            if (isNaN(tempDate.getTime())) {
              // Try MM/DD/YYYY HH:MM format
              const match = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})/);
              if (match) {
                const [, month, day, year, hour, minute] = match;
                const localStr = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${hour.padStart(2, '0')}:${minute}:00`;
                eventDate = new Date(new Date(localStr).toLocaleString('en-US', { timeZone: timezone }));
                // Convert local time in timezone to UTC
                const formatter = new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
                // Use a different approach: create date assuming the input is in the given timezone
                const utcDate = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${hour.padStart(2, '0')}:${minute}:00`);
                const utcOffset = getTimezoneOffset(timezone, utcDate);
                eventDate = new Date(utcDate.getTime() + utcOffset);
              } else {
                throw new Error('Invalid date format');
              }
            } else {
              eventDate = tempDate;
            }
          } catch {
            await interaction.editReply({ content: 'Invalid date format. Use `MM/DD/YYYY HH:MM` (e.g. `03/25/2026 09:30`).' });
            return;
          }

          if (isNaN(eventDate.getTime())) {
            await interaction.editReply({ content: 'Invalid date format. Use `MM/DD/YYYY HH:MM` (e.g. `03/25/2026 09:30`).' });
            return;
          }

          // Verify channel exists
          try {
            await interaction.guild.channels.fetch(channelId);
          } catch {
            await interaction.editReply({ content: `Could not find channel with ID \`${channelId}\`. Right-click a channel → Copy Channel ID.` });
            return;
          }

          const event = createEvent({
            title,
            description,
            dateTime: eventDate.toISOString(),
            timezone,
            channelId,
            createdBy: interaction.user.id,
          });

          const displayTime = formatEventTime(event.dateTime, timezone);

          const { EmbedBuilder } = require('discord.js');
          const embed = new EmbedBuilder()
            .setColor(0x57F287)
            .setTitle('✅ Event Scheduled')
            .addFields(
              { name: 'Title', value: title },
              { name: 'When', value: displayTime },
              { name: 'Channel', value: `<#${channelId}>` },
              { name: 'Description', value: description || 'No description' },
              { name: 'Alerts', value: '30 min before, 5 min before, and at start' },
            )
            .setFooter({ text: `Event ID: ${event.id}` })
            .setTimestamp();

          await interaction.editReply({ embeds: [embed] });
        } catch (error) {
          console.error('Schedule modal error:', error);
          try {
            const reply = { content: 'Something went wrong creating the event. Please try again.' };
            if (interaction.deferred || interaction.replied) {
              await interaction.editReply(reply);
            } else {
              await interaction.reply({ ...reply, flags: MessageFlags.Ephemeral });
            }
          } catch { /* interaction expired */ }
        }
      }

      // — Cancel Event Modal —————————————————————————————————————————————
      if (interaction.customId === 'schedule_cancel_modal') {
        try {
          await interaction.deferReply({ flags: MessageFlags.Ephemeral });
          const eventId = interaction.fields.getTextInputValue('cancel_event_id').trim();

          const success = cancelEvent(eventId);
          if (success) {
            await interaction.editReply({ content: `✅ Event \`${eventId}\` has been cancelled.` });
          } else {
            await interaction.editReply({ content: `Could not find active event with ID \`${eventId}\`.` });
          }
        } catch (error) {
          console.error('Cancel event error:', error);
          try {
            if (interaction.deferred || interaction.replied) {
              await interaction.editReply({ content: 'Something went wrong. Please try again.' });
            }
          } catch { /* expired */ }
        }
      }
      return;
    }

    // ── Button Interactions ──────────────────────────────────────────────────
    if (!interaction.isButton()) return;

    const discordId = interaction.user.id;
    const customId = interaction.customId;

    // Free users can use academy + support ticket, everything else requires Premium/Executive
    const freeButtons = ['otg_academy', 'support_ticket', 'news_learn_more'];
    if (!freeButtons.includes(customId) && !hasOtgAccess(interaction.member)) {
      await interaction.reply({
        content: '🔒 This feature is only available to **Executive** and **Premium** members. Upgrade to unlock AI Coach, Market News, Research & more!',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    try {
      // — AI Coach Chat ——————————————————————————————————————————————————
      if (customId === 'ai_coach_chat') {
        const modal = new ModalBuilder()
          .setCustomId('ai_coach_modal')
          .setTitle('🤖 OTG AI Trading Coach');

        const input = new TextInputBuilder()
          .setCustomId('ai_coach_question')
          .setLabel('What would you like to discuss?')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('e.g. How do I improve my win rate? What is risk management?')
          .setRequired(true)
          .setMaxLength(500);

        modal.addComponents(new ActionRowBuilder().addComponents(input));
        await interaction.showModal(modal);
        return;
      }

      // — React to Post ————————————————————————————————————————————
      if (customId === 'react_emojis') {
        const modal = new ModalBuilder()
          .setCustomId('react_emojis_modal')
          .setTitle('😎 React to a Post');

        const input = new TextInputBuilder()
          .setCustomId('react_message_id')
          .setLabel('Message ID (right-click message → Copy ID)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('e.g. 1234567890123456789')
          .setRequired(true)
          .setMaxLength(25);

        modal.addComponents(new ActionRowBuilder().addComponents(input));
        await interaction.showModal(modal);
        return;
      }

      // — Daily Check-In ————————————————————————————————————————————————
      if (customId === 'daily_checkin') {
        const checkinService = require('../services/checkin');
        const biasButtons = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('checkin_bullish').setLabel('🟢 Bullish').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId('checkin_bearish').setLabel('🔴 Bearish').setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId('checkin_neutral').setLabel('⚪ Neutral').setStyle(ButtonStyle.Secondary),
        );

        const userData = checkinService.getUserData(discordId);
        const streak = userData.streak || 0;
        const xp = userData.xp || 0;

        const { EmbedBuilder } = require('discord.js');
        const embed = new EmbedBuilder()
          .setColor(0x5865F2)
          .setTitle('📋 Daily Check-In')
          .setDescription(
            'What\'s your market bias today?\n\n' +
            `🔥 **Current Streak:** ${streak} day${streak !== 1 ? 's' : ''}\n` +
            `⭐ **Total XP:** ${xp}\n\n` +
            'Select your bias below to check in and earn XP!'
          )
          .setFooter({ text: 'OTG Trading Academy | 1 check-in per day' })
          .setTimestamp();

        await interaction.reply({
          embeds: [embed],
          components: [biasButtons],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      // — Check-In Bias Selection ——————————————————————————————————————————
      if (customId.startsWith('checkin_')) {
        const checkinService = require('../services/checkin');
        const bias = customId.replace('checkin_', '');

        const result = checkinService.processCheckin(discordId, bias);

        const { EmbedBuilder } = require('discord.js');

        if (result.alreadyCheckedIn) {
          await interaction.reply({
            content: '⚠️ You\'ve already checked in today! Come back tomorrow.',
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        const biasLabels = { bullish: '🟢 Bullish', bearish: '🔴 Bearish', neutral: '⚪ Neutral' };
        const streakEmoji = result.streak >= 30 ? '👑' : result.streak >= 7 ? '🔥' : result.streak >= 3 ? '⚡' : '✅';

        let streakBonus = '';
        if (result.streak === 3) streakBonus = '\n🎁 **3-day streak bonus!** Extra XP unlocked!';
        if (result.streak === 7) streakBonus = '\n🎁 **7-day streak!** Bonus XP activated!';
        if (result.streak === 30) streakBonus = '\n👑 **30-day streak!** VIP status earned!';

        const sentiment = checkinService.getTodaySentiment();

        const embed = new EmbedBuilder()
          .setColor(bias === 'bullish' ? 0x57F287 : bias === 'bearish' ? 0xED4245 : 0x99AAB5)
          .setTitle(`${streakEmoji} You checked in!`)
          .setDescription(
            `**Streak:** ${result.streak} day${result.streak !== 1 ? 's' : ''}\n` +
            `**XP Earned:** +${result.xpGain} XP (Total: ${result.xp})\n` +
            `**Today's Bias:** ${biasLabels[bias]}` +
            streakBonus +
            `\n\n📊 **Community Sentiment:**\n` +
            `🟢 Bullish: ${sentiment.bullishPct}%\n` +
            `🔴 Bearish: ${sentiment.bearishPct}%\n` +
            `⚪ Neutral: ${sentiment.neutralPct}%`
          )
          .setFooter({ text: 'OTG Trading Academy | Daily Check-In' })
          .setTimestamp();

        await interaction.reply({
          embeds: [embed],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      // — Schedule: Create Event ——————————————————————————————————————————
      if (customId === 'schedule_create') {
        const modal = new ModalBuilder()
          .setCustomId('schedule_event_modal')
          .setTitle('➕ Schedule a Trading Event');

        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('event_title')
              .setLabel('Event Title')
              .setStyle(TextInputStyle.Short)
              .setPlaceholder('e.g. Live Trading Session, Market Open Alert')
              .setRequired(true)
              .setMaxLength(100)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('event_description')
              .setLabel('Description')
              .setStyle(TextInputStyle.Paragraph)
              .setPlaceholder('Details about the event...')
              .setRequired(false)
              .setMaxLength(500)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('event_datetime')
              .setLabel('Date & Time (MM/DD/YYYY HH:MM)')
              .setStyle(TextInputStyle.Short)
              .setPlaceholder('e.g. 03/25/2026 09:30')
              .setRequired(true)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('event_timezone')
              .setLabel('Timezone (ET, CT, MT, PT, UTC)')
              .setStyle(TextInputStyle.Short)
              .setPlaceholder('ET')
              .setValue('ET')
              .setRequired(true)
              .setMaxLength(20)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('event_channel_id')
              .setLabel('Alert Channel ID (right-click → Copy ID)')
              .setStyle(TextInputStyle.Short)
              .setPlaceholder('e.g. 1234567890123456789')
              .setRequired(true)
              .setMaxLength(25)
          ),
        );
        await interaction.showModal(modal);
        return;
      }

      // — Schedule: View All Events ————————————————————————————————————————
      if (customId === 'schedule_view') {
        const events = getAllActiveEvents();
        const { EmbedBuilder } = require('discord.js');

        const embed = new EmbedBuilder()
          .setColor(COLORS.PRIMARY)
          .setTitle('📋 All Scheduled Events')
          .setTimestamp();

        if (events.length === 0) {
          embed.setDescription('No events scheduled. Use **➕ Create Event** to add one.');
        } else {
          const list = events.map((e, i) => {
            const time = formatEventTime(e.dateTime, e.timezone);
            const status = new Date(e.dateTime) < new Date() ? '🔴 Past' : '🟢 Upcoming';
            return `**${i + 1}. ${e.title}** — ${status}\n> ${time}\n> Channel: <#${e.channelId}> | ID: \`${e.id}\``;
          }).join('\n\n');
          embed.setDescription(list);
        }

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        return;
      }

      // — Schedule: Cancel Event ——————————————————————————————————————————
      if (customId === 'schedule_cancel') {
        const events = getAllActiveEvents();

        if (events.length === 0) {
          await interaction.reply({ content: 'No active events to cancel.', flags: MessageFlags.Ephemeral });
          return;
        }

        const modal = new ModalBuilder()
          .setCustomId('schedule_cancel_modal')
          .setTitle('❌ Cancel an Event');

        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('cancel_event_id')
              .setLabel('Event ID (use /schedule → View All to find it)')
              .setStyle(TextInputStyle.Short)
              .setPlaceholder('e.g. m1abc2def')
              .setRequired(true)
              .setMaxLength(20)
          ),
        );
        await interaction.showModal(modal);
        return;
      }

      // — Custom Research ——————————————————————————————————————————————
      if (customId === 'custom_research') {
        const modal = new ModalBuilder()
          .setCustomId('custom_research_modal')
          .setTitle('🔎 Market Research');

        const input = new TextInputBuilder()
          .setCustomId('research_query')
          .setLabel('What do you want to research?')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('e.g. NVDA earnings outlook, oil sector analysis, $TSLA support levels, crypto market...')
          .setRequired(true)
          .setMaxLength(500);

        modal.addComponents(new ActionRowBuilder().addComponents(input));
        await interaction.showModal(modal);
        return;
      }

      // — Market News ———————————————————————————————————————————————————
      if (customId === 'market_news') {
        await interaction.deferUpdate();
        await interaction.editReply({
          content: '📰 **Fetching market news...** This may take up to 45 seconds.',
          embeds: [],
          components: [],
        });

        const news = await generateMarketNews();

        const refreshRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('market_news').setLabel('🔄 Refresh News').setStyle(ButtonStyle.Primary),
        );

        await interaction.editReply({
          content: '',
          embeds: [embeds.marketNewsEmbed(news)],
          components: [refreshRow, backRow()],
        });
        return;
      }

      // — Support Ticket ————————————————————————————————————————————————
      if (customId === 'support_ticket') {
        const modal = new ModalBuilder()
          .setCustomId('support_ticket_modal')
          .setTitle('🎫 Submit a Support Ticket');

        const subjectInput = new TextInputBuilder()
          .setCustomId('ticket_subject')
          .setLabel('Subject')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Brief summary of your issue')
          .setRequired(true)
          .setMaxLength(100);

        const descInput = new TextInputBuilder()
          .setCustomId('ticket_description')
          .setLabel('Description')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Describe your issue in detail...')
          .setRequired(true)
          .setMaxLength(1000);

        modal.addComponents(
          new ActionRowBuilder().addComponents(subjectInput),
          new ActionRowBuilder().addComponents(descInput),
        );
        await interaction.showModal(modal);
        return;
      }

      // — OTG Academy Link ——————————————————————————————————————————————
      if (customId === 'otg_academy') {
        await interaction.reply({
          content: '**OTG Trading Academy**\nhttps://otg-academy.base44.app/',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      // — Close Menu ————————————————————————————————————————————————————
      if (customId === 'close_menu') {
        await interaction.update({
          content: 'Menu closed. Use `/t` to open again.',
          embeds: [],
          components: [],
        });
        return;
      }

      // — News Learn More (auto-post button) ————————————————————————————————
      if (customId === 'news_learn_more') {
        try {
          await interaction.deferReply({ flags: MessageFlags.Ephemeral });

          const msgId = interaction.message.id;
          const ctx = interaction.client.newsContext?.get(msgId);

          if (!ctx || !ctx.items || ctx.items.length === 0) {
            await interaction.editReply({ content: 'This update has expired. Check the next hourly post for fresh news.' });
            return;
          }

          await interaction.editReply({ content: '📖 **Pulling more details...** This may take up to 45 seconds.' });

          // Build a prompt from the stored items
          const summaries = ctx.items.map(i => `- ${i.title} (${i.ticker}): ${i.summary}`).join('\n');
          const prompt = `The user wants MORE DETAIL on these market updates. For each item give a deeper analysis — explain WHY it matters, what traders should watch for, key price levels, and any related catalysts. Be specific with numbers.\n\nItems:\n${summaries}\n\nGive a detailed but concise breakdown for each item. Use bold headers.`;

          const BASE44_URL = 'https://trade-mind-ai-copy-45442b24.base44.app/functions';
          const resp = await fetch(`${BASE44_URL}/answerTradingQuestion`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question: prompt, context: `You are a senior market analyst for OTG Trading Academy. Provide actionable trading insights. Channel: ${ctx.label}` }),
          });

          let answer = 'Could not fetch additional details right now. Try again later.';
          if (resp.ok) {
            const data = await resp.json();
            answer = data.answer || data.response || data.text || String(data);
          }

          if (answer.length > 4000) answer = answer.substring(0, 4000) + '...';

          const { EmbedBuilder } = require('discord.js');
          const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle(`📖 ${ctx.label} — Deep Dive`)
            .setDescription(answer)
            .setFooter({ text: 'OTG Trading Academy | AI-Powered Analysis' })
            .setTimestamp();

          await interaction.editReply({ content: '', embeds: [embed] });
        } catch (error) {
          console.error('News learn more error:', error);
          try {
            if (interaction.deferred || interaction.replied) {
              await interaction.editReply({ content: 'Something went wrong. Please try again.' });
            }
          } catch { /* expired */ }
        }
        return;
      }

      // — Back to Main Menu ———————————————————————————————————————————————
      if (customId === 'back_main') {
        await interaction.update({
          embeds: [embeds.tradeMenuEmbed()],
          components: mainMenuComponents(hasOtgAccess(interaction.member)),
        });
        return;
      }

      // — Trade Log Step 1: Portfolio Size ——————————————————————————————————
      if (customId === 'trade_log') {
        const row = new ActionRowBuilder().addComponents(
          ...PORTFOLIO_SIZES.map(s =>
            new ButtonBuilder()
              .setCustomId(`portfolio_${s.value}`)
              .setLabel(s.label)
              .setStyle(ButtonStyle.Primary)
          )
        );

        await interaction.update({
          embeds: [embeds.tradeLogStep1Embed()],
          components: [row, backRow()],
        });
        return;
      }

      // — Trade Log Step 2: Gain/Loss ——————————————————————————————————————
      if (customId.startsWith('portfolio_')) {
        const portfolioSize = customId.replace('portfolio_', '');
        tradeState.set(discordId, { portfolioSize: parseInt(portfolioSize) });

        const gainRow = new ActionRowBuilder().addComponents(
          ...GAIN_LOSS_OPTIONS.slice(0, 4).map(o =>
            new ButtonBuilder()
              .setCustomId(`gainloss_${o.value}`)
              .setLabel(o.label)
              .setStyle(ButtonStyle.Success)
          )
        );

        const lossRow = new ActionRowBuilder().addComponents(
          ...GAIN_LOSS_OPTIONS.slice(4).map(o =>
            new ButtonBuilder()
              .setCustomId(`gainloss_${o.value}`)
              .setLabel(o.label)
              .setStyle(ButtonStyle.Danger)
          )
        );

        await interaction.update({
          embeds: [embeds.tradeLogStep2Embed(portfolioSize)],
          components: [gainRow, lossRow, backRow()],
        });
        return;
      }

      // — Trade Log Final: Save ———————————————————————————————————————————
      if (customId.startsWith('gainloss_')) {
        const gainLoss = parseInt(customId.replace('gainloss_', ''));
        const state = tradeState.get(discordId);

        if (!state) {
          await interaction.update({
            content: 'Session expired. Please use `/t` to start again.',
            embeds: [],
            components: [],
          });
          return;
        }

        await db.logTrade(discordId, state.portfolioSize, gainLoss);
        tradeState.delete(discordId);

        await interaction.update({
          embeds: [embeds.tradeLogSuccessEmbed(state.portfolioSize, gainLoss)],
          components: [backRow()],
        });
        return;
      }

      // — Trade Review ——————————————————————————————————————————————————————
      if (customId === 'trade_review') {
        await interaction.deferUpdate();

        const [stats, recentTrades] = await Promise.all([
          db.getTradeStats(discordId),
          db.getRecentTrades(discordId, 10),
        ]);

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('ai_review')
            .setLabel('Get AI Feedback')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(stats.totalTrades === 0),
        );

        await interaction.editReply({
          embeds: [embeds.reviewEmbed(stats, recentTrades)],
          components: [row, backRow()],
        });
        return;
      }

      // — AI Review Feedback ———————————————————————————————————————————————
      if (customId === 'ai_review') {
        await interaction.deferUpdate();

        const [stats, recentTrades] = await Promise.all([
          db.getTradeStats(discordId),
          db.getRecentTrades(discordId, 10),
        ]);

        const feedback = await generateTradeReview(stats, recentTrades);

        await interaction.editReply({
          embeds: [embeds.reviewEmbed(stats, recentTrades), embeds.aiReviewEmbed(feedback)],
          components: [backRow()],
        });
        return;
      }

      // — Chart Training ———————————————————————————————————————————————————
      if (customId === 'chart_training') {
        const question = getRandomQuestion();

        const row = new ActionRowBuilder().addComponents(
          ...question.options.map(o =>
            new ButtonBuilder()
              .setCustomId(`chart_${question.id}_${o.value}`)
              .setLabel(o.label)
              .setStyle(ButtonStyle.Primary)
          )
        );

        await interaction.update({
          embeds: [embeds.chartQuestionEmbed(question)],
          components: [row, backRow()],
        });
        return;
      }

      // — Chart Answer ——————————————————————————————————————————————————————
      if (customId.startsWith('chart_')) {
        const parts = customId.split('_');
        const answer = parts[parts.length - 1];
        const questionId = parts.slice(1, -1).join('_');
        const question = getQuestion(questionId);

        if (!question) {
          await interaction.update({ content: 'Question not found.', embeds: [], components: [] });
          return;
        }

        await interaction.deferUpdate();

        const isCorrect = answer === question.correctAnswer;
        const answerLabel = question.options.find(o => o.value === answer)?.label || answer;
        const correctLabel = question.options.find(o => o.value === question.correctAnswer)?.label || question.correctAnswer;

        const explanation = await generateChartExplanation(question.question, correctLabel, answerLabel);
        await db.updateUserXP(discordId, isCorrect ? 15 : 5);

        const retryRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('chart_training')
            .setLabel('Next Question')
            .setStyle(ButtonStyle.Primary),
        );

        await interaction.editReply({
          embeds: [embeds.chartResultEmbed(isCorrect, explanation)],
          components: [retryRow, backRow()],
        });
        return;
      }

      // — Progress Dashboard ———————————————————————————————————————————————
      if (customId === 'progress_dashboard') {
        await interaction.deferUpdate();

        const [user, stats] = await Promise.all([
          db.getOrCreateUser(discordId),
          db.getTradeStats(discordId),
        ]);

        await interaction.editReply({
          embeds: [embeds.dashboardEmbed(user, stats)],
          components: [backRow()],
        });
        return;
      }

    } catch (error) {
      console.error('Interaction error:', error);
      const reply = { content: 'Something went wrong. Please try again.', embeds: [], components: [] };
      try {
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply(reply);
        } else {
          await interaction.update(reply);
        }
      } catch {
        // Interaction may have expired
      }
    }
  },
};
