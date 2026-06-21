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
    
    const quote = await yahooFinance.quote(ticker, {}, { validateResult: false });
    const quoteSummary = await yahooFinance.quoteSummary(ticker, {
      modules: ['summaryDetail', 'defaultKeyStatistics', 'earningsTrend']
    }, { validateResult: false });

    const currentPrice = quote.regularMarketPrice || null;
    const peRatio = quote.trailingPE || quoteSummary.summaryDetail?.trailingPE || null;
    
    let dividendYieldRaw = quote.dividendYield || quoteSummary.summaryDetail?.dividendYield || 0;
    const dividendYield = dividendYieldRaw * 100;

    let epsGrowth = null;
    if (quoteSummary.earningsTrend && quoteSummary.earningsTrend.trend) {
      const growthTrend = quoteSummary.earningsTrend.trend.find(t => t.period === '+5y');
      if (growthTrend && growthTrend.growth !== undefined && growthTrend.growth !== null) {
        epsGrowth = growthTrend.growth * 100;
      }
    }
    
    if (epsGrowth === null) {
      if (quoteSummary.defaultKeyStatistics?.earningsQuarterlyGrowth) {
        epsGrowth = quoteSummary.defaultKeyStatistics.earningsQuarterlyGrowth * 100;
      } else {
        epsGrowth = 0;
      }
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ticker: ticker.toUpperCase(),
        currentPrice: currentPrice ? currentPrice.toFixed(2) : null,
        peRatio: peRatio ? peRatio.toFixed(2) : null,
        epsGrowth: epsGrowth !== null ? epsGrowth.toFixed(2) : null,
        dividendYield: dividendYield.toFixed(2),
      }),
    };
  } catch (error) {
    console.error(`Error fetching data for ${ticker}:`, error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to fetch stock data' }),
    };
  }
};
