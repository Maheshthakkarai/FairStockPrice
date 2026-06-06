import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

export const handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const query = event.queryStringParameters.q;
  const region = event.queryStringParameters.region || 'US';
  
  if (!query) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Query is required' }) };
  }

  try {
    const suffixes = {
      'CA': ['.TO', '.V', '.NE'],
      'UK': ['.L', '.IL'],
      'IN': ['.NS', '.BO'],
      'AU': ['.AX'],
      'EU': ['.PA', '.DE', '.AS', '.MI', '.MC', '.F', '.SW']
    };

    let searchQueries = [query];
    
    // If region is not US and query doesn't already have a dot, also query with the primary region suffix
    if (region !== 'US' && suffixes[region] && !query.includes('.')) {
      searchQueries.push(`${query}${suffixes[region][0]}`);
    }

    // Run searches in parallel
    const searchPromises = searchQueries.map(q => yahooFinance.search(q));
    const resultsArray = await Promise.all(searchPromises);
    
    // Combine and deduplicate quotes
    let allQuotes = [];
    const seen = new Set();
    
    resultsArray.forEach(res => {
      if (res && res.quotes) {
        res.quotes.forEach(q => {
          if (!seen.has(q.symbol)) {
            seen.add(q.symbol);
            allQuotes.push(q);
          }
        });
      }
    });

    // Filter to only Equity (stocks) and ETFs
    let filtered = allQuotes.filter(q => q.quoteType === 'EQUITY' || q.quoteType === 'ETF');
    
    // Region Filter
    if (region !== 'US') {
      const allowedSuffixes = suffixes[region] || [];
      if (allowedSuffixes.length > 0) {
        filtered = filtered.filter(q => allowedSuffixes.some(suffix => q.symbol.endsWith(suffix)));
      }
    } else {
      // US stocks generally don't have a dot suffix, or they might have .OTC
      filtered = filtered.filter(q => !q.symbol.includes('.') || q.symbol.endsWith('.PK'));
    }

    const formatted = filtered.slice(0, 5).map(q => ({
      symbol: q.symbol,
      name: q.shortname || q.longname,
      exchange: q.exchange
    }));

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(formatted)
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
