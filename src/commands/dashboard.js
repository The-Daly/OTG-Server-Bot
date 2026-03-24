const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const db = require('../database/queries');
const embeds = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('dashboard')
    .setDescription('View your OTG Trading Academy progress dashboard'),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      const discordId = interaction.user.id;
      const [user, stats] = await Promise.all([
        db.getOrCreateUser(discordId),
        db.getTradeStats(discordId),
      ]);

      await interaction.editReply({
        embeds: [embeds.dashboardEmbed(user, stats)],
      });
    } catch (error) {
      console.error('Dashboard command error:', error);
      await interaction.editReply({ content: 'Failed to load your dashboard. Please try again.' });
    }
  },
};
