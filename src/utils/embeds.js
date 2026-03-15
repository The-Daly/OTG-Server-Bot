const { EmbedBuilder } = require('discord.js');
const { COLORS } = require('./constants');

function tradeMenuEmbed() {
  return new EmbedBuilder()
    .setColor(COLORS.PRIMARY)
    .setTitle('📈 OTG Trading Academy')
    .setDescription(
      'Welcome to your trading hub.\n\n' +
      '📝 **Log Trade** — Record a trade\n' +
      '🔍 **Review** — Check your performance\n' +
      '📊 **Chart Training** — Practice analysis\n' +
      '📖 **Micro Lessons 1-3** — Learn the fundamentals\n' +
      '🏆 **Dashboard** — View your progress\n\n' +
      'Select an option below to get started.'
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

function lessonEmbed(lesson) {
  const embed = new EmbedBuilder()
    .setColor(COLORS.PRIMARY)
    .setTitle(`Lesson ${lesson.number}: ${lesson.title}`)
    .setDescription(lesson.description)
    .addFields(
      { name: 'Source', value: `[View on OTG Academy](${lesson.sourceUrl})` },
    )
    .setFooter({ text: 'Answer the review question to complete this lesson' });

  if (lesson.imageUrl) {
    embed.setImage(lesson.imageUrl);
  }

  return embed;
}

function lessonResultEmbed(lessonNumber, isCorrect, feedback) {
  return new EmbedBuilder()
    .setColor(isCorrect ? COLORS.SUCCESS : COLORS.DANGER)
    .setTitle(isCorrect ? `Lesson ${lessonNumber} Complete!` : `Lesson ${lessonNumber} — Try Again`)
    .setDescription(feedback)
    .setFooter({ text: isCorrect ? '+25 XP earned' : 'Review the lesson and try again' });
}

function dashboardEmbed(user, stats, lessonProgress) {
  const lessonsCompleted = lessonProgress.filter(l => l.completed).length;
  const lessonStatus = [1, 2, 3].map(n => {
    const done = lessonProgress.find(l => l.lesson_number === n)?.completed;
    return `Lesson ${n}: ${done ? 'Completed' : 'Not started'}`;
  }).join('\n');

  return new EmbedBuilder()
    .setColor(COLORS.GOLD)
    .setTitle('Your Progress Dashboard')
    .addFields(
      { name: 'XP', value: `${user.xp}`, inline: true },
      { name: 'Trades Logged', value: `${user.trades_logged}`, inline: true },
      { name: 'Lessons Completed', value: `${lessonsCompleted}/3`, inline: true },
      { name: 'Win Rate', value: `${stats.winRate}%`, inline: true },
      { name: 'Avg Result', value: `${stats.avgGainLoss > 0 ? '+' : ''}${stats.avgGainLoss}%`, inline: true },
      { name: 'Lesson Progress', value: lessonStatus },
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
  chartQuestionEmbed,
  chartResultEmbed,
  lessonEmbed,
  lessonResultEmbed,
  dashboardEmbed,
};
