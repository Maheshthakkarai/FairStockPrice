import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

const normalizeName = (name) => {
  if (!name) return '';
  return name
    .replace(/^(Mr\.|Ms\.|Mrs\.|Dr\.)\s+/i, '')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .trim();
};

const nameMatches = (name1, name2) => {
  const n1 = normalizeName(name1);
  const n2 = normalizeName(name2);
  if (n1 === n2) return true;

  const words1 = n1.split(' ').filter(w => w.length > 1);
  const words2 = n2.split(' ').filter(w => w.length > 1);

  if (words1.length >= 2 && words2.length >= 2) {
    const first1 = words1[0];
    const last1 = words1[words1.length - 1];
    const first2 = words2[0];
    const last2 = words2[words2.length - 1];
    return first1 === first2 && last1 === last2;
  }
  return false;
};

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
    const quote = await yahooFinance.quote(ticker, {}, { validateResult: false });
    
    // 2. Fetch rich summary data
    const summary = await yahooFinance.quoteSummary(ticker, {
      modules: ['summaryDetail', 'defaultKeyStatistics', 'earningsTrend', 'financialData', 'summaryProfile', 'assetProfile', 'calendarEvents', 'earnings', 'price']
    }, { validateResult: false });

    // 3. Fetch 1-Year Historical Data for the chart and returns
    const today = new Date();
    const lastYear = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
    
    // We use chart() instead of historical() to bypass strict null validation errors on international holidays
    const chartRes = await yahooFinance.chart(ticker, { 
      period1: lastYear.toISOString().split('T')[0], 
      period2: today.toISOString().split('T')[0] 
    }, { validateResult: false });
    
    // Filter out partial holiday nulls
    const history = (chartRes.quotes || []).filter(q => q.close !== null);

    // Format history for Recharts (keep it monthly to not overload UI)
    const monthlyHistory = [];
    let currentMonth = '';
    history.forEach(h => {
      const monthStr = h.date.toISOString().split('T')[0].slice(0, 7);
      if (monthStr !== currentMonth) {
        monthlyHistory.push({ date: monthStr, price: parseFloat(h.close.toFixed(2)) });
        currentMonth = monthStr;
      } else {
        monthlyHistory[monthlyHistory.length - 1].price = parseFloat(h.close.toFixed(2));
      }
    });
    const chartData = monthlyHistory;

    const currentPrice = quote.regularMarketPrice;

    // Calculate Returns
    let returns = { fiveDay: null, oneMonth: null, threeMonth: null, oneYear: null, ytd: null };
    if (history.length > 0) {
      const getPriceByDate = (targetDate) => {
        for (let i = history.length - 1; i >= 0; i--) {
          if (history[i].date <= targetDate) {
            return history[i].close;
          }
        }
        return history[0]?.close;
      };

      const getReturn = (targetDate) => {
        const pastPrice = getPriceByDate(targetDate);
        if (pastPrice) {
          return ((currentPrice - pastPrice) / pastPrice) * 100;
        }
        return null;
      };

      returns.fiveDay = getReturn(new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000));
      returns.oneMonth = getReturn(new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000));
      returns.threeMonth = getReturn(new Date(today.getFullYear(), today.getMonth() - 3, today.getDate()));
      returns.oneYear = getReturn(new Date(today.getFullYear() - 1, today.getMonth(), today.getDate()));
      
      const ytdTarget = new Date(today.getFullYear() - 1, 11, 31);
      returns.ytd = getReturn(ytdTarget);
    }

    // Extract basic data
    const peRatio = summary.summaryDetail?.trailingPE || summary.summaryDetail?.forwardPE || 0;
    const dividendYield = (summary.summaryDetail?.dividendYield || 0) * 100;
    const dividendRate = summary.summaryDetail?.trailingAnnualDividendRate || summary.summaryDetail?.dividendRate || 0;
    
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
    const getGrowth = (periodStr) => {
      const t = trends.find(t => t.period === periodStr);
      return t && t.growth ? t.growth * 100 : null;
    };
    
    // Institutional fallback cascade to prevent quarterly volatility from skewing valuation
    epsGrowth = getGrowth('+5y') ?? getGrowth('+1y') ?? getGrowth('0y') ?? getGrowth('+1q') ?? 0;

    // Advanced Data & New Data Points
    const sector = summary.summaryProfile?.sector || 'Unknown';
    const targetPrice = summary.financialData?.targetMeanPrice || null;
    const eps = summary.defaultKeyStatistics?.trailingEps || summary.defaultKeyStatistics?.forwardEps || 0;
    const bvps = summary.defaultKeyStatistics?.bookValue || 0;
    const debtToEquity = summary.financialData?.debtToEquity || 0;
    const currentRatio = summary.financialData?.currentRatio || 0;
    const returnOnEquity = (summary.financialData?.returnOnEquity || 0) * 100;

    // Key Stats
    const volume = summary.summaryDetail?.volume || 0;
    const avgVolume = summary.summaryDetail?.averageVolume || 0;
    const dayHigh = summary.price?.regularMarketDayHigh || 0;
    const dayLow = summary.price?.regularMarketDayLow || 0;
    const fiftyTwoWeekHigh = summary.summaryDetail?.fiftyTwoWeekHigh || 0;
    const fiftyTwoWeekLow = summary.summaryDetail?.fiftyTwoWeekLow || 0;
    const marketCap = summary.summaryDetail?.marketCap || summary.price?.marketCap || 0;
    const sharesOutstanding = summary.defaultKeyStatistics?.sharesOutstanding || 0;
    const beta = summary.summaryDetail?.beta || summary.defaultKeyStatistics?.beta || 0;

    // Ratios
    const ebitda = summary.financialData?.ebitda || 0;
    const revenue = summary.financialData?.totalRevenue || 0;
    const grossMargins = (summary.financialData?.grossMargins || 0) * 100;
    const netMargins = (summary.financialData?.profitMargins || 0) * 100;

    // Events
    const nextEarningsDate = summary.calendarEvents?.earnings?.earningsDate?.[0] || null;
    const exDivDate = summary.calendarEvents?.exDividendDate || null;

    // Earnings Data
    const earningsChart = summary.earnings?.earningsChart?.quarterly || [];

    // Profile Data & Key Executives
    let cnbcOfficers = [];
    try {
      const cnbcUrl = `https://www.cnbc.com/quotes/${ticker}?tab=profile`;
      const cnbcRes = await fetch(cnbcUrl);
      if (cnbcRes.ok) {
        const html = await cnbcRes.text();
        const regex = /<div class="CompanyProfile-officer"><div>([^<]+)<\/div><div class="CompanyProfile-officerTitle">([^<]+)<\/div><\/div>/g;
        let match;
        while ((match = regex.exec(html)) !== null) {
          cnbcOfficers.push({
            name: match[1].trim(),
            title: match[2].trim(),
            age: null,
            pay: 0
          });
        }
      }
    } catch (e) {
      console.warn("Failed to fetch CNBC profile:", e.message);
    }

    const rawOfficers = summary.assetProfile?.companyOfficers || summary.summaryProfile?.companyOfficers || [];
    const yahooOfficers = rawOfficers.map(o => ({
      name: o.name,
      title: o.title,
      age: o.age || null,
      pay: o.totalPay || 0
    }));

    let mergedOfficers = [];
    if (cnbcOfficers.length > 0) {
      mergedOfficers = cnbcOfficers.map(c => {
        const yMatch = yahooOfficers.find(y => nameMatches(c.name, y.name));
        if (yMatch) {
          return {
            ...c,
            age: yMatch.age,
            pay: yMatch.pay
          };
        }
        return c;
      });
    } else {
      mergedOfficers = yahooOfficers.slice(0, 4);
    }

    const profile = {
      description: summary.assetProfile?.longBusinessSummary || summary.summaryProfile?.longBusinessSummary || '',
      industry: summary.assetProfile?.industry || summary.summaryProfile?.industry || '',
      website: summary.assetProfile?.website || summary.summaryProfile?.website || '',
      officers: mergedOfficers,
      address: `${summary.assetProfile?.address1 || summary.summaryProfile?.address1 || ''}, ${summary.assetProfile?.city || summary.summaryProfile?.city || ''} ${summary.assetProfile?.state || summary.summaryProfile?.state || ''} ${summary.assetProfile?.zip || summary.summaryProfile?.zip || ''}`.replace(/^, | , | $/g, '').trim()
    };

    // 4. Fetch News & Competitors (Fail gracefully if not available)
    let news = [];
    let competitors = [];
    try {
      const searchRes = await yahooFinance.search(ticker, {}, { validateResult: false });
      if (searchRes.news) {
        news = searchRes.news.slice(0, 3).map(n => ({ title: n.title, link: n.link, publisher: n.publisher }));
      }
      const recs = await yahooFinance.recommendationsBySymbol(ticker, {}, { validateResult: false });
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
        dividendRate,
        sector,
        targetPrice,
        eps,
        bvps,
        debtToEquity,
        currentRatio,
        returnOnEquity,
        chartData,
        news,
        competitors,
        currency,
        currencySymbol,
        keyStats: { volume, avgVolume, dayHigh, dayLow, fiftyTwoWeekHigh, fiftyTwoWeekLow, marketCap, sharesOutstanding, beta },
        ratios: { ebitda, revenue, grossMargins, netMargins },
        events: { nextEarningsDate, exDivDate },
        returns,
        earningsChart,
        profile
      })
    };

  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
