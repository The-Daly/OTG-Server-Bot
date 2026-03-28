const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { getLeaderboard, getTodaySentiment } = require('../services/checkin');
const { COLORS } = require('../utils/constants');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('View XP and streak leaderboards'),

  async execute(interaction) {
    const { byXP, byStreak } = getLeaderboard();
    const sentiment = getTodaySentiment();

    const xpList = byXP.length > 0
      ? byXP.map((u, i) => {
          const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `**${i + 1}.**`;
          return `${medal} <@${u.id}> — **${u.xp} XP**`;
        }).join('\n')
      : 'No check-ins yet. Be the first!';

    const streakList = byStreak.length > 0
      ? byStreak.filter(u => u.streak > 0).map((u, i) => {
          const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `**${i + 1}.**`;
          return `${medal} <@${u.id}> — **${u.streak} day${u.streak !== 1 ? 's' : ''}** 🔥`;
        }).join('\n') || 'No active streaks.'
      : 'No active streaks.';

    const embed = new EmbedBuilder()
      .setColor(COLORS.GOLD)
      .setTitle('🏆 OTG Leaderboard')
      .addFields(
        { name: '⭐ Most XP', value: xpList },
        { name: '🔥 Longest Active Streak', value: streakList },
      )
      .setFooter({ text: 'OTG Trading Academy | Check in daily to climb!' })
      .setTimestamp();

    if (sentiment.total > 0) {
      embed.addFields({
        name: '📊 Today\'s Community Sentiment',
        value: `🟢 Bullish: **${sentiment.bullishPct}%** (${sentiment.bullish})\n🔴 Bearish: **${sentiment.bearishPct}%** (${sentiment.bearish})\n⚪ Neutral: **${sentiment.neutralPct}%** (${sentiment.neutral})`,
      });
    }

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },
};
