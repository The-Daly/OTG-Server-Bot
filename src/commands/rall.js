const { SlashCommandBuilder, MessageFlags, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rall')
    .setDescription('Toggle auto-react on all new messages (Admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const current = interaction.client.autoReactEnabled || false;
    interaction.client.autoReactEnabled = !current;

    await interaction.reply({
      content: `Auto-react is now **${!current ? 'ON' : 'OFF'}**`,
      flags: MessageFlags.Ephemeral,
    });
  },
};
