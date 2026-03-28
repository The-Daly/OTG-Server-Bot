const { Events, EmbedBuilder } = require('discord.js');
const checkin = require('../services/checkin');

const BIAS_MAP = {
  '🟢': 'bullish',
  '🔴': 'bearish',
  '⚪': 'neutral',
};

const BIAS_LABELS = {
  bullish: '🟢 Bullish',
  bearish: '🔴 Bearish',
  neutral: '⚪ Neutral',
};

module.exports = {
  name: Events.MessageReactionAdd,
  async execute(reaction, user) {
    // Ignore bots
    if (user.bot) return;

    // Fetch partials if needed
    if (reaction.partial) {
      try { await reaction.fetch(); } catch { return; }
    }
    if (reaction.message.partial) {
      try { await reaction.message.fetch(); } catch { return; }
    }

    // Check if this is the active check-in message
    const state = checkin.getState();
    if (!state.activeMessageId || reaction.message.id !== state.activeMessageId) return;

    const emoji = reaction.emoji.name;
    const bias = BIAS_MAP[emoji];
    if (!bias) return;

    // Remove other reactions from this user (only allow one bias)
    const validEmojis = Object.keys(BIAS_MAP);
    for (const otherEmoji of validEmojis) {
      if (otherEmoji !== emoji) {
        const otherReaction = reaction.message.reactions.cache.get(otherEmoji);
        if (otherReaction) {
          try { await otherReaction.users.remove(user.id); } catch { /* ignore */ }
        }
      }
    }

    // Process check-in
    const result = checkin.processCheckin(user.id, bias);

    if (result.alreadyCheckedIn) return; // silently ignore duplicates

    // Send ephemeral-like DM or channel reply
    try {
      const sentiment = checkin.getTodaySentiment();

      const streakEmoji = result.streak >= 30 ? '👑' : result.streak >= 7 ? '🔥' : result.streak >= 3 ? '⚡' : '✅';
      let streakBonus = '';
      if (result.streak === 3) streakBonus = '\n🎁 **3-day streak bonus!** +5 bonus XP';
      if (result.streak === 7) streakBonus = '\n🎁 **7-day streak bonus!** +10 bonus XP';
      if (result.streak === 30) streakBonus = '\n👑 **30-day streak!** VIP status earned!';

      const embed = new EmbedBuilder()
        .setColor(bias === 'bullish' ? 0x57F287 : bias === 'bearish' ? 0xED4245 : 0x99AAB5)
        .setTitle(`${streakEmoji} You checked in!`)
        .setDescription(
          `**Streak:** ${result.streak} day${result.streak !== 1 ? 's' : ''}\n` +
          `**XP Earned:** +${result.xpGain} XP (Total: ${result.xp})\n` +
          `**Today's Bias:** ${BIAS_LABELS[bias]}` +
          streakBonus +
          `\n\n📊 **Community Sentiment:**\n` +
          `🟢 Bullish: ${sentiment.bullishPct}%\n` +
          `🔴 Bearish: ${sentiment.bearishPct}%\n` +
          `⚪ Neutral: ${sentiment.neutralPct}%`
        )
        .setFooter({ text: 'OTG Trading Academy | Daily Check-In' })
        .setTimestamp();

      // Reply in channel (auto-deletes after 15 seconds to keep it clean)
      const reply = await reaction.message.channel.send({
        content: `<@${user.id}>`,
        embeds: [embed],
      });

      setTimeout(() => {
        reply.delete().catch(() => {});
      }, 15000);
    } catch (err) {
      console.error('Check-in response error:', err);
    }
  },
};
