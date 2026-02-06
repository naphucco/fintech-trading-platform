/**
 * FILE: helpers.js
 * 
 * MỤC ĐÍCH: Các helper functions dùng chung
 * - Async delay simulation
 * - Các utility functions khác
 */

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

module.exports = {
    simulateAsyncDelay
};