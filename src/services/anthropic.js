// Static feedback engine — no API key required.
// When Anthropic is connected later, swap these for real API calls.

async function generateTradeReview(stats, recentTrades) {
  if (stats.totalTrades === 0) {
    return 'You haven\'t logged any trades yet. Start tracking your trades to get personalized feedback.';
  }

  const lines = [];

  if (stats.winRate >= 60) {
    lines.push(`Strong win rate at ${stats.winRate}%. You're making more right calls than wrong ones — keep it consistent.`);
  } else if (stats.winRate >= 40) {
    lines.push(`Your win rate is ${stats.winRate}%, which is around average. Focus on improving your entries and exits to push this higher.`);
  } else {
    lines.push(`Your win rate is ${stats.winRate}%, which is below average. Consider being more selective with your entries and review your chart setups before committing.`);
  }

  const recentSizes = recentTrades.slice(0, 5).map(t => t.portfolio_size_used);
  const avgSize = recentSizes.reduce((a, b) => a + b, 0) / recentSizes.length;

  if (avgSize > 40) {
    lines.push('You are risking large portions of your portfolio relative to your average return. Consider reducing risk per trade to protect your capital.');
  } else if (avgSize > 20) {
    lines.push('Your position sizing is moderate. As you refine your strategy, aim to keep risk between 1-10% per trade.');
  } else {
    lines.push('Good risk management — you\'re keeping position sizes controlled. This protects you during losing streaks.');
  }

  if (stats.avgGainLoss > 0) {
    lines.push(`Your average return is +${stats.avgGainLoss}% per trade. Stay disciplined and let your winners run.`);
  } else {
    lines.push(`Your average return is ${stats.avgGainLoss}% per trade. Focus on cutting losses quickly and review your stop-loss strategy.`);
  }

  return lines.join('\n\n');
}

async function generateChartExplanation(question, correctAnswer, userAnswer) {
  const isCorrect = correctAnswer === userAnswer;

  const explanations = {
    '50 EMA': 'The 50 EMA is a short-term moving average that reacts quickly to price changes. It provides the first level of dynamic support in an uptrend and is often where pullbacks find a bounce.',
    '200 EMA': 'The 200 EMA is the most widely watched long-term support level. Institutional traders and algorithms often key off this level, making it a strong area where price tends to react.',
    '548 EMA': 'The 548 EMA represents extreme long-term support. When price reaches this level, it often signals a major turning point or a deep correction in the trend.',
    'No support': 'When all EMAs are above price, there is no EMA support below. This indicates a bearish structure where price has broken below all key moving averages.',
  };

  const explanation = explanations[correctAnswer] || `The correct answer is ${correctAnswer}.`;

  if (isCorrect) {
    return `Correct! ${explanation}`;
  }
  return `The correct answer is **${correctAnswer}**. ${explanation} Review how EMAs act as dynamic support and resistance to strengthen your chart reading.`;
}

async function generateLessonReviewFeedback(lessonNumber, userAnswer, correctAnswer) {
  const isCorrect = userAnswer === correctAnswer;

  const feedback = {
    1: {
      correct: `That's right — **${correctAnswer}**. An uptrend is defined by a series of higher highs and higher lows. This is the most fundamental concept in market structure and the basis for identifying trend direction.`,
      wrong: `The correct answer is **${correctAnswer}**. Market structure is built on the pattern of highs and lows. In an uptrend, each new high is higher than the last, and each pullback stays above the previous low.`,
    },
    2: {
      correct: `Correct — **${correctAnswer}**. The 200 EMA is the gold standard for long-term support. It's watched by traders worldwide and often acts as a major decision point for institutional money.`,
      wrong: `The correct answer is **${correctAnswer}**. While shorter EMAs provide support too, the 200 EMA is the most respected long-term level. When price tests the 200 EMA, it often produces a significant reaction.`,
    },
    3: {
      correct: `Spot on — **${correctAnswer}**. Keeping risk small per trade ensures you survive losing streaks and stay in the game long enough for your edge to play out. This is the #1 rule of professional trading.`,
      wrong: `The correct answer is **${correctAnswer}**. Risk management is the most important skill in trading. Risking only 1-2% per trade means even a string of losses won't destroy your account.`,
    },
  };

  const lessonFeedback = feedback[lessonNumber];
  if (!lessonFeedback) return isCorrect ? 'Correct!' : `The correct answer is ${correctAnswer}.`;

  return isCorrect ? lessonFeedback.correct : lessonFeedback.wrong;
}

module.exports = {
  generateTradeReview,
  generateChartExplanation,
  generateLessonReviewFeedback,
};
