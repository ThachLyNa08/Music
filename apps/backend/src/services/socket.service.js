// src/services/socket.service.js

let ioInstance;

function registerSocketEvents(io) {
  ioInstance = io;
  io.on('connection', (socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`);

    // Client tự đăng ký vào room theo user_id (sau khi đăng nhập)
    socket.on('join', ({ userId }) => {
      if (userId) {
        socket.join(`user:${userId}`);
        console.log(`   → User ${userId} joined room user:${userId}`);
      }
    });

    socket.on('disconnect', () => {
      console.log(`🔌 Socket disconnected: ${socket.id}`);
    });
  });
}

// Gửi thông báo tới một user cụ thể
function notifyUser(io, userId, event, data) {
  io.to(`user:${userId}`).emit(event, data);
}

function getIo() {
  return ioInstance;
}

module.exports = { registerSocketEvents, notifyUser, getIo };
