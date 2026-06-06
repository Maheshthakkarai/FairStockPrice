import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

export const handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const ticker = event.queryStringParameters.ticker;
  if (!ticker) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Ticker is required' }) };
  }

  try {
    // 1. Fetch current quote
    const quote = await yahooFinance.quote(ticker);
    
    // 2. Fetch rich summary data
    const summary = await yahooFinance.quoteSummary(ticker, {
      modules: ['summaryDetail', 'defaultKeyStatistics', 'earningsTrend', 'financialData', 'summaryProfile']
    });

    // 3. Fetch 1-Year Historical Data for the chart
    // We get monthly data to keep the payload small but show the trend
    const today = new Date();
    const lastYear = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
    const history = await yahooFinance.historical(ticker, { 
      period1: lastYear.toISOString().split('T')[0], 
      period2: today.toISOString().split('T')[0],
      interval: '1mo' 
    });

    // Format history for Recharts
    const chartData = history.map(h => ({
      date: h.date.toISOString().split('T')[0].slice(0, 7), // YYYY-MM
      price: parseFloat(h.close.toFixed(2))
    }));

    // Extract basic data
    const currentPrice = quote.regularMarketPrice;
    const peRatio = summary.summaryDetail?.trailingPE || summary.summaryDetail?.forwardPE || 0;
    const dividendYield = (summary.summaryDetail?.dividendYield || 0) * 100;
    
    const currency = quote.currency || 'USD';
    let currencySymbol = quote.currencySymbol;
    const symbolsMap = {
      'USD': '$', 'CAD': 'C$', 'GBP': '£', 'GBp': 'GBp ',
      'INR': '₹', 'AUD': 'A$', 'EUR': '€', 'CHF': 'CHF ',
      'JPY': '¥', 'HKD': 'HK$', 'SGD': 'S$', 'CNY': '¥'
    };
    
    // If Yahoo doesn't provide a good symbol, or if it provides the 3-letter code as the symbol, override it
    if (!currencySymbol || currencySymbol === currency || symbolsMap[currency]) {
      currencySymbol = symbolsMap[currency] || currencySymbol || '$';
    }

    // EPS Growth calculation
    let epsGrowth = 0;
    const trends = summary.earningsTrend?.trend || [];
    const fiveYearTrend = trends.find(t => t.period === '+5y');
    if (fiveYearTrend && fiveYearTrend.growth) {
      epsGrowth = fiveYearTrend.growth * 100;
    } else {
      const q1 = trends.find(t => t.period === '+1q');
      if (q1 && q1.growth) epsGrowth = q1.growth * 100;
    }

    // Advanced Data
    const sector = summary.summaryProfile?.sector || 'Unknown';
    const targetPrice = summary.financialData?.targetMeanPrice || null;
    const eps = summary.defaultKeyStatistics?.trailingEps || summary.defaultKeyStatistics?.forwardEps || 0;
    const bvps = summary.defaultKeyStatistics?.bookValue || 0;

    // 4. Fetch News & Competitors (Fail gracefully if not available)
    let news = [];
    let competitors = [];
    try {
      const searchRes = await yahooFinance.search(ticker);
      if (searchRes.news) {
        news = searchRes.news.slice(0, 3).map(n => ({ title: n.title, link: n.link, publisher: n.publisher }));
      }
      const recs = await yahooFinance.recommendationsBySymbol(ticker);
      if (recs && recs.recommendedSymbols) {
        competitors = recs.recommendedSymbols.slice(0, 4).map(r => r.symbol);
      }
    } catch (e) {
      console.warn("Failed to fetch news/competitors:", e.message);
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        currentPrice,
        peRatio,
        epsGrowth,
        dividendYield,
        sector,
        targetPrice,
        eps,
        bvps,
        chartData,
        news,
        competitors,
        currency,
        currencySymbol
      })
    };

  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
