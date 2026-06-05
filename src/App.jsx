import { useState, useEffect } from 'react';
import { Search, Info, PieChart, BookmarkPlus, Trash2, TrendingUp, DollarSign, Loader2 } from 'lucide-react';
import './index.css';

function App() {
  const [ticker, setTicker] = useState('');
  const [data, setData] = useState({
    price: '',
    peRatio: '',
    epsGrowth: '',
    dividendYield: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [valuation, setValuation] = useState(null);
  const [watchlist, setWatchlist] = useState([]);

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

  const saveWatchlist = (newList) => {
    setWatchlist(newList);
    localStorage.setItem('stockWatchlist', JSON.stringify(newList));
  };

  const handleFetch = async (e) => {
    e.preventDefault();
    if (!ticker) return;

    setLoading(true);
    setError(null);
    setValuation(null);

    try {
      const response = await fetch(`/.netlify/functions/fetchStock?ticker=${ticker}`);
      if (!response.ok) {
        throw new Error('Failed to fetch data. Ticker might be invalid or not supported.');
      }
      
      const result = await response.json();
      
      setData({
        price: result.currentPrice || '',
        peRatio: result.peRatio || '',
        epsGrowth: result.epsGrowth || '',
        dividendYield: result.dividendYield || '0'
      });
      
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCalculate = () => {
    const pe = parseFloat(data.peRatio);
    const growth = parseFloat(data.epsGrowth);
    const yieldPct = parseFloat(data.dividendYield);
    const price = parseFloat(data.price);

    if (isNaN(pe) || isNaN(growth) || isNaN(yieldPct) || isNaN(price)) {
      setError('Please ensure all fields are valid numbers.');
      return;
    }

    if (pe <= 0) {
      setError('P/E Ratio must be greater than zero for this valuation model.');
      return;
    }

    const ratio = (growth + yieldPct) / pe;
    
    // Calculate a rough "Fair Price" by equating Ratio to 1.0
    // If Ratio = (G + Y) / PE, and PE = Price / EPS
    // PE_fair = (G + Y) / 1.0
    // Price_fair = PE_fair * EPS = (G + Y) * (Price / PE)
    const currentEps = price / pe;
    const fairPrice = (growth + yieldPct) * currentEps;

    let status = '';
    let statusClass = '';

    if (ratio < 1.0) {
      status = 'Potentially Overvalued';
      statusClass = 'status-overvalued';
    } else if (ratio <= 1.5) {
      status = 'Potentially Fairly Valued';
      statusClass = 'status-fair';
    } else {
      status = 'Potentially Undervalued';
      statusClass = 'status-undervalued';
    }

    setValuation({
      ratio: ratio.toFixed(2),
      fairPrice: fairPrice.toFixed(2),
      status,
      statusClass
    });
    setError(null);
  };

  const handleSaveToWatchlist = () => {
    if (!ticker || !valuation) return;
    
    const newItem = {
      ticker: ticker.toUpperCase(),
      price: data.price,
      ratio: valuation.ratio,
      status: valuation.status
    };

    const existingIndex = watchlist.findIndex(item => item.ticker === newItem.ticker);
    let newList = [...watchlist];
    
    if (existingIndex >= 0) {
      newList[existingIndex] = newItem;
    } else {
      newList.push(newItem);
    }
    
    saveWatchlist(newList);
  };

  const removeFromWatchlist = (t) => {
    saveWatchlist(watchlist.filter(item => item.ticker !== t));
  };

  return (
    <div className="container">
      <div className="header-icons">
        <PieChart size={28} color="var(--accent-color)" />
        <TrendingUp size={28} />
      </div>
      
      <h1>Fair Stock Price Calculator</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: '0.875rem' }}>
        Based on Peter Lynch principles
      </p>

      <div className="glass-panel">
        <form onSubmit={handleFetch}>
          <div className="form-group">
            <label>Ticker Symbol</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input 
                type="text" 
                value={ticker}
                onChange={(e) => setTicker(e.target.value.toUpperCase())}
                placeholder="e.g. AAPL"
                style={{ flex: 1 }}
                required
              />
              <button type="submit" className="btn" style={{ width: 'auto' }} disabled={loading}>
                {loading ? <Loader2 className="loading-spinner" size={20} /> : <Search size={20} />}
              </button>
            </div>
            {error && <div className="error-message">{error}</div>}
          </div>
        </form>

        <div className="form-group">
          <label>Current Stock Price ($)</label>
          <input 
            type="number" 
            step="any"
            value={data.price}
            onChange={(e) => setData({...data, price: e.target.value})}
            placeholder="0.00"
          />
        </div>

        <div className="form-group">
          <label>P/E Ratio (TTM)</label>
          <input 
            type="number" 
            step="any"
            value={data.peRatio}
            onChange={(e) => setData({...data, peRatio: e.target.value})}
            placeholder="e.g. 25.5"
          />
        </div>

        <div className="form-group">
          <label>Future EPS Growth (%)</label>
          <input 
            type="number" 
            step="any"
            value={data.epsGrowth}
            onChange={(e) => setData({...data, epsGrowth: e.target.value})}
            placeholder="e.g. 15.0"
          />
        </div>

        <div className="form-group">
          <label>Dividend Yield (%)</label>
          <input 
            type="number" 
            step="any"
            value={data.dividendYield}
            onChange={(e) => setData({...data, dividendYield: e.target.value})}
            placeholder="e.g. 1.5"
          />
        </div>

        <button className="btn" onClick={handleCalculate} style={{ marginTop: '0.5rem' }}>
          Calculate Valuation
        </button>
      </div>

      {valuation && (
        <div className="glass-panel fade-in">
          <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Valuation Results</h2>
          
          <div className="data-grid">
            <div className="data-item">
              <span className="data-label">Lynch-Inspired Ratio</span>
              <span className="data-value">{valuation.ratio}</span>
            </div>
            <div className="data-item">
              <span className="data-label">Calculated Fair Price</span>
              <span className="data-value">${valuation.fairPrice}</span>
            </div>
          </div>

          <div className={`status-badge ${valuation.statusClass}`}>
            {valuation.status} (Fair: ${valuation.fairPrice})
          </div>

          <button className="btn btn-secondary" onClick={handleSaveToWatchlist}>
            <BookmarkPlus size={20} /> Save to Watchlist
          </button>
        </div>
      )}

      {watchlist.length > 0 && (
        <div className="glass-panel watchlist-container fade-in">
          <h3 style={{ fontSize: '1.125rem', marginBottom: '1rem' }}>Watchlist</h3>
          {watchlist.map((item) => (
            <div key={item.ticker} className="watchlist-item">
              <div className="watchlist-item-details">
                <span className="watchlist-ticker">{item.ticker} - ${item.price}</span>
                <span className="watchlist-status">{item.status} (Ratio: {item.ratio})</span>
              </div>
              <button className="delete-btn" onClick={() => removeFromWatchlist(item.ticker)}>
                <Trash2 size={18} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="glass-panel">
        <h3 style={{ fontSize: '1.125rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Info size={20} color="var(--accent-color)" /> Ratio Interpretation Guide
        </h3>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
          Based on: Ratio = (EPS Growth % + Dividend Yield %) / P/E Ratio
        </p>
        <table className="guide-table">
          <thead>
            <tr>
              <th>Ratio Range</th>
              <th>Interpretation</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>&lt; 1.0</td>
              <td>Potentially Overvalued</td>
            </tr>
            <tr>
              <td>1.0 - 1.5</td>
              <td>Potentially Fairly Valued</td>
            </tr>
            <tr>
              <td>&gt; 1.5</td>
              <td>Potentially Undervalued</td>
            </tr>
          </tbody>
        </table>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '1rem', fontStyle: 'italic' }}>
          Remember: This is a simplified metric. Always conduct further research. Disclaimer: For educational purposes only. Not financial advice.
        </p>
      </div>
    </div>
  );
}

export default App;
