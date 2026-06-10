const socket = io();
let peerConnection;
let dataChannel;
let currentRoomId = new URLSearchParams(window.location.search).get('room');

// File Transfer Tracker State
let selectedFiles = [];
let receivedChunks = [];
let currentFileMeta = null;
let expectedSize = 0;
let bytesTransferred = 0;
let transferStartTime = 0;

const CHUNK_SIZE = 16384; // 16KB WebRTC Standard Chunks

// DOM Elements
const landingView = document.getElementById('landing-view');
const roomView = document.getElementById('room-view');
const joinBtn = document.getElementById('join-btn');
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const fileList = document.getElementById('file-list');
const shareUrlInput = document.getElementById('share-url');
const copyBtn = document.getElementById('copy-btn');
const chatBox = document.getElementById('chat-box');
const chatInput = document.getElementById('chat-input');
const sendMsgBtn = document.getElementById('send-msg-btn');

// Performance & Tracking DOM References
const transferUi = document.getElementById('transfer-ui');
const sendFilesBtn = document.getElementById('send-files-btn');
const progressBar = document.getElementById('progress-bar');
const transferPercentage = document.getElementById('transfer-percentage');
const transferStatus = document.getElementById('transfer-status');
const transferEta = document.getElementById('transfer-eta');
const confirmModal = document.getElementById('confirm-modal');
const modalText = document.getElementById('modal-text');
const acceptBtn = document.getElementById('accept-btn');
const rejectBtn = document.getElementById('reject-btn');
const presenceDot = document.getElementById('presence-dot');
const presenceText = document.getElementById('presence-text');

// Multi-Server Global Network Resolution Array
const rtcConfiguration = { 
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' },
        { urls: 'stun:stun.services.mozilla.com' }
    ] 
};

// --- INITIALIZATION ROUTER ---
if (currentRoomId) {
    switchToRoomView(currentRoomId);
    socket.emit('join-room', currentRoomId);
}

joinBtn.addEventListener('click', () => socket.emit('create-room'));

socket.on('room-created', (roomId) => {
    currentRoomId = roomId;
    const roomUrl = `${window.location.origin}?room=${roomId}`;
    window.history.pushState({}, '', roomUrl);
    switchToRoomView(roomUrl);
});

function switchToRoomView(urlValue) {
    landingView.classList.add('hidden');
    roomView.classList.remove('hidden');
    shareUrlInput.value = urlValue.includes('?room=') ? urlValue : `${window.location.origin}?room=${urlValue}`;
}

copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(shareUrlInput.value);
    copyBtn.textContent = '✅ Copied';
    copyBtn.classList.replace('bg-indigo-600', 'bg-emerald-600');
    setTimeout(() => {
        copyBtn.textContent = 'Copy Link';
        copyBtn.classList.replace('bg-emerald-600', 'bg-indigo-600');
    }, 2500);
});

// --- PRESENCE HANDLERS ---
function updatePeerStatusOnline() {
    presenceDot.className = "h-2 w-2 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/50 animate-pulse";
    presenceText.textContent = "Live Connected";
    presenceText.className = "text-[10px] font-bold text-emerald-400 uppercase tracking-wider";
}

function updatePeerStatusOffline(reasonString) {
    presenceDot.className = "h-2 w-2 rounded-full bg-rose-500 shadow-lg shadow-rose-500/50";
    presenceText.textContent = "Peer Left";
    presenceText.className = "text-[10px] font-bold text-rose-400 uppercase tracking-wider";
    
    appendSystemEvent(`⚠️ Connection state: ${reasonString}`);
    chatInput.disabled = true;
    sendMsgBtn.disabled = true;
    if (!transferUi.classList.contains('hidden')) resetTransferUI();
}

// --- WEBRTC CORE MATRIX ---
socket.on('peer-joined', async (roomId) => {
    appendSystemEvent('Peer joined. Negotiating direct tunnel data sockets...');
    initializePeerConnection(roomId);
    
    dataChannel = peerConnection.createDataChannel('p2p-channel');
    dataChannel.binaryType = 'arraybuffer';
    bindChannelEvents();

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.emit('signal', { roomId, signalData: offer });
});

socket.on('signal', async (signalData) => {
    if (!peerConnection) initializePeerConnection(currentRoomId);

    if (signalData.type === 'offer') {
        await peerConnection.setRemoteDescription(signalData);
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        socket.emit('signal', { roomId: currentRoomId, signalData: answer });
    } else if (signalData.type === 'answer') {
        await peerConnection.setRemoteDescription(signalData);
    } else if (signalData.candidate) {
        await peerConnection.addIceCandidate(signalData);
    }
});

