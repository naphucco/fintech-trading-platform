# Tạo thư mục project
mkdir fintech-websocket-server
cd fintech-websocket-server

# Khởi tạo npm project
npm init -y

# Cài đặt ws library
npm install ws

# Cài thêm các package hỗ trợ
npm install uuid dotenv winston  # uuid cho ID, dotenv cho biến môi trường, winston cho logging

chạy
node test-client.js
node server-simple.js