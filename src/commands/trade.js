const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require('discord.js');
const embeds = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('otg')
    .setDescription('Open the OTG Trading Academy hub'),

  async execute(interaction) {
    const member = interaction.member;
    const isPremium = member.permissions.has('Administrator') ||
      member.roles.cache.some(r => r.name.toLowerCase().includes('executive') || r.name.toLowerCase().includes('premium'));

    if (isPremium) {
      // Full menu for Executive/Premium/Admin
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
      await interaction.reply({
        embeds: [embeds.tradeMenuEmbed()],
        components: [row1, row2, row3],
        flags: MessageFlags.Ephemeral,
      });
    } else {
      // Free members — Academy + Support Ticket only
      const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('otg_academy').setLabel('👉 Enter OTG Academy').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('support_ticket').setLabel('🎫 Support Ticket').setStyle(ButtonStyle.Danger),
      );
      await interaction.reply({
        embeds: [embeds.tradeMenuEmbed()],
        components: [row1],
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
