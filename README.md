# PeepShare

> **Instantly share unlimited files and chat directly with anyone, browser-to-browser.**

A peer-to-peer (P2P) file sharing and messaging application built with WebRTC and Socket.IO. Transfer files and exchange messages securely without any server intermediary storing your data.

---

## Screenshots

<img width="1070" height="692" alt="image" src="https://github.com/user-attachments/assets/a888c206-9306-4a8d-94d9-bee24c5a89c5" />

---

## Features

- ** Privacy-First P2P**: Files and messages are transferred directly between peers using WebRTC Data Channels. Your server never stores or sees your data.
- ** High-Speed Transfers**: Optimized chunking (16KB chunks) with backpressure management for smooth, fast file transfers.
- ** Real-Time Chat**: Send instant messages with your peer using the same secure P2P connection.
- ** Transfer Progress**: Live progress bar with upload/download speed and ETA calculations.
- ** Drag & Drop**: Intuitive file selection with drag-and-drop support.
- ** Browser-Based**: No installation required—works in any modern browser.
- ** Shareable Links**: Generate unique room URLs to invite peers.
- ** Confirmation Modal**: Receiver can accept or decline incoming file transfers.

---

## How It Works

### Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    PeepShare System                     │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Sender (Browser)     Server (Node.js)      Receiver    │
│       │                  (Signaling)        (Browser)   |
│       │◄──────── Socket.IO ──────────────────────┤      |
│       │                                          │      |
│       │         Signaling Exchange               │      |
│       ├────── WebRTC Offer/Answer ───────────────┤      |
│       │                                          │      |
│       ├═════ Direct P2P Data Channel ════════════┤      |
│       │  (Files & Messages - No Server Copy)     │      |
│       └──────────────────────────────────────────┘      |
│_________________________________________________________|
```

### Step-by-Step Flow

1. **Room Creation**: Sender clicks "Create Room" → generates unique room ID
2. **Room Sharing**: Copy and share the generated URL with the receiver
3. **Connection Establishment**: WebRTC peer discovery and direct connection setup
4. **File Transfer**: Sender selects files, receiver accepts, streaming begins
5. **Direct Communication**: All data flows through encrypted P2P channel

## Tech Stack

| Layer             | Technology                          | Purpose                              |
|-------------------|-------------------------------------|--------------------------------------|
| Frontend          | HTML5, JavaScript (Vanilla)         | Client UI & WebRTC handling          |
| Styling           | Tailwind CSS                        | Modern responsive design             |
| Signaling         | Socket.IO                           | Room management & WebRTC signal relay|
| P2P Protocol      | WebRTC Data Channels                | File & message transfer              |
| Backend           | Node.js + Express                   | HTTP server & signaling broker       |
| NAT Traversal     | STUN (Google's stun.l.google.com)   | ICE candidate gathering              |

---

## Installation & Setup

### Prerequisites

- **Node.js** (v14 or higher)
- **npm** (comes with Node.js)

### Local Development

1. **Clone the repository**

   ```bash
   git clone https://github.com/arjuns2487/Peep-Share.git
   cd Peep-Share
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Start the server**

   ```bash
   npm start
   ```

   The server will run on `http://localhost:3000` by default.

4. **Open in browser**

   Visit `http://localhost:3000` in two separate browser windows/tabs to test:
   - One as sender (create room)
   - One as receiver (use shared link)

---

## Usage Guide

### For Sender

1. Click **"Create Room"** on the landing page
2. A unique URL is generated automatically
3. Click **"Copy Link"** to copy the shareable URL
4. Share the link via email, chat, or messaging app
5. **Select files** by:
   - Dragging and dropping into the drop zone
   - Clicking to browse and select multiple files
6. Click **"Send Files"** to initiate transfer
7. Wait for receiver to accept the file
8. Transfer progress displays with percentage and ETA

### For Receiver

