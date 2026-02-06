/**
 * FILE: message-handler.js
 * 
 * MỤC ĐÍCH: Xử lý tất cả messages từ client
 * - Parse JSON messages
 * - Route messages dựa trên type
 * - Gọi các handlers tương ứng
 */

// ==================== IMPORT MODULES ====================
const { getClient, updateClientSubscriptions } = require('../clients/client-manager');
const { marketData } = require('../data/market-data');
const { processOrderAsync } = require('./order-processor');
const { simulateAsyncDelay } = require('../utils/helpers');
const { validateOrderFormat } = require('../utils/validators');

/**
 * Xử lý message từ client
 * @param {WebSocket} ws - WebSocket instance của client
 * @param {string} clientId - ID của client
 * @param {string|Buffer} message - Message từ client
 */
function handleMessage(ws, clientId, message) {
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
            case 'SUBSCRIBE_MARKET_DATA':
                handleSubscribeMarketData(ws, clientId, data);
                break;
                
            case 'UNSUBSCRIBE_MARKET_DATA':
                handleUnsubscribeMarketData(ws, clientId, data);
                break;
                
            case 'PLACE_ORDER':
                handlePlaceOrder(ws, clientId, data);
                break;
                
            case 'HEARTBEAT':
                handleHeartbeat(ws);
                break;
                
            case 'PING':
                handlePing(ws);
                break;
                
            default:
                handleUnknownMessage(ws, data.type);
        }
    } catch (error) {
        // ERROR HANDLING: Client gửi invalid JSON
        console.error('Error parsing message:', error.message);
        ws.send(JSON.stringify({
            type: 'ERROR',
            message: 'Invalid JSON format',
            timestamp: Date.now()
        }));
    }
}

/**
 * Xử lý subscribe market data request
 */
function handleSubscribeMarketData(ws, clientId, data) {
    // BUSINESS LOGIC: Client muốn nhận real-time updates
    // VÍ DỤ THỰC TẾ: User chọn "Theo dõi BTC, ETH" trong trading app
    console.log(`📡 Client ${clientId} subscribing to:`, data.symbols);

    // BƯỚC 0: Lấy client object từ Map
    const client = getClient(clientId);
    if (!client) {
        console.error(`Client ${clientId} not found`);
        ws.send(JSON.stringify({
            type: 'ERROR',
            message: 'Client not found',
            timestamp: Date.now()
        }));
        return;
    }

    // BƯỚC 1: Lưu subscriptions vào client object
    // Đảm bảo subscriptions tồn tại (nếu chưa có trong client object)
    if (!client.subscriptions) {
        client.subscriptions = new Set();  // Tạo Set nếu chưa có
    }

    // Thêm các symbols vào subscriptions
    data.symbols.forEach(symbol => {
        client.subscriptions.add(symbol);
        console.log(`   ✅ Added ${symbol} to client ${clientId} subscriptions`);
    });

    // Cập nhật client trong Map
    updateClientSubscriptions(clientId, client.subscriptions);

    // BƯỚC 2: Gửi acknowledgment (xác nhận)
    ws.send(JSON.stringify({
        type: 'SUBSCRIBE_ACK',
        subscribedSymbols: Array.from(client.subscriptions),
        subscribedCount: data.symbols.length,
        timestamp: Date.now()
    }));

    console.log(`   Total subscriptions for ${clientId}:`, Array.from(client.subscriptions));

    // BƯỚC 3: Gửi initial data (snapshot)
    data.symbols.forEach((symbol, index) => {
        if (marketData[symbol]) {
            setTimeout(() => {
                ws.send(JSON.stringify({
                    type: 'MARKET_DATA',
                    symbol: symbol,
                    data: marketData[symbol],
                    timestamp: Date.now(),
                    isInitial: true // Thêm flag để client biết là data ban đầu
                }));
            }, 100 * index);
        } else {
            console.log(`   ⚠️ Symbol ${symbol} not found in market data`);
            ws.send(JSON.stringify({
                type: 'ERROR',
                message: `Symbol ${symbol} not available`,
                symbol: symbol,
                timestamp: Date.now()
            }));
        }
    });
}

/**
 * Xử lý unsubscribe market data request
 */
function handleUnsubscribeMarketData(ws, clientId, data) {
    // BUSINESS LOGIC: Client muốn ngừng nhận updates
    // VÍ DỤ THỰC TẾ: User bỏ chọn symbol trong trading app
    console.log(`📡 Client ${clientId} unsubscribing from:`, data.symbols);

    const client = getClient(clientId);
    if (client && client.subscriptions) {
        // Xóa các symbols khỏi subscriptions
        data.symbols.forEach(symbol => {
            client.subscriptions.delete(symbol);
            console.log(`   ✅ Removed ${symbol} from client ${clientId} subscriptions`);
        });

        // Gửi confirmation
        ws.send(JSON.stringify({
            type: 'UNSUBSCRIBE_ACK',
            unsubscribedSymbols: data.symbols,
            remainingSubscriptions: Array.from(client.subscriptions),
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
}

/**
 * Xử lý place order request
 */
function handlePlaceOrder(ws, clientId, data) {
    // BUSINESS LOGIC: Client đặt lệnh mua/bán
    // TRONG THỰC TẾ: Order → Matching Engine → Execution
    console.log(`💰 Client ${clientId} placing order:`, data.order);

    // Tạo Order ID unique
    const orderId = 'ORD_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

    // BƯỚC 1: Gửi order acknowledgment NGAY LẬP TỨC
    ws.send(JSON.stringify({
        type: 'ORDER_ACK',
        orderId: orderId,
        status: 'RECEIVED',  // Trạng thái: Đã nhận, chờ xử lý
        timestamp: Date.now(),
        message: 'Order received and queued for processing'
    }));

    // BƯỚC 2: Xử lý order async
    processOrderAsync(ws, orderId, data.order);
    
    console.log(`   ⚡ Order ${orderId} queued for async processing`);
}

/**
 * Xử lý heartbeat message
 */
function handleHeartbeat(ws) {
    // TẠI SAO cần heartbeat?
    // - Keep-alive: giữ kết nối không bị timeout
    // - Network health check: phát hiện broken connections
    // - Load balancing: biết client còn alive
    ws.send(JSON.stringify({
        type: 'HEARTBEAT_ACK',
        timestamp: Date.now()
    }));
}

/**
 * Xử lý ping message
 */
function handlePing(ws) {
    // WebSocket protocol có built-in ping/pong
    // NHƯNG tại sao implement custom ping?
    // - Application-level health check
    // - Custom metrics tracking
    // - Backward compatibility
    ws.send(JSON.stringify({
        type: 'PONG',
        timestamp: Date.now()
    }));
}

/**
 * Xử lý unknown message type
 */
function handleUnknownMessage(ws, messageType) {
    console.log(`   Unknown message type: ${messageType}`);
    ws.send(JSON.stringify({
        type: 'ERROR',
        message: `Unknown message type: ${messageType}`,
        timestamp: Date.now()
    }));
}

module.exports = {
    handleMessage
};