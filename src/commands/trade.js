const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const embeds = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('t')
    .setDescription('Open the OTG Trading Academy hub'),

  async execute(interaction) {
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

    await interaction.reply({
      embeds: [embeds.tradeMenuEmbed()],
      components: [row1, row2, row3, row4, row5],
      ephemeral: true,
    });
  },
};
