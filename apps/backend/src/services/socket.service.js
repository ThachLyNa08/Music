const jwt = require('jsonwebtoken');

let ioInstance;

function joinUserRoom(socket, userId) {
  if (!userId) return;
  socket.join(`user:${userId}`);
  socket.data.userId = userId;
  console.log(`Socket ${socket.id} joined user:${userId}`);
}

function registerSocketEvents(io) {
  ioInstance = io;

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    const token = socket.handshake.auth?.token;
    if (token) {
      try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        joinUserRoom(socket, payload.id);
      } catch (err) {
        console.warn(`Socket auth failed: ${err.message}`);
      }
    }

    socket.on('join', ({ userId }) => {
      joinUserRoom(socket, userId);
    });

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });
}

function notifyUser(io, userId, event, data) {
  io.to(`user:${userId}`).emit(event, data);
}

function getIo() {
  return ioInstance;
}

module.exports = { registerSocketEvents, notifyUser, getIo };
