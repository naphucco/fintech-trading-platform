/**
 * FILE: server-config.js
 * 
 * MỤC ĐÍCH: Quản lý cấu hình WebSocket Server
 * - Tạo WebSocket Server instance
 * - Thiết lập cấu hình performance
 */

// ==================== IMPORT MODULES ====================
const WebSocket = require('ws');

/**
 * Khởi tạo và cấu hình WebSocket Server
 * @returns {WebSocket.Server} WebSocket Server instance
 */
function initializeServer() {
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

    console.log('🚀 WebSocket Server started on ws://localhost:8080');
    return wss;
}

module.exports = {
    initializeServer
};