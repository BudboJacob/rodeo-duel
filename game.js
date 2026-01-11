// ============================================
// RODEO DUEL - Father vs Son Lasso Showdown
// With Angry Birds-style aiming & Multiplayer
// ============================================

document.addEventListener('DOMContentLoaded', init);

// Canvas setup
let canvas, ctx;
let canvasWidth = 0;
let canvasHeight = 0;

// Multiplayer
let socket = null;
let isMultiplayer = false;
let playerId = null;
let roomId = null;
let opponentConnected = false;

// Game State
const game = {
    state: 'title',
    round: 1,
    maxScore: 3,
    dadScore: 0,
    sonScore: 0,
    winner: null,
    countdownValue: 3,
    firstPlay: true,
    animationFrame: null,
    mode: 'local', // 'local' or 'online'
};

// Players
const players = {
    dad: {
        name: 'PA',
        emoji: '👨',
        color: '#8B4513',
        lightColor: '#D2691E',
        x: 0,
        y: 0,
        // Angry Birds style aiming
        isDragging: false,
        dragStart: { x: 0, y: 0 },
        dragCurrent: { x: 0, y: 0 },
        aimAngle: 0,
        aimPower: 0,
        lasso: null,
        hasThrown: false,
    },
    son: {
        name: 'JUNIOR',
        emoji: '👦',
        color: '#2563EB',
        lightColor: '#60A5FA',
        x: 0,
        y: 0,
        isDragging: false,
        dragStart: { x: 0, y: 0 },
        dragCurrent: { x: 0, y: 0 },
        aimAngle: 0,
        aimPower: 0,
        lasso: null,
        hasThrown: false,
    }
};

// Bull target
const bull = {
    x: 0,
    y: 0,
    baseY: 0,
    radius: 35,
    speed: 3,
    direction: 1,
    bobOffset: 0,
    caught: false,
    caughtBy: null,
    runAwayTimer: 0,
};

// Particles
let particles = [];
let dustParticles = [];
let ropeSegments = [];

// Constants
const MAX_DRAG_DISTANCE = 120;
const MIN_POWER_THRESHOLD = 0.15;

// ============ INITIALIZATION ============
function init() {
    canvas = document.getElementById('game-canvas');
    ctx = canvas.getContext('2d');

    setupCanvas();
    setupEventListeners();
    gameLoop();
}

function setupCanvas() {
    const arena = document.getElementById('game-arena');
    if (!arena) return;

    const rect = arena.getBoundingClientRect();
    canvasWidth = rect.width;
    canvasHeight = rect.height;

    canvas.width = canvasWidth * window.devicePixelRatio;
    canvas.height = canvasHeight * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    canvas.style.width = canvasWidth + 'px';
    canvas.style.height = canvasHeight + 'px';

    positionEntities();
}

function positionEntities() {
    players.dad.x = canvasWidth * 0.15;
    players.dad.y = canvasHeight * 0.82;

    players.son.x = canvasWidth * 0.85;
    players.son.y = canvasHeight * 0.82;

    bull.x = canvasWidth * 0.5;
    bull.baseY = canvasHeight * 0.35;
    bull.y = bull.baseY;
}

function setupEventListeners() {
    window.addEventListener('resize', setupCanvas);

    // Start buttons
    document.getElementById('start-btn').addEventListener('click', () => startGame('local'));
    document.getElementById('online-btn')?.addEventListener('click', () => startGame('online'));

    // Canvas touch/mouse for aiming
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
    canvas.addEventListener('touchcancel', handleTouchEnd, { passive: false });

    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mouseleave', handleMouseUp);

    // Other buttons
    document.getElementById('next-round-btn').addEventListener('click', () => {
        showScreen('game-screen');
        setTimeout(() => {
            setupCanvas();
            startRound();
        }, 100);
    });

    document.getElementById('rematch-btn').addEventListener('click', () => {
        if (isMultiplayer) {
            sendMessage({ type: 'rematch' });
        }
        resetGame();
        showScreen('game-screen');
        setTimeout(() => {
            setupCanvas();
            startRound();
        }, 100);
    });

    document.getElementById('menu-btn').addEventListener('click', () => {
        if (socket) {
            socket.close();
            socket = null;
        }
        isMultiplayer = false;
        resetGame();
        showScreen('title-screen');
    });

    document.getElementById('tutorial-ok')?.addEventListener('click', () => {
        document.getElementById('tutorial-overlay').classList.remove('active');
        startCountdown();
    });

    // Copy room code
    document.getElementById('copy-code-btn')?.addEventListener('click', () => {
        navigator.clipboard.writeText(roomId);
        document.getElementById('copy-code-btn').textContent = 'Copied!';
        setTimeout(() => {
            document.getElementById('copy-code-btn').textContent = 'Copy';
        }, 2000);
    });

    // Join room
    document.getElementById('join-room-btn')?.addEventListener('click', () => {
        const code = document.getElementById('room-code-input').value.trim().toUpperCase();
        if (code.length === 4) {
            joinRoom(code);
        }
    });
}

