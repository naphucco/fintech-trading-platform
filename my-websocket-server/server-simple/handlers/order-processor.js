/**
 * FILE: order-processor.js
 * 
 * MỤC ĐÍCH: Xử lý order asynchronously
 * - Mô phỏng quy trình xử lý order thực tế
 * - Xử lý validation, risk checks, matching engine
 * - Gửi status updates về client
 */

// ==================== IMPORT MODULES ====================
const { marketData } = require('../data/market-data');
const { simulateAsyncDelay } = require('../utils/helpers');
const { validateOrderFormat, getErrorMessage } = require('../utils/validators');

/**
 * Xử lý order với async/await pattern
 * @param {WebSocket} ws - WebSocket instance của client
 * @param {string} orderId - Unique order ID
 * @param {object} orderData - Order data từ client
 */
async function processOrderAsync(ws, orderId, orderData) {
    // TẠI SAO dùng async/await thay vì chỉ setTimeout?
    // - Dễ đọc, dễ maintain (linear code flow)
    // - Error handling tốt hơn với try-catch
    // - Có thể thêm các async steps phức tạp (validation, risk checks, etc.)
    // - Phản ánh đúng bản chất không đồng bộ của trading system
    try {
        // SIMULATION: Mô phỏng các bước xử lý order thực tế

        // BƯỚC 2.1: Validation (async simulation)
        // TRONG THỰC TẾ: Kiểm tra order format, symbol tồn tại, trading hours, etc.
        // ⏱️ Thời gian: 50-200ms trong thực tế
        console.log(`   ⏳ Validating order ${orderId}...`);
        await simulateAsyncDelay(100, 300); // Giả lập delay validation
        const isValid = validateOrderFormat(orderData);

        if (!isValid) {
            throw new Error('INVALID_ORDER_FORMAT');
        }

        // Cập nhật status cho client biết đang validation
        ws.send(JSON.stringify({
            type: 'ORDER_STATUS_UPDATE',
            orderId: orderId,
            status: 'VALIDATING',
            timestamp: Date.now(),
            message: 'Order validation in progress'
        }));

        // BƯỚC 2.2: Risk Checks (async simulation)
        // TRONG THỰC TẾ: Kiểm tra position limits, margin requirements, credit limits
        // ⏱️ Thời gian: 100-500ms trong thực tế
        console.log(`   ⏳ Running risk checks for order ${orderId}...`);
        await simulateAsyncDelay(200, 500);
        const riskApproved = Math.random() > 0.1; // 90% pass rate

        if (!riskApproved) {
            throw new Error('RISK_CHECK_FAILED');
        }

        // Cập nhật status cho client biết đang risk check
        ws.send(JSON.stringify({
            type: 'ORDER_STATUS_UPDATE',
            orderId: orderId,
            status: 'RISK_CHECKING',
            timestamp: Date.now(),
            message: 'Risk assessment in progress'
        }));

        // BƯỚC 2.3: Market Data Check (real-time)
        // TRONG THỰC TẾ: Kiểm tra current price, spreads, market conditions
        // ⏱️ Thời gian: <10ms (real-time check)
        const currentPrice = marketData[orderData?.symbol]?.price;
        if (!currentPrice) {
            throw new Error('SYMBOL_NOT_FOUND');
        }

        // BƯỚC 2.4: Matching Engine Simulation (async - VARIABLE TIME)
        // TRONG THỰC TẾ: Gửi đến Matching Engine
        console.log(`   ⏳ Sending order ${orderId} to matching engine...`);

        // Gửi status update
        ws.send(JSON.stringify({
            type: 'ORDER_STATUS_UPDATE',
            orderId: orderId,
            status: 'SUBMITTED_TO_MATCHING_ENGINE',
            timestamp: Date.now(),
            message: 'Order submitted for matching'
        }));

        // Giả lập matching engine delay (1-3 giây như code gốc)
        const matchingDelay = Math.random() * 2000 + 1000; // 1-3 giây
        await simulateAsyncDelay(matchingDelay - 200, matchingDelay + 200);

        // BƯỚC 2.5: Execution Result
        // Mô phỏng 70% thành công (filled)
        const isFilled = Math.random() > 0.3;

        if (isFilled) {
            // Order executed successfully
            const filledPrice = currentPrice * (1 + (Math.random() - 0.5) * 0.02); // ±1%
            const filledQuantity = orderData.quantity || 1;

            console.log(`   ✅ Order ${orderId} FILLED at $${filledPrice.toFixed(2)}`);

            ws.send(JSON.stringify({
                type: 'ORDER_FILLED',
                orderId: orderId,
                status: 'FILLED',
                filledPrice: filledPrice,
                filledQuantity: filledQuantity,
                executionTime: Date.now(),
                averagePrice: filledPrice,
                totalFilled: filledQuantity,
                remainingQuantity: 0,
                timestamp: Date.now()
            }));
        } else {
            // Order rejected (no liquidity)
            console.log(`   ❌ Order ${orderId} REJECTED - insufficient liquidity`);

            ws.send(JSON.stringify({
                type: 'ORDER_REJECTED',
                orderId: orderId,
                status: 'REJECTED',
                reason: 'INSUFFICIENT_LIQUIDITY',
                rejectionTime: Date.now(),
                suggestedAction: 'TRY_LIMIT_ORDER_OR_ADJUST_PRICE',
                timestamp: Date.now()
            }));
        }

        // BƯỚC 2.6: Post-trade processing (async - background)
        // ⚡ KHÔNG block client - xử lý background
        setTimeout(async () => {
            console.log(`   📊 Post-trade processing for ${orderId}...`);
            // Có thể gửi confirmation email, update database, etc.
        }, 100);

    } catch (error) {
        // ERROR HANDLING: Xử lý lỗi trong quá trình order processing
        console.error(`   🚨 Order ${orderId} processing failed:`, error.message);

        ws.send(JSON.stringify({
            type: 'ORDER_ERROR',
            orderId: orderId,
            status: 'ERROR',
            errorCode: error.message,
            errorMessage: getErrorMessage(error.message),
            timestamp: Date.now(),
            // Thông tin debug (chỉ development)
            ...(process.env.NODE_ENV === 'development' && { debug: error.stack })
        }));
    }
}

module.exports = {
    processOrderAsync
};