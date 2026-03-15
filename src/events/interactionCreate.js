const { Events, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { PORTFOLIO_SIZES, GAIN_LOSS_OPTIONS } = require('../utils/constants');
const embeds = require('../utils/embeds');
const db = require('../database/queries');
const { generateTradeReview, generateChartExplanation, generateLessonReviewFeedback } = require('../services/anthropic');
const { getLesson } = require('../services/lessons');
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
    new ButtonBuilder().setCustomId('otg_academy').setLabel('🌐 OTG Academy').setStyle(ButtonStyle.Success),
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('trade_log').setLabel('📝 Log Trade').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('trade_review').setLabel('🔍 Review').setStyle(ButtonStyle.Primary),
  );

  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('chart_training').setLabel('📊 Chart Training').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('progress_dashboard').setLabel('🏆 Dashboard').setStyle(ButtonStyle.Secondary),
  );

  const row4 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('lesson_1').setLabel('Micro Lesson 1').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('lesson_2').setLabel('Micro Lesson 2').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('lesson_3').setLabel('Micro Lesson 3').setStyle(ButtonStyle.Secondary),
  );

  const row5 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('close_menu').setLabel('✖ Close').setStyle(ButtonStyle.Secondary),
  );

  return [row1, row2, row3, row4, row5];
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
        const reply = { content: 'Something went wrong. Please try again.', ephemeral: true };
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(reply);
        } else {
          await interaction.reply(reply);
        }
      }
      return;
    }

    // ── Button Interactions ──────────────────────────────────────────────────
    if (!interaction.isButton()) return;

    const discordId = interaction.user.id;
    const customId = interaction.customId;

    try {
      // — OTG Academy Link ——————————————————————————————————————————————
      if (customId === 'otg_academy') {
        await interaction.reply({
          content: '🌐 **OTG Trading Academy**\nhttps://otg-academy.netlify.app',
          ephemeral: true,
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

      // — Lessons ———————————————————————————————————————————————————————————
      if (customId.startsWith('lesson_') && !customId.startsWith('lesson_answer_')) {
        const lessonNumber = parseInt(customId.replace('lesson_', ''));
        const lesson = getLesson(lessonNumber);

        if (!lesson) {
          await interaction.update({ content: 'Lesson not found.', embeds: [], components: [] });
          return;
        }

        const row = new ActionRowBuilder().addComponents(
          ...lesson.reviewOptions.map(o =>
            new ButtonBuilder()
              .setCustomId(`lesson_answer_${lessonNumber}_${o.value}`)
              .setLabel(o.label)
              .setStyle(ButtonStyle.Primary)
          )
        );

        await interaction.update({
          embeds: [embeds.lessonEmbed(lesson)],
          components: [row, backRow()],
        });
        return;
      }

      // — Lesson Answer ————————————————————————————————————————————————————
      if (customId.startsWith('lesson_answer_')) {
        const parts = customId.replace('lesson_answer_', '').split('_');
        const lessonNumber = parseInt(parts[0]);
        const userAnswer = parts.slice(1).join('_');
        const lesson = getLesson(lessonNumber);

        if (!lesson) {
          await interaction.update({ content: 'Lesson not found.', embeds: [], components: [] });
          return;
        }

        await interaction.deferUpdate();

        const correctOption = lesson.reviewOptions.find(o => o.correct);
        const isCorrect = userAnswer === correctOption.value;
        const userLabel = lesson.reviewOptions.find(o => o.value === userAnswer)?.label || userAnswer;

        const feedback = await generateLessonReviewFeedback(lessonNumber, userLabel, correctOption.label);

        if (isCorrect) {
          await db.completeLesson(discordId, lessonNumber);
        }

        await interaction.editReply({
          embeds: [embeds.lessonResultEmbed(lessonNumber, isCorrect, feedback)],
          components: [backRow()],
        });
        return;
      }

      // — Progress Dashboard ———————————————————————————————————————————————
      if (customId === 'progress_dashboard') {
        await interaction.deferUpdate();

        const [user, stats, lessonProgress] = await Promise.all([
          db.getOrCreateUser(discordId),
          db.getTradeStats(discordId),
          db.getLessonProgress(discordId),
        ]);

        await interaction.editReply({
          embeds: [embeds.dashboardEmbed(user, stats, lessonProgress)],
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
