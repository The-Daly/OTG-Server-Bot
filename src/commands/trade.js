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
    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('otg_academy').setLabel('👉 Enter OTG Academy').setStyle(ButtonStyle.Success),
    );

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ai_coach_chat').setLabel('🤖 Ask AI Coach').setStyle(ButtonStyle.Secondary),
    );

    const row3 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('support_ticket').setLabel('🎫 Support Ticket').setStyle(ButtonStyle.Danger),
    );

    await interaction.reply({
      embeds: [embeds.tradeMenuEmbed()],
      components: [row1, row2, row3],
      flags: MessageFlags.Ephemeral,
    });
  },
};
