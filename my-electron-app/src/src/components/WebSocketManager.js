/**
 * COMPONENT: WebSocketManager
 * CHỨC NĂNG: Quản lý kết nối WebSocket, xử lý message từ server
 * - Quản lý lifecycle của WebSocket connection
 * - Xử lý tất cả message types từ server
 * - Quản lý heartbeat để giữ kết nối
 */

import { useRef } from 'react';

/**
 * Custom hook quản lý WebSocket connection
 * WHAT: Hook chứa tất cả logic liên quan đến WebSocket
 * WHY: Tách biệt WebSocket logic khỏi UI component, dễ reuse và test
 * HOW: Trả về các hàm connect/disconnect và refs cần thiết
 */
export function useWebSocketManager(setWsStatus, setClientId, setOrders, setMarketData, setSubscribedSymbols, orderForm) {
  // ==================== REFS ====================
  // Ref lưu WebSocket instance
  const wsRef = useRef(null);
  
  // Ref lưu heartbeat interval
  const heartbeatIntervalRef = useRef(null);

  // ==================== WEBSOCKET FUNCTIONS ====================

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
        handleWebSocketMessage(
          event, 
          setClientId, 
          setOrders, 
          setMarketData, 
          setSubscribedSymbols,
          orderForm
        );
      };
      
      // Event listener khi có lỗi WebSocket
      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setWsStatus('ERROR');
      };

      // Event listener khi kết nối đóng
      ws.onclose = () => {
        console.log('WebSocket disconnected');
        setWsStatus('DISCONNECTED');

        // Dọn dẹp heartbeat interval
        cleanupHeartbeat();

        // Tự động reconnect sau 3 giây
        setTimeout(() => {
          if (wsRef.current && wsRef.current.readyState !== WebSocket.CONNECTING) {
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

    cleanupHeartbeat();
    setWsStatus('DISCONNECTED');
  };

  /**
   * Hàm xử lý message từ server
   * WHAT: Parse và xử lý tất cả message types từ server
   * WHY: Cần phân loại và xử lý từng loại message khác nhau
   * HOW: Switch-case dựa trên field 'type' của message
   */
  const handleWebSocketMessage = (event, setClientId, setOrders, setMarketData, setSubscribedSymbols, orderForm) => {
    try {
      const data = JSON.parse(event.data);
      console.log('📨 Received from server:', data);

      switch (data.type) {
        // ============ CASE 1: WELCOME MESSAGE ============
        case 'WELCOME':
          // SERVER GỬI KHI: Client kết nối thành công lần đầu
          // MỤC ĐÍCH: Cung cấp client ID và thông tin khởi tạo
          console.log(`🎉 Server welcome: ${data.message}`);
          setClientId(data.clientId);
          break;

        // ============ CASE 2: SUBSCRIBE ACKNOWLEDGMENT ============
        case 'SUBSCRIBE_ACK':
          // SERVER GỬI KHI: Client gửi SUBSCRIBE_MARKET_DATA thành công
          console.log(`✅ Subscribed to ${data.subscribedCount} symbols`);
          if (data.subscribedSymbols) {
            setSubscribedSymbols(data.subscribedSymbols);
          }
          break;

        // ============ CASE 3: UNSUBSCRIBE ACKNOWLEDGMENT ============
        case 'UNSUBSCRIBE_ACK':
          // SERVER GỬI KHI: Client gửi UNSUBSCRIBE_MARKET_DATA thành công
          console.log(`✅ Unsubscribed from symbols:`, data.unsubscribedSymbols);
          if (data.remainingSubscriptions) {
            setSubscribedSymbols(data.remainingSubscriptions);
          }
          break;

        // ============ CASE 4: MARKET DATA UPDATES ============
        case 'MARKET_DATA':
          // SERVER GỬI KHI: Client subscribe hoặc định kỳ update
          if (data.symbol && data.isInitial) {
            // Initial snapshot cho 1 symbol cụ thể
            setMarketData(prev => ({
              ...prev,
              [data.symbol]: data.data
            }));
          } else if (data.data) {
            // Batch updates cho nhiều symbols
            setMarketData(prev => ({
              ...prev,
              ...data.data
            }));
          }
          break;

        // ============ CASE 5: ORDER ACKNOWLEDGMENT ============
        case 'ORDER_ACK':
          // SERVER GỬI KHI: Server nhận order và bắt đầu xử lý
          console.log(`📝 Order ${data.orderId} acknowledged by server`);

          // THÊM ORDER MỚI VÀO STATE
          setOrders(prev => [...prev, {
            id: data.orderId,
            symbol: orderForm.symbol,
            quantity: orderForm.quantity,
            side: orderForm.side,
            status: data.status || 'PROCESSING',
            timestamp: data.timestamp,
            message: data.message || 'Order received and queued for processing'
          }]);

          // HIỂN THỊ NOTIFICATION CHO USER
          if (window.electronAPI && data.message) {
            window.electronAPI.showNotification(
              'Order Received',
              data.message
            );
          }
          break;

        // ============ CASE 6: ORDER STATUS UPDATES ============
        case 'ORDER_STATUS_UPDATE':
          // SERVER GỬI KHI: Order chuyển trạng thái trong quá trình xử lý
          console.log(`📊 Order ${data.orderId} status update: ${data.status}`);

          // CẬP NHẬT ORDER HIỆN CÓ TRONG STATE
          setOrders(prev => prev.map(order =>
            order.id === data.orderId
              ? {
                ...order,
                status: data.status,
                ...(data.message && { statusMessage: data.message }),
                lastUpdated: data.timestamp
              }
              : order
          ));
          break;

        // ============ CASE 7: ORDER ERROR ============
        case 'ORDER_ERROR':
          // SERVER GỬI KHI: Có lỗi xảy ra trong quá trình xử lý order
          console.error(`❌ Order ${data.orderId} error:`, data.errorCode);

          // CẬP NHẬT ORDER THÀNH TRẠNG THÁI ERROR
          setOrders(prev => prev.map(order =>
            order.id === data.orderId
              ? {
                ...order,
                status: 'ERROR',
                errorCode: data.errorCode,
                errorMessage: data.errorMessage,
                timestamp: data.timestamp
              }
              : order
          ));

          // HIỂN THỊ ERROR NOTIFICATION
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
          console.log(`✅ Order ${data.orderId} filled at $${data.filledPrice}`);

          // CẬP NHẬT ORDER VỚI THÔNG TIN EXECUTION
          setOrders(prev => prev.map(order =>
            order.id === data.orderId
              ? {
                ...order,
                status: 'FILLED',
                filledPrice: data.filledPrice,
                filledQuantity: data.filledQuantity,
                averagePrice: data.averagePrice || data.filledPrice,
                totalFilled: data.totalFilled || data.filledQuantity,
                remainingQuantity: data.remainingQuantity || 0,
                executionTime: data.executionTime,
                lastUpdated: data.timestamp
              }
              : order
          ));

          // HIỂN THỊ SUCCESS NOTIFICATION
          if (window.electronAPI) {
            window.electronAPI.showNotification(
              'Order Filled',
              `Order ${data.orderId.slice(0, 8)}... filled ${data.filledQuantity} @ $${data.filledPrice.toFixed(2)}`
            );
          }
          break;

        // ============ CASE 9: ORDER REJECTED ============
        case 'ORDER_REJECTED':
          // SERVER GỬI KHI: Order bị reject (không thể khớp)
          console.log(`❌ Order ${data.orderId} rejected: ${data.reason}`);

          // CẬP NHẬT ORDER VỚI THÔNG TIN REJECT
          setOrders(prev => prev.map(order =>
            order.id === data.orderId
              ? {
                ...order,
                status: 'REJECTED',
                rejectionTime: data.rejectionTime,
                reason: data.reason,
                suggestedAction: data.suggestedAction,
                lastUpdated: data.timestamp
              }
              : order
          ));

          // HIỂN THỊ REJECTION NOTIFICATION VỚI ĐỀ XUẤT
          if (window.electronAPI) {
            const message = data.suggestedAction
              ? `${data.reason}. ${data.suggestedAction}`
              : data.reason;

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
          // Không cần xử lý gì, chỉ để biết connection OK
          break;

        // ============ DEFAULT: UNKNOWN MESSAGE TYPE ============
        default:
          // XỬ LÝ KHI: Server gửi message type không xác định
          console.log('⚠️ Unknown message type from server:', data.type);
      }
    } catch (error) {
      // ERROR HANDLING KHI PARSE JSON THẤT BẠI
      console.error('❌ Error parsing server message:', error);
      if (window.electronAPI) {
        window.electronAPI.showNotification(
          'Connection Error',
          'Failed to parse server message'
        );
      }
    }
  };

  /**
   * Hàm gửi message qua WebSocket
   * WHAT: Gửi message JSON đến server
   * WHY: Cần gửi các loại request (subscribe, order, ping, etc.)
   * HOW: Stringify object và gửi qua WebSocket
   */
  const sendWebSocketMessage = (message) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
      return true;
    }
    console.error('WebSocket not connected');
    return false;
  };

  /**
   * Hàm bắt đầu heartbeat
   * WHAT: Gửi message HEARTBEAT định kỳ để giữ kết nối
   * WHY: Ngăn kết nối bị timeout bởi firewall/proxy
   * HOW: setInterval gửi message mỗi 30 giây
   */
  const startHeartbeat = () => {
    // Dọn interval cũ nếu có
    cleanupHeartbeat();

    // Tạo interval mới mỗi 30 giây
    heartbeatIntervalRef.current = setInterval(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        sendWebSocketMessage({
          type: 'HEARTBEAT',
          timestamp: Date.now()
        });
      }
    }, 30000); // 30 giây
  };

  /**
   * Hàm dọn dẹp heartbeat
   * WHAT: Clear heartbeat interval
   * WHY: Khi disconnect hoặc component unmount
   * HOW: clearInterval và set ref về null
   */
  const cleanupHeartbeat = () => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
  };

  /**
   * Hàm gửi ping
   * WHAT: Gửi custom ping message đến server
   * WHY: Kiểm tra latency hoặc application-level health check
   * HOW: Gửi message type PING
   */
  const sendPing = () => {
    return sendWebSocketMessage({
      type: 'PING',
      timestamp: Date.now()
    });
  };

  return {
    wsRef,
    connectWebSocket,
    disconnectWebSocket,
    sendWebSocketMessage,
    sendPing
  };
}