// ============ TOUCH/MOUSE HANDLERS (Angry Birds Style) ============
function getPlayerFromPosition(x, y) {
    const dadDist = Math.sqrt(Math.pow(x - players.dad.x, 2) + Math.pow(y - players.dad.y, 2));
    const sonDist = Math.sqrt(Math.pow(x - players.son.x, 2) + Math.pow(y - players.son.y, 2));

    // Check if touch is in the lower portion of screen (control area)
    if (y < canvasHeight * 0.6) return null;

    // In multiplayer, only control your assigned player
    if (isMultiplayer) {
        if (playerId === 'dad' && x < canvasWidth / 2) return 'dad';
        if (playerId === 'son' && x > canvasWidth / 2) return 'son';
        return null;
    }

    // Local: left half = dad, right half = son
    if (x < canvasWidth / 2) return 'dad';
    return 'son';
}

function handleTouchStart(e) {
    e.preventDefault();
    if (game.state !== 'playing') return;

    for (let touch of e.changedTouches) {
        const rect = canvas.getBoundingClientRect();
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;

        const playerKey = getPlayerFromPosition(x, y);
        if (playerKey && !players[playerKey].hasThrown) {
            startDrag(playerKey, x, y, touch.identifier);
        }
    }
}

function handleTouchMove(e) {
    e.preventDefault();
    if (game.state !== 'playing') return;

    for (let touch of e.changedTouches) {
        const rect = canvas.getBoundingClientRect();
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;

        ['dad', 'son'].forEach(key => {
            if (players[key].isDragging && players[key].touchId === touch.identifier) {
                updateDrag(key, x, y);
            }
        });
    }
}

function handleTouchEnd(e) {
    e.preventDefault();

    for (let touch of e.changedTouches) {
        ['dad', 'son'].forEach(key => {
            if (players[key].isDragging && players[key].touchId === touch.identifier) {
                releaseDrag(key);
            }
        });
    }
}

function handleMouseDown(e) {
    if (game.state !== 'playing') return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const playerKey = getPlayerFromPosition(x, y);
    if (playerKey && !players[playerKey].hasThrown) {
        startDrag(playerKey, x, y, 'mouse');
    }
}

function handleMouseMove(e) {
    if (game.state !== 'playing') return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ['dad', 'son'].forEach(key => {
        if (players[key].isDragging && players[key].touchId === 'mouse') {
            updateDrag(key, x, y);
        }
    });
}

function handleMouseUp(e) {
    ['dad', 'son'].forEach(key => {
        if (players[key].isDragging && players[key].touchId === 'mouse') {
            releaseDrag(key);
        }
    });
}

// ============ DRAG MECHANICS ============
function startDrag(playerKey, x, y, touchId) {
    const player = players[playerKey];
    player.isDragging = true;
    player.touchId = touchId;
    player.dragStart = { x: player.x, y: player.y - 50 };
    player.dragCurrent = { x, y };
    vibrate(20);
}

function updateDrag(playerKey, x, y) {
    const player = players[playerKey];
    player.dragCurrent = { x, y };

    // Calculate pull-back vector (opposite of drag direction)
    const dx = player.dragStart.x - x;
    const dy = player.dragStart.y - y;

    // Clamp distance
    const dist = Math.sqrt(dx * dx + dy * dy);
    const clampedDist = Math.min(dist, MAX_DRAG_DISTANCE);

    // Calculate aim angle and power
    player.aimAngle = Math.atan2(dy, dx);
    player.aimPower = clampedDist / MAX_DRAG_DISTANCE;

    // Send to opponent in multiplayer
    if (isMultiplayer && playerKey === playerId) {
        sendMessage({
            type: 'aim',
            angle: player.aimAngle,
            power: player.aimPower,
        });
    }
}

function releaseDrag(playerKey) {
    const player = players[playerKey];
    if (!player.isDragging) return;

    player.isDragging = false;

    if (player.hasThrown || game.state !== 'playing') return;

    // Check minimum power
    if (player.aimPower < MIN_POWER_THRESHOLD) {
        player.aimPower = 0;
        return;
    }

    player.hasThrown = true;
    throwLasso(player, playerKey);
    vibrate(80);

    // Send throw to opponent
    if (isMultiplayer && playerKey === playerId) {
        sendMessage({
            type: 'throw',
            angle: player.aimAngle,
            power: player.aimPower,
        });
    }
}

