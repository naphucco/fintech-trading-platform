/**
 * COMPONENT: MarketData
 * CHỨC NĂNG: Hiển thị real-time market data và quản lý subscription
 * - Hiển thị giá và biến động cho các symbols
 * - Cho phép subscribe/unsubscribe symbols
 * - Hiển thị trạng thái subscription
 */

import React from 'react';
import './styles/MarketData.css';

/**
 * Component MarketData
 */
const MarketData = ({
  wsStatus,
  subscribedSymbols,
  marketData,
  subscribeMarketData,
  unsubscribeMarketData
}) => {
  // Danh sách symbols có sẵn
  const availableSymbols = ['BTC/USD', 'ETH/USD', 'AAPL'];

  return (
    <div className="market-data-section">
      <h2>📈 Market Data</h2>

      {/* Symbol Subscription Controls */}
      <div className="symbol-controls">
        <div className="available-symbols">
          <h4>Available Symbols:</h4>
          {availableSymbols.map(symbol => (
            <div key={symbol} className="symbol-item">
              <span>{symbol}</span>
              {subscribedSymbols.includes(symbol) ? (
                <button onClick={() => unsubscribeMarketData([symbol])}>
                  Unsubscribe
                </button>
              ) : (
                <button onClick={() => subscribeMarketData([symbol])}>
                  Subscribe
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="subscription-controls">
          <button
            onClick={() => subscribeMarketData(availableSymbols)}
            disabled={wsStatus !== 'CONNECTED'}
          >
            Subscribe All
          </button>
          <button
            onClick={() => unsubscribeMarketData(subscribedSymbols)}
            disabled={subscribedSymbols.length === 0}
          >
            Unsubscribe All
          </button>
        </div>
      </div>

      {/* Market Data Display */}
      <div className="market-data-grid">
        <div className="grid-header">
          <span>Symbol</span>
          <span>Price</span>
          <span>Change</span>
          <span>Status</span>
        </div>

        {availableSymbols.map(symbol => {
          const data = marketData[symbol];
          const isSubscribed = subscribedSymbols.includes(symbol);

          return (
            <div key={symbol} className={`grid-row ${isSubscribed ? 'subscribed' : ''}`}>
              <span>{symbol}</span>
              <span>
                {data ? `$${data.price.toFixed(2)}` : 'N/A'}
              </span>
              <span className={data?.change >= 0 ? 'positive' : 'negative'}>
                {data ? `${data.change.toFixed(2)}%` : 'N/A'}
              </span>
              <span>
                {isSubscribed ? '✅ Subscribed' : '❌ Not Subscribed'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MarketData;