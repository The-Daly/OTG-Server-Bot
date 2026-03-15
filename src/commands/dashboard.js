const { SlashCommandBuilder } = require('discord.js');
const db = require('../database/queries');
const embeds = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('dashboard')
    .setDescription('View your OTG Trading Academy progress dashboard'),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const discordId = interaction.user.id;
      const [user, stats, lessonProgress] = await Promise.all([
        db.getOrCreateUser(discordId),
        db.getTradeStats(discordId),
        db.getLessonProgress(discordId),
      ]);

      await interaction.editReply({
        embeds: [embeds.dashboardEmbed(user, stats, lessonProgress)],
      });
    } catch (error) {
      console.error('Dashboard command error:', error);
      await interaction.editReply({ content: 'Failed to load your dashboard. Please try again.' });
    }
  },
};