// ============ LASSO PHYSICS ============
function throwLasso(player, playerKey) {
    const power = player.aimPower;
    const angle = player.aimAngle;

    // Calculate velocity based on pull-back
    const speed = 8 + power * 12;
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;

    player.lasso = {
        x: player.x,
        y: player.y - 50,
        vx: vx,
        vy: vy,
        gravity: 0.3,
        power: power,
        radius: 20 + power * 25,
        rotation: 0,
        rotationSpeed: 0.3 + power * 0.3,
        state: 'flying',
        ropePoints: [],
        time: 0,
    };

    // Initialize rope
    for (let i = 0; i < 20; i++) {
        player.lasso.ropePoints.push({
            x: player.x,
            y: player.y - 50,
            oldX: player.x,
            oldY: player.y - 50,
        });
    }

    // Throw particles
    for (let i = 0; i < 12; i++) {
        const particleAngle = angle + (Math.random() - 0.5) * 0.5;
        particles.push({
            x: player.x,
            y: player.y - 50,
            vx: Math.cos(particleAngle) * (2 + Math.random() * 3),
            vy: Math.sin(particleAngle) * (2 + Math.random() * 3),
            life: 1,
            color: player.lightColor,
            size: 3 + Math.random() * 4,
        });
    }
}

function updateLassoPhysics(lasso, player, playerKey) {
    if (lasso.state !== 'flying') return;

    lasso.time++;

    // Apply velocity
    lasso.x += lasso.vx;
    lasso.y += lasso.vy;

    // Apply gravity
    lasso.vy += lasso.gravity;

    // Air resistance
    lasso.vx *= 0.99;
    lasso.vy *= 0.99;

    // Rotation
    lasso.rotation += lasso.rotationSpeed;

    // Update rope physics (verlet integration)
    updateRopePhysics(lasso, player);

    // Check bounds
    if (lasso.y > canvasHeight + 50 || lasso.x < -50 || lasso.x > canvasWidth + 50) {
        lasso.state = 'missed';
        return;
    }

    // Check collision with bull
    const dist = Math.sqrt(Math.pow(lasso.x - bull.x, 2) + Math.pow(lasso.y - bull.y, 2));
    if (dist < lasso.radius + bull.radius && !bull.caught) {
        bull.caught = true;
        bull.caughtBy = player;
        lasso.state = 'caught';

        showCatchEffect(bull.x, bull.y, player.color);

        // Celebration particles
        for (let i = 0; i < 40; i++) {
            const angle = (Math.PI * 2 / 40) * i;
            particles.push({
                x: bull.x,
                y: bull.y,
                vx: Math.cos(angle) * (4 + Math.random() * 6),
                vy: Math.sin(angle) * (4 + Math.random() * 6),
                life: 1,
                color: player.lightColor,
                size: 5 + Math.random() * 8,
            });
        }

        vibrate(150);

        // Notify opponent
        if (isMultiplayer) {
            sendMessage({ type: 'catch', player: playerKey });
        }
    }
}

function updateRopePhysics(lasso, player) {
    const points = lasso.ropePoints;
    const anchorX = player.x + (player === players.dad ? 15 : -15);
    const anchorY = player.y - 55;

    // First point anchored to player
    points[0].x = anchorX;
    points[0].y = anchorY;

    // Last point attached to lasso
    points[points.length - 1].x = lasso.x;
    points[points.length - 1].y = lasso.y;

    // Verlet integration for middle points
    for (let i = 1; i < points.length - 1; i++) {
        const p = points[i];
        const vx = (p.x - p.oldX) * 0.98;
        const vy = (p.y - p.oldY) * 0.98;

        p.oldX = p.x;
        p.oldY = p.y;

        p.x += vx;
        p.y += vy + 0.2; // Gravity
    }

    // Constraint iterations
    for (let iter = 0; iter < 3; iter++) {
        for (let i = 0; i < points.length - 1; i++) {
            const p1 = points[i];
            const p2 = points[i + 1];

            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const targetDist = 15;

            if (dist > 0) {
                const diff = (dist - targetDist) / dist;

                if (i === 0) {
                    // Anchor fixed
                    p2.x -= dx * diff;
                    p2.y -= dy * diff;
                } else if (i === points.length - 2) {
                    // End fixed
                    p1.x += dx * diff;
                    p1.y += dy * diff;
                } else {
                    p1.x += dx * diff * 0.5;
                    p1.y += dy * diff * 0.5;
                    p2.x -= dx * diff * 0.5;
                    p2.y -= dy * diff * 0.5;
                }
            }
        }
    }
}

// ============ GAME FLOW ============
function startGame(mode) {
    game.mode = mode;

    if (mode === 'online') {
        showScreen('lobby-screen');
        connectToServer();
    } else {
        resetGame();
        showScreen('game-screen');

        setTimeout(() => {
            setupCanvas();

            if (game.firstPlay) {
                game.firstPlay = false;
                document.getElementById('tutorial-overlay').classList.add('active');
            } else {
                startRound();
            }
        }, 100);
    }
}

