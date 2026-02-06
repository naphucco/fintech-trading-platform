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
      // ==================== MESSAGE HANDLER CHI TIẾT ====================
      ws.onmessage = (event) => {
        // TRONG THỰC TẾ: Server gửi nhiều loại message khác nhau
        // MỖI LOẠI cần xử lý khác nhau để cập nhật UI
        // CẦN parse JSON và phân loại theo field 'type' giống BE

        try {
          const data = JSON.parse(event.data);
          console.log('📨 Received from server:', data);

          // SWITCH-CASE để xử lý từng loại message
          // TẠI SAO dùng switch-case? 
          // - Dễ đọc, dễ maintain khi có nhiều message types
          // - Performance tốt hơn cho nhiều cases
          // - Tách biệt logic xử lý cho từng message type

          switch (data.type) {
            // ============ CASE 1: WELCOME MESSAGE ============
            case 'WELCOME':
              // SERVER GỬI KHI: Client kết nối thành công lần đầu
              // MỤC ĐÍCH: Cung cấp client ID và thông tin khởi tạo
              // XỬ LÝ: Lưu client ID để dùng cho các request sau
              console.log(`🎉 Server welcome: ${data.message}`);
              setClientId(data.clientId);
              break;

            // ============ CASE 2: SUBSCRIBE ACKNOWLEDGMENT ============
            case 'SUBSCRIBE_ACK':
              // SERVER GỬI KHI: Client gửi SUBSCRIBE_MARKET_DATA thành công
              // MỤC ĐÍCH: Xác nhận subscription và gửi danh sách symbols hiện tại
              // XỬ LÝ: Cập nhật state subscribedSymbols từ server
              // TẠI SAO cần lấy từ server? Đảm bảo đồng bộ giữa client và server

              console.log(`✅ Subscribed to ${data.subscribedCount} symbols`);

              if (data.subscribedSymbols) {
                // CẬP NHẬT STATE: Ghi đè toàn bộ subscribedSymbols từ server
                // TẠI SAO ghi đè thay vì merge? Đảm bảo client luôn có view chính xác
                setSubscribedSymbols(data.subscribedSymbols);
              }
              break;

            // ============ CASE 3: UNSUBSCRIBE ACKNOWLEDGMENT ============
            case 'UNSUBSCRIBE_ACK':
              // SERVER GỬI KHI: Client gửi UNSUBSCRIBE_MARKET_DATA thành công
              // MỤC ĐÍCH: Xác nhận unsubscribe và gửi danh sách symbols còn lại
              // XỬ LÝ: Cập nhật state với remaining subscriptions

              console.log(`✅ Unsubscribed from symbols:`, data.unsubscribedSymbols);

              if (data.remainingSubscriptions) {
                // CẬP NHẬT STATE: Chỉ giữ lại các symbols server nói còn subscribe
                setSubscribedSymbols(data.remainingSubscriptions);
              }
              break;

            // ============ CASE 4: MARKET DATA UPDATES ============
            case 'MARKET_DATA':
              // SERVER GỬI KHI: 
              // 1. Client mới subscribe (isInitial: true) - snapshot
              // 2. Định kỳ (mỗi 2s) - real-time updates
              // MỤC ĐÍCH: Cung cấp giá real-time cho các symbols
              // XỬ LÝ: Cập nhật marketData state

              if (data.symbol && data.isInitial) {
                // TRƯỜNG HỢP 1: Initial snapshot cho 1 symbol cụ thể
                // TẠI SAO có isInitial flag? Để phân biệt snapshot vs update
                setMarketData(prev => ({
                  ...prev,  // Giữ lại data cũ
                  [data.symbol]: data.data  // Thêm/update symbol mới
                }));
              } else if (data.data) {
                // TRƯỜNG HỢP 2: Batch updates cho nhiều symbols
                // Server chỉ gửi symbols client đã subscribe
                setMarketData(prev => ({
                  ...prev,
                  ...data.data  // Merge tất cả data mới
                }));
              }
              break;

            // ============ CASE 5: ORDER ACKNOWLEDGMENT ============
            case 'ORDER_ACK':
              // SERVER GỬI KHI: Server nhận order và bắt đầu xử lý
              // MỤC ĐÍCH: Xác nhận order đã được nhận, cung cấp order ID
              // XỬ LÝ: Thêm order mới vào state với status PROCESSING

              console.log(`📝 Order ${data.orderId} acknowledged by server`);

              // THÊM ORDER MỚI VÀO STATE
              setOrders(prev => [...prev, {
                id: data.orderId,
                symbol: orderForm.symbol,
                quantity: orderForm.quantity,
                side: orderForm.side,
                status: data.status || 'PROCESSING',  // Dùng status từ server
                timestamp: data.timestamp,
                message: data.message || 'Order received and queued for processing'
              }]);

              // HIỂN THỊ NOTIFICATION CHO USER
              // TẠI SAO cần notification? User cần biết ngay order đã được nhận
              if (window.electronAPI && data.message) {
                window.electronAPI.showNotification(
                  'Order Received',
                  data.message
                );
              }
              break;

            // ============ CASE 6: ORDER STATUS UPDATES (MỚI) ============
            case 'ORDER_STATUS_UPDATE':
              // SERVER GỬI KHI: Order chuyển trạng thái trong quá trình xử lý
              // MỤC ĐÍCH: Cung cấp real-time updates về tiến trình order
              // VÍ DỤ: VALIDATING → RISK_CHECKING → SUBMITTED_TO_MATCHING_ENGINE
              // XỬ LÝ: Cập nhật status của order hiện có

              console.log(`📊 Order ${data.orderId} status update: ${data.status}`);

              // CẬP NHẬT ORDER HIỆN CÓ TRONG STATE
              setOrders(prev => prev.map(order =>
                order.id === data.orderId
                  ? {
                    ...order,  // Giữ nguyên các field cũ
                    status: data.status,  // Cập nhật status mới
                    ...(data.message && { statusMessage: data.message }),
                    lastUpdated: data.timestamp  // Thời điểm cập nhật
                  }
                  : order
              ));
              break;

            // ============ CASE 7: ORDER ERROR (MỚI) ============
            case 'ORDER_ERROR':
              // SERVER GỬI KHI: Có lỗi xảy ra trong quá trình xử lý order
              // MỤC ĐÍCH: Thông báo lỗi chi tiết cho user
              // VÍ DỤ: INVALID_ORDER_FORMAT, RISK_CHECK_FAILED, SYMBOL_NOT_FOUND
              // XỬ LÝ: Cập nhật order thành ERROR với thông tin lỗi

              console.error(`❌ Order ${data.orderId} error:`, data.errorCode);

              // CẬP NHẬT ORDER THÀNH TRẠNG THÁI ERROR
              setOrders(prev => prev.map(order =>
                order.id === data.orderId
                  ? {
                    ...order,
                    status: 'ERROR',  // Đánh dấu là lỗi
                    errorCode: data.errorCode,  // Mã lỗi (ngắn)
                    errorMessage: data.errorMessage,  // Message chi tiết
                    timestamp: data.timestamp  // Thời điểm lỗi
                  }
                  : order
              ));

              // HIỂN THỊ ERROR NOTIFICATION
              // TẠI SAO cần notification? User cần biết ngay khi có lỗi
              if (window.electronAPI) {
                window.electronAPI.showNotification(
                  'Order Error',
                  `${data.errorCode}: ${data.errorMessage || 'Processing failed'}`
                );
              }
              break;

            // ============ CASE 8: ORDER FILLED ============
            case 'ORDER_FILLED':
              // SERVER GỬI KHI: Order được khớp thành công (filled)
              // MỤC ĐÍCH: Thông báo order đã executed với price và quantity
              // XỬ LÝ: Cập nhật order thành FILLED với execution details

              console.log(`✅ Order ${data.orderId} filled at $${data.filledPrice}`);

              // CẬP NHẬT ORDER VỚI THÔNG TIN EXECUTION
              setOrders(prev => prev.map(order =>
                order.id === data.orderId
                  ? {
                    ...order,
                    status: 'FILLED',  // Trạng thái cuối cùng
                    filledPrice: data.filledPrice,  // Giá khớp
                    filledQuantity: data.filledQuantity,  // Số lượng khớp
                    averagePrice: data.averagePrice || data.filledPrice,  // Giá trung bình (nếu multiple fills)
                    totalFilled: data.totalFilled || data.filledQuantity,  // Tổng số lượng đã khớp
                    remainingQuantity: data.remainingQuantity || 0,  // Số lượng còn lại (nếu partial fill)
                    executionTime: data.executionTime,  // Thời điểm khớp
                    lastUpdated: data.timestamp  // Thời điểm cập nhật
                  }
                  : order
              ));

              // HIỂN THỊ SUCCESS NOTIFICATION
              if (window.electronAPI) {
                // Chỉ hiển thị 8 ký tự đầu của order ID cho gọn
                window.electronAPI.showNotification(
                  'Order Filled',
                  `Order ${data.orderId.slice(0, 8)}... filled ${data.filledQuantity} @ $${data.filledPrice.toFixed(2)}`
                );
              }
              break;

            // ============ CASE 9: ORDER REJECTED ============
            case 'ORDER_REJECTED':
              // SERVER GỬI KHI: Order bị reject (không thể khớp)
              // MỤC ĐÍCH: Thông báo lý do reject và đề xuất hành động
              // XỬ LÝ: Cập nhật order thành REJECTED với lý do

              console.log(`❌ Order ${data.orderId} rejected: ${data.reason}`);

              // CẬP NHẬT ORDER VỚI THÔNG TIN REJECT
              setOrders(prev => prev.map(order =>
                order.id === data.orderId
                  ? {
                    ...order,
                    status: 'REJECTED',  // Trạng thái cuối cùng
                    rejectionTime: data.rejectionTime,  // Thời điểm reject
                    reason: data.reason,  // Lý do reject
                    suggestedAction: data.suggestedAction,  // Đề xuất hành động (nếu có)
                    lastUpdated: data.timestamp  // Thời điểm cập nhật
                  }
                  : order
              ));

              // HIỂN THỊ REJECTION NOTIFICATION VỚI ĐỀ XUẤT
              if (window.electronAPI) {
                const message = data.suggestedAction
                  ? `${data.reason}. ${data.suggestedAction}`  // Kết hợp lý do + đề xuất
                  : data.reason;  // Chỉ hiển thị lý do

                window.electronAPI.showNotification(
                  'Order Rejected',
                  message
                );
              }
              break;

            // ============ CASE 10: HEARTBEAT ACKNOWLEDGMENT ============
            case 'HEARTBEAT_ACK':
            case 'PONG':
              // SERVER GỬI KHI: Client gửi HEARTBEAT hoặc PING
              // MỤC ĐÍCH: Xác nhận connection vẫn sống
              // XỬ LÝ: Không cần làm gì, chỉ để biết connection OK

              // TRONG THỰC TẾ: Có thể tính latency từ timestamp
              // const latency = Date.now() - data.timestamp;
              // console.log(`❤️ Heartbeat latency: ${latency}ms`);
              break;

            // ============ DEFAULT: UNKNOWN MESSAGE TYPE ============
            default:
              // XỬ LÝ KHI: Server gửi message type không xác định
              // MỤC ĐÍCH: Log để debug, không crash app
              console.log('⚠️ Unknown message type from server:', data.type);
          }
        } catch (error) {
          // ERROR HANDLING KHI PARSE JSON THẤT BẠI
          // TẠI SAO cần try-catch? 
          // - Server có thể gửi invalid JSON (lỗi server)
          // - Network corruption có thể làm hỏng data
          // - Malicious server (trong production cần validation)

          console.error('❌ Error parsing server message:', error);

          // TRONG PRODUCTION: Có thể gửi error report hoặc reconnect
          if (window.electronAPI) {
            window.electronAPI.showNotification(
              'Connection Error',
              'Failed to parse server message'
            );
          }
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

            {/* ==================== ORDER HISTORY COMPONENT CHI TIẾT ==================== */}

            <div className="orders-history">
              {/* HEADER VỚI TỔNG SỐ ORDERS */}
              <h3>📋 Order History ({orders.length})</h3>

              {/* HIỂN THỊ KHI CHƯA CÓ ORDER */}
              {orders.length === 0 ? (
                <p className="no-orders">No orders placed yet. Place your first order above!</p>
              ) : (
                <div className="orders-list">
                  {/* HIỂN THỊ ORDERS THEO THỨ TỰ MỚI NHẤT ĐẦU TIÊN */}
                  {/* TẠI SAO dùng slice().reverse()? 
                      - slice(): tạo bản copy để không mutate state gốc
                      - reverse(): đảo ngược thứ tự (mới nhất lên đầu)
                  */}
                  {orders.slice().reverse().map(order => {
                    // ============ HÀM PHỤ TRỢ: XÁC ĐỊNH MÀU THEO STATUS ============
                    // TẠI SAO cần hàm này? Để UI nhất quán, dễ nhận biết trạng thái
                    const getStatusColor = (status) => {
                      switch (status) {
                        case 'FILLED': return '#2ecc71';        // Xanh lá: Thành công
                        case 'PROCESSING': return '#3498db';    // Xanh dương: Đang xử lý
                        case 'VALIDATING': return '#9b59b6';    // Tím: Đang validate
                        case 'RISK_CHECKING': return '#e67e22'; // Cam: Đang kiểm tra risk
                        case 'SUBMITTED_TO_MATCHING_ENGINE': return '#1abc9c'; // Xanh ngọc: Đã gửi matching
                        case 'REJECTED': return '#e74c3c';      // Đỏ: Bị reject
                        case 'ERROR': return '#c0392b';         // Đỏ đậm: Lỗi
                        default: return '#95a5a6';              // Xám: Trạng thái khác
                      }
                    };

                    // ============ HÀM PHỤ TRỢ: XÁC ĐỊNH ICON THEO STATUS ============
                    // TẠI SAO cần icon? Giúp user nhận biết nhanh trạng thái
                    const getStatusIcon = (status) => {
                      switch (status) {
                        case 'FILLED': return '✅';          // Checkmark: Thành công
                        case 'PROCESSING': return '⏳';      // Hourglass: Đang xử lý
                        case 'VALIDATING': return '🔍';      // Magnifying glass: Đang kiểm tra
                        case 'RISK_CHECKING': return '⚖️';   // Scale: Đang đánh giá risk
                        case 'SUBMITTED_TO_MATCHING_ENGINE': return '⚡'; // Lightning: Nhanh
                        case 'REJECTED': return '❌';        // Cross: Bị từ chối
                        case 'ERROR': return '🚨';           // Siren: Có lỗi
                        default: return '📝';                // Memo: Trạng thái chung
                      }
                    };

                    // ============ RENDER MỖI ORDER ITEM ============
                    return (
                      <div
                        key={order.id}
                        className="order-item"
                        // STYLE INLINE: Thêm border màu theo status
                        // TẠI SAO dùng inline style? Để động thay đổi màu theo status
                        style={{ borderLeft: `4px solid ${getStatusColor(order.status)}` }}
                      >
                        {/* ORDER HEADER: Hiển thị ID và Status */}
                        <div className="order-header">
                          {/* ORDER ID (cắt ngắn cho đẹp UI) */}
                          <span className="order-id" title={order.id}>
                            {/* HIỂN THỊ 10 KÝ TỰ ĐẦU + "..." để UI gọn */}
                            {order.id.slice(0, 10)}...
                          </span>

                          {/* ORDER STATUS VỚI MÀU VÀ ICON */}
                          <span
                            className="order-status"
                            // MÀU CHỮ THEO STATUS
                            style={{ color: getStatusColor(order.status) }}
                          >
                            {/* KẾT HỢP ICON + TEXT STATUS */}
                            {getStatusIcon(order.status)} {order.status}
                          </span>
                        </div>

                        {/* ORDER DETAILS: Hiển thị chi tiết order */}
                        <div className="order-details">
                          {/* ROW 1: SYMBOL */}
                          <div className="detail-row">
                            <span className="detail-label">Symbol:</span>
                            <span className="detail-value">{order.symbol}</span>
                          </div>

                          {/* ROW 2: SIDE (BUY/SELL) */}
                          <div className="detail-row">
                            <span className="detail-label">Side:</span>
                            {/* THÊM CLASS 'buy' hoặc 'sell' để styling khác nhau */}
                            <span className={`detail-value ${order.side.toLowerCase()}`}>
                              {order.side}
                            </span>
                          </div>

                          {/* ROW 3: QUANTITY */}
                          <div className="detail-row">
                            <span className="detail-label">Quantity:</span>
                            <span className="detail-value">{order.quantity}</span>
                          </div>

                          {/* ROW 4: FILLED PRICE (chỉ hiển thị nếu order đã filled) */}
                          {/* TẠI SAO conditional rendering? Không hiển thị field không có data */}
                          {order.filledPrice && (
                            <div className="detail-row">
                              <span className="detail-label">Filled Price:</span>
                              <span className="detail-value">
                                {/* ĐỊNH DẠNG SỐ VỚI 2 CHỮ SỐ THẬP PHÂN */}
                                ${order.filledPrice.toFixed(2)}
                              </span>
                            </div>
                          )}

                          {/* ROW 5: STATUS MESSAGE (nếu có) */}
                          {/* HIỂN THỊ THÔNG ĐIỆP CHI TIẾT TỪ SERVER */}
                          {order.statusMessage && (
                            <div className="detail-row">
                              <span className="detail-label">Status:</span>
                              <span className="detail-value">{order.statusMessage}</span>
                            </div>
                          )}

                          {/* ROW 6: ERROR MESSAGE (nếu có lỗi) */}
                          {/* HIỂN THỊ VỚI STYLING ĐẶC BIỆT CHO LỖI */}
                          {order.errorMessage && (
                            <div className="detail-row error">
                              <span className="detail-label">Error:</span>
                              <span className="detail-value">{order.errorMessage}</span>
                            </div>
                          )}

                          {/* ROW 7: TIME STAMP */}
                          <div className="detail-row time">
                            <span className="detail-label">Time:</span>
                            <span className="detail-value">
                              {/* ĐỊNH DẠNG TIME THEO LOCALE CỦA USER */}
                              {new Date(order.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
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