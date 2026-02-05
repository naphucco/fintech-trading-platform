/**
 * FILE: server-simple.js
 * 
 * MỤC ĐÍCH CHÍNH: Mô phỏng hệ thống real-time trading cho FinTech
 * - Server WebSocket xử lý market data và orders
 * - Minh họa kiến trúc real-time cho trading platform
 * - Dùng cho học tập và prototyping
 * 
 * KIẾN TRÚC: Single WebSocket endpoint đa năng
 * - 1 connection duy nhất cho mỗi client
 * - Multiplexing: Tất cả message types trên 1 connection
 * - Message-based routing: Dùng field 'type' để phân loại
 */

// ==================== 1. IMPORT MODULES ====================
// WebSocket: Thư viện core để tạo WebSocket server
// TẠI SAO dùng 'ws' thay vì Socket.io? 
// - 'ws' nhẹ hơn, performance tốt hơn cho trading
// - Socket.io có overhead (polling fallback) không cần cho low-latency
const WebSocket = require('ws');

// uuid: Tạo unique ID cho mỗi client
// TẠI SAO cần UUID thay vì tự tạo ID?
// - UUID đảm bảo uniqueness trên toàn hệ thống
// - Tránh collision khi nhiều clients kết nối cùng lúc
// - UUID v4 random, không thể đoán trước (bảo mật tốt hơn)
const { v4: uuidv4 } = require('uuid');

// ==================== 2. TẠO WEBSOCKET SERVER ====================
// Tạo WebSocket server instance
const wss = new WebSocket.Server({
    port: 8080,                    // Port mặc định cho development
    // TẠI SAO perMessageDeflate: false?
    // - Compression tốn CPU cycles → tăng latency
    // - Trong High-Frequency Trading (HFT), mỗi millisecond đều quan trọng
    // - Market data messages thường nhỏ (< 1KB) → compression không đáng
    // - Trading platforms thực tế (Bloomberg, Reuters) đều tắt compression
    perMessageDeflate: false
});

// ==================== 3. BIẾN TOÀN CỤC LƯU TRỮ ====================
// Map: Cấu trúc key-value của JavaScript (giống Dictionary/HashMap)
// TẠI SAO dùng Map thay vì Object?
// - Map giữ thứ tự insertion (quan trọng cho iteration)
// - Keys có thể là bất kỳ type nào (Object chỉ string/symbol)
// - Performance tốt hơn cho add/remove operations
// - Có .size property built-in
const clients = new Map();  // Format: Map<clientId, clientObject>

console.log('🚀 WebSocket Server started on ws://localhost:8080');

