/**
 * FILE: test-client.js
 * MỤC ĐÍCH: Test client cho WebSocket server FinTech
 * CHỨC NĂNG:
 *  - Kết nối đến WebSocket server
 *  - Subscribe market data
 *  - Đặt orders
 *  - Xử lý real-time updates
 */

// ==================== 1. IMPORT MODULES ====================
const WebSocket = require('ws');  // Thư viện WebSocket client

// ==================== 2. TẠO WEBSOCKET CLIENT ====================
// Khởi tạo WebSocket client kết nối đến server
const ws = new WebSocket('ws://localhost:8080', {  // URL WebSocket server
    headers: {
        'x-api-key': 'DEMO_API_KEY_123'  // API key cho authentication (gửi trong HTTP headers)
    }
});

// ==================== 3. XỬ LÝ SỰ KIỆN KẾT NỐI THÀNH CÔNG ====================
// 'open' event được trigger khi kết nối đến server thành công
ws.on('open', () => {
    console.log('✅ Connected to Trading WebSocket Server');
    console.log('⏳ Waiting for welcome message...');
    
    // Chờ 1 giây để server gửi welcome message trước khi subscribe
    setTimeout(() => {
        // ============ 3.1. SUBSCRIBE MARKET DATA ============
        console.log('📡 Subscribing to market data...');
        ws.send(JSON.stringify({  // Gửi message subscribe
            type: 'SUBSCRIBE_MARKET_DATA',  // Loại message
            symbols: ['BTC/USD', 'ETH/USD', 'AAPL']  // Danh sách symbols cần subscribe
        }));
        
        // ============ 3.2. ĐẶT TEST ORDER SAU 3 GIÂY ============
        setTimeout(() => {
            console.log('💰 Placing test order...');
            ws.send(JSON.stringify({
                type: 'PLACE_ORDER',  // Loại message: đặt order
                order: {              // Dữ liệu order
                    symbol: 'BTC/USD',    // Symbol giao dịch
                    side: 'BUY',          // Bên: BUY (mua) hoặc SELL (bán)
                    quantity: 0.5,        // Số lượng
                    orderType: 'MARKET'   // Loại order: MARKET (giá thị trường)
                }
            }));
        }, 3000);  // Chờ 3 giây (3000ms)
    }, 1000);  // Chờ 1 giây (1000ms)
});