function startRound() {
    // Reset players
    ['dad', 'son'].forEach(key => {
        const p = players[key];
        p.aimPower = 0;
        p.aimAngle = 0;
        p.isDragging = false;
        p.lasso = null;
        p.hasThrown = false;
    });

    // Reset bull
    bull.caught = false;
    bull.caughtBy = null;
    bull.x = canvasWidth / 2;
    bull.y = bull.baseY;
    bull.direction = Math.random() > 0.5 ? 1 : -1;
    bull.speed = 2 + game.round * 0.5;
    bull.runAwayTimer = 0;

    particles = [];
    dustParticles = [];

    document.getElementById('round-display').textContent = `ROUND ${game.round}`;
    updateScoreStars();

    startCountdown();
}

function startCountdown() {
    game.state = 'countdown';
    game.countdownValue = 3;

    const overlay = document.getElementById('countdown-overlay');
    const text = document.getElementById('countdown-text');

    overlay.classList.add('active');

    function tick() {
        if (game.countdownValue > 0) {
            text.textContent = game.countdownValue;
            text.style.animation = 'none';
            text.offsetHeight;
            text.style.animation = 'countPop 0.4s ease-out';

            vibrate(50);
            game.countdownValue--;
            setTimeout(tick, 700);
        } else {
            text.textContent = 'GO!';
            text.style.animation = 'none';
            text.offsetHeight;
            text.style.animation = 'countPop 0.4s ease-out';

            vibrate(100);

            setTimeout(() => {
                overlay.classList.remove('active');
                game.state = 'playing';
            }, 400);
        }
    }

    tick();
}

function endRound() {
    if (game.state === 'roundEnd') return;
    game.state = 'roundEnd';

    let winner = null;

    if (bull.caught && bull.caughtBy) {
        winner = bull.caughtBy === players.dad ? 'dad' : 'son';
    }

    if (winner === 'dad') {
        game.dadScore++;
        document.getElementById('round-winner').textContent = "👨 PA catches the bull!";
        document.getElementById('round-result-icon').textContent = '🎉';
    } else if (winner === 'son') {
        game.sonScore++;
        document.getElementById('round-winner').textContent = "👦 JUNIOR catches the bull!";
        document.getElementById('round-result-icon').textContent = '🎉';
    } else {
        document.getElementById('round-winner').textContent = "🐂 The bull escaped!";
        document.getElementById('round-result-icon').textContent = '💨';
    }

    document.getElementById('round-dad-score').textContent = game.dadScore;
    document.getElementById('round-son-score').textContent = game.sonScore;
    updateScoreStars();

    vibrate(200);

    setTimeout(() => {
        if (game.dadScore >= game.maxScore) {
            game.winner = 'dad';
            showVictory();
        } else if (game.sonScore >= game.maxScore) {
            game.winner = 'son';
            showVictory();
        } else {
            game.round++;
            showScreen('round-screen');
        }
    }, 800);
}

function showVictory() {
    const isDad = game.winner === 'dad';

    document.getElementById('winner-text').textContent = isDad ? 'PA WINS!' : 'JUNIOR WINS!';
    document.getElementById('winner-icon').textContent = isDad ? '👨' : '👦';
    document.getElementById('winner-subtitle').textContent = isDad
        ? "The old man's still got it!"
        : "The student becomes the master!";
    document.getElementById('final-dad').textContent = game.dadScore;
    document.getElementById('final-son').textContent = game.sonScore;

    showScreen('victory-screen');
    createConfetti();
    vibrate([100, 50, 100, 50, 200]);
}

function resetGame() {
    game.round = 1;
    game.dadScore = 0;
    game.sonScore = 0;
    game.winner = null;
    game.state = 'title';
    updateScoreStars();
}

// ============ MULTIPLAYER ============
function connectToServer() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    // For development/testing, use a simple signaling approach
    // In production, this would connect to a real WebSocket server

    document.getElementById('room-status').textContent = 'Connecting...';

    try {
        socket = new WebSocket(wsUrl);

        socket.onopen = () => {
            sendMessage({ type: 'create' });
        };

        socket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            handleServerMessage(data);
        };

        socket.onerror = (error) => {
            console.error('WebSocket error:', error);
            document.getElementById('room-status').textContent = 'Connection failed. Using local mode.';
            showFallbackLocalMode();
        };

        socket.onclose = () => {
            if (isMultiplayer && game.state === 'playing') {
                document.getElementById('room-status').textContent = 'Opponent disconnected';
                showScreen('lobby-screen');
            }
        };
    } catch (e) {
        console.error('WebSocket not available:', e);
        showFallbackLocalMode();
    }
}

