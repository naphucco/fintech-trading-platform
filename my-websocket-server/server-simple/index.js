/**
 * FILE: index.js
 * 
 * MỤC ĐÍCH CHÍNH: Điểm vào chính của ứng dụng
 * - Khởi tạo WebSocket Server
 * - Kết nối các modules với nhau
 * - Xử lý graceful shutdown
 */

// ==================== 1. IMPORT MODULES ====================
const WebSocket = require('ws');
const { initializeServer } = require('./config/server-config');
const { setupConnectionHandler } = require('./handlers/connection-handler');
const { startMarketDataBroadcast } = require('./services/broadcast-service');

// ==================== 2. KHỞI TẠO SERVER ====================
const wss = initializeServer();

// ==================== 3. THIẾT LẬP CONNECTION HANDLER ====================
setupConnectionHandler(wss);

// ==================== 4. KHỞI ĐỘNG MARKET DATA BROADCAST ====================
startMarketDataBroadcast();

// ==================== 5. GRACEFUL SHUTDOWN ====================
// Xử lý server shutdown (Ctrl+C, deployment, maintenance)
// TẠI SAO cần graceful shutdown?
// - Đóng connections cleanly
// - Tránh data loss (pending orders, unsent messages)
// - Client có thể reconnect hoặc hiển thị maintenance message
process.on('SIGINT', () => {
    console.log('Shutting down server...');
    
    // Import client-manager để close all connections
    const { closeAllConnections } = require('./clients/client-manager');
    
    // Close all client connections
    closeAllConnections(1001, 'Server shutting down');
    
    // Close WebSocket server
    wss.close(() => {
        console.log('Server shutdown complete');
        process.exit(0);
    });
});

console.log('🚀 FinTech WebSocket Server started successfully!');