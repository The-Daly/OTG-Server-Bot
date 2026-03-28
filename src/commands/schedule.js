const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  MessageFlags,
  EmbedBuilder,
} = require('discord.js');
const { COLORS } = require('../utils/constants');
const { getUpcomingEvents, formatEventTime } = require('../services/scheduler');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('schedule')
    .setDescription('Manage trading session schedules (Admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const events = getUpcomingEvents();

    const embed = new EmbedBuilder()
      .setColor(COLORS.PRIMARY)
      .setTitle('📅 OTG Session Scheduler')
      .setDescription(
        'Schedule trading sessions, market alerts, and live events.\n' +
        'Members get notified **30 min**, **5 min** before, and **at start**.\n\n' +
        `**Upcoming Events:** ${events.length === 0 ? 'None scheduled' : ''}`
      )
      .setFooter({ text: 'Admin Only | OTG Trading Academy' })
      .setTimestamp();

    if (events.length > 0) {
      const eventList = events.slice(0, 10).map((e, i) => {
        const time = formatEventTime(e.dateTime, e.timezone);
        return `**${i + 1}.** ${e.title}\n> ${time} — <#${e.channelId}>`;
      }).join('\n\n');
      embed.addFields({ name: 'Scheduled Events', value: eventList });
    }

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('schedule_create').setLabel('➕ Create Event').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('schedule_view').setLabel('📋 View All').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('schedule_cancel').setLabel('❌ Cancel Event').setStyle(ButtonStyle.Danger),
    );

    await interaction.reply({
      embeds: [embed],
      components: [row1],
      flags: MessageFlags.Ephemeral,
    });
  },
};
