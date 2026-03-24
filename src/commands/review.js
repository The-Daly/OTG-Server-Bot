const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const db = require('../database/queries');
const embeds = require('../utils/embeds');
const { generateTradeReview } = require('../services/anthropic');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('review')
    .setDescription('Review your trading performance and get AI feedback'),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      const discordId = interaction.user.id;
      const [stats, recentTrades] = await Promise.all([
        db.getTradeStats(discordId),
        db.getRecentTrades(discordId, 10),
      ]);

      const reviewEmbedMsg = embeds.reviewEmbed(stats, recentTrades);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('ai_review')
          .setLabel('Get AI Feedback')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(stats.totalTrades === 0),
      );

      await interaction.editReply({
        embeds: [reviewEmbedMsg],
        components: [row],
      });
    } catch (error) {
      console.error('Review command error:', error);
      await interaction.editReply({ content: 'Failed to load your trade review. Please try again.' });
    }
  },
};
