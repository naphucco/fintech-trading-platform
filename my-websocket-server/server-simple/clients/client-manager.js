/**
 * FILE: client-manager.js
 * 
 * MỤC ĐÍCH: Quản lý danh sách clients đang kết nối
 * - Lưu trữ client information
 * - Cung cấp methods để thêm/xóa/truy vấn clients
 */

// ==================== BIẾN TOÀN CỤC LƯU TRỮ ====================
// Map: Cấu trúc key-value của JavaScript (giống Dictionary/HashMap)
// TẠI SAO dùng Map thay vì Object?
// - Map giữ thứ tự insertion (quan trọng cho iteration)
// - Keys có thể là bất kỳ type nào (Object chỉ string/symbol)
// - Performance tốt hơn cho add/remove operations
// - Có .size property built-in
const clients = new Map();  // Format: Map<clientId, clientObject>

// ==================== PUBLIC METHODS ====================

/**
 * Thêm client mới vào Map
 * @param {string} clientId - Unique client ID
 * @param {object} clientInfo - Client information object
 */
function addClient(clientId, clientInfo) {
    clients.set(clientId, clientInfo);
}

/**
 * Lấy client từ Map
 * @param {string} clientId - Client ID cần lấy
 * @returns {object|null} Client object hoặc null nếu không tồn tại
 */
function getClient(clientId) {
    return clients.get(clientId) || null;
}

/**
 * Xóa client khỏi Map
 * @param {string} clientId - Client ID cần xóa
 */
function removeClient(clientId) {
    clients.delete(clientId);
}

/**
 * Get all clients (for broadcasting)
 * @returns {Map} All connected clients
 */
function getAllClients() {
    return clients;
}

/**
 * Đóng tất cả kết nối clients
 * @param {number} code - WebSocket close code
 * @param {string} reason - Lý do đóng kết nối
 */
function closeAllConnections(code, reason) {
    clients.forEach((client) => {
        if (client.ws && client.ws.readyState === WebSocket.OPEN) {
            client.ws.close(code, reason);
        }
    });
}

/**
 * Cập nhật subscriptions cho client
 * @param {string} clientId - Client ID
 * @param {Set} subscriptions - Set of symbols
 */
function updateClientSubscriptions(clientId, subscriptions) {
    const client = getClient(clientId);
    if (client) {
        client.subscriptions = subscriptions;
        clients.set(clientId, client);
    }
}

module.exports = {
    addClient,
    getClient,
    removeClient,
    getAllClients,
    closeAllConnections,
    updateClientSubscriptions
};