function showFallbackLocalMode() {
    // If WebSocket fails, show message and allow local play
    setTimeout(() => {
        document.getElementById('room-status').innerHTML = `
            <p>Online mode requires a WebSocket server.</p>
            <p>Play locally instead?</p>
            <button onclick="startGame('local')" class="btn">Play Local</button>
        `;
    }, 1000);
}

function joinRoom(code) {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
        alert('Not connected to server');
        return;
    }

    sendMessage({ type: 'join', room: code });
}

function sendMessage(data) {
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(data));
    }
}

function handleServerMessage(data) {
    switch (data.type) {
        case 'room_created':
            roomId = data.room;
            playerId = 'dad';
            document.getElementById('room-code-display').textContent = roomId;
            document.getElementById('room-status').textContent = 'Waiting for opponent...';
            document.querySelector('.room-code-section').style.display = 'block';
            break;

        case 'room_joined':
            roomId = data.room;
            playerId = 'son';
            opponentConnected = true;
            document.getElementById('room-status').textContent = 'Joined! Starting game...';
            startMultiplayerGame();
            break;

        case 'opponent_joined':
            opponentConnected = true;
            document.getElementById('room-status').textContent = 'Opponent joined! Starting...';
            startMultiplayerGame();
            break;

        case 'opponent_aim':
            const oppKey = playerId === 'dad' ? 'son' : 'dad';
            players[oppKey].aimAngle = data.angle;
            players[oppKey].aimPower = data.power;
            players[oppKey].isDragging = true;
            break;

        case 'opponent_throw':
            const throwKey = playerId === 'dad' ? 'son' : 'dad';
            players[throwKey].aimAngle = data.angle;
            players[throwKey].aimPower = data.power;
            players[throwKey].hasThrown = true;
            throwLasso(players[throwKey], throwKey);
            break;

        case 'sync':
            // Sync game state from host
            if (data.bull) {
                bull.x = data.bull.x;
                bull.y = data.bull.y;
                bull.direction = data.bull.direction;
            }
            break;

        case 'opponent_left':
            opponentConnected = false;
            alert('Opponent disconnected');
            showScreen('lobby-screen');
            break;

        case 'error':
            alert(data.message);
            break;
    }
}

function startMultiplayerGame() {
    isMultiplayer = true;
    resetGame();
    showScreen('game-screen');

    setTimeout(() => {
        setupCanvas();
        startRound();
    }, 500);
}

// ============ GAME LOOP ============
function gameLoop() {
    update();
    render();
    game.animationFrame = requestAnimationFrame(gameLoop);
}

function update() {
    if (game.state !== 'playing' && game.state !== 'countdown') return;

    if (game.state !== 'playing') return;

    // Update bull
    if (!bull.caught) {
        bull.x += bull.speed * bull.direction;

        const margin = 60;
        if (bull.x > canvasWidth - margin) {
            bull.x = canvasWidth - margin;
            bull.direction = -1;
        } else if (bull.x < margin) {
            bull.x = margin;
            bull.direction = 1;
        }

        bull.bobOffset += 0.15;
        bull.y = bull.baseY + Math.sin(bull.bobOffset) * 8;

        // Dust
        if (Math.random() < 0.3) {
            dustParticles.push({
                x: bull.x - bull.direction * 20,
                y: bull.y + 25,
                vx: -bull.direction * (1 + Math.random()),
                vy: -Math.random() * 2,
                life: 1,
                size: 5 + Math.random() * 10,
            });
        }

        // Run away timer
        bull.runAwayTimer++;
        if (bull.runAwayTimer > 300 && players.dad.hasThrown && players.son.hasThrown) {
            endRound();
        }

        // Sync bull position in multiplayer (host only)
        if (isMultiplayer && playerId === 'dad' && bull.runAwayTimer % 30 === 0) {
            sendMessage({
                type: 'sync',
                bull: { x: bull.x, y: bull.y, direction: bull.direction }
            });
        }
    }

    // Update lassos
    ['dad', 'son'].forEach(key => {
        const player = players[key];
        if (player.lasso && player.lasso.state === 'flying') {
            updateLassoPhysics(player.lasso, player, key);
        }
    });

    // Update particles
    particles = particles.filter(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.025;
        p.vy += 0.15;
        return p.life > 0;
    });

    dustParticles = dustParticles.filter(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.02;
        p.size *= 0.98;
        return p.life > 0 && p.size > 1;
    });

    // Check round end
    const dadDone = players.dad.hasThrown && (!players.dad.lasso || players.dad.lasso.state !== 'flying');
    const sonDone = players.son.hasThrown && (!players.son.lasso || players.son.lasso.state !== 'flying');

    if (bull.caught || (dadDone && sonDone)) {
        setTimeout(() => endRound(), bull.caught ? 600 : 300);
    }
}

