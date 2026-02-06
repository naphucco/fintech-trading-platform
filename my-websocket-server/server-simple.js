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
const { v4: uuidv4 } = require('uuid'); // Destructuring 

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

                    // BƯỚC 1: Gửi order acknowledgment NGAY LẬP TỨC
                    // TẠI SAO không xử lý order ngay?
                    // - Trading thực tế: order phải qua validation, risk checks (có thể mất vài ms đến vài trăm ms)
                    // - Asynchronous processing để không block WebSocket connection
                    // - Cho phép client biết order đã được nhận (user feedback immediate)
                    // - Client có thể tiếp tục gửi messages khác trong khi order đang xử lý
                    ws.send(JSON.stringify({
                        type: 'ORDER_ACK',
                        orderId: orderId,
                        status: 'RECEIVED',  // Trạng thái: Đã nhận, chờ xử lý
                        timestamp: Date.now(),
                        message: 'Order received and queued for processing'
                    }));

                    // BƯỚC 2: Xử lý order với ASYNC/AWAIT pattern
                    // TẠI SAO dùng async/await thay vì chỉ setTimeout?
                    // - Dễ đọc, dễ maintain (linear code flow)
                    // - Error handling tốt hơn với try-catch
                    // - Có thể thêm các async steps phức tạp (validation, risk checks, etc.)
                    // - Phản ánh đúng bản chất không đồng bộ của trading system
                    // ⚠️ QUAN TRỌNG: Dùng IIFE (Immediately Invoked Function Expression) để:
                    // - Tạo execution context riêng cho async operation
                    // - Không block message handler chính
                    // - Cho phép xử lý nhiều orders song song
                    (async () => {
                        try {
                            // SIMULATION: Mô phỏng các bước xử lý order thực tế

                            // BƯỚC 2.1: Validation (async simulation)
                            // TRONG THỰC TẾ: Kiểm tra order format, symbol tồn tại, trading hours, etc.
                            // ⏱️ Thời gian: 50-200ms trong thực tế
                            console.log(`   ⏳ Validating order ${orderId}...`);
                            await simulateAsyncDelay(100, 300); // Giả lập delay validation
                            const isValid = validateOrderFormat(data.order);

                            if (!isValid) {
                                throw new Error('INVALID_ORDER_FORMAT');
                            }

                            // Cập nhật status cho client biết đang validation
                            ws.send(JSON.stringify({
                                type: 'ORDER_STATUS_UPDATE',
                                orderId: orderId,
                                status: 'VALIDATING',
                                timestamp: Date.now(),
                                message: 'Order validation in progress'
                            }));

                            // BƯỚC 2.2: Risk Checks (async simulation)
                            // TRONG THỰC TẾ: Kiểm tra position limits, margin requirements, credit limits
                            // ⏱️ Thời gian: 100-500ms trong thực tế
                            console.log(`   ⏳ Running risk checks for order ${orderId}...`);
                            await simulateAsyncDelay(200, 500);
                            const riskApproved = Math.random() > 0.1; // 90% pass rate

                            if (!riskApproved) {
                                throw new Error('RISK_CHECK_FAILED');
                            }

                            // Cập nhật status cho client biết đang risk check
                            ws.send(JSON.stringify({
                                type: 'ORDER_STATUS_UPDATE',
                                orderId: orderId,
                                status: 'RISK_CHECKING',
                                timestamp: Date.now(),
                                message: 'Risk assessment in progress'
                            }));

                            // BƯỚC 2.3: Market Data Check (real-time)
                            // TRONG THỰC TẾ: Kiểm tra current price, spreads, market conditions
                            // ⏱️ Thời gian: <10ms (real-time check)
                            const currentPrice = marketData[data.order?.symbol]?.price;
                            if (!currentPrice) {
                                throw new Error('SYMBOL_NOT_FOUND');
                            }

                            // BƯỚC 2.4: Matching Engine Simulation (async - VARIABLE TIME)
                            // TRONG THỰC TẾ: Gửi đến Matching Engine
                            // Engine tìm matching buy/sell orders trong order book
                            // ⏱️ Thời gian: BIẾN ĐỘNG RẤT LỚN (1ms - 30s+)
                            // - Market orders: thường <100ms nếu có liquidity
                            // - Limit orders: có thể pending vài giây đến vài phút chờ price
                            // - Large orders: có thể partial fill trong nhiều phút
                            console.log(`   ⏳ Sending order ${orderId} to matching engine...`);

                            // Gửi status update
                            ws.send(JSON.stringify({
                                type: 'ORDER_STATUS_UPDATE',
                                orderId: orderId,
                                status: 'SUBMITTED_TO_MATCHING_ENGINE',
                                timestamp: Date.now(),
                                message: 'Order submitted for matching'
                            }));

                            // Giả lập matching engine delay (1-3 giây như code gốc)
                            // Thực tế delay phụ thuộc vào:
                            // - Market liquidity (liquid markets nhanh hơn)
                            // - Order type (market order nhanh hơn limit order)
                            // - Order size (small orders nhanh hơn)
                            // - Market volatility (high volatility chậm hơn)
                            const matchingDelay = Math.random() * 2000 + 1000; // 1-3 giây
                            await simulateAsyncDelay(matchingDelay - 200, matchingDelay + 200);

                            // BƯỚC 2.5: Execution Result
                            // Mô phỏng 70% thành công (filled) - giữ nguyên logic gốc
                            // Thực tế: phụ thuộc vào market liquidity, price, order book depth
                            const isFilled = Math.random() > 0.3;

                            if (isFilled) {
                                // Order executed successfully
                                // TRONG THỰC TẾ: Có thể partial fill (chỉ fill một phần)
                                // Có thể multiple fills (nhiều lần fill với prices khác nhau)
                                const filledPrice = currentPrice * (1 + (Math.random() - 0.5) * 0.02); // ±1%
                                const filledQuantity = data.order.quantity || 1;

                                console.log(`   ✅ Order ${orderId} FILLED at $${filledPrice.toFixed(2)}`);

                                // 'ws' là WebSocket instance của client HIỆN TẠI
                                ws.send(JSON.stringify({
                                    type: 'ORDER_FILLED',
                                    orderId: orderId,
                                    status: 'FILLED',
                                    filledPrice: filledPrice,
                                    filledQuantity: filledQuantity,
                                    executionTime: Date.now(), // Thời điểm thực sự executed
                                    averagePrice: filledPrice, // Với multiple fills sẽ là avg
                                    totalFilled: filledQuantity,
                                    remainingQuantity: 0,
                                    timestamp: Date.now()
                                }));
                            } else {
                                // Order rejected (no liquidity)
                                // TRONG THỰC TẾ: Có thể bị reject vì nhiều lý do:
                                // - No liquidity (không có matching orders)
                                // - Price moved away (limit order không khớp)
                                // - Market closed
                                // - Circuit breaker triggered
                                console.log(`   ❌ Order ${orderId} REJECTED - insufficient liquidity`);

                                ws.send(JSON.stringify({
                                    type: 'ORDER_REJECTED',
                                    orderId: orderId,
                                    status: 'REJECTED',
                                    reason: 'INSUFFICIENT_LIQUIDITY',
                                    rejectionTime: Date.now(),
                                    suggestedAction: 'TRY_LIMIT_ORDER_OR_ADJUST_PRICE',
                                    timestamp: Date.now()
                                }));
                            }

                            // BƯỚC 2.6: Post-trade processing (async - background)
                            // TRONG THỰC TẾ: Settlement, position updates, P&L calculation
                            // ⚡ KHÔNG block client - xử lý background
                            setTimeout(async () => {
                                console.log(`   📊 Post-trade processing for ${orderId}...`);
                                // Có thể gửi confirmation email, update database, etc.
                            }, 100);

                        } catch (error) {
                            // ERROR HANDLING: Xử lý lỗi trong quá trình order processing
                            // TRONG THỰC TẾ: Cần logging đầy đủ, alerting, recovery procedures
                            console.error(`   🚨 Order ${orderId} processing failed:`, error.message);

                            ws.send(JSON.stringify({
                                type: 'ORDER_ERROR',
                                orderId: orderId,
                                status: 'ERROR',
                                errorCode: error.message,
                                errorMessage: getErrorMessage(error.message),
                                timestamp: Date.now(),
                                // Thông tin debug (chỉ development)
                                ...(process.env.NODE_ENV === 'development' && { debug: error.stack })
                            }));
                        }
                    })(); // ⚡ IIFE: Immediately Invoked Function Expression
                    // Từ đây message handler tiếp tục xử lý messages khác NGAY LẬP TỨC

                    console.log(`   ⚡ Order ${orderId} queued for async processing`);
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

// ==================== HELPER FUNCTIONS ====================

/**
 * Giả lập async delay với random variation
 * @param {number} minDelay - Minimum delay in ms
 * @param {number} maxDelay - Maximum delay in ms  
 * @returns {Promise<void>}
 */
function simulateAsyncDelay(minDelay, maxDelay) {
    const delay = Math.random() * (maxDelay - minDelay) + minDelay;
    return new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * Validate order format cơ bản
 * TRONG THỰC TẾ: Phức tạp hơn nhiều (regulatory checks, etc.)
 */
function validateOrderFormat(order) {
    if (!order || !order.symbol) return false;
    if (order.quantity && order.quantity <= 0) return false;
    return true;
}

/**
 * Map error codes to user-friendly messages
 */
function getErrorMessage(errorCode) {
    const errorMap = {
        'INVALID_ORDER_FORMAT': 'Order format is invalid',
        'RISK_CHECK_FAILED': 'Order rejected by risk management system',
        'SYMBOL_NOT_FOUND': 'Trading symbol not found',
        'INSUFFICIENT_LIQUIDITY': 'Not enough liquidity in the market'
    };
    return errorMap[errorCode] || 'Unknown error occurred';
}