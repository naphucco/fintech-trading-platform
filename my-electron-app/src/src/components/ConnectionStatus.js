/**
 * COMPONENT: ConnectionStatus
 * CHỨC NĂNG: Hiển thị trạng thái kết nối WebSocket
 * - Hiển thị trạng thái (connected, disconnected, error)
 * - Nút điều khiển kết nối
 * - Hiển thị client ID
 */

import React from 'react';
import './styles/ConnectionStatus.css';

/**
 * Component ConnectionStatus
 */
const ConnectionStatus = ({
  wsStatus,
  clientId,
  connectWebSocket,
  disconnectWebSocket,
  sendPing
}) => {
  return (
    <div className="connection-status">
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <div className={`status-indicator ${wsStatus.toLowerCase()}`}></div>
        <span>Status: {wsStatus}</span>
        {clientId && <span> | Client ID: {clientId}</span>}
      </div>

      <div className="connection-controls">
        {wsStatus !== 'CONNECTED' && (
          <button onClick={connectWebSocket}>Connect</button>
        )}
        {wsStatus === 'CONNECTED' && (
          <button onClick={disconnectWebSocket}>Disconnect</button>
        )}
        <button onClick={sendPing} disabled={wsStatus !== 'CONNECTED'}>
          Ping Server
        </button>
      </div>
    </div>
  );
};

export default ConnectionStatus;