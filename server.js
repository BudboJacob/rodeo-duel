// Rodeo Duel WebSocket Server
// Run with: node server.js
// Or deploy to a platform that supports WebSockets (Railway, Render, Fly.io, etc.)

const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;

// Create HTTP server to serve static files
const server = http.createServer((req, res) => {
    let filePath = req.url === '/' ? '/index.html' : req.url;
    filePath = path.join(__dirname, filePath);

    const extname = path.extname(filePath);
    const contentTypes = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon',
    };

    const contentType = contentTypes[extname] || 'application/octet-stream';

    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404);
                res.end('File not found');
            } else {
                res.writeHead(500);
                res.end('Server error');
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content);
        }
    });
});

// Create WebSocket server
const wss = new WebSocket.Server({ server, path: '/ws' });

// Room management
const rooms = new Map();

function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 4; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

function broadcast(room, message, exclude = null) {
    room.players.forEach((player, ws) => {
        if (ws !== exclude && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(message));
        }
    });
}

wss.on('connection', (ws) => {
    console.log('New connection');

    let currentRoom = null;
    let playerId = null;

    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data);
            console.log('Received:', message.type);

            switch (message.type) {
                case 'create': {
                    // Create a new room
                    let code = generateRoomCode();
                    while (rooms.has(code)) {
                        code = generateRoomCode();
                    }

                    const room = {
                        code,
                        players: new Map(),
                        gameState: null,
                    };
                    room.players.set(ws, 'dad');
                    rooms.set(code, room);

                    currentRoom = room;
                    playerId = 'dad';

                    ws.send(JSON.stringify({
                        type: 'room_created',
                        room: code,
                    }));

                    console.log(`Room ${code} created`);
                    break;
                }

                case 'join': {
                    const code = message.room?.toUpperCase();
                    const room = rooms.get(code);

                    if (!room) {
                        ws.send(JSON.stringify({
                            type: 'error',
                            message: 'Room not found',
                        }));
                        return;
                    }

                    if (room.players.size >= 2) {
                        ws.send(JSON.stringify({
                            type: 'error',
                            message: 'Room is full',
                        }));
                        return;
                    }

                    room.players.set(ws, 'son');
                    currentRoom = room;
                    playerId = 'son';

                    // Notify joiner
                    ws.send(JSON.stringify({
                        type: 'room_joined',
                        room: code,
                    }));

                    // Notify host
                    broadcast(room, { type: 'opponent_joined' }, ws);

                    console.log(`Player joined room ${code}`);
                    break;
                }

                case 'aim': {
                    if (!currentRoom) return;
                    broadcast(currentRoom, {
                        type: 'opponent_aim',
                        angle: message.angle,
                        power: message.power,
                    }, ws);
                    break;
                }

                case 'throw': {
                    if (!currentRoom) return;
                    broadcast(currentRoom, {
                        type: 'opponent_throw',
                        angle: message.angle,
                        power: message.power,
                    }, ws);
                    break;
                }

                case 'catch': {
                    if (!currentRoom) return;
                    broadcast(currentRoom, {
                        type: 'catch',
                        player: message.player,
                    }, ws);
                    break;
                }

                case 'sync': {
                    if (!currentRoom) return;
                    broadcast(currentRoom, {
                        type: 'sync',
                        bull: message.bull,
                    }, ws);
                    break;
                }

                case 'rematch': {
                    if (!currentRoom) return;
                    broadcast(currentRoom, { type: 'rematch' }, ws);
                    break;
                }
            }
        } catch (err) {
            console.error('Error processing message:', err);
        }
    });

    ws.on('close', () => {
        console.log('Connection closed');

        if (currentRoom) {
            currentRoom.players.delete(ws);
            broadcast(currentRoom, { type: 'opponent_left' });

            // Clean up empty rooms
            if (currentRoom.players.size === 0) {
                rooms.delete(currentRoom.code);
                console.log(`Room ${currentRoom.code} deleted`);
            }
        }
    });

    ws.on('error', (err) => {
        console.error('WebSocket error:', err);
    });
});

server.listen(PORT, () => {
    console.log(`Rodeo Duel server running on port ${PORT}`);
    console.log(`Open http://localhost:${PORT} to play`);
});
