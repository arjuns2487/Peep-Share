const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

app.use(express.static('public'));

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    socket.on('create-room', () => {
        const roomId = uuidv4().substring(0, 8);
        socket.join(roomId);
        socket.emit('room-created', roomId);
    });

    socket.on('join-room', (roomId) => {
        const room = io.sockets.adapter.rooms.get(roomId);
        const currentUsers = room ? room.size : 0;

        if (currentUsers === 0) {
            socket.emit('error-msg', 'This room expired or does not exist.');
        } else if (currentUsers === 1) {
            socket.join(roomId);
            socket.to(roomId).emit('peer-joined', roomId);
        } else {
            socket.emit('error-msg', 'This room is already occupied.');
        }
    });

    socket.on('signal', (data) => {
        socket.to(data.roomId).emit('signal', data.signalData);
    });

    socket.on('disconnecting', () => {
        for (const room of socket.rooms) {
            if (room !== socket.id) {
                socket.to(room).emit('peer-left');
            }
        }
        console.log(`User disconnected: ${socket.id}`);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Server executing on http://localhost:${PORT}`));