1. Receive the unique shareable link from the sender
2. Click the link or paste it in your browser
3. Your browser automatically connects to the sender's room
4. When the sender offers a file, a **confirmation modal** appears
5. **Accept** to download or **Decline** to reject
6. Download starts automatically upon acceptance
7. Monitor the **live progress bar** for transfer status

### Messaging

- Once the P2P connection is established, use the **Direct Chat** panel to send instant messages
- Messages are encrypted and transferred directly between peers
- The chat remains active throughout the session

---

## Project Structure

```
Peep-Share/
├── package.json           # Dependencies (Express, Socket.IO, UUID)
├── package-lock.json      # Dependency lock file
├── server.js              # Express + Socket.IO server (Signaling Broker)
└── public/
    ├── index.html         # Main UI template
    └── app.js             # WebRTC + File Transfer Logic (Frontend)
```

### File Breakdown

| File              | Lines | Purpose                                                              |
|-------------------|-------|----------------------------------------------------------------------|
| server.js         | ~50   | Node.js signaling server for room management and WebRTC signal relay |
| public/app.js     | ~360  | Core frontend logic: WebRTC, file streaming, chat, progress tracking |
| public/index.html | ~90   | Responsive UI with Tailwind CSS                                      |

---

## Configuration

### Server Port

The default port is `3000`. To use a different port:

```bash
PORT=5000 npm start
```

Or set the `PORT` environment variable before running.

### WebRTC STUN Server

The application uses Google's public STUN server: `stun.l.google.com:19302`

To use a different STUN server, modify `rtcConfiguration` in `public/app.js`:

```javascript
const rtcConfiguration = { 
    iceServers: [{ urls: 'stun:your-stun-server.com:19302' }] 
};
```

---

## How File Streaming Works

### Sender Side

1. File is read in **16KB chunks** (safe WebRTC standard)
2. Each chunk is sent as raw binary data via the data channel
3. **Backpressure handling**: If buffer exceeds 1MB, pause for 10ms before reading next chunk
4. Once all chunks sent, `file-eof` signal is dispatched
5. UI updates with real-time progress percentage and ETA

### Receiver Side

1. Incoming binary chunks are collected in an array
2. Progress is tracked and displayed in real-time
3. Once `file-eof` is received, chunks are combined into a single Blob
4. Browser's native download is triggered with the original filename
5. Automatic download saves the file to Downloads folder

### Data Integrity

