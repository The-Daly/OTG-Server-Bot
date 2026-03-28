const { Events } = require('discord.js');

const DEFAULT_EMOJIS = ['❤️', '👀', '💯'];

module.exports = {
  name: Events.MessageCreate,
  async execute(message) {
    // Ignore bot messages and DMs
    if (message.author.bot) return;
    if (!message.guild) return;

    // Check if auto-react is enabled
    if (!message.client.autoReactEnabled) return;

    try {
      for (const emoji of DEFAULT_EMOJIS) {
        await message.react(emoji);
      }
    } catch (err) {
      // Silently fail — message may have been deleted
    }
  },
};
