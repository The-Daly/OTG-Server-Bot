let yahooFinance;
try {
  const YahooFinance = require('yahoo-finance2').default;
  // v3 requires constructor, v2 exports directly
  if (typeof YahooFinance === 'function') {
    yahooFinance = new YahooFinance();
  } else {
    yahooFinance = YahooFinance;
  }
} catch (err) {
  console.error('Yahoo Finance init error:', err.message);
}

const LARGE_CAP_TICKERS = ['AAPL', 'TSLA', 'NVDA', 'MSFT', 'AMZN', 'META', 'GOOGL', 'AMD', 'NFLX', 'JPM'];
const INDEX_TICKERS = ['^GSPC', '^IXIC', '^DJI', '^VIX'];

async function getQuotes(tickers) {
  const results = [];
  for (const ticker of tickers) {
    try {
      const quote = await yahooFinance.quote(ticker);
      if (quote) {
        results.push({
          symbol: quote.symbol,
          name: quote.shortName || quote.longName || quote.symbol,
          price: quote.regularMarketPrice,
          change: quote.regularMarketChange,
          changePct: quote.regularMarketChangePercent,
          volume: quote.regularMarketVolume,
          marketCap: quote.marketCap,
          high: quote.regularMarketDayHigh,
          low: quote.regularMarketDayLow,
          prevClose: quote.regularMarketPreviousClose,
        });
      }
    } catch (err) {
      console.error(`Yahoo quote error for ${ticker}:`, err.message);
    }
  }
  return results;
}

async function getMarketOverview() {
  return getQuotes(INDEX_TICKERS);
}

async function getLargeCapMovers() {
  const quotes = await getQuotes(LARGE_CAP_TICKERS);
  // Sort by absolute % change to find biggest movers
  return quotes.sort((a, b) => Math.abs(b.changePct || 0) - Math.abs(a.changePct || 0));
}

async function getNews(ticker) {
  try {
    const result = await yahooFinance.search(ticker, { newsCount: 5 });
    if (result && result.news) {
      return result.news.map(n => ({
        title: n.title,
        publisher: n.publisher,
        link: n.link,
        publishedAt: n.providerPublishTime,
      }));
    }
  } catch (err) {
    console.error(`Yahoo news error for ${ticker}:`, err.message);
  }
  return [];
}

async function getTrendingTickers() {
  try {
    const result = await yahooFinance.trendingSymbols('US', { count: 10 });
    if (result && result.quotes) {
      return result.quotes.map(q => q.symbol);
    }
  } catch (err) {
    console.error('Yahoo trending error:', err.message);
  }
  return [];
}

function formatNumber(num) {
  if (!num) return 'N/A';
  if (num >= 1e12) return (num / 1e12).toFixed(2) + 'T';
  if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K';
  return num.toFixed(2);
}

module.exports = {
  getQuotes,
  getMarketOverview,
  getLargeCapMovers,
  getNews,
  getTrendingTickers,
  formatNumber,
  LARGE_CAP_TICKERS,
};
