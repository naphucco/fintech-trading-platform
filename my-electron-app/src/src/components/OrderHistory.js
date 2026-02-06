/**
 * COMPONENT: OrderHistory
 * CHỨC NĂNG: Hiển thị lịch sử và trạng thái các orders
 * - Hiển thị chi tiết từng order (id, symbol, side, quantity, giá khớp, thông báo, lỗi, thời gian)
 * - Màu sắc và icon thay đổi theo trạng thái order
 * - Hiển thị thông báo lỗi/ thành công nếu có
 */

import React from 'react';
import './styles/OrderHistory.css';

/**
 * Component OrderHistory
 * @param {Array} orders - Danh sách các orders được truyền từ props
 */
const OrderHistory = ({ orders }) => {
  /**
   * Hàm xác định màu sắc theo status của order
   * @param {string} status - trạng thái của order
   * @returns {string} mã màu HEX tương ứng
   */
  const getStatusColor = (status) => {
    switch (status) {
      case 'FILLED': return '#2ecc71'; // xanh lá: đã khớp lệnh
      case 'PROCESSING': return '#3498db'; // xanh dương: đang xử lý
      case 'VALIDATING': return '#9b59b6'; // tím: đang kiểm tra hợp lệ
      case 'RISK_CHECKING': return '#e67e22'; // cam: kiểm tra rủi ro
      case 'SUBMITTED_TO_MATCHING_ENGINE': return '#1abc9c'; // xanh ngọc: gửi tới hệ thống khớp lệnh
      case 'REJECTED': return '#e74c3c'; // đỏ: bị từ chối
      case 'ERROR': return '#c0392b'; // đỏ đậm: lỗi hệ thống
      default: return '#95a5a6'; // xám: trạng thái không xác định
    }
  };

  /**
   * Hàm xác định icon hiển thị theo status của order
   * @param {string} status - trạng thái của order
   * @returns {string} emoji tương ứng
   */
  const getStatusIcon = (status) => {
    switch (status) {
      case 'FILLED': return '✅'; // check xanh
      case 'PROCESSING': return '⏳'; // đồng hồ cát
      case 'VALIDATING': return '🔍'; // kính lúp
      case 'RISK_CHECKING': return '⚖️'; // cân công lý
      case 'SUBMITTED_TO_MATCHING_ENGINE': return '⚡'; // tia sét
      case 'REJECTED': return '❌'; // dấu X đỏ
      case 'ERROR': return '🚨'; // chuông báo động
      default: return '📝'; // ghi chú mặc định
    }
  };

  return (
    <div className="orders-history">
      {/* Tiêu đề hiển thị tổng số orders */}
      <h3>📋 Order History ({orders.length})</h3>

      {/* Nếu chưa có order nào thì hiển thị thông báo */}
      {orders.length === 0 ? (
        <p className="no-orders">No orders placed yet. Place your first order above!</p>
      ) : (
        <div className="orders-list">
          {/* Duyệt qua danh sách orders (đảo ngược để order mới nhất lên đầu) */}
          {orders.slice().reverse().map(order => (
            <div
              key={order.id}
              className="order-item"
              style={{ borderLeft: `4px solid ${getStatusColor(order.status)}` }}
            >
              {/* ORDER HEADER: hiển thị ID và trạng thái */}
              <div className="order-header">
                {/* Hiển thị rút gọn ID (10 ký tự đầu) */}
                <span className="order-id" title={order.id}>
                  {order.id.slice(0, 10)}...
                </span>
                {/* Hiển thị trạng thái với màu và icon */}
                <span
                  className="order-status"
                  style={{ color: getStatusColor(order.status) }}
                >
                  {getStatusIcon(order.status)} {order.status}
                </span>
              </div>

              {/* ORDER DETAILS: chi tiết order */}
              <div className="order-details">
                {/* Symbol (mã chứng khoán) */}
                <div className="detail-row">
                  <span className="detail-label">Symbol:</span>
                  <span className="detail-value">{order.symbol}</span>
                </div>

                {/* Side (BUY/SELL) với class để đổi màu */}
                <div className="detail-row">
                  <span className="detail-label">Side:</span>
                  <span className={`detail-value ${order.side.toLowerCase()}`}>
                    {order.side}
                  </span>
                </div>

                {/* Quantity (số lượng) */}
                <div className="detail-row">
                  <span className="detail-label">Quantity:</span>
                  <span className="detail-value">{order.quantity}</span>
                </div>

                {/* Filled Price (giá khớp) nếu có */}
                {order.filledPrice && (
                  <div className="detail-row">
                    <span className="detail-label">Filled Price:</span>
                    <span className="detail-value">
                      ${order.filledPrice.toFixed(2)}
                    </span>
                  </div>
                )}

                {/* Status Message (thông báo trạng thái) nếu có */}
                {order.statusMessage && (
                  <div className="detail-row">
                    <span className="detail-label">Status:</span>
                    <span className="detail-value">{order.statusMessage}</span>
                  </div>
                )}

                {/* Error Message (thông báo lỗi) nếu có */}
                {order.errorMessage && (
                  <div className="detail-row error">
                    <span className="detail-label">Error:</span>
                    <span className="detail-value">{order.errorMessage}</span>
                  </div>
                )}

                {/* Thời gian tạo order */}
                <div className="detail-row time">
                  <span className="detail-label">Time:</span>
                  <span className="detail-value">
                    {new Date(order.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default OrderHistory;
