/**
 * FILE: connection-handler.js
 * 
 * MỤC ĐÍCH: Xử lý sự kiện kết nối WebSocket
 * - Thiết lập connection với client mới
 * - Gửi welcome message
 * - Thiết lập các event handlers cho connection
 */

// ==================== IMPORT MODULES ====================
const { v4: uuidv4 } = require('uuid');
const { addClient, removeClient, updateClientSubscriptions } = require('../clients/client-manager');
const { handleMessage } = require('./message-handler');

/**
 * Thiết lập connection handler cho WebSocket Server
 * @param {WebSocket.Server} wss - WebSocket Server instance
 */
function setupConnectionHandler(wss) {
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

        // ==================== LƯU THÔNG TIN CLIENT ====================
        // TẠI SAO cần lưu client vào Map?
        // - Để biết có bao nhiêu clients đang connected
        // - Để gửi broadcast messages đến tất cả clients
        // - Để cleanup khi client disconnect
        addClient(clientId, {
            ws: ws,           // WebSocket instance để gửi message
            id: clientId,     // ID để nhận diện
            ip: clientIp,     // IP để security/analytics
            connectedAt: Date.now(),  // Thời gian để tính uptime/session length
            subscriptions: new Set() // Lưu symbols client đang subscribe
        });

        // ==================== GỬI WELCOME MESSAGE ====================
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

        // ==================== XỬ LÝ MESSAGE TỪ CLIENT ====================
        // Event 'message' được trigger khi client gửi data qua WebSocket
        ws.on('message', (message) => {
            handleMessage(ws, clientId, message);
        });

        // ==================== XỬ LÝ DISCONNECT ====================
        ws.on('close', () => {
            // TẠI SAO cần xử lý disconnect?
            // - Cleanup resources (memory, connections)
            // - Update user status (offline/online)
            // - Cancel pending orders của client
            console.log(`❌ Client disconnected: ${clientId}`);
            removeClient(clientId);
        });

        // ==================== XỬ LÝ LỖI WEBSOCKET ====================
        ws.on('error', (error) => {
            // WebSocket errors (network issues, protocol errors)
            console.error(`WebSocket error for ${clientId}:`, error.message);
        });
    });
}

module.exports = {
    setupConnectionHandler
};