- WebRTC handles packet loss and retransmission automatically
- No checksum verification needed (WebRTC's transport layer handles it)
- Files arrive exactly as sent

---

## Chat Implementation

- Uses the same **WebRTC Data Channel** as file transfers
- Messages are JSON-formatted and identified by type (`'text'`)
- Chat history persists in-memory during the session
- Disabled until P2P connection is established
- System events notify users of connection status, file transfers, and errors

---

## Performance Metrics

| Metric                 | Value    | Notes                                 |
|------------------------|----------|---------------------------------------|
| Chunk Size             | 16 KB    | Optimal for WebRTC stability          |
| Backpressure Threshold | 1 MB     | Prevents buffer overflow              |
| Typical Speed          | 1–10 Mbps| Depends on network conditions         |
| Latency                | < 100 ms | LAN; higher over WAN                  |

---

## Security & Privacy

### Data Privacy

✅ **No Server Storage**: Files never touch the server disk  
✅ **No Data Logging**: Messages and files are not logged  
✅ **Encrypted Transport**: WebRTC uses DTLS-SRTP (built-in encryption)  
✅ **Peer-to-Peer**: Direct connection between browsers  

### Room Security

⚠️ **Room IDs are non-guessable**: 8-character UUIDs  
⚠️ **No authentication**: Room access is URL-only (share carefully)  
⚠️ **HTTPS recommended**: Deploy over HTTPS in production to prevent man-in-the-middle attacks  

---

## Deployment

### Render.com (Live Demo)

The project is deployed at: [https://peep-share.onrender.com/](https://peep-share.onrender.com/)

### Deploy Your Own

**Option 1: Render.com (Recommended)**

1. Push code to GitHub
2. Create account on [render.com](https://render.com)
3. Create new **Web Service**
4. Connect your repository
5. Set build command: `npm install`
6. Set start command: `npm start`
7. Deploy

**Option 2: Heroku**

```bash
heroku login
heroku create your-app-name
git push heroku main
heroku open
```

**Option 3: Docker**

Create a `Dockerfile`:

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

Build and run:

```bash
docker build -t peep-share .
docker run -p 3000:3000 peep-share
```

---

## Troubleshooting

| Issue                                          | Solution                                                                                 |
|------------------------------------------------|------------------------------------------------------------------------------------------|
| "This room expired or does not exist"          | Sender must create room first; receiver must use the exact shared link                  |
| "This room is already occupied"                | Only 2 peers per room; a third person cannot join                                       |
| Files not transferring                         | Ensure firewall isn't blocking WebRTC; check browser console for errors                 |
| Chat not working                               | P2P connection hasn't established yet; wait for "Direct P2P Data Pipe Secured" message |
| Slow transfer speeds                           | Check network conditions; may be affected by ISP throttling or NAT traversal            |
| "Failed to fetch"                              | Server is not running; start with `npm start`                                           |

---

<img width="1600" height="900" alt="image" src="https://github.com/user-attachments/assets/0a2ddde8-3d9c-4502-bc7e-9f321244139e" />

<img width="1600" height="900" alt="image" src="https://github.com/user-attachments/assets/88b2db85-eac7-43e6-a971-707a1cb9023f" />


<img width="1600" height="900" alt="image" src="https://github.com/user-attachments/assets/325d406e-3b88-426d-bb08-d22314f84929" />


---

### Signaling Protocol

The server relays WebRTC signaling messages (offers, answers, ICE candidates) without modification:

```javascript
socket.on('signal', (data) => {
    socket.to(data.roomId).emit('signal', data.signalData);
});
```

### Data Channel Events

- `onopen`: Called when P2P connection is ready
- `onmessage`: Called for both text and binary data
- `onerror`: Called if connection fails
- `onclose`: Called when connection ends

### Browser Compatibility

| Browser       | WebRTC Support | Status                  |
|---------------|----------------|-------------------------|
| Chrome / Edge | ✅             | Full support            |
| Firefox       | ✅             | Full support            |
| Safari        | ✅             | Full support (15+)      |
| Opera         | ✅             | Full support            |
| IE 11         | ❌             | Not supported           |

---

## 🎓 Learning Resources

- [WebRTC MDN Documentation](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API)
- [Socket.IO Guide](https://socket.io/docs/)
- [P2P File Transfer Best Practices](https://www.html5rocks.com/en/tutorials/webrtc/basics/)
- [Data Channel API](https://developer.mozilla.org/en-US/docs/Web/API/RTCDataChannel)

---

## Contributing

Contributions are welcome! Here's how to help:

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

### Ideas for Contributions

- Add file preview before transfer
- Implement end-to-end encryption (E2EE)
- Add support for multiple file transfers in queue
- Dark mode / Light mode toggle
- Support for folder uploads
- Video call integration
- Connection quality statistics
- Resumable transfers for interrupted downloads

---

## License

This project is licensed under the **ISC License**. See `LICENSE` file for details.

---

## Support

- **GitHub Issues**: [Report bugs or request features](https://github.com/arjuns2487/Peep-Share/issues)
- **Live Demo**: [https://peep-share.onrender.com/](https://peep-share.onrender.com/)

---

## Acknowledgments

- Built with ❤️ using modern web standards (WebRTC, Socket.IO, Tailwind CSS)
- Inspired by the need for simple, privacy-respecting file sharing

---

**Happy Sharing! 🎉**
