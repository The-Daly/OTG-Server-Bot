const marketdata = require('./marketdata');

const BASE44_URL = 'https://trade-mind-ai-copy-45442b24.base44.app/functions';

// Data sources we scrape/fetch from
const SOURCES = {
  yahoo_news: 'https://finance.yahoo.com',
  sec_filings: 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&type=8-K&dateb=&owner=include&count=10&search_text=&action=getcompany',
  finviz: 'https://finviz.com/quote.ashx',
  stocktwits: 'https://api.stocktwits.com/api/2/streams/symbol',
};

// Fetch Yahoo Finance quote data for a ticker
async function getTickerData(ticker) {
  try {
    const quotes = await marketdata.getQuotes([ticker.toUpperCase()]);
    if (quotes.length > 0) {
      const q = quotes[0];
      return `**${q.symbol}** — $${q.price?.toFixed(2)} | Change: ${q.change >= 0 ? '+' : ''}${q.change?.toFixed(2)} (${q.changePct >= 0 ? '+' : ''}${q.changePct?.toFixed(2)}%) | Vol: ${marketdata.formatNumber(q.volume)} | MCap: ${marketdata.formatNumber(q.marketCap)} | Day Range: $${q.low?.toFixed(2)} - $${q.high?.toFixed(2)}`;
    }
  } catch (err) {
    console.error(`Research quote error for ${ticker}:`, err.message);
  }
  return null;
}

// Fetch Yahoo Finance news for a ticker
async function getTickerNews(ticker) {
  try {
    const news = await marketdata.getNews(ticker.toUpperCase());
    if (news.length > 0) {
      return news.slice(0, 5).map(n =>
        `• **${n.title}** — ${n.publisher}`
      ).join('\n');
    }
  } catch (err) {
    console.error(`Research news error for ${ticker}:`, err.message);
  }
  return null;
}

// Fetch StockTwits sentiment
async function getStockTwitsSentiment(ticker) {
  try {
    const res = await fetch(`https://api.stocktwits.com/api/2/streams/symbol/${ticker.toUpperCase()}.json`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.symbol && data.symbol.watchlist_count) {
      const messages = (data.messages || []).slice(0, 3);
      const bullish = messages.filter(m => m.entities?.sentiment?.basic === 'Bullish').length;
      const bearish = messages.filter(m => m.entities?.sentiment?.basic === 'Bearish').length;
      return `Watchers: ${marketdata.formatNumber(data.symbol.watchlist_count)} | Recent sentiment: ${bullish} bullish, ${bearish} bearish out of ${messages.length} posts`;
    }
  } catch (err) {
    // StockTwits may rate limit or block
  }
  return null;
}

// Fetch market overview for sector/general queries
async function getMarketSnapshot() {
  try {
    const indices = await marketdata.getMarketOverview();
    if (indices.length > 0) {
      return indices.map(q => {
        const arrow = (q.changePct || 0) >= 0 ? '📈' : '📉';
        const name = q.symbol === '^GSPC' ? 'S&P 500' : q.symbol === '^IXIC' ? 'NASDAQ' : q.symbol === '^DJI' ? 'DOW' : q.symbol === '^VIX' ? 'VIX' : q.name;
        return `${arrow} **${name}** ${q.price?.toFixed(2)} (${(q.changePct || 0) >= 0 ? '+' : ''}${q.changePct?.toFixed(2)}%)`;
      }).join('\n');
    }
  } catch (err) {
    console.error('Research market snapshot error:', err.message);
  }
  return null;
}