// ============ RENDERING ============
function render() {
    if (!ctx || canvasWidth === 0) return;

    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    drawArena();
    drawDustParticles();
    drawBull();

    // Draw trajectory previews for aiming players
    ['dad', 'son'].forEach(key => {
        const player = players[key];
        if (player.isDragging && !player.hasThrown) {
            drawTrajectoryPreview(player, key);
        }
    });

    drawPlayer(players.dad, true);
    drawPlayer(players.son, false);

    // Draw lassos with rope physics
    ['dad', 'son'].forEach(key => {
        const player = players[key];
        if (player.lasso) {
            drawRopeLasso(player.lasso, player);
        }
    });

    drawParticles();

    // Draw aim indicators
    ['dad', 'son'].forEach(key => {
        const player = players[key];
        if (player.isDragging && !player.hasThrown) {
            drawAimIndicator(player, key);
        }
    });
}

function drawArena() {
    const groundY = canvasHeight * 0.6;

    ctx.strokeStyle = '#8B4513';
    ctx.lineWidth = 6;

    ctx.beginPath();
    ctx.moveTo(0, groundY - 20);
    ctx.lineTo(canvasWidth, groundY - 20);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, groundY - 50);
    ctx.lineTo(canvasWidth, groundY - 50);
    ctx.stroke();

    ctx.fillStyle = '#5D4037';
    for (let x = 30; x < canvasWidth; x += 80) {
        ctx.fillRect(x - 5, groundY - 70, 10, 70);
    }

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 10]);
    ctx.beginPath();
    ctx.arc(canvasWidth / 2, groundY, canvasWidth * 0.3, Math.PI, 0);
    ctx.stroke();
    ctx.setLineDash([]);
}