// ==================== 4. XỬ LÝ MESSAGE TỪ SERVER ====================
// 'message' event được trigger khi nhận message từ server
// chạy MỖI LẦN server gửi data qua setInterval (theo ví dụ server-simple.js)
// giống y hệt RxJS subscribe()
ws.on('message', (data) => {
    try {
        // Chuyển dữ liệu từ Buffer/string sang JavaScript object
        const message = JSON.parse(data.toString());
        console.log('\n📨 Received:', message.type);  // Log loại message
        
        // Xử lý message dựa trên type
        switch (message.type) {
            // ============ CASE 1: WELCOME MESSAGE ============
            case 'WELCOME':
                console.log(`   Server: ${message.message}`);
                console.log(`   Your Client ID: ${message.clientId}`);
                break;
                
            // ============ CASE 2: SUBSCRIBE ACKNOWLEDGMENT ============
            case 'SUBSCRIBE_ACK':
                console.log(`   ✅ Subscribed to ${message.symbols?.length || 0} symbols`);
                console.log(`   Total subscribed: ${message.subscribedCount}`);
                break;
                
            // ============ CASE 3: MARKET DATA ============
            case 'MARKET_DATA':
                // Kiểm tra cấu trúc message có đúng không
                if (message.symbol && message.data && typeof message.data.price === 'number') {
                    // Format 1: Server gửi từng symbol riêng
                    console.log(`   📊 ${message.symbol}: $${message.data.price.toFixed(2)} (${message.data.change?.toFixed(2) || 0}%)`);
                } else if (message.data && typeof message.data === 'object') {
                    // Format 2: Server gửi tất cả market data cùng lúc
                    console.log('   📈 Market Data Update:');
                    Object.keys(message.data).forEach(symbol => {
                        const price = message.data[symbol]?.price || message.data[symbol];
                        if (price) {
                            // toFixed(2) làm tròn 2 chữ số thập phân
                            console.log(`      ${symbol}: $${typeof price === 'number' ? price.toFixed(2) : price}`);
                        }
                    });
                }
                break;
                
            // ============ CASE 4: MARKET DATA UPDATE ============
            case 'MARKET_DATA_UPDATE':
                if (message.symbol && message.data) {
                    console.log(`   🔄 ${message.symbol} Update: $${message.data.price?.toFixed(2) || 'N/A'}`);
                }
                break;
                
            // ============ CASE 5: ORDER ACKNOWLEDGMENT ============
            case 'ORDER_ACK':
                console.log(`   ✅ Order Acknowledged: ${message.orderId}`);
                console.log(`   Status: ${message.status}`);
                break;
                
            // ============ CASE 6: ORDER FILLED (THÀNH CÔNG) ============
            case 'ORDER_FILLED':
                console.log(`   🎉 Order Filled!`);
                console.log(`   Order ID: ${message.orderId}`);
                console.log(`   Price: $${message.filledPrice?.toFixed(2) || 'N/A'}`);
                console.log(`   Quantity: ${message.filledQuantity}`);
                break;
                
            // ============ CASE 7: ORDER REJECTED (TỪ CHỐI) ============
            case 'ORDER_REJECTED':
                console.log(`   ❌ Order Rejected: ${message.reason || 'Unknown reason'}`);
                break;
                
            // ============ CASE 8: HEARTBEAT ACKNOWLEDGMENT ============
            case 'HEARTBEAT_ACK':
                console.log('   💓 Heartbeat acknowledged');
                break;
                
            // ============ CASE 9: ERROR MESSAGE ============
            case 'ERROR':
                console.log(`   ⚠️ Error: ${message.error} - ${message.message}`);
                break;
                
            // ============ DEFAULT: UNKNOWN MESSAGE TYPE ============
            default:
                console.log('   Unknown message type:', message.type);
                // JSON.stringify với null, 2 để format đẹp (indent 2 spaces)
                console.log('   Full message:', JSON.stringify(message, null, 2));
        }
    } catch (error) {
        // Xử lý lỗi parse JSON
        console.error('❌ Error parsing message:', error.message);
        console.log('Raw data:', data.toString().substring(0, 100));  // Log 100 ký tự đầu
    }
});

// ==================== 5. XỬ LÝ LỖI WEBSOCKET ====================
// 'error' event được trigger khi có lỗi kết nối
ws.on('error', (error) => {
    console.error('❌ WebSocket Error:', error.message);
});

// ==================== 6. XỬ LÝ KHI ĐÓNG KẾT NỐI ====================
// 'close' event được trigger khi kết nối đóng
ws.on('close', (code, reason) => {
    // code: WebSocket close code (1000 = normal closure)
    // reason: Lý do đóng kết nối (string)
    console.log(`\n🔌 Connection closed. Code: ${code}, Reason: ${reason || 'No reason'}`);
});

// ==================== 7. GỬI HEARTBEAT ĐỊNH KỲ ====================
// setInterval gửi heartbeat mỗi 15 giây để giữ kết nối
setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {  // Kiểm tra kết nối còn mở
        ws.send(JSON.stringify({ 
            type: 'HEARTBEAT'  // Gửi heartbeat message
        }));
    }
}, 15000);  // 15000ms = 15 giây

// ==================== 8. TỰ ĐỘNG RECONNECT ====================
function reconnect() {
    console.log('🔄 Attempting to reconnect...');
    setTimeout(() => {
        // Trong ví dụ đơn giản này, cần restart client để reconnect
        console.log('Please restart the client to reconnect.');
    }, 5000);  // Thử lại sau 5 giây
}

// Gọi hàm reconnect khi connection đóng
ws.on('close', () => {
    reconnect();
});