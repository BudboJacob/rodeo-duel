// ============================================
// RODEO DUEL - Father vs Son Lasso Showdown
// ============================================

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

// Game State
const game = {
    state: 'title', // title, countdown, playing, roundEnd, victory
    round: 1,
    maxRounds: 3,
    dadScore: 0,
    sonScore: 0,
    winner: null,
    countdownValue: 3,
};

// Players
const players = {
    dad: {
        name: 'Pa',
        emoji: '👨',
        color: '#8B4513',
        lightColor: '#D2691E',
        x: 0,
        y: 0,
        power: 0,
        isCharging: false,
        lasso: null,
        hasThrown: false,
        catchTime: null,
    },
    son: {
        name: 'Junior',
        emoji: '👦',
        color: '#4169E1',
        lightColor: '#6495ED',
        x: 0,
        y: 0,
        power: 0,
        isCharging: false,
        lasso: null,
        hasThrown: false,
        catchTime: null,
    }
};

// Target (the bull/steer they're trying to lasso)
const target = {
    x: 0,
    y: 0,
    radius: 30,
    speed: 2,
    direction: 1,
    emoji: '🐂',
    caught: false,
    caughtBy: null,
};

// Lasso class
class Lasso {
    constructor(player, power) {
        this.player = player;
        this.x = player.x;
        this.y = player.y - 40;
        this.power = power;
        this.speed = 8 + power * 4;
        this.radius = 15 + power * 10;
        this.rotation = 0;
        this.active = true;
        this.extending = true;
        this.maxDistance = 150 + power * 100;
        this.distance = 0;
        this.targetY = player === players.dad ? target.y : target.y;
    }

    update() {
        if (!this.active) return;

        this.rotation += 0.3;

        if (this.extending) {
            // Move toward target area
            const dx = target.x - this.x;
            const dy = (canvas.height * 0.4) - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist > 0) {
                this.x += (dx / dist) * this.speed;
                this.y += (dy / dist) * this.speed;
            }

            this.distance += this.speed;

            if (this.distance >= this.maxDistance) {
                this.extending = false;
            }

            // Check collision with target
            const targetDist = Math.sqrt(
                Math.pow(this.x - target.x, 2) +
                Math.pow(this.y - target.y, 2)
            );

            if (targetDist < this.radius + target.radius && !target.caught) {
                target.caught = true;
                target.caughtBy = this.player;
                this.player.catchTime = Date.now();
                this.active = false;
            }
        } else {
            // Retract
            const dx = this.player.x - this.x;
            const dy = this.player.y - 40 - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist > 10) {
                this.x += (dx / dist) * this.speed;
                this.y += (dy / dist) * this.speed;
            } else {
                this.active = false;
            }
        }
    }

    draw() {
        if (!this.active) return;

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);

        // Rope
        ctx.strokeStyle = '#8B4513';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(this.player.x - this.x, this.player.y - 40 - this.y);
        ctx.stroke();

        // Lasso loop
        ctx.strokeStyle = '#D2691E';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.stroke();

        // Inner rope texture
        ctx.strokeStyle = '#A0522D';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius - 3, 0, Math.PI * 2);
        ctx.stroke();

        ctx.restore();
    }
}

// Resize canvas
function resizeCanvas() {
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    // Position players
    players.dad.x = canvas.width * 0.25;
    players.dad.y = canvas.height * 0.75;

    players.son.x = canvas.width * 0.75;
    players.son.y = canvas.height * 0.75;

    // Position target
    target.x = canvas.width * 0.5;
    target.y = canvas.height * 0.35;
}

// Draw arena
function drawArena() {
    // Sky gradient (already in CSS, but add clouds)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    drawCloud(canvas.width * 0.2, 40, 40);
    drawCloud(canvas.width * 0.7, 60, 30);
    drawCloud(canvas.width * 0.5, 30, 25);

    // Fence posts
    ctx.fillStyle = '#8B4513';
    for (let i = 0; i < canvas.width; i += 80) {
        ctx.fillRect(i + 30, canvas.height * 0.5, 10, 60);
        ctx.fillRect(i + 30, canvas.height * 0.5 - 5, 20, 8);
    }

    // Fence rails
    ctx.strokeStyle = '#A0522D';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(0, canvas.height * 0.55);
    ctx.lineTo(canvas.width, canvas.height * 0.55);
    ctx.moveTo(0, canvas.height * 0.52);
    ctx.lineTo(canvas.width, canvas.height * 0.52);
    ctx.stroke();

    // Arena dust
    ctx.fillStyle = 'rgba(210, 180, 140, 0.3)';
    for (let i = 0; i < 20; i++) {
        const x = Math.random() * canvas.width;
        const y = canvas.height * 0.6 + Math.random() * canvas.height * 0.3;
        const size = Math.random() * 20 + 5;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
    }
}