/**
 * Hàm subscribe market data
 * WHAT: Gửi request subscribe symbols đến server
 * WHY: Muốn nhận real-time updates cho các symbols cụ thể
 * HOW: Gửi message type SUBSCRIBE_MARKET_DATA với mảng symbols
 */
export const subscribeMarketData = (sendWebSocketMessage, symbols, setSubscribedSymbols) => {
  const success = sendWebSocketMessage({
    type: 'SUBSCRIBE_MARKET_DATA',
    symbols: symbols,
    timestamp: Date.now()
  });

  if (success) {
    // Cập nhật state tạm thời (sẽ được xác nhận bởi server)
    setSubscribedSymbols(prev => {
      const newSymbols = [...new Set([...prev, ...symbols])];
      return newSymbols;
    });
  }
};

/**
 * Hàm unsubscribe market data
 * WHAT: Ngừng nhận updates cho symbols
 * WHY: Tiết kiệm bandwidth, không cần data nữa
 * HOW: Gửi message UNSUBSCRIBE_MARKET_DATA đến server
 */
export const unsubscribeMarketData = (sendWebSocketMessage, symbols, setSubscribedSymbols) => {
  const success = sendWebSocketMessage({
    type: 'UNSUBSCRIBE_MARKET_DATA',
    symbols: symbols
  });

  if (success) {
    // Cập nhật state tạm thời (sẽ được xác nhận bởi server)
    setSubscribedSymbols(prev =>
      prev.filter(symbol => !symbols.includes(symbol))
    );
  }
};

/**
 * Hàm đặt lệnh
 * WHAT: Gửi order request đến server
 * WHY: Người dùng muốn mua/bán trading instrument
 * HOW: Gửi message type PLACE_ORDER với order details
 */
export const placeOrder = (sendWebSocketMessage, orderForm, setOrderForm) => {
  // Validate order form
  if (!orderForm.symbol || !orderForm.quantity || orderForm.quantity <= 0) {
    alert('Please fill all required fields');
    return false;
  }

  const success = sendWebSocketMessage({
    type: 'PLACE_ORDER',
    order: {
      symbol: orderForm.symbol,
      quantity: parseFloat(orderForm.quantity),
      price: orderForm.price ? parseFloat(orderForm.price) : undefined,
      side: orderForm.side,
      timestamp: Date.now()
    }
  });

  if (success) {
    // Reset form (giữ lại symbol và side)
    setOrderForm(prev => ({
      ...prev,
      quantity: 1,
      price: ''
    }));
    return true;
  }

  return false;
};