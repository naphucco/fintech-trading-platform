/**
 * COMPONENT: OrderForm
 * CHỨC NĂNG: Form đặt lệnh trading
 * - Cho phép nhập thông tin lệnh (symbol, side, quantity, price)
 * - Validate input trước khi gửi
 * - Hiển thị giá thị trường hiện tại
 */

import React from 'react';
import './styles/OrderForm.css';

/**
 * Component OrderForm
 */
const OrderForm = ({
  orderForm,
  setOrderForm,
  marketData,
  placeOrder,
  wsStatus
}) => {
  const handleSubmit = (e) => {
    e.preventDefault();
    placeOrder();
  };

  return (
    <div className="order-section">
      <h2>💰 Place Order</h2>

      <form className="order-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Symbol:</label>
          <select
            value={orderForm.symbol}
            onChange={(e) => setOrderForm({ ...orderForm, symbol: e.target.value })}
          >
            <option value="BTC/USD">BTC/USD</option>
            <option value="ETH/USD">ETH/USD</option>
            <option value="AAPL">AAPL</option>
          </select>
        </div>

        <div className="form-group">
          <label>Side:</label>
          <div className="side-selector">
            <button
              type="button"
              className={orderForm.side === 'BUY' ? 'active buy' : ''}
              onClick={() => setOrderForm({ ...orderForm, side: 'BUY' })}
            >
              BUY
            </button>
            <button
              type="button"
              className={orderForm.side === 'SELL' ? 'active sell' : ''}
              onClick={() => setOrderForm({ ...orderForm, side: 'SELL' })}
            >
              SELL
            </button>
          </div>
        </div>

        <div className="form-group">
          <label>Quantity:</label>
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={orderForm.quantity}
            onChange={(e) => setOrderForm({ ...orderForm, quantity: e.target.value })}
            required
          />
        </div>

        <div className="form-group">
          <label>Price (optional):</label>
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="Market Price"
            value={orderForm.price}
            onChange={(e) => setOrderForm({ ...orderForm, price: e.target.value })}
          />
        </div>

        <button
          type="submit"
          className="place-order-btn"
          disabled={wsStatus !== 'CONNECTED'}
        >
          {orderForm.side} {orderForm.symbol}
        </button>

        <div className="market-price-hint">
          Current Price: ${marketData[orderForm.symbol]?.price?.toFixed(2) || 'N/A'}
        </div>
      </form>
    </div>
  );
};

export default OrderForm;