// ==================== 4. XỬ LÝ SỰ KIỆN KẾT NỐI ====================
// Event 'connection' được trigger khi client thiết lập WebSocket connection
// NHƯ THẾ NÀO hoạt động?
// 1. Client mở kết nối TCP đến port 8080
// 2. WebSocket handshake (HTTP upgrade request)
// 3. Nếu thành công → connection established
// 4. Server gọi callback này với ws (WebSocket instance) và req (HTTP request)
wss.on('connection', (ws, req) => {
    // TẠI SAO cần tạo unique ID cho client?
    // - Để tracking: biết client nào gửi message gì
    // - Để routing: gửi response đúng client
    // - Để authentication/logging: trace các activities
    const clientId = uuidv4();

    // Lấy IP của client từ HTTP request
    // TẠI SAO cần IP?
    // - Rate limiting: giới hạn requests từ 1 IP
    // - Geo-location: phục vụ data center gần nhất
    // - Security logging: track suspicious activities
    const clientIp = req.socket.remoteAddress;

    console.log(`✅ Client connected: ${clientId} from ${clientIp}`);

    // ==================== 4.0. LƯU THÔNG TIN CLIENT ====================
    // TẠI SAO cần lưu client vào Map?
    // - Để biết có bao nhiêu clients đang connected
    // - Để gửi broadcast messages đến tất cả clients
    // - Để cleanup khi client disconnect
    // 🚨 VẤN ĐỀ HIỆN TẠI: Thiếu field 'subscriptions'
    // - Server không biết client subscribe symbols nào
    // - Không thể gửi targeted updates
    // - CẦN THÊM: subscriptions: new Set() 
    clients.set(clientId, {
        ws: ws,           // WebSocket instance để gửi message
        id: clientId,     // ID để nhận diện
        ip: clientIp,     // IP để security/analytics
        connectedAt: Date.now(),  // Thời gian để tính uptime/session length
        subscriptions: new Set() // Lưu symbols client đang subscribe
    });

    // ==================== 4.1. GỬI WELCOME MESSAGE ====================
    // TẠI SAO cần welcome message?
    // - Client biết kết nối thành công
    // - Cung cấp Client ID để dùng cho future requests
    // - Thiết lập timestamp baseline để tính latency
    ws.send(JSON.stringify({
        type: 'WELCOME',           // Client dựa vào type để xử lý
        clientId: clientId,        // Client cần lưu ID này
        message: 'Connected to FinTech WebSocket Server',
        timestamp: Date.now()      // Để client sync time
    }));

    // ==================== 4.2. XỬ LÝ MESSAGE TỪ CLIENT ====================
    // Event 'message' được trigger khi client gửi data qua WebSocket
    // NHƯ THẾ NÀO hoạt động?
    // 1. Client gửi message (string/binary)
    // 2. Server nhận → trigger event
    // 3. Parse message → xử lý theo business logic
    ws.on('message', (message) => {
        // // HANDLER này sẽ chạy MỖI KHI có message đến
        try {
            // TẠI SAO cần try-catch ở đây?
            // - Client có thể gửi invalid JSON (vô tình/cố ý)
            // - Malicious clients có thể crash server nếu không bắt lỗi
            // - Production cần xử lý graceful degradation
            const data = JSON.parse(message);
            console.log(`📨 Received from ${clientId}:`, data.type);

            // SWITCH-CASE như Message Router
            // TẠI SAO dùng switch-case thay vì if-else?
            // - Dễ đọc, dễ maintain khi có nhiều message types
            // - Performance tốt hơn cho nhiều cases
            // - Có thể refactor thành strategy pattern khi scale
            switch (data.type) {
                // ============ CASE 1: SUBSCRIBE MARKET DATA ============
                case 'SUBSCRIBE_MARKET_DATA':
                    // BUSINESS LOGIC: Client muốn nhận real-time updates
                    // VÍ DỤ THỰC TẾ: User chọn "Theo dõi BTC, ETH" trong trading app
                    console.log(`📡 Client ${clientId} subscribing to:`, data.symbols);

                    // BƯỚC 0: Lấy client object từ Map (THÊM MỚI)
                    // TẠI SAO cần bước này?
                    // - Để truy cập client object đã lưu trong Map
                    // - Để cập nhật subscriptions
                    const client = clients.get(clientId);
                    if (!client) {
                        console.error(`Client ${clientId} not found`);
                        break;
                    }

                    // BƯỚC 1: Lưu subscriptions vào client object

                    // Đảm bảo subscriptions tồn tại (nếu chưa có trong client object)
                    if (!client.subscriptions) {
                        client.subscriptions = new Set();  // Tạo Set nếu chưa có
                    }

                    // Thêm các symbols vào subscriptions (PHẦN QUAN TRỌNG ĐÃ THIẾU)
                    data.symbols.forEach(symbol => {
                        client.subscriptions.add(symbol);
                        console.log(`   ✅ Added ${symbol} to client ${clientId} subscriptions`);
                    });

                    // Cập nhật client trong Map
                    clients.set(clientId, client);

                    // BƯỚC 2: Gửi acknowledgment (xác nhận)
                    // TẠI SAO cần SUBSCRIBE_ACK?
                    // - Client biết request đã được nhận
                    // - Confirmation pattern trong distributed systems
                    // - Client có thể retry nếu không nhận ACK

                    // SUBSCRIBE_ACK (Subscription Acknowledgment - Xác nhận đăng ký) 
                    // là một gói tin (packet) hoặc thông điệp được sử dụng trong các giao thức giao tiếp máy-máy (M2M) 
                    // và hệ thống publish/subscribe, phổ biến nhất là MQTT (Message Queuing Telemetry Transport).
                    ws.send(JSON.stringify({
                        type: 'SUBSCRIBE_ACK',
                        subscribedSymbols: Array.from(client.subscriptions), // Gửi lại tất cả symbols đang subscribe
                        subscribedCount: data.symbols.length,
                        timestamp: Date.now()
                    }));

                    console.log(`   Total subscriptions for ${clientId}:`, Array.from(client.subscriptions));

                    // BƯỚC 3: Gửi initial data (snapshot)
                    // TẠI SAO cần gửi data ban đầu?
                    // - Client cần thấy giá HIỆN TẠI ngay lập tức
                    // - Không đợi đến lúc có update đầu tiên
                    // - Snapshot + Updates pattern phổ biến trong real-time systems
                    data.symbols.forEach((symbol, index) => {
                        if (marketData[symbol]) {
                            // ⚠️ VẤN ĐỀ 1: Tất cả setTimeout đều 100ms
                            // - BTC: gửi sau 100ms
                            // - ETH: gửi sau 100ms (CÙNG LÚC với BTC!)
                            // - Gây flood client nếu nhiều symbols
                            // ✅ NÊN: setTimeout với index * delay
                            setTimeout(() => {
                                ws.send(JSON.stringify({
                                    type: 'MARKET_DATA',
                                    symbol: symbol,
                                    data: marketData[symbol],
                                    timestamp: Date.now(),
                                    isInitial: true // Thêm flag để client biết là data ban đầu
                                }));
                            }, 100 * index); // ⏳ SỬA: 100 * index thay vì chỉ 100

                            // ✅ ĐÃ SỬA: Đã thêm client.subscriptions.add(symbol) ở trên
                        } else {
                            console.log(`   ⚠️ Symbol ${symbol} not found in market data`);
                            // Có thể gửi error message về client
                            ws.send(JSON.stringify({
                                type: 'ERROR',
                                message: `Symbol ${symbol} not available`,
                                symbol: symbol,
                                timestamp: Date.now()
                            }));
                        }
                    });
                    break;

                // ============ CASE 2: PLACE ORDER ============
                case 'PLACE_ORDER':
                    // BUSINESS LOGIC: Client đặt lệnh mua/bán
                    // TRONG THỰC TẾ: Order → Matching Engine → Execution
                    console.log(`💰 Client ${clientId} placing order:`, data.order);

                    // Tạo Order ID unique
                    // TẠI SAO cần format 'ORD_timestamp_random'?
                    // - Timestamp để biết thời điểm đặt lệnh
                    // - Random string để tránh collision
                    // - Prefix 'ORD_' để dễ nhận diện trong logs
                    const orderId = 'ORD_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

                    // BƯỚC 1: Gửi order acknowledgment
                    // TẠI SAO không xử lý order ngay?
                    // - Trading thực tế: order phải qua validation, risk checks
                    // - Asynchronous processing để không block connection
                    // - Cho phép client biết order đã được nhận
                    ws.send(JSON.stringify({
                        type: 'ORDER_ACK',
                        orderId: orderId,
                        status: 'PENDING',  // Trạng thái initial
                        timestamp: Date.now()
                    }));

                    // BƯỚC 2: Mô phỏng xử lý order (async)
                    // TRONG THỰC TẾ: Gửi đến Matching Engine
                    // Engine tìm matching buy/sell orders
                    // Nếu match → filled, không match → rejected/cancelled
                    setTimeout(() => {
                        // Mô phỏng 70% thành công (filled)
                        // Thực tế: phụ thuộc vào market liquidity, price
                        const isFilled = Math.random() > 0.3;

                        if (isFilled) {
                            // Order executed successfully
                            // 'ws' là WebSocket instance của client HIỆN TẠI
                            ws.send(JSON.stringify({
                                type: 'ORDER_FILLED',
                                orderId: orderId,
                                status: 'FILLED',
                                filledPrice: marketData[data.order.symbol]?.price || 45000,
                                filledQuantity: data.order.quantity || 1,
                                timestamp: Date.now()
                            }));
                        } else {
                            // Order rejected (no liquidity)
                            ws.send(JSON.stringify({
                                type: 'ORDER_REJECTED',
                                orderId: orderId,
                                reason: 'INSUFFICIENT_LIQUIDITY',
                                timestamp: Date.now()
                            }));
                        }
                    }, Math.random() * 2000 + 1000); // Random delay 1-3s
                    break;

                // ============ CASE 3: HEARTBEAT ============
                case 'HEARTBEAT':
                    // TẠI SAO cần heartbeat?
                    // - Keep-alive: giữ kết nối không bị timeout
                    // - Network health check: phát hiện broken connections
                    // - Load balancing: biết client còn alive
                    ws.send(JSON.stringify({
                        type: 'HEARTBEAT_ACK',
                        timestamp: Date.now()
                    }));
                    break;

                // ============ CASE 4: PING/PONG ============
                case 'PING':
                    // WebSocket protocol có built-in ping/pong
                    // NHƯNG tại sao implement custom ping?
                    // - Application-level health check
                    // - Custom metrics tracking
                    // - Backward compatibility
                    ws.send(JSON.stringify({
                        type: 'PONG',
                        timestamp: Date.now()
                    }));
                    break;

                default:
                    // Xử lý unknown message types
                    // Production nên gửi ERROR message về client
                    console.log(`   Unknown message type: ${data.type}`);

                // ============ CASE 5: UNSUBSCRIBE MARKET DATA ============
                case 'UNSUBSCRIBE_MARKET_DATA':
                    // BUSINESS LOGIC: Client muốn ngừng nhận updates
                    // VÍ DỤ THỰC TẾ: User bỏ chọn symbol trong trading app
                    console.log(`📡 Client ${clientId} unsubscribing from:`, data.symbols);

                    const clientToUpdate = clients.get(clientId);
                    if (clientToUpdate && clientToUpdate.subscriptions) {
                        // Xóa các symbols khỏi subscriptions
                        data.symbols.forEach(symbol => {
                            clientToUpdate.subscriptions.delete(symbol);
                            console.log(`   ✅ Removed ${symbol} from client ${clientId} subscriptions`);
                        });

                        // Gửi confirmation
                        ws.send(JSON.stringify({
                            type: 'UNSUBSCRIBE_ACK',
                            unsubscribedSymbols: data.symbols,
                            remainingSubscriptions: Array.from(clientToUpdate.subscriptions),
                            timestamp: Date.now()
                        }));
                    } else {
                        // Nếu client không tồn tại hoặc không có subscriptions
                        ws.send(JSON.stringify({
                            type: 'ERROR',
                            message: 'Cannot unsubscribe - client not found or no subscriptions',
                            timestamp: Date.now()
                        }));
                    }
                    break;
            }

        } catch (error) {
            // ERROR HANDLING: Client gửi invalid JSON
            // Production cần:
            // 1. Log để security monitoring
            // 2. Gửi error message về client
            // 3. Rate limiting cho client gửi nhiều invalid messages
            console.error('Error parsing message:', error.message);
        }
    });

    // ==================== 4.3. XỬ LÝ DISCONNECT ====================
    ws.on('close', () => {
        // TẠI SAO cần xử lý disconnect?
        // - Cleanup resources (memory, connections)
        // - Update user status (offline/online)
        // - Cancel pending orders của client
        console.log(`❌ Client disconnected: ${clientId}`);
        clients.delete(clientId);
    });

    // ==================== 4.4. XỬ LÝ LỖI WEBSOCKET ====================
    ws.on('error', (error) => {
        // WebSocket errors (network issues, protocol errors)
        console.error(`WebSocket error for ${clientId}:`, error.message);
    });
});

