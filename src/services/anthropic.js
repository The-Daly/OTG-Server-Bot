const BASE44_URL = 'https://trade-mind-ai-copy-45442b24.base44.app/functions';

async function callBase44LLM(prompt, context) {
  if (!process.env.BASE44_API_KEY) return null;

  const response = await fetch(`${BASE44_URL}/answerTradingQuestion`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      question: prompt,
      context: context || '',
    }),
  });

  if (!response.ok) {
    throw new Error(`Base44 API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.answer || data.response || data.text || String(data);
}

async function generateTradeReview(stats, recentTrades) {
  if (stats.totalTrades === 0) {
    return 'You haven\'t logged any trades yet. Start tracking your trades to get personalized feedback.';
  }

  const recentSummary = recentTrades.slice(0, 5).map(t =>
    `${t.symbol || 'Unknown'}: ${t.gain_loss_percent > 0 ? '+' : ''}${t.gain_loss_percent}% | ${t.portfolio_size_used}% portfolio`
  ).join('\n');

  const prompt = `Review this trader's performance and give concise, actionable feedback in 3-4 short paragraphs. Be direct and encouraging but honest.

Stats:
- Total trades: ${stats.totalTrades}
- Win rate: ${stats.winRate}%
- Average gain/loss per trade: ${stats.avgGainLoss}%
- Total P&L: ${stats.totalGainLoss}%

Recent trades:
${recentSummary}

Keep the tone professional, motivating, and specific. No bullet points — write in short paragraphs. Max 150 words.`;

  try {
    const result = await callBase44LLM(prompt, 'You are a professional trading coach for OTG Trading Academy.');
    if (result) return result;
  } catch (error) {
    console.error('Base44 LLM error (trade review):', error);
  }

  return fallbackTradeReview(stats, recentTrades);
}

async function generateChartExplanation(question, correctAnswer, userAnswer) {
  const isCorrect = correctAnswer === userAnswer;

  const prompt = `Question: ${question}
Correct answer: ${correctAnswer}
Student answered: ${userAnswer}
Result: ${isCorrect ? 'CORRECT' : 'INCORRECT'}

Give a brief explanation (2-3 sentences) of why "${correctAnswer}" is correct and what the trader should understand about this concept. If they got it wrong, gently correct them. Be concise and educational.`;

  try {
    const result = await callBase44LLM(prompt, 'You are a trading educator at OTG Trading Academy explaining EMA concepts.');
    if (result) {
      const prefix = isCorrect ? '✅ Correct! ' : `❌ The correct answer is **${correctAnswer}**. `;
      return prefix + result;
    }
  } catch (error) {
    console.error('Base44 LLM error (chart explanation):', error);
  }

  return fallbackChartExplanation(question, correctAnswer, userAnswer);
}

async function generateAICoachResponse(userMessage, recentTrades, stats) {
  let context = 'You are an expert trading coach at OTG Trading Academy. You help traders improve their skills, mindset, and strategy. Be concise, direct, and encouraging. Focus on practical advice. Keep responses under 300 words.';

  if (stats && stats.totalTrades > 0) {
    context += `\n\nTrader context: ${stats.totalTrades} trades logged, ${stats.winRate}% win rate, avg P&L ${stats.avgGainLoss}% per trade.`;
    if (recentTrades && recentTrades.length > 0) {
      const recent = recentTrades.slice(0, 3).map(t =>
        `${t.symbol || 'trade'}: ${t.gain_loss_percent > 0 ? '+' : ''}${t.gain_loss_percent}%`
      ).join(', ');
      context += ` Recent trades: ${recent}.`;
    }
  }

  try {
    const result = await callBase44LLM(userMessage, context);
    if (result) return result;
  } catch (error) {
    console.error('Base44 LLM error (AI coach):', error);
  }

  return 'AI Coach is not available right now. Please try again later.';
}

async function generateMarketNews() {
  const prompt = `Give me today's most important market news and catalysts for traders. Include:

1. Breaking market news or major moves
2. Upcoming or recent earnings announcements
3. Key economic events (CPI, FOMC, interest rates, jobs data)
4. FDA approvals, IPOs, or major catalysts
5. Any significant pre-market or after-hours movers

Format each item as:
**[CATEGORY]** headline
Brief 1-2 sentence summary of why it matters for traders.

Give 5-7 items total. Be specific with ticker symbols, numbers, and dates. Focus on what's actionable for traders today.`;

  const context = 'You are a professional market news analyst for OTG Trading Academy. Deliver fast, clear, actionable market intelligence. Use current real-time data. Today\'s date is ' + new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) + '.';

  try {
    const result = await callBase44LLM(prompt, context);
    if (result) return result;
  } catch (error) {
    console.error('Base44 LLM error (market news):', error);
  }

  return 'Market news is not available right now. Please try again later.';
}

// Fallback static responses when LLM is unavailable
function fallbackTradeReview(stats, recentTrades) {
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

function fallbackChartExplanation(question, correctAnswer, userAnswer) {
  const isCorrect = correctAnswer === userAnswer;
  const explanations = {
    '50 EMA': 'The 50 EMA is a short-term moving average that reacts quickly to price changes. It provides the first level of dynamic support in an uptrend and is often where pullbacks find a bounce.',
    '200 EMA': 'The 200 EMA is the most widely watched long-term support level. Institutional traders and algorithms often key off this level, making it a strong area where price tends to react.',
    '548 EMA': 'The 548 EMA represents extreme long-term support. When price reaches this level, it often signals a major turning point or a deep correction in the trend.',
    'No support': 'When all EMAs are above price, there is no EMA support below. This indicates a bearish structure where price has broken below all key moving averages.',
  };
  const explanation = explanations[correctAnswer] || `The correct answer is ${correctAnswer}.`;
  if (isCorrect) return `Correct! ${explanation}`;
  return `The correct answer is **${correctAnswer}**. ${explanation} Review how EMAs act as dynamic support and resistance to strengthen your chart reading.`;
}

module.exports = {
  generateTradeReview,
  generateChartExplanation,
  generateAICoachResponse,
  generateMarketNews,
};
