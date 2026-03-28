const { SlashCommandBuilder, MessageFlags, PermissionFlagsBits, ChannelType } = require('discord.js');

// Default emojis if no reactions exist on the message
const DEFAULT_EMOJIS = ['❤️', '👀', '💯'];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('react')
    .setDescription('Add reactions to a message (Admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(option =>
      option
        .setName('message_id')
        .setDescription('The ID of the message to react to (right-click message → Copy Message ID)')
        .setRequired(true)
    ),

  async execute(interaction) {
    const messageId = interaction.options.getString('message_id');

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

      // Get existing reactions on the message
      const existingReactions = message.reactions.cache;
      let toReact = [];

      if (existingReactions.size > 0) {
        // Add the bot's reaction to emojis already on the message
        for (const [, reaction] of existingReactions) {
          const emoji = reaction.emoji;
          toReact.push(emoji.id ? `<:${emoji.name}:${emoji.id}>` : emoji.name);
        }
      } else {
        // No reactions yet — use ❤️ 😍 💯
        toReact = [...DEFAULT_EMOJIS];
      }

      const reacted = [];
      for (const emoji of toReact) {
        try {
          await message.react(emoji);
          reacted.push(emoji);
        } catch (err) {
          console.error(`Failed to react with ${emoji}:`, err.message);
        }
      }

      await interaction.editReply({
        content: `Reacted to message in #${message.channel.name} with ${reacted.join(' ')}`,
      });
    } catch (error) {
      console.error('React command error:', error);
      await interaction.editReply({
        content: 'Something went wrong adding reactions.',
      });
    }
  },
};
