import { useState, useEffect, useRef } from 'react';
import { Search, Info, PieChart, BookmarkPlus, Trash2, TrendingUp, Download, X, AlertTriangle, Loader2, RefreshCw, Share2, Activity, Target, Shield, Newspaper, Users, Edit2, Briefcase, Zap } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import * as htmlToImage from 'html-to-image';
import './index.css';

const getCurrencySymbol = (currency, fallbackSymbol) => {
  const symbolsMap = {
    'USD': '$', 'CAD': 'C$', 'GBP': '£', 'GBp': 'GBp ',
    'INR': '₹', 'AUD': 'A$', 'EUR': '€', 'CHF': 'CHF ',
    'JPY': '¥', 'HKD': 'HK$', 'SGD': 'S$', 'CNY': '¥'
  };
  return symbolsMap[currency] || fallbackSymbol || '$';
};

function App() {
  const [ticker, setTicker] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [region, setRegion] = useState('US');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [valuation, setValuation] = useState(null);
  
  const [watchlist, setWatchlist] = useState([]);
  const [refreshingTickers, setRefreshingTickers] = useState({});

  const [showModal, setShowModal] = useState(false);
  const [editingPortfolioItem, setEditingPortfolioItem] = useState(null);
  
  const captureRef = useRef(null);

  useEffect(() => {
    const saved = localStorage.getItem('stockWatchlist');
    if (saved) {
      try {
        setWatchlist(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load watchlist', e);
      }
    }

  }, []);

  // Background Watchlist Monitoring (Local Notification)
  useEffect(() => {
    const interval = setInterval(async () => {
      if (watchlist.length === 0 || !('Notification' in window) || Notification.permission !== 'granted') return;
      
      // Pick a random stock from watchlist to check to avoid spamming the API
      const itemToCheck = watchlist[Math.floor(Math.random() * watchlist.length)];
      try {
        const response = await fetch(`/.netlify/functions/fetchAdvancedStock?ticker=${itemToCheck.ticker}`);
        if (response.ok) {
          const res = await response.json();
          const currentPrice = parseFloat(res.currentPrice);
          const fairPrice = parseFloat(itemToCheck.fairPrice);
          
          if (currentPrice < fairPrice && itemToCheck.price >= fairPrice) {
            // Price just dropped below fair value
            new Notification('StockCalc Alert', {
              body: `🚨 ${itemToCheck.ticker} has dropped below its Fair Value to $${currentPrice.toFixed(2)}!`,
              icon: '/icon-192.png'
            });
            
            // Update watchlist with new price to prevent repeated alerts
            const updatedList = watchlist.map(item => 
              item.ticker === itemToCheck.ticker ? { ...item, price: currentPrice.toFixed(2) } : item
            );
            saveWatchlist(updatedList);
          }
        }
      } catch (e) {
        console.error("Background check failed", e);
      }
    }, 60000); // Check every 60 seconds

    return () => clearInterval(interval);
  }, [watchlist]);

  // Autocomplete debounce
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchQuery.length >= 2) {
        setIsSearching(true);
        try {
          const res = await fetch(`/.netlify/functions/fetchSearch?q=${searchQuery}&region=${region}`);
          const data = await res.json();
          if (Array.isArray(data)) setSuggestions(data);
        } catch (e) {
          console.error('Search error', e);
        }
        setIsSearching(false);
      } else {
        setSuggestions([]);
      }
    }, 300);
    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const triggerHaptic = () => {
    if (navigator.vibrate) navigator.vibrate(50);
  };


  const saveWatchlist = (newList) => {
    setWatchlist(newList);
    localStorage.setItem('stockWatchlist', JSON.stringify(newList));
  };

  const calculateBlendedValuation = (res) => {
    const pe = parseFloat(res.peRatio || '0');
    const growth = parseFloat(res.epsGrowth || '0');
    const yieldPct = parseFloat(res.dividendYield || '0');
    const price = parseFloat(res.currentPrice || '0');
    const eps = parseFloat(res.eps || '0');
    const bvps = parseFloat(res.bvps || '0');
    const target = parseFloat(res.targetPrice || '0');
    const sym = getCurrencySymbol(res.currency, res.currencySymbol);

    // 1. Lynch Model
    let lynchFairPrice = 0;
    let lynchRatio = 0;
    if (pe > 0 && price > 0 && (growth + yieldPct) > 0) {
      lynchRatio = (growth + yieldPct) / pe;
      const currentEps = price / pe;
      lynchFairPrice = (growth + yieldPct) * currentEps;
    }

    // 2. Graham Number
    let grahamFairPrice = 0;
    if (eps > 0 && bvps > 0) {
      grahamFairPrice = Math.sqrt(22.5 * eps * bvps);
    }

    // 3. Analyst Target
    const analystTarget = target > 0 ? target : 0;

    // Blended Average
    let modelsCount = 0;
    let sumFairPrice = 0;
    if (lynchFairPrice > 0) { sumFairPrice += lynchFairPrice; modelsCount++; }
    if (grahamFairPrice > 0) { sumFairPrice += grahamFairPrice; modelsCount++; }
    if (analystTarget > 0) { sumFairPrice += analystTarget; modelsCount++; }

    const blendedFairPrice = modelsCount > 0 ? sumFairPrice / modelsCount : 0;
    
    let status = 'Unavailable';
    let statusClass = '';
    
    if (blendedFairPrice > 0) {
      if (price < blendedFairPrice * 0.9) {
        status = 'Undervalued';
        statusClass = 'status-undervalued';
      } else if (price > blendedFairPrice * 1.1) {
        status = 'Overvalued';
        statusClass = 'status-overvalued';
      } else {
        status = 'Fairly Valued';
        statusClass = 'status-fair';
      }
    }

    return {
      ratio: lynchRatio > 0 ? lynchRatio.toFixed(2) : 'N/A',
      lynchFairPrice: lynchFairPrice > 0 ? sym + lynchFairPrice.toFixed(2) : 'N/A',
      grahamFairPrice: grahamFairPrice > 0 ? sym + grahamFairPrice.toFixed(2) : 'N/A',
      analystTarget: analystTarget > 0 ? sym + analystTarget.toFixed(2) : 'N/A',
      blendedFairPrice: blendedFairPrice > 0 ? sym + blendedFairPrice.toFixed(2) : 'N/A',
      status,
      statusClass
    };
  };

  const handleFetch = async (tickerToFetch) => {
    triggerHaptic();
    if (!tickerToFetch) return;
    
    setTicker(tickerToFetch);
    setSearchQuery(tickerToFetch);
    setShowSuggestions(false);
    setLoading(true);
    setError(null);
    setValuation(null);
    setData(null);

    try {
      const response = await fetch(`/.netlify/functions/fetchAdvancedStock?ticker=${tickerToFetch}`);
      if (!response.ok) {
        throw new Error('Failed to fetch data. Ticker might be invalid or not supported.');
      }
      
      const result = await response.json();
      setData(result);
      
      const val = calculateBlendedValuation(result);
      setValuation(val);
      
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveToWatchlist = () => {
    triggerHaptic();
    if (!ticker || !valuation || !data) return;
    
    const tickerUpper = ticker.toUpperCase();
    const existingIndex = watchlist.findIndex(item => item.ticker === tickerUpper);

    const newItem = {
      ticker: tickerUpper,
      price: data.currentPrice,
      fairPrice: valuation.blendedFairPrice,
      status: valuation.status,
      sector: data.sector || 'Unknown',
      currency: data.currency || 'USD',
      currencySymbol: getCurrencySymbol(data.currency, data.currencySymbol),
      shares: existingIndex >= 0 ? watchlist[existingIndex].shares || 0 : 0,
      avgCost: existingIndex >= 0 ? watchlist[existingIndex].avgCost || 0 : 0
    };

    let newList = [...watchlist];
    
    if (existingIndex >= 0) {
      newList[existingIndex] = newItem;
    } else {
      newList.push(newItem);
    }
    
    saveWatchlist(newList);
  };

  const removeFromWatchlist = (t) => {
    triggerHaptic();
    saveWatchlist(watchlist.filter(item => item.ticker !== t));
  };

  const handleRefreshWatchlistItem = async (tickerToRefresh) => {
    triggerHaptic();
    setRefreshingTickers(prev => ({ ...prev, [tickerToRefresh]: true }));
    try {
      const response = await fetch(`/.netlify/functions/fetchAdvancedStock?ticker=${tickerToRefresh}`);
      if (!response.ok) throw new Error('Failed to refresh data');
      const result = await response.json();
      const val = calculateBlendedValuation(result);

      const updatedList = watchlist.map(item => {
        if (item.ticker === tickerToRefresh) {
          return {
            ...item,
            price: result.currentPrice ? result.currentPrice.toFixed(2) : item.price,
            fairPrice: val.blendedFairPrice !== '0.00' ? val.blendedFairPrice : item.fairPrice,
            status: val.status !== 'Unavailable' ? val.status : item.status,
            sector: result.sector || item.sector || 'Unknown',
            currency: result.currency || item.currency || 'USD',
            currencySymbol: getCurrencySymbol(result.currency || item.currency, result.currencySymbol || item.currencySymbol)
          };
        }
        return item;
      });
      saveWatchlist(updatedList);
    } catch (error) {
      console.error('Error refreshing ' + tickerToRefresh, error);
    } finally {
      setRefreshingTickers(prev => ({ ...prev, [tickerToRefresh]: false }));
    }
  };

  const handleSavePortfolio = (e) => {
    e.preventDefault();
    triggerHaptic();
    const updatedList = watchlist.map(item => 
      item.ticker === editingPortfolioItem.ticker ? editingPortfolioItem : item
    );
    saveWatchlist(updatedList);
    setEditingPortfolioItem(null);
  };

  const getPortfolioStatsByCurrency = () => {
    let portfolios = {};

    watchlist.forEach(item => {
      const shares = parseFloat(item.shares) || 0;
      if (shares > 0) {
        const cur = item.currency || 'USD';
        const sym = getCurrencySymbol(item.currency, item.currencySymbol);
        
        if (!portfolios[cur]) {
          portfolios[cur] = {
            currency: cur,
            symbol: sym,
            totalValue: 0,
            totalCost: 0,
            insights: [],
            sectorWeights: {},
            hasPortfolio: true
          };
        }

        const p = portfolios[cur];
        const val = shares * (parseFloat(item.price) || 0);
        const cost = shares * (parseFloat(item.avgCost) || 0);
        p.totalValue += val;
        p.totalCost += cost;
        const s = item.sector || 'Unknown';
        p.sectorWeights[s] = (p.sectorWeights[s] || 0) + val;
      }
    });

    Object.values(portfolios).forEach(p => {
      p.returnPct = p.totalCost > 0 ? ((p.totalValue - p.totalCost) / p.totalCost) * 100 : 0;
      p.returnVal = p.totalValue - p.totalCost;

      if (p.totalValue > 0) {
        Object.keys(p.sectorWeights).forEach(s => {
          if (p.sectorWeights[s] / p.totalValue > 0.6) {
            p.insights.push(`⚠️ Concentration Risk: Over 60% of your ${p.currency} portfolio is in ${s}. Consider diversifying.`);
          }
        });
      }

      watchlist.filter(i => (i.currency || 'USD') === p.currency).forEach(item => {
        const shares = parseFloat(item.shares) || 0;
        // Strip non-numeric chars from fairPrice
        const fp = parseFloat((item.fairPrice || '0').replace(/[^0-9.-]+/g, ''));
        if (shares > 0 && parseFloat(item.price) < fp * 0.8) {
          p.insights.push(`💡 Opportunity: ${item.ticker} is trading 20%+ below its Ultimate Fair Value!`);
        }
      });
    });

    return Object.values(portfolios);
  };

  const handleShare = async () => {
    triggerHaptic();
    if (captureRef.current) {
      try {
        const dataUrl = await htmlToImage.toPng(captureRef.current, { cacheBust: true, backgroundColor: '#0f1115' });
        
        // Native Web Share if available
        if (navigator.share) {
          const blob = await (await fetch(dataUrl)).blob();
          const file = new File([blob], `${ticker}_valuation.png`, { type: 'image/png' });
          await navigator.share({
            title: `${ticker} Valuation - StockCalc`,
            text: `Check out the ultimate fair value for ${ticker}!`,
            files: [file]
          });
        } else {
          // Fallback download
          const link = document.createElement('a');
          link.download = `${ticker}-stockcalc.png`;
          link.href = dataUrl;
          link.click();
        }
      } catch (err) {
        console.error('Error sharing image', err);
        alert('Sharing failed. Try downloading instead.');
      }
    }
  };

  return (
    <div className="container">

      <div className="top-actions">
        <div className="header-icons">
          <Activity size={28} color="var(--accent-color)" />
          <span style={{ fontSize: '1.2rem', fontWeight: 'bold', marginLeft: '0.5rem' }}>StockCalc Pro</span>
        </div>
        
        <div style={{ display: 'flex', gap: '0.5rem' }}>

          <button className="btn btn-secondary icon-btn" onClick={() => { triggerHaptic(); setShowModal(true); }}>
            <Info size={18} /> <span className="hide-on-mobile">How to Use</span>
          </button>
        </div>
      </div>
      
      <div className="glass-panel search-panel">
        <form onSubmit={(e) => { 
          e.preventDefault(); 
          const q = searchQuery.trim().toUpperCase();
          if (suggestions.length > 0 && !q.includes('.')) {
            handleFetch(suggestions[0].symbol);
          } else {
            handleFetch(q); 
          }
        }} style={{ position: 'relative' }}>
          <label>Search Ticker</label>
          <div style={{ display: 'flex', gap: '0.5rem', position: 'relative' }}>
            <select 
              value={region} 
              onChange={e => setRegion(e.target.value)}
              style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--panel-border)', background: '#111827', color: '#fff', fontSize: '0.9rem' }}
            >
              <option value="US">🇺🇸 US</option>
              <option value="CA">🇨🇦 CA</option>
              <option value="UK">🇬🇧 UK</option>
              <option value="IN">🇮🇳 IN</option>
              <option value="AU">🇦🇺 AU</option>
              <option value="EU">🇪🇺 EU</option>
            </select>
            <div className="autocomplete-wrapper" style={{ flex: 1 }}>
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value.toUpperCase());
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                placeholder="e.g. AAPL, MSFT"
                required
              />
              {showSuggestions && suggestions.length > 0 && (
                <ul className="autocomplete-dropdown">
                  {suggestions.map((s, idx) => (
                    <li key={idx} onClick={() => handleFetch(s.symbol)}>
                      <strong>{s.symbol}</strong> - {s.name} <span style={{fontSize:'0.7rem', color:'var(--text-secondary)'}}>({s.exchange})</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <button type="submit" className="btn icon-btn" disabled={loading}>
              {loading ? <Loader2 className="loading-spinner" size={20} /> : <Search size={20} />}
            </button>
          </div>
          {error && <div className="error-message">{error}</div>}
        </form>
      </div>

      {!data && !loading && (
        <div className="glass-panel fade-in">
          <h3 style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }}>Popular Searches</h3>
          <div className="trending-tags">
            {['NVDA', 'TSLA', 'AAPL', 'AMD', 'META'].map(t => (
              <span key={t} className="trend-tag" onClick={() => handleFetch(t)}>{t}</span>
            ))}
          </div>
        </div>
      )}

      {data && valuation && (
        <div ref={captureRef} className="valuation-capture-area">
          <div className="glass-panel fade-in">
            <div className="stock-header">
              <div>
                <h2 style={{ fontSize: '1.5rem', margin: 0 }}>{ticker}</h2>
                <span className="sector-badge">{data.sector}</span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{getCurrencySymbol(data.currency, data.currencySymbol)}{data.currentPrice?.toFixed(2)}</span>
              </div>
            </div>

            <div className={`status-badge ${valuation.statusClass}`}>
              {valuation.status} (Fair: {valuation.blendedFairPrice})
            </div>

            {data.chartData && data.chartData.length > 0 && (
              <div className="chart-container">
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={data.chartData}>
                    <XAxis dataKey="date" stroke="var(--text-secondary)" fontSize={10} tickFormatter={(val) => val.split('-')[1]} />
                    <YAxis 
                      domain={[
                        dataMin => Math.floor(Math.min(dataMin, valuation.blendedFairPrice !== 'N/A' ? parseFloat(valuation.blendedFairPrice.replace(/[^0-9.-]+/g, '')) : dataMin) * 0.95), 
                        dataMax => Math.ceil(Math.max(dataMax, valuation.blendedFairPrice !== 'N/A' ? parseFloat(valuation.blendedFairPrice.replace(/[^0-9.-]+/g, '')) : dataMax) * 1.05)
                      ]} 
                      stroke="var(--text-secondary)" 
                      fontSize={10} 
                      width={40} 
                    />
                    <Tooltip contentStyle={{ backgroundColor: 'var(--bg-color)', borderColor: 'var(--panel-border)' }} />
                    {valuation.blendedFairPrice !== 'N/A' && (
                      <ReferenceLine y={parseFloat(valuation.blendedFairPrice.replace(/[^0-9.-]+/g, ''))} stroke="var(--success-color)" strokeDasharray="3 3" />
                    )}
                    <Line type="monotone" dataKey="price" stroke="var(--accent-color)" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
                <div style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                  1-Year Price History vs. <span style={{color: 'var(--success-color)'}}>Fair Value Line</span>
                </div>
              </div>
            )}

            <div className="data-grid">
              <div className="data-item">
                <Shield size={16} color="var(--accent-color)" style={{marginBottom: '0.25rem'}}/>
                <span className="data-label">Graham Number</span>
                <span className="data-value">{valuation.grahamFairPrice}</span>
              </div>
              <div className="data-item">
                <Target size={16} color="var(--accent-color)" style={{marginBottom: '0.25rem'}}/>
                <span className="data-label">Analyst Target</span>
                <span className="data-value">{valuation.analystTarget}</span>
              </div>
              <div className="data-item">
                <PieChart size={16} color="var(--accent-color)" style={{marginBottom: '0.25rem'}}/>
                <span className="data-label">Lynch Fair Price</span>
                <span className="data-value">{valuation.lynchFairPrice}</span>
              </div>
              <div className="data-item highlight-item">
                <TrendingUp size={16} color="var(--success-color)" style={{marginBottom: '0.25rem'}}/>
                <span className="data-label">Ultimate Fair Price</span>
                <span className="data-value">{valuation.blendedFairPrice}</span>
              </div>
            </div>

            {/* V3: News and Competitors */}
            <div className="v3-features-container" style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {data.competitors && data.competitors.length > 0 && (
                <div className="competitors-card" style={{ padding: '1rem', backgroundColor: '#1f2937', borderRadius: '12px', border: '1px solid var(--panel-border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', color: 'var(--text-secondary)' }}>
                    <Users size={16} /> <span>Peer Comparison</span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {data.competitors.map(comp => (
                      <button key={comp} onClick={() => handleFetch(comp)} style={{ background: '#374151', border: 'none', color: '#fff', padding: '0.5rem 1rem', borderRadius: '20px', cursor: 'pointer', fontSize: '0.85rem' }}>
                        {comp}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {data.news && data.news.length > 0 && (
                <div className="news-card" style={{ padding: '1rem', backgroundColor: '#1f2937', borderRadius: '12px', border: '1px solid var(--panel-border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', color: 'var(--text-secondary)' }}>
                    <Newspaper size={16} /> <span>Latest News</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {data.news.map((item, idx) => (
                      <a key={idx} href={item.link} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-color)', textDecoration: 'none', display: 'block', paddingBottom: idx !== data.news.length - 1 ? '0.75rem' : '0', borderBottom: idx !== data.news.length - 1 ? '1px solid var(--panel-border)' : 'none' }}>
                        <div style={{ fontSize: '0.9rem', marginBottom: '0.25rem', lineHeight: '1.4' }}>{item.title}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--accent-color)' }}>{item.publisher}</div>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }} data-html2canvas-ignore="true">
              <button className="btn btn-secondary" onClick={handleSaveToWatchlist} style={{ flex: 1 }}>
                <BookmarkPlus size={20} /> Save
              </button>
              <button className="btn btn-secondary" onClick={handleShare} style={{ flex: 1, backgroundColor: 'rgba(59, 130, 246, 0.2)' }}>
                <Share2 size={20} /> Share
              </button>
            </div>
          </div>
        </div>
      )}

      {(() => {
        const portfolios = getPortfolioStatsByCurrency();
        if (portfolios.length === 0) return null;
        
        return portfolios.map(stats => {
          const flagCodes = { USD: 'us', CAD: 'ca', GBP: 'gb', GBp: 'gb', INR: 'in', AUD: 'au', EUR: 'eu', CHF: 'ch', JPY: 'jp', HKD: 'hk', SGD: 'sg', CNY: 'cn' };
          const fCode = flagCodes[stats.currency] || 'un';
          const flagImg = <img src={`https://flagcdn.com/w20/${fCode}.png`} srcSet={`https://flagcdn.com/w40/${fCode}.png 2x`} width="20" alt={stats.currency} style={{ borderRadius: '2px' }} />;
          
          return (
          <div key={stats.currency} className="glass-panel fade-in" style={{ marginBottom: '1.5rem', border: '1px solid var(--accent-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: 'var(--accent-color)' }}>
              <Briefcase size={20} /> <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.125rem', margin: 0 }}>{flagImg} My Portfolio ({stats.currency})</h3>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1.5rem' }}>
              <div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Total Value</div>
                <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{stats.symbol}{stats.totalValue.toFixed(2)}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>All-Time Return</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: stats.returnVal >= 0 ? 'var(--success-color)' : '#ef4444' }}>
                  {stats.returnVal >= 0 ? '+' : ''}{stats.symbol}{stats.returnVal.toFixed(2)} ({stats.returnPct >= 0 ? '+' : ''}{stats.returnPct.toFixed(2)}%)
                </div>
              </div>
            </div>

            {stats.insights.length > 0 && (
              <div style={{ backgroundColor: '#1f2937', padding: '1rem', borderRadius: '12px', border: '1px solid #374151' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', color: '#eab308' }}>
                  <Zap size={16} /> <span style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>Agentic Robo-Advisor</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.85rem', lineHeight: '1.4' }}>
                  {stats.insights.map((ins, i) => <div key={i}>{ins}</div>)}
                </div>
              </div>
            )}
          </div>
          );
        });
      })()}

      {watchlist.length > 0 && (
        <div className="glass-panel watchlist-container fade-in">
          <h3 style={{ fontSize: '1.125rem', marginBottom: '1rem' }}>Watchlist</h3>
          {watchlist.map((item) => (
            <div key={item.ticker} className="watchlist-item">
              <div className="watchlist-item-details">
                <span className="watchlist-ticker">{item.ticker} - {getCurrencySymbol(item.currency, item.currencySymbol)}{item.price}</span>
                <span className="watchlist-status">{item.status} (Fair: {item.fairPrice})</span>
                {parseFloat(item.shares) > 0 && (
                  <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                    {item.shares} shares @ {getCurrencySymbol(item.currency, item.currencySymbol)}{item.avgCost} | Value: {getCurrencySymbol(item.currency, item.currencySymbol)}{(parseFloat(item.shares) * parseFloat(item.price)).toFixed(2)}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="delete-btn" onClick={() => setEditingPortfolioItem(item)}>
                  <Edit2 size={18} />
                </button>
                <button className="delete-btn" onClick={() => handleRefreshWatchlistItem(item.ticker)} disabled={refreshingTickers[item.ticker]}>
                  {refreshingTickers[item.ticker] ? <Loader2 size={18} className="loading-spinner" /> : <RefreshCw size={18} />}
                </button>
                <button className="delete-btn" onClick={() => removeFromWatchlist(item.ticker)}>
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <footer className="disclaimer-footer">
        <div className="disclaimer-header">
          <AlertTriangle size={16} color="var(--accent-color)" /> Legal Disclaimer
        </div>
        <p>This application is <strong>NOT a commercial product</strong> and does <strong>NOT provide financial advice</strong>. All information and logic within is provided strictly for educational and informational purposes.</p>
        <p>The creator assumes no liability for any financial losses, damages, copyright infringements, or legal issues arising from the use of this tool. Always conduct your own research or consult a certified financial advisor before making investment decisions.</p>
      </footer>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.25rem', margin: 0 }}>How to Use StockCalc Pro</h2>
              <button onClick={() => setShowModal(false)} className="delete-btn" style={{ background: 'transparent', padding:0 }}><X size={24} color="var(--text-primary)" /></button>
            </div>
            <div className="modal-body" style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.6' }}>
              <p><strong>1. Search:</strong> Enter a valid US stock ticker (e.g., AAPL) using the auto-complete search box.</p>
              <p><strong>2. Blended Valuation:</strong> Unlike basic tools, StockCalc Pro fetches historical data and combines three legendary models to find the Ultimate Fair Price:
                <br/>• <em>Graham Number</em> (Defensive asset-based valuation)
                <br/>• <em>Lynch Fair Price</em> (PEG & Dividend yield growth model)
                <br/>• <em>Analyst Target</em> (Consensus 1-yr Wall Street target)
              </p>
              <p><strong>3. Charting:</strong> The 1-year history chart overlays the calculated Fair Value line so you can instantly see if the stock is currently trading at a discount.</p>
              <p><strong>4. Smart Watchlist:</strong> Save stocks to your list. The app checks prices in the background and will send a notification if a stock drops below fair value!</p>
            </div>
          </div>
        </div>
      )}

      {editingPortfolioItem && (
        <div className="modal-overlay" onClick={() => setEditingPortfolioItem(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', margin: 0 }}>Edit Portfolio: {editingPortfolioItem.ticker}</h2>
              <button onClick={() => setEditingPortfolioItem(null)} className="delete-btn" style={{ background: 'transparent', padding:0 }}><X size={24} color="var(--text-primary)" /></button>
            </div>
            <form onSubmit={handleSavePortfolio}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Number of Shares</label>
                <input 
                  type="number" 
                  step="any" 
                  min="0"
                  value={editingPortfolioItem.shares || ''}
                  onChange={e => setEditingPortfolioItem({...editingPortfolioItem, shares: e.target.value})}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--panel-border)', background: '#111827', color: '#fff' }}
                  placeholder="e.g. 10.5"
                />
              </div>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Average Cost ({getCurrencySymbol(editingPortfolioItem.currency, editingPortfolioItem.currencySymbol)})</label>
                <input 
                  type="number" 
                  step="any" 
                  min="0"
                  value={editingPortfolioItem.avgCost || ''}
                  onChange={e => setEditingPortfolioItem({...editingPortfolioItem, avgCost: e.target.value})}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--panel-border)', background: '#111827', color: '#fff' }}
                  placeholder="e.g. 150.25"
                />
              </div>
              <button type="submit" className="btn btn-secondary" style={{ width: '100%', backgroundColor: 'var(--accent-color)' }}>Save Holdings</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
