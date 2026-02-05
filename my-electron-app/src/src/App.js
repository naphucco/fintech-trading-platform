/**
 * FILE: src/src/App.js
 * CHỨC NĂNG: Component React chính cho ứng dụng FinTech Trading Desktop
 * - Kết nối WebSocket với backend trading server
 * - Hiển thị real-time market data
 * - Xử lý đặt lệnh trading
 * - Quản lý kết nối WebSocket
 */

// Import React và các hooks cần thiết
import React, { useState, useEffect, useRef } from 'react';
import './App.css'; // Import file CSS cho styling

/**
 * COMPONENT CHÍNH: App
 */
function App() {
  // ==================== 1. STATE MANAGEMENT ====================

  // State lưu thông tin hệ thống từ Electron
  // WHAT: Biến lưu thông tin hệ thống (platform, node version, electron version)
  // WHY: Cần hiển thị thông tin môi trường cho người dùng
  // HOW: Khởi tạo với giá trị null, sẽ được cập nhật khi component mount
  const [systemInfo, setSystemInfo] = useState(null);

  // State lưu trạng thái kết nối WebSocket
  // WHAT: Biến lưu trạng thái kết nối ('DISCONNECTED', 'CONNECTING', 'CONNECTED', 'ERROR')
  // WHY: Cần hiển thị trạng thái kết nối cho người dùng, xử lý UI tương ứng
  // HOW: Sử dụng string để đại diện cho các trạng thái khác nhau
  const [wsStatus, setWsStatus] = useState('DISCONNECTED');

  // State lưu danh sách symbols đã subscribe
  // WHAT: Mảng các trading symbols (ví dụ: ['BTC/USD', 'ETH/USD'])
  // WHY: Cần biết client đang theo dõi symbols nào để hiển thị và quản lý
  // HOW: Khởi tạo mảng rỗng, sẽ được cập nhật khi người dùng subscribe
  // Trong demo hiện tại, subscribedSymbols thực sự chỉ "cho vui" - CHƯA CÓ TÁC DỤNG THỰC!
  const [subscribedSymbols, setSubscribedSymbols] = useState([]);

  // State lưu market data
  // WHAT: Object chứa dữ liệu thị trường cho các symbols
  // WHY: Cần lưu và hiển thị giá real-time cho người dùng
  // HOW: Object với key là symbol, value là data object {price, change}
  const [marketData, setMarketData] = useState({});

  // State lưu danh sách orders
  // WHAT: Mảng lưu lịch sử đặt lệnh của người dùng
  // WHY: Cần hiển thị lịch sử giao dịch, trạng thái các lệnh
  // HOW: Mảng các order objects, mỗi order có id, symbol, quantity, status,...
  const [orders, setOrders] = useState([]);

  // State lưu client ID từ server
  // WHAT: Biến lưu ID duy nhất mà server cấp cho client
  // WHY: Cần ID để nhận diện client trong các message trao đổi với server
  // HOW: Lưu string ID được server gửi trong welcome message
  const [clientId, setClientId] = useState('');

  // State cho form đặt lệnh
  // WHAT: Object lưu thông tin lệnh đang được nhập
  // WHY: Cần lưu tạm thông tin lệnh trước khi gửi lên server
  // HOW: Object với các fields symbol, quantity, price, side (buy/sell)
  const [orderForm, setOrderForm] = useState({
    symbol: 'BTC/USD',
    quantity: 1,
    price: '',
    side: 'BUY'
  });

  // ==================== 2. REFS ====================

  // Ref lưu WebSocket instance
  // WHAT: Tham chiếu đến WebSocket connection
  // WHY: Không muốn tạo lại WebSocket mỗi lần component re-render
  //      Cần truy cập WebSocket trong các hàm callback (event listeners)
  // HOW: useRef() giữ giá trị giữa các lần render mà không gây re-render
  const wsRef = useRef(null);

  // Ref lưu heartbeat interval
  // WHAT: Tham chiếu đến interval ID của heartbeat
  // WHY: Cần clear interval khi component unmount hoặc disconnect
  // HOW: Lưu return value của setInterval để clear sau này
  const heartbeatIntervalRef = useRef(null);

  // ==================== 3. EFFECTS ====================

  /**
   * useEffect: Khởi tạo khi component mount
   * WHAT: Chạy 1 lần khi component được load
   * WHY: Cần lấy system info và thiết lập kết nối WebSocket ban đầu
   * HOW: Dependency array rỗng [] đảm bảo chỉ chạy 1 lần
   */
  useEffect(() => {
    // Lấy thông tin hệ thống từ Electron
    if (window.electronAPI) {
      window.electronAPI.getSystemInfo().then(info => {
        setSystemInfo(info);
      });
    }

    // Tự động kết nối WebSocket khi app khởi động
    connectWebSocket();

    // Cleanup function: chạy khi component unmount
    return () => {
      disconnectWebSocket();
    };
  }, []); // Empty dependency array = chỉ chạy 1 lần

  // ==================== 4. WEBSOCKET FUNCTIONS ====================

  /**
   * Hàm kết nối WebSocket
   * WHAT: Thiết lập kết nối WebSocket đến server
   * WHY: Cần kết nối để nhận real-time data và gửi orders
   * HOW: Tạo WebSocket instance, đăng ký event listeners
   */
  const connectWebSocket = () => {
    // Kiểm tra nếu đã có kết nối thì không tạo mới
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected');
      return;
    }

    // Cập nhật trạng thái đang kết nối
    setWsStatus('CONNECTING');

    try {
      // Tạo WebSocket connection đến server port 8080
      // WHAT: Kết nối đến localhost:8080 theo protocol ws://
      // WHY: Server đang chạy trên port 8080 (xem server-simple.js)
      // HOW: Tạo WebSocket instance, lưu vào ref để dùng sau
      const ws = new WebSocket('ws://localhost:8080');
      wsRef.current = ws;

      // Event listener khi kết nối mở thành công
      ws.onopen = () => {
        console.log('WebSocket connected');
        setWsStatus('CONNECTED');

        // Bắt đầu gửi heartbeat để giữ kết nối
        startHeartbeat();
      };

      // Event listener khi nhận message từ server
      ws.onmessage = (event) => {
        // WHAT: Xử lý message từ server
        // WHY: Server gửi nhiều loại message (welcome, market data, order status,...)
        // HOW: Parse JSON và xử lý theo type
        try {
          const data = JSON.parse(event.data);
          console.log('Received from server:', data);

          // Xử lý message theo type
          switch (data.type) {
            case 'WELCOME':
              // Server gửi khi kết nối thành công
              // Lưu client ID để dùng cho các request sau
              setClientId(data.clientId);
              break;

            // Server bây giờ gửi subscribedSymbols trong ACK
            case 'SUBSCRIBE_ACK':
              // Server xác nhận subscribe thành công
              // Cập nhật subscribedSymbols từ server (cho chính xác)
              if (data.subscribedSymbols) {
                setSubscribedSymbols(data.subscribedSymbols);
              }
              console.log(`✅ Subscribed to ${data.subscribedCount} symbols`);
              break;

            case 'UNSUBSCRIBE_ACK':
              // Server xác nhận unsubscribe thành công
              // Cập nhật subscribedSymbols từ server
              if (data.remainingSubscriptions) {
                setSubscribedSymbols(data.remainingSubscriptions);
              }
              console.log(`✅ Unsubscribed from symbols:`, data.unsubscribedSymbols);
              break;

            case 'MARKET_DATA':
              // Server gửi real-time market data
              // Cập nhật state với data mới
              // WHAT: data có thể là toàn bộ market data hoặc data cho 1 symbol
              // WHY: Cần cập nhật UI với giá mới nhất
              // HOW: Merge data mới vào state hiện tại

              if (data.symbol && data.isInitial) {
                // Trường hợp 1: Initial data cho 1 symbol cụ thể
                setMarketData(prev => ({
                  ...prev,
                  [data.symbol]: data.data
                }));
              } else if (data.data) {
                // Trường hợp 2: Batch updates cho nhiều symbols
                // Server chỉ gửi symbols client đã subscribe
                setMarketData(prev => ({
                  ...prev,
                  ...data.data  // Merge toàn bộ data mới
                }));
              }
              break;

            case 'ORDER_ACK':
              // Server xác nhận đã nhận order
              // Cập nhật order với status PENDING
              setOrders(prev => [...prev, {
                id: data.orderId,
                symbol: orderForm.symbol,
                quantity: orderForm.quantity,
                side: orderForm.side,
                status: 'PENDING',
                timestamp: data.timestamp
              }]);
              break;

            case 'ORDER_FILLED':
              // Server báo order đã được filled (khớp lệnh)
              // Cập nhật status order thành FILLED
              setOrders(prev => prev.map(order =>
                order.id === data.orderId
                  ? { ...order, status: 'FILLED', filledPrice: data.filledPrice }
                  : order
              ));

              // Hiển thị notification cho người dùng
              if (window.electronAPI) {
                window.electronAPI.showNotification(
                  'Order Filled',
                  `Order ${data.orderId} filled at $${data.filledPrice}`
                );
              }
              break;

            case 'ORDER_REJECTED':
              // Server báo order bị rejected
              // Cập nhật status order thành REJECTED
              setOrders(prev => prev.map(order =>
                order.id === data.orderId
                  ? { ...order, status: 'REJECTED', reason: data.reason }
                  : order
              ));

              // Hiển thị notification cho người dùng
              if (window.electronAPI) {
                window.electronAPI.showNotification(
                  'Order Rejected',
                  `Order ${data.orderId} rejected: ${data.reason}`
                );
              }
              break;

            case 'HEARTBEAT_ACK':
            case 'PONG':
              // Server phản hồi heartbeat/ping
              // Không cần làm gì, chỉ để biết connection vẫn sống
              break;

            default:
              console.log('Unknown message type:', data.type);
          }
        } catch (error) {
          console.error('Error parsing message:', error);
        }
      };

      // Event listener khi có lỗi WebSocket
      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setWsStatus('ERROR');
      };

      // Event listener khi kết nối đóng
      // Tắt server cũng gọi đây
      ws.onclose = () => {
        console.log('WebSocket disconnected');
        setWsStatus('DISCONNECTED');

        // Dọn dẹp heartbeat interval
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current);
          heartbeatIntervalRef.current = null;
        }

        // Tự động reconnect sau 3 giây
        // 0 delay: Server crash đột ngột (port vẫn mở)
        // 100-500ms: Network hiccup
        // 3-5 giây: Server báo shutdown (code 1001)
        // Không reconnect: User tự disconnect (code 1000)

        // Ở đây reconnect bị chậm (tối đa 3s) vì chỉ là ví dụ
        setTimeout(() => {
          if (wsStatus !== 'CONNECTING') {
            connectWebSocket();
          }
        }, 3000);
      };

    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      setWsStatus('ERROR');
    }
  };

  /**
   * Hàm ngắt kết nối WebSocket
   * WHAT: Đóng kết nối WebSocket cleanly
   * WHY: Khi người dùng logout, app shutdown, hoặc manual disconnect
   * HOW: Gọi ws.close() và cleanup các refs
   */
  const disconnectWebSocket = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }

    setWsStatus('DISCONNECTED');
  };

  /**
   * Heartbeat là cơ chế "kiểm tra nhịp tim" để duy trì kết nối WebSocket luôn sống.

  TẠI SAO cần:
  Ngăn firewall/proxy tự động đóng kết nối không hoạt động
  Phát hiện sớm khi kết nối bị mất (thay vì đợi timeout)
  Giữ session không bị timeout từ server

  CÁCH HOẠT ĐỘNG:
  Client định kỳ gửi message HEARTBEAT (ví dụ mỗi 30 giây)
  Server phản hồi ngay với HEARTBEAT_ACK
  Nếu không nhận được ACK sau vài lần → kết nối đã chết → reconnect
  VÍ DỤ THỰC TẾ: Giống như bạn gọi điện thoại và thi thoảng hỏi "Alo, còn nghe không?" để chắc chắn đường truyền vẫn ổn.
   */

  /**
   * Hàm gửi heartbeat
   * WHAT: Gửi message HEARTBEAT định kỳ để giữ kết nối
   * WHY: Ngăn kết nối bị timeout bởi firewall/proxy
   * HOW: setInterval gửi message mỗi 30 giây
   */
  const startHeartbeat = () => {
    // Dọn interval cũ nếu có
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
    }

    // Tạo interval mới mỗi 30 giây
    // MỤC ĐÍCH của .current: Giữ giá trị giữa các lần render mà không gây re-render khi giá trị thay đổi!
    heartbeatIntervalRef.current = setInterval(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'HEARTBEAT',
          timestamp: Date.now()
        }));
      }
    }, 30000); // 30 giây
  };

  // ==================== 5. TRADING FUNCTIONS ====================

  /**
   * Hàm subscribe market data
   * WHAT: Gửi request subscribe symbols đến server
   * WHY: Muốn nhận real-time updates cho các symbols cụ thể
   * HOW: Gửi message type SUBSCRIBE_MARKET_DATA với mảng symbols
   */
  const subscribeMarketData = (symbols) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.error('WebSocket not connected');
      return;
    }

    // Gửi subscribe request đến server
    wsRef.current.send(JSON.stringify({
      type: 'SUBSCRIBE_MARKET_DATA',
      symbols: symbols,
      timestamp: Date.now()
    }));

    // Cập nhật state subscribed symbols
    setSubscribedSymbols(prev => {
      // Thêm symbols mới vào (loại bỏ trùng lặp)
      const newSymbols = [...new Set([...prev, ...symbols])];
      return newSymbols;
    });
  };

  /**
 * Hàm unsubscribe market data
 * WHAT: Ngừng nhận updates cho symbols
 * WHY: Tiết kiệm bandwidth, không cần data nữa
 * HOW: Gửi message UNSUBSCRIBE_MARKET_DATA đến server
 */
  const unsubscribeMarketData = (symbols) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.error('WebSocket not connected');
      return;
    }

    // Gửi unsubscribe request đến server
    wsRef.current.send(JSON.stringify({
      type: 'UNSUBSCRIBE_MARKET_DATA',  // Thêm type này nếu server hỗ trợ
      symbols: symbols
    }));

    // Cập nhật state tạm thời (sẽ được cập nhật lại khi nhận ACK từ server)
    setSubscribedSymbols(prev =>
      prev.filter(symbol => !symbols.includes(symbol))
    );
  };
  /**
   * Hàm đặt lệnh
   * WHAT: Gửi order request đến server
   * WHY: Người dùng muốn mua/bán trading instrument
   * HOW: Gửi message type PLACE_ORDER với order details
   */
  const placeOrder = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.error('WebSocket not connected');
      return;
    }

    // Validate order form
    if (!orderForm.symbol || !orderForm.quantity || orderForm.quantity <= 0) {
      alert('Please fill all required fields');
      return;
    }

    // Gửi order request
    wsRef.current.send(JSON.stringify({
      type: 'PLACE_ORDER',
      order: {
        symbol: orderForm.symbol,
        quantity: parseFloat(orderForm.quantity),
        price: orderForm.price ? parseFloat(orderForm.price) : undefined,
        side: orderForm.side,
        timestamp: Date.now()
      }
    }));

    // Reset form (giữ lại symbol và side)
    setOrderForm(prev => ({
      ...prev,
      quantity: 1,
      price: ''
    }));
  };

  /**
   * Hàm gửi ping
   * WHAT: Gửi custom ping message đến server
   * WHY: Kiểm tra latency hoặc application-level health check
   * HOW: Gửi message type PING
   */
  const sendPing = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'PING',
        timestamp: Date.now()
      }));
    }
  };

  // ==================== 6. RENDER UI ====================

  return (
    <div className="App">
      <header className="App-header">
        <h1>🚀 FinTech Trading Platform</h1>
        <p>Real-time Trading with WebSockets</p>

        {/* Connection Status */}
        <div className="connection-status">
          <div className={`status-indicator ${wsStatus.toLowerCase()}`}></div>
          <span>Status: {wsStatus}</span>
          {clientId && <span> | Client ID: {clientId}</span>}

          <div className="connection-controls">
            {wsStatus !== 'CONNECTED' && (
              <button onClick={connectWebSocket}>Connect</button>
            )}
            {wsStatus === 'CONNECTED' && (
              <button onClick={disconnectWebSocket}>Disconnect</button>
            )}
            <button onClick={sendPing} disabled={wsStatus !== 'CONNECTED'}>
              Ping Server
            </button>
          </div>
        </div>

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
          <div className="market-data-section">
            <h2>📈 Market Data</h2>

            {/* Symbol Subscription Controls */}
            <div className="symbol-controls">
              <div className="available-symbols">
                <h4>Available Symbols:</h4>
                {['BTC/USD', 'ETH/USD', 'AAPL'].map(symbol => (
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
                  onClick={() => subscribeMarketData(['BTC/USD', 'ETH/USD', 'AAPL'])}
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

              {['BTC/USD', 'ETH/USD', 'AAPL'].map(symbol => {
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

          {/* Order Form Section */}
          <div className="order-section">
            <h2>💰 Place Order</h2>

            <div className="order-form">
              <div className="form-group">
                <label>Symbol:</label>
                <select
                  value={orderForm.symbol}
                  onChange={(e) => setOrderForm({ ...orderForm, symbol: e.target.value })}
                >
                  <option value="BTC/USD">BTC/USD</option>
                  <option value="ETH/USD">ETH/USD</option>
                  <option value="AAPL">AAPL</option>
                </select>
              </div>

              <div className="form-group">
                <label>Side:</label>
                <div className="side-selector">
                  <button
                    className={orderForm.side === 'BUY' ? 'active buy' : ''}
                    onClick={() => setOrderForm({ ...orderForm, side: 'BUY' })}
                  >
                    BUY
                  </button>
                  <button
                    className={orderForm.side === 'SELL' ? 'active sell' : ''}
                    onClick={() => setOrderForm({ ...orderForm, side: 'SELL' })}
                  >
                    SELL
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label>Quantity:</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={orderForm.quantity}
                  onChange={(e) => setOrderForm({ ...orderForm, quantity: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Price (optional):</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Market Price"
                  value={orderForm.price}
                  onChange={(e) => setOrderForm({ ...orderForm, price: e.target.value })}
                />
              </div>

              <button
                className="place-order-btn"
                onClick={placeOrder}
                disabled={wsStatus !== 'CONNECTED'}
              >
                {orderForm.side} {orderForm.symbol}
              </button>

              <div className="market-price-hint">
                Current Price: ${marketData[orderForm.symbol]?.price?.toFixed(2) || 'N/A'}
              </div>
            </div>

            {/* Orders History */}
            <div className="orders-history">
              <h3>📋 Order History</h3>

              {orders.length === 0 ? (
                <p>No orders placed yet</p>
              ) : (
                <div className="orders-list">
                  {orders.slice().reverse().map(order => (
                    <div key={order.id} className={`order-item ${order.status.toLowerCase()}`}>
                      <div className="order-header">
                        <span className="order-id">{order.id}</span>
                        <span className={`order-status ${order.status.toLowerCase()}`}>
                          {order.status}
                        </span>
                      </div>
                      <div className="order-details">
                        <span>{order.side} {order.symbol}</span>
                        <span>Qty: {order.quantity}</span>
                        {order.filledPrice && (
                          <span>Price: ${order.filledPrice.toFixed(2)}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
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

// Export component App để sử dụng ở file khác
export default App;