// ==================== 5. DỮ LIỆU THỊ TRƯỜNG MẪU ====================
// Mock data cho testing
// TRONG THỰC TẾ: Data từ các nguồn:
// - Bloomberg/Reuters feeds
// - Exchange APIs (Binance, Coinbase, NASDAQ)
// - Internal pricing engines
const marketData = {
    'BTC/USD': {
        price: 45000,   // Price in USD
        change: 2.5     // % change from previous close
    },
    'ETH/USD': {
        price: 2500,
        change: 1.2
    },
    'AAPL': {
        price: 180,
        change: -0.5    // Negative = price decrease
    }
};

// ==================== 6. BROADCAST MARKET UPDATES (SIMULATION) ====================
// Mô phỏng real-time market data updates
// TẠI SAO dùng setInterval?
// - Đơn giản cho demo/testing
// - Thực tế: Data từ external feeds (push-based)
// setInterval() chạy LẶP LẠI mỗi 2000ms
setInterval(() => {
    // Update prices randomly (-5% to +5%)
    // THỰC TẾ: Prices từ market data feeds
    Object.keys(marketData).forEach(symbol => {
        const change = (Math.random() - 0.5) * 0.1;
        marketData[symbol].price *= (1 + change);
        marketData[symbol].change = change * 100;
    });

    // LOGIC: Kiểm tra xem client subscribe symbol nào, chỉ gửi data của symbol đó
    let totalMessagesSent = 0;
    clients.forEach((client) => {
        if (client.ws.readyState === WebSocket.OPEN && client.subscriptions && client.subscriptions.size > 0) {
            // Tạo filtered data chỉ chứa symbols client đã subscribe
            const filteredData = {};

            client.subscriptions.forEach(symbol => {
                if (marketData[symbol]) {
                    filteredData[symbol] = marketData[symbol];
                }
            });

            // Chỉ gửi nếu có ít nhất 1 symbol
            if (Object.keys(filteredData).length > 0) {
                client.ws.send(JSON.stringify({
                    type: 'MARKET_DATA',
                    data: filteredData,  // ✅ Chỉ gửi symbols client quan tâm
                    timestamp: Date.now()
                }));
                totalMessagesSent++;
            }
        }
    });
    console.log(`📊 Market data updated, sent ${totalMessagesSent} messages to ${clients.size} clients`);
}, 2000); // 2 seconds - Thực tế HFT cần milliseconds

// ==================== 7. GRACEFUL SHUTDOWN ====================
// Xử lý server shutdown (Ctrl+C, deployment, maintenance)
// TẠI SAO cần graceful shutdown?
// - Đóng connections cleanly
// - Tránh data loss (pending orders, unsent messages)
// - Client có thể reconnect hoặc hiển thị maintenance message
process.on('SIGINT', () => {
    console.log('Shutting down server...');

    // Close all client connections
    clients.forEach((client) => {
        // WebSocket close code 1001 = "Going Away"
        // Client biết server đang shutdown (không phải error)
        client.ws.close(1001, 'Server shutting down');
    });

    // Close WebSocket server
    wss.close(() => {
        console.log('Server shutdown complete');
        process.exit(0);
    });
});