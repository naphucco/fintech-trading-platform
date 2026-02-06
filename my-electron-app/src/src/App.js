/**
 * FILE: src/src/App.js
 * CHỨC NĂNG: Component React chính cho ứng dụng FinTech Trading Desktop
 * - Component container chứa tất cả các sub-components
 * - Quản lý state chung
 * - Kết nối các components với nhau
 */

import React, { useState, useEffect } from 'react';
import { 
  useWebSocketManager, 
  subscribeMarketData, 
  unsubscribeMarketData, 
  placeOrder 
} from './components/WebSocketManager';
import ConnectionStatus from './components/ConnectionStatus';
import MarketData from './components/MarketData';
import OrderForm from './components/OrderForm';
import OrderHistory from './components/OrderHistory';
import './App.css';

/**
 * COMPONENT CHÍNH: App
 */
function App() {
  // ==================== 1. STATE MANAGEMENT ====================
  const [systemInfo, setSystemInfo] = useState(null);
  const [wsStatus, setWsStatus] = useState('DISCONNECTED');
  const [subscribedSymbols, setSubscribedSymbols] = useState([]);
  const [marketData, setMarketData] = useState({});
  const [orders, setOrders] = useState([]);
  const [clientId, setClientId] = useState('');
  const [orderForm, setOrderForm] = useState({
    symbol: 'BTC/USD',
    quantity: 1,
    price: '',
    side: 'BUY'
  });

  // ==================== 2. WEBSOCKET MANAGER ====================
  const {
    connectWebSocket,
    disconnectWebSocket,
    sendWebSocketMessage,
    sendPing
  } = useWebSocketManager(
    setWsStatus,
    setClientId,
    setOrders,
    setMarketData,
    setSubscribedSymbols,
    orderForm
  );

  // ==================== 3. EFFECTS ====================
  useEffect(() => {
    // Lấy thông tin hệ thống từ Electron
    if (window.electronAPI) {
      window.electronAPI.getSystemInfo().then(info => {
        setSystemInfo(info);
      });
    }

    // Tự động kết nối WebSocket khi app khởi động
    connectWebSocket();

    // Cleanup function
    return () => {
      disconnectWebSocket();
    };
  }, []);

  // ==================== 4. WRAPPER FUNCTIONS ====================
  const handleSubscribeMarketData = (symbols) => {
    subscribeMarketData(sendWebSocketMessage, symbols, setSubscribedSymbols);
  };

  const handleUnsubscribeMarketData = (symbols) => {
    unsubscribeMarketData(sendWebSocketMessage, symbols, setSubscribedSymbols);
  };

  const handlePlaceOrder = () => {
    placeOrder(sendWebSocketMessage, orderForm, setOrderForm);
  };

  // ==================== 5. RENDER ====================
  return (
    <div className="App">
      <header className="App-header">
        <h1>🚀 FinTech Trading Platform</h1>
        <p>Real-time Trading with WebSockets</p>

        {/* Connection Status */}
        <ConnectionStatus
          wsStatus={wsStatus}
          clientId={clientId}
          connectWebSocket={connectWebSocket}
          disconnectWebSocket={disconnectWebSocket}
          sendPing={sendPing}
        />

        {/* System Information */}
        {systemInfo && (
          <div className="system-info">
            <h3>📊 System Information</h3>
            <p><strong>Platform:</strong> {systemInfo.platform}</p>
            <p><strong>Node.js:</strong> {systemInfo.nodeVersion}</p>
            <p><strong>Electron:</strong> {systemInfo.electronVersion}</p>
          </div>
        )}

        <div className="trading-container">
          {/* Market Data Section */}
          <MarketData
            wsStatus={wsStatus}
            subscribedSymbols={subscribedSymbols}
            marketData={marketData}
            subscribeMarketData={handleSubscribeMarketData}
            unsubscribeMarketData={handleUnsubscribeMarketData}
          />

          {/* Order Section */}
          <div>
            <OrderForm
              orderForm={orderForm}
              setOrderForm={setOrderForm}
              marketData={marketData}
              placeOrder={handlePlaceOrder}
              wsStatus={wsStatus}
            />
            
            <OrderHistory orders={orders} />
          </div>
        </div>

        {/* Window Controls */}
        <div className="window-controls">
          <button onClick={() => window.electronAPI?.minimizeWindow()}>
            Minimize
          </button>
          <button onClick={() => window.electronAPI?.maximizeWindow()}>
            Maximize/Toggle
          </button>
          <button
            onClick={() => window.electronAPI?.quitApp()}
            style={{ backgroundColor: '#ff6b6b' }}
          >
            Quit App
          </button>
        </div>

        {/* Instructions */}
        <div className="instructions">
          <h3>📝 How to use:</h3>
          <ol>
            <li>Ensure the WebSocket server is running (node server-simple.js)</li>
            <li>Click "Connect" to establish WebSocket connection</li>
            <li>Subscribe to symbols to receive real-time market data</li>
            <li>Fill order form and click "BUY/SELL" to place orders</li>
            <li>Monitor order status in Order History</li>
          </ol>
        </div>
      </header>
    </div>
  );
}

export default App;