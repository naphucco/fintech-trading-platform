/**
 * FILE: validators.js
 * 
 * MỤC ĐÍCH: Các functions validation
 * - Validate order format
 * - Error message mapping
 */

/**
 * Validate order format cơ bản
 * TRONG THỰC TẾ: Phức tạp hơn nhiều (regulatory checks, etc.)
 * @param {object} order - Order object
 * @returns {boolean} True nếu valid
 */
function validateOrderFormat(order) {
    if (!order || !order.symbol) return false;
    if (order.quantity && order.quantity <= 0) return false;
    return true;
}

/**
 * Map error codes to user-friendly messages
 * @param {string} errorCode - Error code
 * @returns {string} User-friendly error message
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

module.exports = {
    validateOrderFormat,
    getErrorMessage
};