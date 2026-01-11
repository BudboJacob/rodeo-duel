// ============================================
// RODEO DUEL - Father vs Son Lasso Showdown
// ============================================

// Wait for DOM
document.addEventListener('DOMContentLoaded', init);

// Canvas setup
let canvas, ctx;
let canvasWidth = 0;
let canvasHeight = 0;

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
        power: 0,
        isCharging: false,
        chargeStart: 0,
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
        power: 0,
        isCharging: false,
        chargeStart: 0,
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

// Particles for effects
let particles = [];
let dustParticles = [];

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

    // Set actual canvas dimensions
    canvas.width = canvasWidth * window.devicePixelRatio;
    canvas.height = canvasHeight * window.devicePixelRatio;

    // Scale for retina
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    // CSS dimensions
    canvas.style.width = canvasWidth + 'px';
    canvas.style.height = canvasHeight + 'px';

    // Position entities
    positionEntities();
}

function positionEntities() {
    // Players at bottom
    players.dad.x = canvasWidth * 0.2;
    players.dad.y = canvasHeight * 0.85;

    players.son.x = canvasWidth * 0.8;
    players.son.y = canvasHeight * 0.85;

    // Bull in the middle-upper area
    bull.x = canvasWidth * 0.5;
    bull.baseY = canvasHeight * 0.35;
    bull.y = bull.baseY;
}

function setupEventListeners() {
    window.addEventListener('resize', () => {
        setupCanvas();
    });

    // Start button
    document.getElementById('start-btn').addEventListener('click', startGame);

    // Control zones
    const dadZone = document.getElementById('dad-control');
    const sonZone = document.getElementById('son-control');

    // Touch events
    dadZone.addEventListener('touchstart', (e) => { e.preventDefault(); startCharge('dad'); }, { passive: false });
    dadZone.addEventListener('touchend', (e) => { e.preventDefault(); releaseCharge('dad'); }, { passive: false });
    dadZone.addEventListener('touchcancel', (e) => { e.preventDefault(); releaseCharge('dad'); }, { passive: false });

    sonZone.addEventListener('touchstart', (e) => { e.preventDefault(); startCharge('son'); }, { passive: false });
    sonZone.addEventListener('touchend', (e) => { e.preventDefault(); releaseCharge('son'); }, { passive: false });
    sonZone.addEventListener('touchcancel', (e) => { e.preventDefault(); releaseCharge('son'); }, { passive: false });

    // Mouse events for desktop
    dadZone.addEventListener('mousedown', () => startCharge('dad'));
    dadZone.addEventListener('mouseup', () => releaseCharge('dad'));
    dadZone.addEventListener('mouseleave', () => { if (players.dad.isCharging) releaseCharge('dad'); });

    sonZone.addEventListener('mousedown', () => startCharge('son'));
    sonZone.addEventListener('mouseup', () => releaseCharge('son'));
    sonZone.addEventListener('mouseleave', () => { if (players.son.isCharging) releaseCharge('son'); });

    // Other buttons
    document.getElementById('next-round-btn').addEventListener('click', () => {
        showScreen('game-screen');
        setTimeout(() => {
            setupCanvas();
            startRound();
        }, 100);
    });

    document.getElementById('rematch-btn').addEventListener('click', () => {
        resetGame();
        showScreen('game-screen');
        setTimeout(() => {
            setupCanvas();
            startRound();
        }, 100);
    });

    document.getElementById('menu-btn').addEventListener('click', () => {
        resetGame();
        showScreen('title-screen');
    });

    // Tutorial
    document.getElementById('tutorial-ok')?.addEventListener('click', () => {
        document.getElementById('tutorial-overlay').classList.remove('active');
        startCountdown();
    });
}

