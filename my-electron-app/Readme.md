npm install electron --save-dev => cài 
npx create-react-app src  => Tích hợp React vào Electron
npm install concurrently wait-on --save-dev => cài để chạy song song 2 app


"dev" - Chạy 1 lệnh duy nhất để khởi động cả React và Electron
"react-dev" - Chỉ chạy React dev server
"electron-dev" - Chỉ chạy Electron app

# Cách 1: Chạy cả 2 cùng lúc (khuyến nghị)
npm run dev

# Cách 2: Chạy riêng lẻ
# Terminal 1:
npm run react-dev

# Terminal 2 (mở terminal mới):
npm start  # hoặc npm run electron-dev