function initializePeerConnection(roomId) {
    peerConnection = new RTCPeerConnection(rtcConfiguration);

    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('signal', { roomId, signalData: event.candidate });
        }
    };

    peerConnection.ondatachannel = (event) => {
        dataChannel = event.channel;
        dataChannel.binaryType = 'arraybuffer';
        bindChannelEvents();
    };
}

function bindChannelEvents() {
    dataChannel.onopen = () => {
        chatBox.innerHTML = '';
        appendSystemEvent('Direct P2P Data Pipe Secured.');
        chatInput.disabled = false;
        sendMsgBtn.disabled = false;
        updatePeerStatusOnline();
    };

    dataChannel.onmessage = (event) => {
        if (event.data instanceof ArrayBuffer) {
            handleIncomingChunk(event.data);
            return;
        }

        const payload = JSON.parse(event.data);
        switch(payload.type) {
            case 'text':
                appendMsg(payload.body, 'peer');
                break;
            case 'file-offer':
                currentFileMeta = payload.meta;
                modalText.innerHTML = `Peer wants to send:<br><b class="text-indigo-400">${payload.meta.name}</b> (${payload.meta.sizeString})`;
                confirmModal.classList.remove('hidden');
                break;
            case 'file-response':
                if (payload.approved) {
                    appendSystemEvent('File accepted. Streaming array blocks...');
                    executeFileStreaming();
                } else {
                    appendSystemEvent('❌ File transfer request declined.');
                    resetTransferUI();
                }
                break;
            case 'file-eof':
                assembleAndDownloadFile();
                break;
        }
    };

    dataChannel.onclose = () => updatePeerStatusOffline('Tunnel connection closed.');
}

socket.on('peer-left', () => updatePeerStatusOffline('Peer closed the session tab.'));

// --- REALTIME CHAT ENGINE ---
sendMsgBtn.addEventListener('click', dispatchMessage);
chatInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') dispatchMessage(); });

function dispatchMessage() {
    const text = chatInput.value.trim();
    if (!text || !dataChannel || dataChannel.readyState !== 'open') return;

    dataChannel.send(JSON.stringify({ type: 'text', body: text }));
    appendMsg(text, 'me');
    chatInput.value = '';
}

function appendMsg(msg, owner) {
    const bubble = document.createElement('div');
    bubble.className = `p-3 rounded-xl max-w-[85%] text-sm ${owner === 'me' ? 'bg-indigo-600 text-white self-end ml-auto rounded-tr-none' : 'bg-slate-800 text-slate-100 rounded-tl-none'}`;
    bubble.textContent = msg;
    chatBox.appendChild(bubble);
    chatBox.scrollTop = chatBox.scrollHeight;
}

function appendSystemEvent(info) {
    const notice = document.createElement('div');
    notice.className = 'text-center text-xs text-indigo-400/80 bg-indigo-950/30 border border-indigo-900/50 py-1.5 px-3 rounded-lg my-2';
    notice.textContent = info;
    chatBox.appendChild(notice);
    chatBox.scrollTop = chatBox.scrollHeight;
}

// --- FILE STACK QUEUE MANAGEMENT ---
dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.replace('border-slate-700', 'border-indigo-500'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.replace('border-indigo-500', 'border-slate-700'));
dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.replace('border-indigo-500', 'border-slate-700');
    queueFiles(e.dataTransfer.files);
});
fileInput.addEventListener('change', (e) => queueFiles(e.target.files));

function queueFiles(files) {
    selectedFiles = Array.from(files);
    fileList.innerHTML = '';
    if(selectedFiles.length === 0) return;

    selectedFiles.forEach(file => {
        const item = document.createElement('div');
        item.className = 'bg-slate-950 border border-slate-800 p-3 rounded-xl flex justify-between items-center text-xs';
        item.innerHTML = `<span class="text-slate-300 font-medium truncate max-w-[70%]">📄 ${file.name}</span> 
                          <span class="text-slate-500 font-mono">${(file.size / (1024 * 1024)).toFixed(2)} MB</span>`;
        fileList.appendChild(item);
    });

    transferUi.classList.remove('hidden');
    sendFilesBtn.classList.remove('hidden');
    updateProgressUI(0, 'Ready to transfer', '--');
}

// --- BINARY CHUNKING PIPELINE (SENDER -> RECEIVER) ---