// ============ GAME FLOW ============
function startGame() {
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

function startRound() {
    // Reset players
    ['dad', 'son'].forEach(key => {
        const p = players[key];
        p.power = 0;
        p.isCharging = false;
        p.lasso = null;
        p.hasThrown = false;
        updatePowerRing(key, 0);
        document.getElementById(`${key}-control`).classList.remove('active');
    });

    // Reset bull
    bull.caught = false;
    bull.caughtBy = null;
    bull.x = canvasWidth / 2;
    bull.y = bull.baseY;
    bull.direction = Math.random() > 0.5 ? 1 : -1;
    bull.speed = 2 + game.round * 0.5; // Gets faster each round
    bull.runAwayTimer = 0;

    // Clear particles
    particles = [];
    dustParticles = [];

    // Update UI
    document.getElementById('round-display').textContent = `ROUND ${game.round}`;
    updateScoreStars();

    // Start countdown
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
            text.offsetHeight; // Trigger reflow
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

    // Award point
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

    // Update displays
    document.getElementById('round-dad-score').textContent = game.dadScore;
    document.getElementById('round-son-score').textContent = game.sonScore;
    updateScoreStars();

    vibrate(200);

    // Check for game winner
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

// ============ CONTROLS ============
function startCharge(playerKey) {
    if (game.state !== 'playing') return;

    const player = players[playerKey];
    if (player.hasThrown) return;

    player.isCharging = true;
    player.chargeStart = Date.now();
    player.power = 0;

    document.getElementById(`${playerKey}-control`).classList.add('active');
    vibrate(30);
}

function releaseCharge(playerKey) {
    const player = players[playerKey];
    if (!player.isCharging) return;

    player.isCharging = false;
    document.getElementById(`${playerKey}-control`).classList.remove('active');

    if (player.hasThrown || game.state !== 'playing') return;

    // Minimum power threshold
    if (player.power < 0.1) {
        player.power = 0;
        updatePowerRing(playerKey, 0);
        return;
    }

    player.hasThrown = true;
    throwLasso(player);
    vibrate(80);
}

function throwLasso(player) {
    const power = player.power;

    player.lasso = {
        x: player.x,
        y: player.y - 50,
        startX: player.x,
        startY: player.y - 50,
        targetX: bull.x,
        targetY: bull.y,
        power: power,
        speed: 10 + power * 8,
        radius: 25 + power * 20,
        rotation: 0,
        progress: 0,
        state: 'flying', // flying, missed, caught
        trail: [],
    };

    // Add throw particles
    for (let i = 0; i < 10; i++) {
        particles.push({
            x: player.x,
            y: player.y - 50,
            vx: (Math.random() - 0.5) * 5,
            vy: (Math.random() - 0.5) * 5,
            life: 1,
            color: player.lightColor,
            size: 3 + Math.random() * 4,
        });
    }
}

function updatePowerRing(playerKey, power) {
    const ring = document.getElementById(`${playerKey}-ring-fill`);
    if (ring) {
        const circumference = 283;
        const offset = circumference * (1 - power);
        ring.style.strokeDashoffset = offset;
    }
}

// ============ GAME LOOP ============
function gameLoop() {
    update();
    render();
    game.animationFrame = requestAnimationFrame(gameLoop);
}

function update() {
    if (game.state !== 'playing' && game.state !== 'countdown') return;

    // Update charging
    ['dad', 'son'].forEach(key => {
        const player = players[key];
        if (player.isCharging && !player.hasThrown) {
            const elapsed = Date.now() - player.chargeStart;
            player.power = Math.min(1, elapsed / 1200);
            updatePowerRing(key, player.power);
        }
    });

    if (game.state !== 'playing') return;

    // Update bull
    if (!bull.caught) {
        // Horizontal movement
        bull.x += bull.speed * bull.direction;

        // Bounce off edges
        const margin = 60;
        if (bull.x > canvasWidth - margin) {
            bull.x = canvasWidth - margin;
            bull.direction = -1;
        } else if (bull.x < margin) {
            bull.x = margin;
            bull.direction = 1;
        }

        // Bobbing animation
        bull.bobOffset += 0.15;
        bull.y = bull.baseY + Math.sin(bull.bobOffset) * 8;

        // Create dust
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

        // Run away timer - end round if both missed
        bull.runAwayTimer++;
        if (bull.runAwayTimer > 300 && players.dad.hasThrown && players.son.hasThrown) {
            endRound();
        }
    }

    // Update lassos
    ['dad', 'son'].forEach(key => {
        const player = players[key];
        if (player.lasso && player.lasso.state === 'flying') {
            updateLasso(player.lasso, player);
        }
    });

    // Update particles
    particles = particles.filter(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.03;
        p.vy += 0.1;
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

function updateLasso(lasso, player) {
    lasso.rotation += 0.4;
    lasso.progress += 0.04 * lasso.speed / 10;

    // Store trail
    lasso.trail.push({ x: lasso.x, y: lasso.y });
    if (lasso.trail.length > 15) lasso.trail.shift();

    if (lasso.progress < 1) {
        // Fly toward target
        const t = easeOutQuad(lasso.progress);
        lasso.x = lasso.startX + (lasso.targetX - lasso.startX) * t;
        lasso.y = lasso.startY + (lasso.targetY - lasso.startY) * t;

        // Arc upward
        const arc = Math.sin(lasso.progress * Math.PI) * 50 * lasso.power;
        lasso.y -= arc;

        // Check collision
        const dist = Math.sqrt(Math.pow(lasso.x - bull.x, 2) + Math.pow(lasso.y - bull.y, 2));
        if (dist < lasso.radius + bull.radius && !bull.caught) {
            bull.caught = true;
            bull.caughtBy = player;
            lasso.state = 'caught';

            // Catch effect
            showCatchEffect(bull.x, bull.y, player.color);

            // Celebration particles
            for (let i = 0; i < 30; i++) {
                const angle = (Math.PI * 2 / 30) * i;
                particles.push({
                    x: bull.x,
                    y: bull.y,
                    vx: Math.cos(angle) * (3 + Math.random() * 5),
                    vy: Math.sin(angle) * (3 + Math.random() * 5),
                    life: 1,
                    color: player.lightColor,
                    size: 4 + Math.random() * 6,
                });
            }

            vibrate(150);
        }
    } else {
        // Missed
        lasso.state = 'missed';
    }
}

function easeOutQuad(t) {
    return t * (2 - t);
}

// ============ RENDERING ============
function render() {
    if (!ctx || canvasWidth === 0) return;

    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    // Draw arena elements
    drawArena();

    // Draw dust particles (behind everything)
    drawDustParticles();

    // Draw bull
    drawBull();

    // Draw players
    drawPlayer(players.dad, true);
    drawPlayer(players.son, false);

    // Draw lassos
    ['dad', 'son'].forEach(key => {
        const player = players[key];
        if (player.lasso) {
            drawLasso(player.lasso, player);
        }
    });

    // Draw particles (on top)
    drawParticles();
}

function drawArena() {
    // Ground line
    const groundY = canvasHeight * 0.6;

    // Fence
    ctx.strokeStyle = '#8B4513';
    ctx.lineWidth = 6;

    // Fence rails
    ctx.beginPath();
    ctx.moveTo(0, groundY - 20);
    ctx.lineTo(canvasWidth, groundY - 20);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, groundY - 50);
    ctx.lineTo(canvasWidth, groundY - 50);
    ctx.stroke();

    // Fence posts
    ctx.fillStyle = '#5D4037';
    for (let x = 30; x < canvasWidth; x += 80) {
        ctx.fillRect(x - 5, groundY - 70, 10, 70);
    }

    // Arena markings
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

    // Direction flip
    if (bull.direction < 0) {
        ctx.scale(-1, 1);
    }

    // Running animation
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

    // Legs (animated)
    ctx.fillStyle = '#3D2106';
    const legOffset = runPhase * 8;

    // Front legs
    ctx.fillRect(15, 20, 8, 25 + legOffset);
    ctx.fillRect(25, 20, 8, 25 - legOffset);

    // Back legs
    ctx.fillRect(-25, 20, 8, 25 - legOffset);
    ctx.fillRect(-15, 20, 8, 25 + legOffset);

    // Tail
    ctx.strokeStyle = '#4A2810';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-40, 0);
    ctx.quadraticCurveTo(-55, 10 + runPhase * 5, -50, 25 + runPhase * 3);
    ctx.stroke();

    // Tail tuft
    ctx.fillStyle = '#3D2106';
    ctx.beginPath();
    ctx.arc(-50, 28 + runPhase * 3, 8, 0, Math.PI * 2);
    ctx.fill();

    // Snort effect when running
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

        // Rope around bull
        ctx.strokeStyle = bull.caughtBy.lightColor;
        ctx.lineWidth = 4;
        ctx.setLineDash([8, 4]);
        ctx.beginPath();
        ctx.arc(x, y, bull.radius + 10, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        // CAUGHT text
        ctx.fillStyle = bull.caughtBy.color;
        ctx.font = 'bold 24px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('CAUGHT!', x, y - 60);

        ctx.restore();
    }

    // Target indicator when playing
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

    // Face toward center
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

    // Hat brim
    ctx.fillStyle = '#5D4037';
    ctx.beginPath();
    ctx.ellipse(0, -65, 30, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Hat top
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

    // Arm with lasso (when charging)
    if (player.isCharging) {
        // Raised arm
        ctx.fillStyle = player.color;
        ctx.beginPath();
        ctx.ellipse(20, -45, 8, 20, -0.5, 0, Math.PI * 2);
        ctx.fill();

        // Spinning lasso above head
        ctx.save();
        ctx.translate(25, -75);
        ctx.rotate(Date.now() / 80);

        const lassoSize = 15 + player.power * 20;
        ctx.strokeStyle = '#D2B48C';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, lassoSize, 0, Math.PI * 2);
        ctx.stroke();

        // Inner loop
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

function drawLasso(lasso, player) {
    if (lasso.state === 'missed') return;

    ctx.save();

    // Rope trail
    if (lasso.trail.length > 1) {
        ctx.strokeStyle = 'rgba(210, 180, 140, 0.5)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(lasso.trail[0].x, lasso.trail[0].y);
        for (let i = 1; i < lasso.trail.length; i++) {
            ctx.lineTo(lasso.trail[i].x, lasso.trail[i].y);
        }
        ctx.stroke();
    }

    // Rope from player to lasso
    ctx.strokeStyle = '#D2B48C';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(player.x + (player === players.dad ? 20 : -20), player.y - 60);
    ctx.lineTo(lasso.x, lasso.y);
    ctx.stroke();

    // Lasso loop
    ctx.save();
    ctx.translate(lasso.x, lasso.y);
    ctx.rotate(lasso.rotation);

    // Outer rope
    ctx.strokeStyle = player.lightColor;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(0, 0, lasso.radius, 0, Math.PI * 2);
    ctx.stroke();

    // Inner rope
    ctx.strokeStyle = '#D2B48C';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, lasso.radius - 4, 0, Math.PI * 2);
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
