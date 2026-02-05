/**
 * FILE: main.js
 * CHỨC NĂNG: Main process của Electron
 * - Quản lý vòng đời ứng dụng
 * - Tạo và quản lý cửa sổ
 * - Xử lý IPC (giao tiếp với React)
 */

// Import các module cần thiết từ Electron
const { app, BrowserWindow, ipcMain, Notification } = require('electron');
// app: Quản lý ứng dụng (lifecycle events)
// BrowserWindow: Tạo cửa sổ desktop
// ipcMain: Xử lý giao tiếp IPC từ renderer process (React)
// Notification: Hiển thị thông báo hệ thống

const path = require('path');
// Module path của Node.js để xử lý đường dẫn file

// Biến toàn cục lưu reference đến cửa sổ chính
// Giữ reference để không bị garbage collected
let mainWindow;

/**
 * Hàm tạo cửa sổ chính
 */
function createWindow() {
  // Tạo một BrowserWindow instance (cửa sổ desktop)
  mainWindow = new BrowserWindow({
    width: 1000,      // Chiều rộng cửa sổ (pixels)
    height: 700,      // Chiều cao cửa sổ (pixels)
    
    // Cấu hình webPreferences cho nội dung web bên trong
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'), // Load script preload trước
      nodeIntegration: false,  // KHÔNG cho phép Node.js trong renderer (bảo mật)
      contextIsolation: true   // Bật context isolation (bảo mật)
      // contextIsolation: true giúp ngăn XSS attacks
    }
  });

  // TRONG DEVELOPMENT: Load React app từ dev server
  // React dev server chạy trên http://localhost:3000
  mainWindow.loadURL('http://localhost:3000');
  
  // Mở DevTools tự động (chỉ trong development)
  // DevTools giúp debug HTML/CSS/JS trong cửa sổ Electron
  mainWindow.webContents.openDevTools();
  
  // Optional: Xử lý khi cửa sổ đóng
  mainWindow.on('closed', () => {
    mainWindow = null; // Xóa reference
  });
}

/**
 * SỰ KIỆN: Khi Electron đã khởi tạo xong
 * app.whenReady() trả về Promise, khi resolved thì chạy hàm
 */
app.whenReady().then(() => {
  // Tạo cửa sổ chính
  createWindow();
  
  /**
   * IPC HANDLERS - Xử lý các message từ React
   * ipcMain.handle(): Xử lý async request từ React
   * ipcMain.on(): Lắng nghe event từ React
   */
  
  // Handler cho 'get-system-info': Trả về thông tin hệ thống
  ipcMain.handle('get-system-info', () => {
    // Trả về object chứa thông tin hệ thống
    return {
      platform: process.platform,          // 'win32', 'darwin', 'linux'
      nodeVersion: process.version,        // Phiên bản Node.js
      electronVersion: process.versions.electron // Phiên bản Electron
    };
  });

  // Handler cho 'quit-app': Thoát ứng dụng
  ipcMain.on('quit-app', () => {
    app.quit(); // Gọi app.quit() để thoát ứng dụng
  });

  // Handler cho 'minimize-window': Thu nhỏ cửa sổ
  ipcMain.on('minimize-window', () => {
    if (mainWindow) mainWindow.minimize(); // Gọi minimize() trên cửa sổ
  });

  // Handler cho 'maximize-window': Phóng to/thu nhỏ cửa sổ
  ipcMain.on('maximize-window', () => {
    if (mainWindow) {
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize(); // Nếu đang phóng to thì thu nhỏ
      } else {
        mainWindow.maximize();   // Nếu chưa phóng to thì phóng to
      }
    }
  });

  // Handler cho 'show-notification': Hiển thị thông báo
  ipcMain.on('show-notification', (event, title, body) => {
    // Tạo và hiển thị notification hệ thống
    new Notification({ 
      title: title, // Tiêu đề thông báo
      body: body    // Nội dung thông báo
    }).show();      // Hiển thị thông báo
  });
});

/**
 * SỰ KIỆN: Khi tất cả cửa sổ đều đóng
 */
app.on('window-all-closed', () => {
  // Trên macOS, ứng dụng thường không thoát khi đóng cửa sổ
  // process.platform = 'darwin' (macOS), 'win32' (Windows), 'linux' (Linux)
  if (process.platform !== 'darwin') {
    app.quit(); // Nếu không phải macOS, thoát ứng dụng
  }
});

/**
 * SỰ KIỆN: Khi click vào dock icon trên macOS
 */
app.on('activate', () => {
  // Trên macOS, khi click vào dock icon mà không có cửa sổ nào
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow(); // Tạo cửa sổ mới
  }
});