function drawBull() {
    const x = bull.x;
    const y = bull.y;

    ctx.save();
    ctx.translate(x, y);

    if (bull.direction < 0) {
        ctx.scale(-1, 1);
    }

    const runPhase = Math.sin(bull.bobOffset * 2);

    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.beginPath();
    ctx.ellipse(0, 35, 40, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body
    ctx.fillStyle = '#4A2810';
    ctx.beginPath();
    ctx.ellipse(0, 0, 45, 30, 0, 0, Math.PI * 2);
    ctx.fill();

    // Head
    ctx.fillStyle = '#3D2106';
    ctx.beginPath();
    ctx.ellipse(35, -5, 20, 18, 0.2, 0, Math.PI * 2);
    ctx.fill();

    // Horns
    ctx.strokeStyle = '#F5DEB3';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.moveTo(40, -15);
    ctx.quadraticCurveTo(55, -30, 50, -40);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(40, 5);
    ctx.quadraticCurveTo(55, 20, 50, 30);
    ctx.stroke();

    // Eye
    ctx.fillStyle = '#FF4444';
    ctx.beginPath();
    ctx.arc(45, -3, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(46, -4, 2, 0, Math.PI * 2);
    ctx.fill();

    // Legs
    ctx.fillStyle = '#3D2106';
    const legOffset = runPhase * 8;

    ctx.fillRect(15, 20, 8, 25 + legOffset);
    ctx.fillRect(25, 20, 8, 25 - legOffset);
    ctx.fillRect(-25, 20, 8, 25 - legOffset);
    ctx.fillRect(-15, 20, 8, 25 + legOffset);

    // Tail
    ctx.strokeStyle = '#4A2810';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-40, 0);
    ctx.quadraticCurveTo(-55, 10 + runPhase * 5, -50, 25 + runPhase * 3);
    ctx.stroke();

    ctx.fillStyle = '#3D2106';
    ctx.beginPath();
    ctx.arc(-50, 28 + runPhase * 3, 8, 0, Math.PI * 2);
    ctx.fill();

    // Snort
    if (!bull.caught && Math.random() < 0.1) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.beginPath();
        ctx.arc(55 + Math.random() * 10, -5 + Math.random() * 10, 3, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.restore();

    // Caught indicator
    if (bull.caught && bull.caughtBy) {
        ctx.save();

        ctx.strokeStyle = bull.caughtBy.lightColor;
        ctx.lineWidth = 4;
        ctx.setLineDash([8, 4]);
        ctx.beginPath();
        ctx.arc(x, y, bull.radius + 10, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = bull.caughtBy.color;
        ctx.font = 'bold 24px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('CAUGHT!', x, y - 60);

        ctx.restore();
    }

    // Target indicator
    if (game.state === 'playing' && !bull.caught) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 215, 0, 0.5)';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);

        const pulseSize = Math.sin(Date.now() / 200) * 5;
        ctx.beginPath();
        ctx.arc(x, y, bull.radius + 15 + pulseSize, 0, Math.PI * 2);
        ctx.stroke();

        ctx.setLineDash([]);
        ctx.restore();
    }
}

function drawPlayer(player, isLeft) {
    const x = player.x;
    const y = player.y;

    ctx.save();
    ctx.translate(x, y);

    if (!isLeft) {
        ctx.scale(-1, 1);
    }

    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.beginPath();
    ctx.ellipse(0, 10, 25, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body
    ctx.fillStyle = player.color;
    ctx.beginPath();
    ctx.ellipse(0, -25, 22, 35, 0, 0, Math.PI * 2);
    ctx.fill();

    // Belt buckle
    ctx.fillStyle = '#FFD700';
    ctx.beginPath();
    ctx.ellipse(0, 0, 8, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Hat
    ctx.fillStyle = '#5D4037';
    ctx.beginPath();
    ctx.ellipse(0, -65, 30, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillRect(-12, -85, 24, 22);
    ctx.beginPath();
    ctx.arc(0, -85, 12, Math.PI, 0);
    ctx.fill();

    // Face
    ctx.fillStyle = '#FDBF6F';
    ctx.beginPath();
    ctx.arc(0, -48, 15, 0, Math.PI * 2);
    ctx.fill();

    // Eyes
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.arc(-5, -50, 2, 0, Math.PI * 2);
    ctx.arc(5, -50, 2, 0, Math.PI * 2);
    ctx.fill();

    // Smile
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, -45, 6, 0.2, Math.PI - 0.2);
    ctx.stroke();

    // Arm with lasso when aiming
    if (player.isDragging && !player.hasThrown) {
        ctx.fillStyle = player.color;
        ctx.beginPath();
        ctx.ellipse(20, -45, 8, 20, -0.5, 0, Math.PI * 2);
        ctx.fill();

        // Spinning lasso above head
        ctx.save();
        ctx.translate(25, -75);
        ctx.rotate(Date.now() / 60);

        const lassoSize = 15 + player.aimPower * 25;
        ctx.strokeStyle = '#D2B48C';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, lassoSize, 0, Math.PI * 2);
        ctx.stroke();

        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, lassoSize - 5, 0, Math.PI * 2);
        ctx.stroke();

        ctx.restore();
    }

    ctx.restore();

    // Name tag
    ctx.fillStyle = player.lightColor;
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(player.name, x, y + 30);
}

function drawAimIndicator(player, playerKey) {
    if (player.aimPower < 0.05) return;

    const startX = player.x;
    const startY = player.y - 50;

    // Draw pull-back line (slingshot style)
    ctx.save();

    // Slingshot bands
    ctx.strokeStyle = player.lightColor;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';

    const pullX = startX - Math.cos(player.aimAngle) * player.aimPower * MAX_DRAG_DISTANCE;
    const pullY = startY - Math.sin(player.aimAngle) * player.aimPower * MAX_DRAG_DISTANCE;

    ctx.beginPath();
    ctx.moveTo(startX - 10, startY - 10);
    ctx.lineTo(pullX, pullY);
    ctx.lineTo(startX + 10, startY - 10);
    ctx.stroke();

    // Power indicator at pull point
    const powerRadius = 15 + player.aimPower * 15;
    ctx.fillStyle = `rgba(${player.color === '#8B4513' ? '139, 69, 19' : '37, 99, 235'}, 0.3)`;
    ctx.beginPath();
    ctx.arc(pullX, pullY, powerRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = player.lightColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(pullX, pullY, powerRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Power percentage
    ctx.fillStyle = 'white';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(Math.round(player.aimPower * 100) + '%', pullX, pullY);

    ctx.restore();
}

function drawTrajectoryPreview(player, playerKey) {
    if (player.aimPower < MIN_POWER_THRESHOLD) return;

    const startX = player.x;
    const startY = player.y - 50;
    const power = player.aimPower;
    const angle = player.aimAngle;

    const speed = 8 + power * 12;
    let vx = Math.cos(angle) * speed;
    let vy = Math.sin(angle) * speed;
    const gravity = 0.3;

    ctx.save();

    // Draw dotted trajectory
    let x = startX;
    let y = startY;

    ctx.strokeStyle = `rgba(${player.color === '#8B4513' ? '210, 105, 30' : '96, 165, 250'}, 0.6)`;
    ctx.setLineDash([8, 8]);
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.moveTo(x, y);

    for (let t = 0; t < 40; t++) {
        x += vx;
        y += vy;
        vy += gravity;
        vx *= 0.99;
        vy *= 0.99;

        if (y > canvasHeight || x < 0 || x > canvasWidth) break;

        ctx.lineTo(x, y);
    }

    ctx.stroke();

    // Draw dots along path
    ctx.setLineDash([]);
    x = startX;
    y = startY;
    vx = Math.cos(angle) * speed;
    vy = Math.sin(angle) * speed;

    for (let t = 0; t < 40; t += 5) {
        for (let i = 0; i < 5; i++) {
            x += vx;
            y += vy;
            vy += gravity;
            vx *= 0.99;
            vy *= 0.99;
        }

        if (y > canvasHeight || x < 0 || x > canvasWidth) break;

        const alpha = 1 - (t / 40) * 0.7;
        ctx.fillStyle = `rgba(${player.color === '#8B4513' ? '210, 105, 30' : '96, 165, 250'}, ${alpha})`;
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.restore();
}

function drawRopeLasso(lasso, player) {
    if (lasso.state === 'missed') return;

    ctx.save();

    // Draw rope using physics points
    if (lasso.ropePoints.length > 1) {
        // Rope shadow
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        ctx.beginPath();
        ctx.moveTo(lasso.ropePoints[0].x + 3, lasso.ropePoints[0].y + 3);
        for (let i = 1; i < lasso.ropePoints.length; i++) {
            ctx.lineTo(lasso.ropePoints[i].x + 3, lasso.ropePoints[i].y + 3);
        }
        ctx.stroke();

        // Main rope
        ctx.strokeStyle = '#8B7355';
        ctx.lineWidth = 5;

        ctx.beginPath();
        ctx.moveTo(lasso.ropePoints[0].x, lasso.ropePoints[0].y);
        for (let i = 1; i < lasso.ropePoints.length; i++) {
            ctx.lineTo(lasso.ropePoints[i].x, lasso.ropePoints[i].y);
        }
        ctx.stroke();

        // Rope highlight
        ctx.strokeStyle = '#D2B48C';
        ctx.lineWidth = 2;

        ctx.beginPath();
        ctx.moveTo(lasso.ropePoints[0].x, lasso.ropePoints[0].y - 1);
        for (let i = 1; i < lasso.ropePoints.length; i++) {
            ctx.lineTo(lasso.ropePoints[i].x, lasso.ropePoints[i].y - 1);
        }
        ctx.stroke();
    }

    // Lasso loop at the end
    ctx.save();
    ctx.translate(lasso.x, lasso.y);
    ctx.rotate(lasso.rotation);

    // Outer glow
    ctx.shadowColor = player.lightColor;
    ctx.shadowBlur = 10;

    // Lasso ring
    ctx.strokeStyle = '#8B7355';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(0, 0, lasso.radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.shadowBlur = 0;

    // Inner ring
    ctx.strokeStyle = '#D2B48C';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, lasso.radius - 3, 0, Math.PI * 2);
    ctx.stroke();

    // Player color accent
    ctx.strokeStyle = player.lightColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, lasso.radius + 3, 0, Math.PI * 0.5);
    ctx.stroke();

    ctx.restore();
    ctx.restore();
}

function drawParticles() {
    particles.forEach(p => {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.globalAlpha = 1;
}

function drawDustParticles() {
    dustParticles.forEach(p => {
        ctx.globalAlpha = p.life * 0.4;
        ctx.fillStyle = '#D2B48C';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.globalAlpha = 1;
}

// ============ UI HELPERS ============
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
}

function updateScoreStars() {
    const dadStars = '★'.repeat(game.dadScore) + '☆'.repeat(game.maxScore - game.dadScore);
    const sonStars = '★'.repeat(game.sonScore) + '☆'.repeat(game.maxScore - game.sonScore);

    document.getElementById('dad-stars').textContent = dadStars;
    document.getElementById('son-stars').textContent = sonStars;
}

function showCatchEffect(x, y, color) {
    const effect = document.getElementById('catch-effect');
    effect.style.left = x + 'px';
    effect.style.top = y + 'px';
    effect.style.background = `radial-gradient(circle, ${color} 0%, transparent 70%)`;
    effect.classList.remove('hidden');
    effect.classList.remove('active');
    void effect.offsetWidth;
    effect.classList.add('active');

    setTimeout(() => {
        effect.classList.remove('active');
        effect.classList.add('hidden');
    }, 600);
}

function createConfetti() {
    const container = document.getElementById('confetti');
    container.innerHTML = '';

    const colors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7'];

    for (let i = 0; i < 50; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        confetti.style.left = Math.random() * 100 + '%';
        confetti.style.background = colors[Math.floor(Math.random() * colors.length)];
        confetti.style.animationDelay = Math.random() * 2 + 's';
        confetti.style.animationDuration = 2 + Math.random() * 2 + 's';
        container.appendChild(confetti);
    }
}

function vibrate(pattern) {
    if (navigator.vibrate) {
        navigator.vibrate(pattern);
    }
}
