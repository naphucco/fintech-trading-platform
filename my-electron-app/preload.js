// preload.js - Cầu nối giữa Electron và React
const { contextBridge, ipcRenderer } = require('electron');

// Expose APIs để React có thể gọi
contextBridge.exposeInMainWorld('electronAPI', {
  // Lấy thông tin hệ thống
  getSystemInfo: () => ipcRenderer.invoke('get-system-info'),
  
  // Đóng ứng dụng
  quitApp: () => ipcRenderer.send('quit-app'),
  
  // Thu nhỏ cửa sổ
  minimizeWindow: () => ipcRenderer.send('minimize-window'),
  
  // Phóng to/thu nhỏ cửa sổ
  maximizeWindow: () => ipcRenderer.send('maximize-window'),
  
  // Gửi notification
  showNotification: (title, body) => ipcRenderer.send('show-notification', title, body)
});