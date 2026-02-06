/**
 * FILE: broadcast-service.js
 * 
 * MỤC ĐÍCH: Broadcast market data updates đến clients
 * - Mô phỏng real-time market data feeds
 * - Gửi updates đến subscribed clients
 */

// ==================== IMPORT MODULES ====================
const { getAllClients } = require('../clients/client-manager');
const { marketData, updateMarketData } = require('../data/market-data');
const WebSocket = require('ws');

/**
 * Khởi động service broadcast market data
 */
function startMarketDataBroadcast() {
    // Mô phỏng real-time market data updates
    // TẠI SAO dùng setInterval?
    // - Đơn giản cho demo/testing
    // - Thực tế: Data từ external feeds (push-based)
    setInterval(() => {
        // Update prices randomly (-5% to +5%)
        updateMarketData();

        // Lấy tất cả clients
        const clients = getAllClients();
        let totalMessagesSent = 0;

        // Gửi updates đến từng client
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
}

module.exports = {
    startMarketDataBroadcast
};