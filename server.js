const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

// Serve everything inside the "public" folder automatically
app.use(express.static('public'));

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Action A: Create Room (Triggered by Sender clicking "Join")
    socket.on('create-room', () => {
        const roomId = uuidv4().substring(0, 8); // Keep ID short and clean
        socket.join(roomId);
        socket.emit('room-created', roomId);
    });

    // Action B: Join Room (Triggered by Receiver opening shared link)
    socket.on('join-room', (roomId) => {
        const room = io.sockets.adapter.rooms.get(roomId);
        const currentUsers = room ? room.size : 0;

        if (currentUsers === 0) {
            socket.emit('error-msg', 'This room expired or does not exist.');
        } else if (currentUsers === 1) {
            socket.join(roomId);
            // Notify the room creator that a peer has arrived
            socket.to(roomId).emit('peer-joined', roomId);
        } else {
            socket.emit('error-msg', 'This room is already occupied.');
        }
    });

    // Action C: Relay Signaling Traffic
    socket.on('signal', (data) => {
        // Transparently route SDP offers, answers, and ICE candidates to the opposing peer
        socket.to(data.roomId).emit('signal', data.signalData);
    });

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Server executing on http://localhost:${PORT}`));