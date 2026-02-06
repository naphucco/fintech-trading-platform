/**
 * FILE: market-data.js
 * 
 * MỤC ĐÍCH: Quản lý dữ liệu thị trường
 * - Mock data cho testing
 * - Có thể mở rộng để kết nối với real market data feeds
 */

// ==================== DỮ LIỆU THỊ TRƯỜNG MẪU ====================
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

/**
 * Cập nhật giá thị trường với random changes
 * THỰC TẾ: Prices từ market data feeds
 */
function updateMarketData() {
    Object.keys(marketData).forEach(symbol => {
        const change = (Math.random() - 0.5) * 0.1;
        marketData[symbol].price *= (1 + change);
        marketData[symbol].change = change * 100;
    });
}

/**
 * Lấy market data cho một symbol cụ thể
 * @param {string} symbol - Trading symbol
 * @returns {object|null} Market data hoặc null nếu không tồn tại
 */
function getMarketData(symbol) {
    return marketData[symbol] || null;
}

/**
 * Lấy tất cả market data
 * @returns {object} Tất cả market data
 */
function getAllMarketData() {
    return marketData;
}

module.exports = {
    marketData,
    updateMarketData,
    getMarketData,
    getAllMarketData
};