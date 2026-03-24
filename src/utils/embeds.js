const { EmbedBuilder } = require('discord.js');
const { COLORS } = require('./constants');

function tradeMenuEmbed() {
  return new EmbedBuilder()
    .setColor(COLORS.PRIMARY)
    .setTitle('OTG Trading Academy')
    .setDescription(
      'Master the markets with structure, strategy, and discipline.\n\n' +
      '📈 Learn how to trade with confidence\n' +
      '🧠 Build real skills — not guesswork\n' +
      '📊 Track your growth and performance\n' +
      '🎯 Turn knowledge into execution\n\n' +
      'Select an option below to begin your journey.'
    )
    .setFooter({ text: '🎓 OTG Trading Academy | Brian Oates' })
    .setTimestamp();
}

function tradeLogStep1Embed() {
  return new EmbedBuilder()
    .setColor(COLORS.GOLD)
    .setTitle('Log Trade — Step 1')
    .setDescription('How heavy did you go in today?\n\nSelect the percentage of your portfolio used on this trade.');
}

function tradeLogStep2Embed(portfolioSize) {
  return new EmbedBuilder()
    .setColor(COLORS.GOLD)
    .setTitle('Log Trade — Step 2')
    .setDescription(`Portfolio used: **${portfolioSize}%**\n\nHow did the trade perform?`);
}

function tradeLogSuccessEmbed(portfolioSize, gainLoss) {
  const isProfit = gainLoss > 0;
  return new EmbedBuilder()
    .setColor(isProfit ? COLORS.SUCCESS : COLORS.DANGER)
    .setTitle('Trade Logged')
    .setDescription(`Your trade has been recorded.`)
    .addFields(
      { name: 'Portfolio Used', value: `${portfolioSize}%`, inline: true },
      { name: 'Result', value: `${gainLoss > 0 ? '+' : ''}${gainLoss}%`, inline: true },
    )
    .setFooter({ text: '+10 XP earned' })
    .setTimestamp();
}

function reviewEmbed(stats, recentTrades) {
  const recentList = recentTrades.slice(0, 5).map(t => {
    const date = new Date(t.date).toLocaleDateString();
    const result = t.gain_loss_percent > 0 ? `+${t.gain_loss_percent}%` : `${t.gain_loss_percent}%`;
    return `${date} — ${t.portfolio_size_used}% portfolio — **${result}**`;
  }).join('\n') || 'No trades yet';

  return new EmbedBuilder()
    .setColor(COLORS.PRIMARY)
    .setTitle('Trade Review')
    .addFields(
      { name: 'Total Trades', value: `${stats.totalTrades}`, inline: true },
      { name: 'Win Rate', value: `${stats.winRate}%`, inline: true },
      { name: 'Avg Gain/Loss', value: `${stats.avgGainLoss > 0 ? '+' : ''}${stats.avgGainLoss}%`, inline: true },
      { name: 'Wins / Losses', value: `${stats.wins}W / ${stats.losses}L`, inline: true },
      { name: 'Recent Activity', value: recentList },
    )
    .setTimestamp();
}

function aiReviewEmbed(feedback) {
  return new EmbedBuilder()
    .setColor(COLORS.WARNING)
    .setTitle('AI Coach Feedback')
    .setDescription(feedback)
    .setFooter({ text: 'Powered by Anthropic | OTG Trading Academy' });
}

function chartQuestionEmbed(question) {
  const embed = new EmbedBuilder()
    .setColor(COLORS.PRIMARY)
    .setTitle('Chart Training')
    .setDescription(question.question);

  if (question.imageUrl) {
    embed.setImage(question.imageUrl);
  }

  return embed;
}

function chartResultEmbed(isCorrect, explanation) {
  return new EmbedBuilder()
    .setColor(isCorrect ? COLORS.SUCCESS : COLORS.DANGER)
    .setTitle(isCorrect ? 'Correct!' : 'Not quite...')
    .setDescription(explanation)
    .setFooter({ text: isCorrect ? '+15 XP earned' : '+5 XP for trying' });
}

function aiCoachEmbed(question, response) {
  const truncatedQuestion = question.length > 1024 ? question.slice(0, 1021) + '...' : question;
  const truncatedResponse = response.length > 1024 ? response.slice(0, 1021) + '...' : response;
  return new EmbedBuilder()
    .setColor(COLORS.PRIMARY)
    .setTitle('🤖 OTG AI Trading Coach')
    .addFields(
      { name: 'Your Question', value: truncatedQuestion },
      { name: 'Coach Response', value: truncatedResponse },
    )
    .setFooter({ text: 'Powered by Claude AI | OTG Trading Academy' })
    .setTimestamp();
}

function dashboardEmbed(user, stats) {
  return new EmbedBuilder()
    .setColor(COLORS.GOLD)
    .setTitle('Your Progress Dashboard')
    .addFields(
      { name: 'XP', value: `${user.xp}`, inline: true },
      { name: 'Trades Logged', value: `${user.trades_logged}`, inline: true },
      { name: 'Win Rate', value: `${stats.winRate}%`, inline: true },
      { name: 'Avg Result', value: `${stats.avgGainLoss > 0 ? '+' : ''}${stats.avgGainLoss}%`, inline: true },
    )
    .setFooter({ text: 'OTG Trading Academy | Keep grinding!' })
    .setTimestamp();
}

module.exports = {
  tradeMenuEmbed,
  tradeLogStep1Embed,
  tradeLogStep2Embed,
  tradeLogSuccessEmbed,
  reviewEmbed,
  aiReviewEmbed,
  aiCoachEmbed,
  chartQuestionEmbed,
  chartResultEmbed,
  dashboardEmbed,
};