sendFilesBtn.addEventListener('click', () => {
    if (selectedFiles.length === 0) return;
    sendFilesBtn.classList.add('hidden');
    
    const file = selectedFiles[0];
    const meta = {
        name: file.name,
        size: file.size,
        sizeString: `${(file.size / (1024 * 1024)).toFixed(2)} MB`
    };

    appendSystemEvent(`Offering file: ${meta.name}. Waiting for approval response...`);
    dataChannel.send(JSON.stringify({ type: 'file-offer', meta }));
});

acceptBtn.addEventListener('click', () => {
    confirmModal.classList.add('hidden');
    receivedChunks = [];
    bytesTransferred = 0;
    expectedSize = currentFileMeta.size;
    transferStartTime = Date.now();
    
    transferUi.classList.remove('hidden');
    sendFilesBtn.classList.add('hidden');
    updateProgressUI(0, 'Downloading...', 'Calculating...');

    dataChannel.send(JSON.stringify({ type: 'file-response', approved: true }));
});

rejectBtn.addEventListener('click', () => {
    confirmModal.classList.add('hidden');
    dataChannel.send(JSON.stringify({ type: 'file-response', approved: false }));
    currentFileMeta = null;
});

function executeFileStreaming() {
    const file = selectedFiles[0];
    let offset = 0;
    transferStartTime = Date.now();
    bytesTransferred = 0;

    const fileReader = new FileReader();

    fileReader.onload = (e) => {
        dataChannel.send(e.target.result);
        bytesTransferred += e.target.result.byteLength;
        
        const progress = (bytesTransferred / file.size) * 100;
        const eta = calculateETA(bytesTransferred, file.size);
        updateProgressUI(progress, 'Uploading...', eta);

        offset += CHUNK_SIZE;
        if (offset < file.size) {
            readNextChunk();
        } else {
            setTimeout(() => {
                dataChannel.send(JSON.stringify({ type: 'file-eof' }));
                appendSystemEvent('✅ Upload completed successfully.');
                resetTransferUI();
            }, 500);
        }
    };

    function readNextChunk() {
        if (dataChannel.bufferedAmount > 1024 * 1024) { 
            setTimeout(readNextChunk, 10);
            return;
        }
        const slice = file.slice(offset, offset + CHUNK_SIZE);
        fileReader.readAsArrayBuffer(slice);
    }

    readNextChunk();
}

function handleIncomingChunk(arrayBuffer) {
    receivedChunks.push(arrayBuffer);
    bytesTransferred += arrayBuffer.byteLength;

    const progress = (bytesTransferred / expectedSize) * 100;
    const eta = calculateETA(bytesTransferred, expectedSize);
    updateProgressUI(progress, 'Downloading...', eta);
}

function assembleAndDownloadFile() {
    const blob = new Blob(receivedChunks);
    const url = URL.createObjectURL(blob);
    
    const downloadAnchor = document.createElement('a');
    downloadAnchor.href = url;
    downloadAnchor.download = currentFileMeta.name;
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    document.body.removeChild(downloadAnchor);
    
    appendSystemEvent(`✅ Successfully downloaded: ${currentFileMeta.name}`);
    resetTransferUI();
}

// --- SPEED TELEMETRY CALCULATORS ---
function calculateETA(transferred, total) {
    const timeElapsed = (Date.now() - transferStartTime) / 1000;
    if (timeElapsed === 0 || transferred === 0) return 'Calculating...';
    
    const speed = transferred / timeElapsed;
    const bytesRemaining = total - transferred;
    const secondsRemaining = bytesRemaining / speed;

    if (secondsRemaining === Infinity || isNaN(secondsRemaining)) return '--';
    if (secondsRemaining < 1) return '0s remaining';
    if (secondsRemaining < 60) return `${Math.round(secondsRemaining)}s remaining`;
    
    const mins = Math.floor(secondsRemaining / 60);
    const secs = Math.round(secondsRemaining % 60);
    return `${mins}m ${secs}s remaining`;
}

function updateProgressUI(percentage, statusText, etaText) {
    progressBar.style.width = `${percentage}%`;
    transferPercentage.textContent = `${Math.round(percentage)}%`;
    transferStatus.textContent = statusText;
    transferEta.textContent = `ETA: ${etaText}`;
}

function mergeQueuedFiles(files) {
    // This helper facilitates seamless multi-file arrays internally
    return Array.from(files);
}

function resetTransferUI() {
    setTimeout(() => {
        transferUi.classList.add('hidden');
        fileList.innerHTML = '';
        selectedFiles = [];
        receivedChunks = [];
        currentFileMeta = null;
    }, 4000);
}