// Extract ticker from user query if present
function extractTicker(query) {
  // Match $TICKER or standalone uppercase 1-5 letter words that look like tickers
  const dollarMatch = query.match(/\$([A-Za-z]{1,5})/);
  if (dollarMatch) return dollarMatch[1].toUpperCase();

  const words = query.split(/\s+/);
  for (const word of words) {
    const clean = word.replace(/[^A-Za-z]/g, '');
    if (clean.length >= 1 && clean.length <= 5 && clean === clean.toUpperCase() && /^[A-Z]+$/.test(clean)) {
      // Skip common words
      const skip = ['I', 'A', 'THE', 'AND', 'OR', 'FOR', 'ON', 'IN', 'IS', 'IT', 'AT', 'TO', 'OF', 'DO', 'IF', 'MY', 'ME', 'UP', 'SO', 'NO', 'BY', 'AN', 'AS', 'BE', 'WE', 'HE', 'AI', 'SEC', 'FDA', 'GDP', 'CPI', 'IPO', 'ETF', 'CEO', 'CFO', 'NEWS'];
      if (!skip.includes(clean)) return clean;
    }
  }
  return null;
}

// Main research function
async function generateResearch(userQuery) {
  const ticker = extractTicker(userQuery);
  const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  // Gather live data in parallel
  const promises = [];
  let tickerData = null;
  let tickerNews = null;
  let stocktwits = null;
  let marketSnapshot = null;

  if (ticker) {
    promises.push(getTickerData(ticker).then(d => { tickerData = d; }));
    promises.push(getTickerNews(ticker).then(d => { tickerNews = d; }));
    promises.push(getStockTwitsSentiment(ticker).then(d => { stocktwits = d; }));
  }
  promises.push(getMarketSnapshot().then(d => { marketSnapshot = d; }));

  await Promise.all(promises);

  // Build data context for AI
  let dataContext = '';
  if (tickerData) dataContext += `\n\nLIVE QUOTE DATA:\n${tickerData}`;
  if (tickerNews) dataContext += `\n\nLATEST NEWS (Yahoo Finance):\n${tickerNews}`;
  if (stocktwits) dataContext += `\n\nSTOCKTWITS SENTIMENT:\n${stocktwits}`;
  if (marketSnapshot) dataContext += `\n\nMARKET OVERVIEW:\n${marketSnapshot}`;

  const prompt = `User question: ${userQuery}

Based on the live data provided below and your knowledge, give a comprehensive but concise research briefing. Include:
- Key price action and technical levels if a ticker was mentioned
- Recent news and catalysts
- Social sentiment if available
- SEC filings or regulatory news if relevant
- Your analysis and what traders should watch for

${dataContext}

Format your response cleanly with sections. Be specific with numbers, levels, and dates. Keep it under 400 words. If no specific ticker was asked about, give a broad market overview or sector analysis based on the question.`;

  const context = `You are a senior market research analyst at OTG Trading Academy. You provide in-depth, data-driven research briefings pulling from Yahoo Finance, SEC EDGAR filings, StockTwits social sentiment, Finviz screeners, Webull data, and government economic reports. Be specific, actionable, and cite data sources. Today is ${dateStr}.`;

  try {
    const response = await fetch(`${BASE44_URL}/answerTradingQuestion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: prompt, context }),
    });

    if (!response.ok) throw new Error(`Base44 error: ${response.status}`);
    const data = await response.json();
    const aiResponse = data.answer || data.response || data.text || String(data);

    // Build the full response with live data header
    let fullResponse = '';
    if (tickerData) fullResponse += `📊 ${tickerData}\n\n`;
    fullResponse += aiResponse;

    return { response: fullResponse, ticker, tickerData, tickerNews, stocktwits, marketSnapshot };
  } catch (error) {
    console.error('Research AI error:', error);

    // Return just the live data if AI fails
    let fallback = '';
    if (tickerData) fallback += `📊 ${tickerData}\n\n`;
    if (tickerNews) fallback += `📰 **Latest News:**\n${tickerNews}\n\n`;
    if (marketSnapshot) fallback += `🌍 **Market Overview:**\n${marketSnapshot}\n\n`;
    if (fallback) return { response: fallback + '*AI analysis unavailable — showing live data only.*', ticker };
    return { response: 'Research is not available right now. Please try again later.', ticker: null };
  }
}

module.exports = { generateResearch };
