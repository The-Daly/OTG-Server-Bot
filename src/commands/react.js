const { SlashCommandBuilder, MessageFlags, PermissionFlagsBits, ChannelType } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('react')
    .setDescription('Add 3 random server emojis to a message (Admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(option =>
      option
        .setName('message_id')
        .setDescription('The ID of the message to react to (right-click message → Copy Message ID)')
        .setRequired(true)
    ),

  async execute(interaction) {
    const messageId = interaction.options.getString('message_id');

    // Get all custom emojis from the server
    const serverEmojis = interaction.guild.emojis.cache.filter(e => e.available);

    if (serverEmojis.size < 3) {
      await interaction.reply({
        content: 'This server needs at least 3 custom emojis for this command.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Pick 3 random unique emojis
    const emojiArray = [...serverEmojis.values()];
    const picked = [];
    while (picked.length < 3) {
      const rand = emojiArray[Math.floor(Math.random() * emojiArray.length)];
      if (!picked.includes(rand)) picked.push(rand);
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      // Search all text channels for the message
      let message = null;
      const textChannels = interaction.guild.channels.cache.filter(
        ch => ch.type === ChannelType.GuildText || ch.type === ChannelType.GuildAnnouncement
      );

      for (const [, channel] of textChannels) {
        try {
          message = await channel.messages.fetch(messageId);
          if (message) break;
        } catch { /* not in this channel */ }
      }

      if (!message) {
        await interaction.editReply({ content: 'Could not find that message in any channel.' });
        return;
      }

      for (const emoji of picked) {
        await message.react(emoji);
      }

      await interaction.editReply({
        content: `Reacted to message in #${message.channel.name} with ${picked.map(e => e.toString()).join(' ')}`,
      });
    } catch (error) {
      console.error('React command error:', error);
      await interaction.editReply({
        content: 'Something went wrong adding reactions.',
      });
    }
  },
};