function drawCloud(x, y, size) {
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.arc(x + size * 0.8, y - size * 0.2, size * 0.7, 0, Math.PI * 2);
    ctx.arc(x + size * 1.4, y, size * 0.6, 0, Math.PI * 2);
    ctx.fill();
}

// Draw player
function drawPlayer(player, isLeft) {
    const x = player.x;
    const y = player.y;

    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.beginPath();
    ctx.ellipse(x, y + 10, 30, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body
    ctx.fillStyle = player.color;
    ctx.beginPath();
    ctx.ellipse(x, y - 20, 25, 35, 0, 0, Math.PI * 2);
    ctx.fill();

    // Hat
    ctx.fillStyle = '#5D4037';
    ctx.beginPath();
    ctx.ellipse(x, y - 60, 35, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(x - 15, y - 80, 30, 20);
    ctx.beginPath();
    ctx.arc(x, y - 80, 15, Math.PI, 0);
    ctx.fill();

    // Face
    ctx.font = '35px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(player.emoji, x, y - 45);

    // Charging indicator
    if (player.isCharging) {
        // Spinning lasso above head
        ctx.save();
        ctx.translate(x + (isLeft ? 30 : -30), y - 70);
        ctx.rotate(Date.now() / 100);

        ctx.strokeStyle = '#D2691E';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, 15 + player.power * 15, 0, Math.PI * 2);
        ctx.stroke();

        ctx.restore();
    }

    // Name tag
    ctx.fillStyle = player.lightColor;
    ctx.font = 'bold 14px Arial';
    ctx.fillText(player.name, x, y + 30);
}

// Draw target
function drawTarget() {
    const x = target.x;
    const y = target.y;

    // Movement
    if (!target.caught && game.state === 'playing') {
        target.x += target.speed * target.direction;
        if (target.x > canvas.width - 100 || target.x < 100) {
            target.direction *= -1;
        }
    }

    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.ellipse(x, y + 25, 35, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    // Bull body
    ctx.fillStyle = '#4A2810';
    ctx.beginPath();
    ctx.ellipse(x, y, 40, 25, 0, 0, Math.PI * 2);
    ctx.fill();

    // Bull emoji
    ctx.font = '50px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(target.emoji, x, y);

    // Dust trail
    if (!target.caught && game.state === 'playing') {
        ctx.fillStyle = 'rgba(210, 180, 140, 0.5)';
        for (let i = 0; i < 5; i++) {
            const dustX = x - target.direction * (20 + i * 15) + Math.random() * 10;
            const dustY = y + 15 + Math.random() * 10;
            ctx.beginPath();
            ctx.arc(dustX, dustY, 5 + Math.random() * 5, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // Caught indicator
    if (target.caught) {
        ctx.strokeStyle = target.caughtBy.color;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(x, y, 50, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = target.caughtBy.color;
        ctx.font = 'bold 16px Arial';
        ctx.fillText('CAUGHT!', x, y - 50);
    }
}

// Game loop
function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    drawArena();
    drawTarget();
    drawPlayer(players.dad, true);
    drawPlayer(players.son, false);

    // Update and draw lassos
    if (players.dad.lasso) {
        players.dad.lasso.update();
        players.dad.lasso.draw();
    }
    if (players.son.lasso) {
        players.son.lasso.update();
        players.son.lasso.draw();
    }

    // Check round end conditions
    if (game.state === 'playing') {
        // Both thrown and lassos inactive
        const dadDone = players.dad.hasThrown && (!players.dad.lasso || !players.dad.lasso.active);
        const sonDone = players.son.hasThrown && (!players.son.lasso || !players.son.lasso.active);

        if ((dadDone && sonDone) || target.caught) {
            setTimeout(() => endRound(), 500);
            game.state = 'roundEnd';
        }
    }

    // Update power meters
    updatePowerMeter('dad');
    updatePowerMeter('son');

    requestAnimationFrame(gameLoop);
}

function updatePowerMeter(playerKey) {
    const player = players[playerKey];
    const meter = document.querySelector(`#${playerKey}-power .power-fill`);
    if (meter) {
        meter.style.width = (player.power * 100) + '%';
    }
}

// Controls
function setupControls() {
    const dadZone = document.getElementById('dad-control');
    const sonZone = document.getElementById('son-control');

    // Touch events
    dadZone.addEventListener('touchstart', (e) => { e.preventDefault(); startCharge('dad'); });
    dadZone.addEventListener('touchend', (e) => { e.preventDefault(); releaseCharge('dad'); });
    dadZone.addEventListener('mousedown', () => startCharge('dad'));
    dadZone.addEventListener('mouseup', () => releaseCharge('dad'));
    dadZone.addEventListener('mouseleave', () => { if (players.dad.isCharging) releaseCharge('dad'); });

    sonZone.addEventListener('touchstart', (e) => { e.preventDefault(); startCharge('son'); });
    sonZone.addEventListener('touchend', (e) => { e.preventDefault(); releaseCharge('son'); });
    sonZone.addEventListener('mousedown', () => startCharge('son'));
    sonZone.addEventListener('mouseup', () => releaseCharge('son'));
    sonZone.addEventListener('mouseleave', () => { if (players.son.isCharging) releaseCharge('son'); });
}

function startCharge(playerKey) {
    if (game.state !== 'playing') return;
    const player = players[playerKey];
    if (player.hasThrown) return;

    player.isCharging = true;
    player.chargeStart = Date.now();

    document.getElementById(`${playerKey}-control`).classList.add('active');

    // Charge loop
    const chargeLoop = () => {
        if (!player.isCharging) return;
        const elapsed = Date.now() - player.chargeStart;
        player.power = Math.min(1, elapsed / 1500); // 1.5 seconds to full power
        requestAnimationFrame(chargeLoop);
    };
    chargeLoop();
}

function releaseCharge(playerKey) {
    const player = players[playerKey];
    if (!player.isCharging || player.hasThrown) return;

    player.isCharging = false;
    player.hasThrown = true;

    document.getElementById(`${playerKey}-control`).classList.remove('active');

    // Create lasso
    player.lasso = new Lasso(player, player.power);
}

// Round management
function startRound() {
    // Reset players
    Object.values(players).forEach(player => {
        player.power = 0;
        player.isCharging = false;
        player.lasso = null;
        player.hasThrown = false;
        player.catchTime = null;
    });

    // Reset target
    target.caught = false;
    target.caughtBy = null;
    target.x = canvas.width / 2;
    target.direction = Math.random() > 0.5 ? 1 : -1;

    // Update UI
    document.getElementById('round-display').textContent = `Round ${game.round}`;

    // Countdown
    game.state = 'countdown';
    game.countdownValue = 3;
    showCountdown();
}

function showCountdown() {
    const overlay = document.getElementById('countdown-overlay');
    const text = document.getElementById('countdown-text');

    overlay.classList.add('active');
    text.textContent = game.countdownValue;

    if (game.countdownValue > 0) {
        game.countdownValue--;
        setTimeout(showCountdown, 800);
    } else {
        text.textContent = 'GO!';
        setTimeout(() => {
            overlay.classList.remove('active');
            game.state = 'playing';
        }, 500);
    }
}

function endRound() {
    let roundWinner = null;

    if (target.caught) {
        roundWinner = target.caughtBy === players.dad ? 'dad' : 'son';
    }
    // If no one caught it, it's a draw (no points)

    if (roundWinner === 'dad') {
        game.dadScore++;
        document.getElementById('round-winner').textContent = "👨 Pa catches the bull!";
    } else if (roundWinner === 'son') {
        game.sonScore++;
        document.getElementById('round-winner').textContent = "👦 Junior catches the bull!";
    } else {
        document.getElementById('round-winner').textContent = "🐂 The bull got away!";
    }

    // Update scores
    document.getElementById('dad-score').textContent = game.dadScore;
    document.getElementById('son-score').textContent = game.sonScore;
    document.getElementById('round-dad-score').textContent = game.dadScore;
    document.getElementById('round-son-score').textContent = game.sonScore;

    // Check for winner
    if (game.dadScore >= game.maxRounds) {
        game.winner = 'dad';
        showVictory();
    } else if (game.sonScore >= game.maxRounds) {
        game.winner = 'son';
        showVictory();
    } else {
        game.round++;
        showScreen('round-screen');
    }
}

function showVictory() {
    const isDad = game.winner === 'dad';

    document.getElementById('winner-text').textContent = isDad ? '🏆 PA WINS! 🏆' : '🏆 JUNIOR WINS! 🏆';
    document.getElementById('winner-icon').textContent = isDad ? '👨' : '👦';
    document.getElementById('winner-subtitle').textContent = isDad ?
        "The old man's still got it!" :
        "The student becomes the master!";
    document.getElementById('final-dad').textContent = game.dadScore;
    document.getElementById('final-son').textContent = game.sonScore;

    showScreen('victory-screen');
}

// Screen management
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
}

// Button handlers
document.getElementById('start-btn').addEventListener('click', () => {
    resetGame();
    showScreen('game-screen');
    startRound();
});

document.getElementById('next-round-btn').addEventListener('click', () => {
    showScreen('game-screen');
    startRound();
});

document.getElementById('rematch-btn').addEventListener('click', () => {
    resetGame();
    showScreen('game-screen');
    startRound();
});

document.getElementById('menu-btn').addEventListener('click', () => {
    resetGame();
    showScreen('title-screen');
});

function resetGame() {
    game.round = 1;
    game.dadScore = 0;
    game.sonScore = 0;
    game.winner = null;
    document.getElementById('dad-score').textContent = '0';
    document.getElementById('son-score').textContent = '0';
}

// Initialize
window.addEventListener('resize', resizeCanvas);
resizeCanvas();
setupControls();
gameLoop();
