const { Events, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags, ChannelType } = require('discord.js');
const { PORTFOLIO_SIZES, GAIN_LOSS_OPTIONS } = require('../utils/constants');
const embeds = require('../utils/embeds');
const db = require('../database/queries');
const { generateTradeReview, generateChartExplanation, generateAICoachResponse } = require('../services/anthropic');
const { getRandomQuestion, getQuestion } = require('../services/chartTraining');

// Temporary state for multi-step trade logging (keyed by user ID)
const tradeState = new Map();

function backRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('back_main').setLabel('Back to Menu').setStyle(ButtonStyle.Secondary),
  );
}

function mainMenuComponents() {
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('otg_academy').setLabel('👉 Enter OTG Academy').setStyle(ButtonStyle.Success),
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ai_coach_chat').setLabel('🤖 Ask AI Coach').setStyle(ButtonStyle.Secondary),
  );

  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('support_ticket').setLabel('🎫 Support Ticket').setStyle(ButtonStyle.Danger),
  );

  return [row1, row2, row3];
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

          const userMessage = interaction.fields.getTextInputValue('ai_coach_question');
          const discordId = interaction.user.id;

          const [stats, recentTrades] = await Promise.all([
            db.getTradeStats(discordId),
            db.getRecentTrades(discordId, 5),
          ]);

          const response = await generateAICoachResponse(userMessage, recentTrades, stats);

          await interaction.editReply({
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
      return;
    }

    // ── Button Interactions ──────────────────────────────────────────────────
    if (!interaction.isButton()) return;

    const discordId = interaction.user.id;
    const customId = interaction.customId;

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
          content: '**OTG Trading Academy**\nhttps://otg-academy-landing-page.netlify.app/',
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

      // — Back to Main Menu ———————————————————————————————————————————————
      if (customId === 'back_main') {
        await interaction.update({
          embeds: [embeds.tradeMenuEmbed()],
          components: mainMenuComponents(),
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
