// --- Flappy Bird initialization (guarded) ---
const flappyCanvas = document.getElementById('gameCanvas') || document.getElementById('flappyCanvas');
if (flappyCanvas) {
    const canvas = flappyCanvas;
    const ctx = canvas.getContext('2d');
    const scoreDisplay = document.getElementById('scoreDisplay') || document.getElementById('flappyScore');
    const bestScoreDisplay = document.getElementById('bestScore') || document.getElementById('flappyBest');
    const gameOverDiv = document.getElementById('gameOver') || document.getElementById('flappyGameOver');
    const finalScoreSpan = document.getElementById('finalScore') || document.getElementById('flappyFinalScore');

    // Ensure numeric bestScore
    let gameState = 'playing';
    let score = 0;
    let bestScore = parseInt(localStorage.getItem('flappyBestScore') || 0, 10) || 0;
    if (bestScoreDisplay) bestScoreDisplay.textContent = bestScore;

    // Bird object (create after canvas known)
    const bird = {
        x: 80,
        y: canvas.height / 2,
        width: 30,
        height: 30,
        velocity: 0,
        gravity: 0.5,
        jumpPower: -10,
        color: '#FFD700'
    };

    // Flappy image assets (sprite with 3 frames: left-to-right)
    const flappySprite = new Image();
    flappySprite.src = 'Images/flappy.png';
    const flappyBg = new Image(); flappyBg.src = 'Images/flappy-bg.png';
    const flappyGroundImg = new Image(); flappyGroundImg.src = 'Images/flappy-ground.png';
    const pipeImg = new Image(); pipeImg.src = 'Images/pipe.png';
    // --- Preloader helper (collect assets declared in this block) ---
    // We'll push known images into a list; a global waitForAssets() promise will resolve when all loaded.
    const _assetImages = [flappySprite, flappyBg, flappyGroundImg, pipeImg];
    let flappyFrame = 0;
    const flappyFrameCount = 3;
    let flappyGroundOffset = 0;
    let flappyBgOffset = 0;
    // scale multiplier for bird drawing (adjustable)
    let flappyScale = 1.6;

    // Pipes array
    let pipes = [];
    const pipeWidth = 60;
    const pipeGap = 180;
    let frameCount = 0;

    // Drawing and game functions (kept similar to your original)
    function drawBird() {
        // bird sprite: pick frame based on frameCount for simple wing animation
        // (background is drawn in drawBackground; do not draw flappyBg here to avoid covering pipes)
    if (flappySprite.complete && flappySprite.naturalWidth) {
            // sprite assumed to be horizontal strip of 3 frames
            const sw = flappySprite.naturalWidth / flappyFrameCount;
            const sh = flappySprite.naturalHeight;
            flappyFrame = Math.floor(frameCount / 6) % flappyFrameCount;
            ctx.drawImage(flappySprite, flappyFrame * sw, 0, sw, sh,
                          bird.x, bird.y, bird.width * flappyScale, bird.height * flappyScale);
        } else {
            // fallback circle if image not loaded
            ctx.fillStyle = bird.color;
            ctx.beginPath();
            ctx.arc(bird.x + bird.width / 2, bird.y + bird.height / 2, bird.width / 2, 0, Math.PI * 2);
            ctx.fill();
        }
        // draw pipes after bird so pipes appear behind if needed
        // ground should be drawn after pipes so it appears in front of lower part of bird
        // ground drawing is deferred to end of frame in gameLoop by drawing here as well
        
        // drawGround handled in gameLoop for correct layering
    }

    function drawPipe(pipe) {
        // If a pipe image was provided, draw it (top and bottom). Otherwise fall back to simple rectangles.
        if (pipeImg.complete && pipeImg.naturalWidth) {
            // If we've computed trimmed content bounds for the pipe image, use them to avoid visual padding
            if (pipe._trim && pipe._trim.height > 0) {
                const srcY = pipe._trim.top;
                const srcH = pipe._trim.height;
                // Top pipe: draw trimmed content flipped vertically so it points downward
                ctx.save();
                    ctx.translate(pipe.x, pipe.top);
                    ctx.scale(1, -1);
                    ctx.drawImage(pipeImg, 0, srcY, pipeImg.naturalWidth, srcH,
                                  0, 0, pipeWidth, pipe.top);
                ctx.restore();
                // Bottom pipe: draw trimmed content normally at pipe.bottom
                ctx.drawImage(pipeImg, 0, srcY, pipeImg.naturalWidth, srcH,
                              pipe.x, pipe.bottom, pipeWidth, canvas.height - pipe.bottom);
            } else {
                // fallback - flip the top image, draw bottom normally
                ctx.save();
                    ctx.translate(pipe.x, pipe.top);
                    ctx.scale(1, -1);
                    ctx.drawImage(pipeImg, 0, 0, pipeImg.naturalWidth, pipeImg.naturalHeight,
                                  0, 0, pipeWidth, pipe.top);
                ctx.restore();
                ctx.drawImage(pipeImg, 0, 0, pipeImg.naturalWidth, pipeImg.naturalHeight,
                              pipe.x, pipe.bottom, pipeWidth, canvas.height - pipe.bottom);
            }
        } else {
            // Top pipe (fallback)
            ctx.fillStyle = '#228B22';
            ctx.fillRect(pipe.x, 0, pipeWidth, pipe.top);
            ctx.strokeStyle = '#006400';
            ctx.lineWidth = 3;
            ctx.strokeRect(pipe.x, 0, pipeWidth, pipe.top);

            // Bottom pipe
            ctx.fillStyle = '#228B22';
            ctx.fillRect(pipe.x, pipe.bottom, pipeWidth, canvas.height - pipe.bottom);
            ctx.strokeRect(pipe.x, pipe.bottom, pipeWidth, canvas.height - pipe.bottom);

            // Pipe caps
            ctx.fillStyle = '#32CD32';
            ctx.fillRect(pipe.x - 5, pipe.top - 20, pipeWidth + 10, 20);
            ctx.fillRect(pipe.x - 5, pipe.bottom, pipeWidth + 10, 20);
        }
    }

    // Analyze an Image for non-transparent vertical bounds (returns {top,bottom,height})
    function computeImageVerticalTrim(img) {
        try {
            const w = img.naturalWidth;
            const h = img.naturalHeight;
            if (!w || !h) return null;
            const tmp = document.createElement('canvas');
            tmp.width = w; tmp.height = h;
            const tctx = tmp.getContext('2d');
            tctx.drawImage(img, 0, 0);
            const data = tctx.getImageData(0, 0, w, h).data;
            let top = -1, bottom = -1;
            for (let y = 0; y < h; y++) {
                for (let x = 0; x < w; x++) {
                    const alpha = data[(y * w + x) * 4 + 3];
                    if (alpha !== 0) { top = y; break; }
                }
                if (top !== -1) break;
            }
            for (let y = h - 1; y >= 0; y--) {
                for (let x = 0; x < w; x++) {
                    const alpha = data[(y * w + x) * 4 + 3];
                    if (alpha !== 0) { bottom = y; break; }
                }
                if (bottom !== -1) break;
            }
            if (top === -1 || bottom === -1) return null;
            return { top: top, bottom: bottom, height: bottom - top + 1 };
        } catch (e) {
            return null;
        }
    }

    // when pipe image loads, compute trim and attach to newly created pipes via a cached value
    pipeImg.addEventListener('load', () => {
        const trim = computeImageVerticalTrim(pipeImg);
        // store globally for later per-pipe use
        pipeImg._trim = trim;
        // apply to existing pipe objects so visuals align immediately
        if (trim) {
            pipes.forEach(p => { p._trim = trim; });
        }
    });

    // cactusImg load handler will be attached after cactusImg is declared further below

    function createPipe() {
        const pipeHeight = Math.random() * (canvas.height - pipeGap - 100) + 50;
        const newPipe = { x: canvas.width, top: pipeHeight, bottom: pipeHeight + pipeGap, passed: false };
        if (pipeImg && pipeImg._trim) newPipe._trim = pipeImg._trim;
        pipes.push(newPipe);
    }

    function updateBird() {
        bird.velocity += bird.gravity;
        bird.y += bird.velocity;

        // Keep bird in bounds (respect ground image height so bird dies slightly below visible ground)
        if (bird.y < 0) bird.y = 0;
        const groundHeight = (flappyGroundImg && flappyGroundImg.naturalHeight) ? flappyGroundImg.naturalHeight : 24;
        const groundTop = canvas.height - groundHeight;
        if (bird.y + bird.height > groundTop + 6) {
            // sink slightly into the ground then die
            bird.y = groundTop - bird.height + 6;
            gameOver();
        }
    }

    function updatePipes() {
        if (frameCount % 90 === 0) createPipe();
        pipes.forEach((pipe, index) => {
            pipe.x -= 3;
            if (!pipe.passed && pipe.x + pipeWidth < bird.x) {
                pipe.passed = true;
                score++;
                if (scoreDisplay) scoreDisplay.textContent = score;
            }
            if (pipe.x + pipeWidth < 0) pipes.splice(index, 1);
        });
    }

    function checkCollisions() {
        pipes.forEach(pipe => {
            if (bird.x + bird.width > pipe.x && bird.x < pipe.x + pipeWidth && bird.y < pipe.top) gameOver();
            if (bird.x + bird.width > pipe.x && bird.x < pipe.x + pipeWidth && bird.y + bird.height > pipe.bottom) gameOver();
        });
    }

    function gameOver() {
        if (gameState === 'gameOver') return;
        gameState = 'gameOver';
        if (score > bestScore) {
            bestScore = score;
            localStorage.setItem('flappyBestScore', bestScore);
            if (bestScoreDisplay) bestScoreDisplay.textContent = bestScore;
        }
        if (finalScoreSpan) finalScoreSpan.textContent = score;
        if (gameOverDiv) gameOverDiv.style.display = 'block';
    }

    function restartGame() {
        gameState = 'playing';
        score = 0;
        if (scoreDisplay) scoreDisplay.textContent = score;
        bird.y = canvas.height / 2;
        bird.velocity = 0;
        pipes = [];
        frameCount = 0;
        if (gameOverDiv) gameOverDiv.style.display = 'none';
    }

    // expose flappy controls to global scope so HTML buttons work
    window.restartFlappy = restartGame;
    window.startFlappy = restartGame;

    function jump() {
        if (gameState === 'playing') bird.velocity = bird.jumpPower;
    }

    function drawBackground() {
        // If flappy background image is available, tile it horizontally and scroll slowly for parallax
        if (flappyBg.complete && flappyBg.naturalWidth) {
            const bw = flappyBg.naturalWidth;
            // move slower than pipes/ground to create parallax
            if (gameState === 'playing') flappyBgOffset = (flappyBgOffset + 1.2) % bw;
            const startX = - (flappyBgOffset % bw + bw) % bw;
            for (let bx = startX; bx < canvas.width; bx += bw) {
                // stretch bg to canvas height to avoid vertical tiling artifacts
                ctx.drawImage(flappyBg, bx, 0, bw, canvas.height);
            }
        } else {
            // fallback gradient and soft clouds
            const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
            gradient.addColorStop(0, '#87CEEB');
            gradient.addColorStop(0.7, '#98FB98');
            gradient.addColorStop(1, '#90EE90');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            for (let i = 0; i < 5; i++) {
                const x = (frameCount / 2 + i * 120) % (canvas.width + 60) - 30;
                const y = 50 + i * 30;
                ctx.beginPath();
                ctx.arc(x, y, 20, 0, Math.PI * 2);
                ctx.arc(x + 25, y, 30, 0, Math.PI * 2);
                ctx.arc(x + 50, y, 20, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    function gameLoop() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawBackground();
        if (gameState === 'playing') {
            updateBird();
            updatePipes();
            checkCollisions();
            frameCount++;
        }
        // draw pipes behind bird
        pipes.forEach(drawPipe);
        // draw bird on top of pipes
        drawBird();
        // draw ground last so it appears above lower part of bird (gives sense of depth)
        if (flappyGroundImg.complete && flappyGroundImg.naturalWidth) {
            const gw = flappyGroundImg.naturalWidth;
            const gh = flappyGroundImg.naturalHeight;
            const gy = canvas.height - gh;
            // increment offset smoothly by a ground speed (match pipe speed ~3)
            if (gameState === 'playing') flappyGroundOffset = (flappyGroundOffset + 3) % gw;
            const startX = - (flappyGroundOffset % gw + gw) % gw;
            for (let gx = startX; gx < canvas.width; gx += gw) {
                ctx.drawImage(flappyGroundImg, gx, gy);
            }
        }
        requestAnimationFrame(gameLoop);
    }

    // Event listeners (guarded)
    canvas.addEventListener('click', jump);
    document.addEventListener('keydown', (e) => { if (e.code === 'Space') { e.preventDefault(); jump(); } });
    window.addEventListener('keydown', (e) => { if (e.keyCode === 32 && e.target === document.body) e.preventDefault(); });

    // Start flappy loop and initial pipe
    createPipe();
    gameLoop();
}

// Global preloader: collects top-level game images (dino images are declared later) and waits for them
let _allAssets = [];
function _registerAssets(list) { if (!Array.isArray(list)) return; _allAssets = _allAssets.concat(list); }
// register flappy assets already collected (if any)
_registerAssets(typeof _assetImages !== 'undefined' ? _assetImages : []);

function waitForAssets(timeoutMs = 5000) {
    // Filter only Image objects
    const imgs = _allAssets.filter(i => i && i instanceof Image);
    if (!imgs.length) return Promise.resolve();
    return new Promise((resolve) => {
        let remaining = imgs.length;
        let done = false;
        const checkDone = () => { if (done) return; if (--remaining <= 0) { done = true; resolve(); } };
        imgs.forEach(img => {
            if (img.complete && (img.naturalWidth || img.naturalHeight)) { checkDone(); return; }
            img.addEventListener('load', checkDone);
            img.addEventListener('error', checkDone);
        });
        // fallback timeout
        setTimeout(() => { if (!done) { done = true; resolve(); } }, timeoutMs);
    });
}


//* Dino Game
// Utility for switching visible games
function showGame(game) {
    const flappyEl = document.getElementById('flappy-game-container');
    const dinoEl = document.getElementById('dino-game-container');
    const geoEl = document.getElementById('geometry-game-container');
    const hub = document.querySelector('.games-section');
    if (flappyEl) flappyEl.style.display = (game === 'flappy') ? 'block' : 'none';
    if (dinoEl) dinoEl.style.display = (game === 'dino') ? 'block' : 'none';
    if (geoEl) geoEl.style.display = (game === 'geometry') ? 'block' : 'none';
    if (hub) hub.style.display = (game ? 'none' : 'block');
}

function closeGame(game) {
  showGame(); // go back to hub menu
}

if (document.getElementById('flappy-card')) {
  document.getElementById('flappy-card').onclick = function () { showGame('flappy'); startFlappy(); };
}

// Dino Launch
if (document.getElementById('dino-card')) {
  document.getElementById('dino-card').onclick = function () { showGame('dino'); startDino(); };
}

// Geometry Dash Launch (Just opens placeholder)
if (document.getElementById('geometry-card')) {
  document.getElementById('geometry-card').onclick = function () { showGame('geometry'); };
}

// ======= Flappy Bird LOGIC HERE =======
// You should move your original Flappy Bird JS here
// Just make sure your Flappy Bird canvas uses id="flappyCanvas",
// and your score/over elements use flappyScore, flappyBest, flappyFinalScore, flappyGameOver

function startFlappy() {
  // Add your Flappy Bird start/init logic here (if needed)
  // You might want to reset values and show/hide elements
  // This function is called every time the user opens Flappy Bird from the UI
}

// ======= Chrome Dino Game =======
let dinoCanvas, dinoCtx, dinoGameInterval, dinoGameActive, dinoScore, dinoBestScore = 0;
let distanceTraveled = 0; // pixels travelled used for score instead of direct feedback
// small visual offset so sprites sit flush with ground (positive => move down)
const visualGroundOffset = 21;
const dinoGravity = 0.7, dinoJump = -12;
let groundY = 0; // will be set to canvas based ground
let dino, cacti, groundOffset = 0; // use groundOffset (additive) for scrolling
let dinoFrameCount = 0;
let nextCactusCountdown = 0;
const cactusSpawnMin = 48; // min frames between spawns (~0.8s)
const cactusSpawnMax = 120; // max frames between spawns (~2s)

// Dino image assets
const dinoRun0 = new Image(); dinoRun0.src = 'Images/dino-run-0.png';
const dinoRun1 = new Image(); dinoRun1.src = 'Images/dino-run-1.png';
const dinoStationary = new Image(); dinoStationary.src = 'Images/dino-stationary.png';
const dinoLose = new Image(); dinoLose.src = 'Images/dino-lose.png';
const dinoGroundImg = new Image(); dinoGroundImg.src = 'Images/dino-ground.png';
const cactusImg = new Image(); cactusImg.src = 'Images/cactus.png';
// compute trim when cactus image finishes loading
cactusImg.addEventListener('load', () => {
    try {
        const trim = computeImageVerticalTrim(cactusImg);
        cactusImg._trim = trim;
        console.log('cactusImg loaded', { w: cactusImg.naturalWidth, h: cactusImg.naturalHeight, trim });
    } catch (e) { /* ignore */ }
});

// Debug overlay removed for production
let dinoDebug = false;
// register these images with the global preloader list
try { _registerAssets([dinoRun0, dinoRun1, dinoStationary, dinoLose, dinoGroundImg, cactusImg]); } catch (e) { /* ignore if preloader not defined yet */ }
let dinoDead = false;

// compute trim for the ground image so we use the visible ground height (avoids visual offsets)
dinoGroundImg.addEventListener('load', () => {
    try {
        const trim = computeImageVerticalTrim(dinoGroundImg);
        dinoGroundImg._trim = trim;
        console.log('dinoGroundImg loaded', { w: dinoGroundImg.naturalWidth, h: dinoGroundImg.naturalHeight, trim });
    } catch (e) { /* ignore */ }
});

async function startDino() {
    // ensure assets loaded first to avoid sprite/ground jumps
    await waitForAssets();
    dinoCanvas = document.getElementById('dinoCanvas');
    dinoCtx = dinoCanvas.getContext('2d');
    dinoScore = 0;
    distanceTraveled = 0;
    // compute ground top (y coordinate where ground image begins) so layout scales
    const groundImgH = (dinoGroundImg && dinoGroundImg._trim && dinoGroundImg._trim.height) ? dinoGroundImg._trim.height : ((dinoGroundImg && dinoGroundImg.naturalHeight) ? dinoGroundImg.naturalHeight : 28);
    groundY = dinoCanvas.height - groundImgH; // ground top Y
    // sprite is 5x5 blocks at scale 2 (block size 6), approx width = 5*6*2 = 60, height = 5*6*2 = 60
    dino = { x: 50, y: 0, w: 60, h: 60, vy: 0, jumping: false, legFrame: 0 };
    dino.y = groundY - dino.h + visualGroundOffset;
    dinoVelY = 0;
    cacti = [];
    groundOffset = 0;
    dinoFrameCount = 0;
    // random first spawn so the first cactus isn't immediate and spacing varies
    nextCactusCountdown = Math.floor(Math.random() * (cactusSpawnMax - cactusSpawnMin)) + cactusSpawnMin;
    dinoDead = false;
    dino.legFrame = 0;
    dinoGameActive = true;
    document.getElementById('dinoGameOver').style.display = 'none';
    dinoCanvas.focus();
    // attach input handlers for this run (store references for removal)
    const dinoJumpHandler = function() {
        // Only allow jumping when on ground (prevents double-jump)
        if (!dinoGameActive) return;
        if (dino.y + dino.h >= groundY + visualGroundOffset - 1) {
            dino.vy = dinoJump;
            dino.jumping = true;
        }
    };

    // keyboard
    const keyHandler = function(e){ if ((e.code === 'Space' || e.keyCode === 32) ) { e.preventDefault(); dinoJumpHandler(); } };
    // mouse/tap on canvas
    const mouseHandler = function(e){ dinoJumpHandler(); };
    // touch support
    const touchHandler = function(e){ e.preventDefault(); dinoJumpHandler(); };

    // register handlers (avoid duplicating if already attached)
    if (!dinoCanvas._dinoKeyHandler) document.addEventListener('keydown', keyHandler);
    if (!dinoCanvas._dinoMouseHandler) dinoCanvas.addEventListener('mousedown', mouseHandler);
    if (!dinoCanvas._dinoTouchHandler) dinoCanvas.addEventListener('touchstart', touchHandler, {passive:false});

    // store handlers so we can remove them on stop
    dinoCanvas._dinoKeyHandler = keyHandler;
    dinoCanvas._dinoMouseHandler = mouseHandler;
    dinoCanvas._dinoTouchHandler = touchHandler;
    dinoGameInterval = setInterval(dinoGameLoop, 1000/60);
    document.getElementById('dinoScore').innerText = dinoScore;
    // load best from localStorage
    dinoBestScore = parseInt(localStorage.getItem('dinoBestScore') || '0', 10) || 0;
    document.getElementById('dinoBest').innerText = dinoBestScore;
}

function stopDino() {
    dinoGameActive = false;
    clearInterval(dinoGameInterval);
    try {
        if (dinoCanvas && dinoCanvas._dinoKeyHandler) { document.removeEventListener('keydown', dinoCanvas._dinoKeyHandler); delete dinoCanvas._dinoKeyHandler; }
        if (dinoCanvas && dinoCanvas._dinoMouseHandler) { dinoCanvas.removeEventListener('mousedown', dinoCanvas._dinoMouseHandler); delete dinoCanvas._dinoMouseHandler; }
        if (dinoCanvas && dinoCanvas._dinoTouchHandler) { dinoCanvas.removeEventListener('touchstart', dinoCanvas._dinoTouchHandler); delete dinoCanvas._dinoTouchHandler; }
    } catch (e) { /* ignore */ }
}

function dinoGameLoop() {
    // game speed increases slowly with distance traveled (avoid immediate feedback loop)
    const baseSpeed = 8 + Math.floor(distanceTraveled / 1000);

    // Move ground (visual scroll should go left as cacti move left)
    groundOffset = (groundOffset + baseSpeed);

    // Move cacti
    for (let i = 0; i < cacti.length; i++) {
        cacti[i].x -= baseSpeed;
    }

    // Spawn logic using countdown to avoid deterministic spacing
    dinoFrameCount++;
    if (nextCactusCountdown <= 0) {
        const variant = Math.random();
        if (variant < 0.5) {
            // single tall cactus
            cacti.push({ x: dinoCanvas.width + 40, w: 16 + Math.floor(Math.random() * 6), h: 36, type: 'single' });
            // cooldown
            nextCactusCountdown = Math.floor(Math.random() * (cactusSpawnMax - cactusSpawnMin)) + cactusSpawnMin;
        } else if (variant < 0.7) {
            // double cactus
            cacti.push({ x: dinoCanvas.width + 40, w: 14 + Math.floor(Math.random() * 6), h: 36, type: 'double' });
            // sometimes add a smaller one after a short offset (cluster), but not too often
            if (Math.random() < 0.25) {
                cacti.push({ x: dinoCanvas.width + 140, w: 12 + Math.floor(Math.random() * 6), h: 32, type: 'single' });
            }
            nextCactusCountdown = Math.floor(Math.random() * (cactusSpawnMax - cactusSpawnMin)) + cactusSpawnMin + 20;
        } else {
            // low/wide bush
            cacti.push({ x: dinoCanvas.width + 40, w: 24 + Math.floor(Math.random() * 12), h: 24, type: 'low' });
            nextCactusCountdown = Math.floor(Math.random() * (cactusSpawnMax - cactusSpawnMin)) + cactusSpawnMin - 10;
        }
    // choose next spawn based on desired pixel gap so spacing scales with speed
    // keep min gap reasonable and not too aggressive
    const desiredGapPixels = 260 + Math.random() * 140; // ~260-400 px gap
    nextCactusCountdown = Math.max(30, Math.floor(desiredGapPixels / Math.max(1, (8 + Math.floor(distanceTraveled / 1000)))));
    } else {
        nextCactusCountdown--;
    }

    // Remove passed cactus (no longer increment score per cactus)
    if (cacti.length && cacti[0].x < -120) {
        cacti.shift();
    }

    // Update distance traveled and compute score from distance (stable growth)
    distanceTraveled += baseSpeed;
    const newDinoScore = Math.floor(distanceTraveled / 10);
    if (newDinoScore !== dinoScore) {
        dinoScore = newDinoScore;
        const scoreEl = document.getElementById('dinoScore'); if (scoreEl) scoreEl.innerText = dinoScore;
    }

    // Dino physics
    dino.y += dino.vy;
    dino.vy += dinoGravity;

    // Floor collision (respect visual offset so dino doesn't sink behind ground)
    if (dino.y + dino.h >= groundY + visualGroundOffset) {
        dino.y = groundY - dino.h + visualGroundOffset;
        dino.vy = 0;
        dino.jumping = false;
    }

    // Collision detection (AABB) with a small hitbox padding for fairness
    const hitPadding = 6;
    const dx = dino.x + hitPadding;
    const dy = dino.y + hitPadding;
    const dw = dino.w - hitPadding * 2;
    const dh = dino.h - hitPadding * 1.2;
    for (let cactus of cacti) {
        const cx = cactus.x;
        const cw = cactus.w;
        // compute destination height from cactus image aspect (preserve base anchor)
        let ch = cactus.h || 36;
        if (cactusImg && cactusImg.complete && cactusImg.naturalWidth) {
            const trim = cactusImg._trim;
            const srcH = (trim && trim.height) ? trim.height : cactusImg.naturalHeight;
            ch = Math.max(8, Math.round(srcH * (cw / cactusImg.naturalWidth)));
        }
        const cactusTop = groundY - ch + visualGroundOffset;
        if (dx < cx + cw && dx + dw > cx && dy < cactusTop + ch && dy + dh > cactusTop) {
            // mark death — allow one frame to draw death sprite, then stop
            dinoDead = true;
            // update final scores and UI
            const finalEl = document.getElementById('dinoFinalScore'); if (finalEl) finalEl.innerText = dinoScore;
            if (dinoScore > dinoBestScore) {
                dinoBestScore = dinoScore; localStorage.setItem('dinoBestScore', dinoBestScore);
            }
            const scoreEl = document.getElementById('dinoScore'); if (scoreEl) scoreEl.innerText = dinoScore;
            const bestEl = document.getElementById('dinoBest'); if (bestEl) bestEl.innerText = dinoBestScore;
            const over = document.getElementById('dinoGameOver'); if (over) over.style.display = 'block';
            // stop physics so dino doesn't sink
            dino.vy = 0;
            dino.jumping = false;
            // don't return — let drawing code render death frame then stop interval
        }
    }
    // Draw everything (clear once)
    dinoCtx.clearRect(0, 0, dinoCanvas.width, dinoCanvas.height);

    // Draw background ground (use image if available)
    if (dinoGroundImg.complete && dinoGroundImg.naturalWidth) {
        const gw = dinoGroundImg.naturalWidth;
        const gh = dinoGroundImg.naturalHeight;
        const gy = groundY; // draw ground image starting at groundY
        // Normalize startX so the tiling doesn't snap. Use groundOffset additive progression.
        const startX = - ((groundOffset % gw) + gw) % gw;
        for (let gx = startX; gx < dinoCanvas.width; gx += gw) {
            dinoCtx.drawImage(dinoGroundImg, gx, gy);
        }
    } else {
        dinoCtx.fillStyle = '#f5f5f5';
        dinoCtx.fillRect(0, groundY, dinoCanvas.width, dinoCanvas.height - groundY);
        dinoCtx.fillStyle = '#ddd';
        // Move simple ground tiles left by subtracting groundOffset
        for (let i = -2; i < 30; i++) {
            const rx = ((i * 40 - groundOffset) % 1000 + 1000) % 1000; // normalized positive
            dinoCtx.fillRect(rx, groundY, 40, 6);
        }
    }

    // Draw cacti using image if available
    for (let cactus of cacti) {
        const cx = Math.round(cactus.x);
        const cw = cactus.w;
        // compute drawing height similarly to collision (preserve aspect)
        let ch = cactus.h || 36;
        if (cactusImg && cactusImg.complete && cactusImg.naturalWidth) {
            const trim = cactusImg._trim;
            const srcH = (trim && trim.height) ? trim.height : cactusImg.naturalHeight;
            ch = Math.max(8, Math.round(srcH * (cw / cactusImg.naturalWidth)));
        }
        if (cactusImg.complete && cactusImg.naturalWidth) {
            const trim = cactusImg._trim;
            if (trim && trim.height > 0) {
                // draw only the non-transparent vertical slice so cactus sits flush
                dinoCtx.drawImage(cactusImg, 0, trim.top, cactusImg.naturalWidth, trim.height,
                                  cx, groundY - ch + visualGroundOffset, cw, ch);
            } else {
                dinoCtx.drawImage(cactusImg, 0, 0, cactusImg.naturalWidth, cactusImg.naturalHeight,
                                  cx, groundY - ch + visualGroundOffset, cw, ch);
            }
    } else {
            // fallback simple rectangles
            dinoCtx.fillStyle = '#3aa21e';
            dinoCtx.fillRect(cx, groundY - ch + visualGroundOffset, cw, ch);
            dinoCtx.fillStyle = '#2f8f1a';
            dinoCtx.fillRect(cx - 2, groundY - ch - 4 + visualGroundOffset, cw + 4, 6);
        }
    }

    // Draw dino sprite
    const px = dino.x;
    const py = dino.y;
    if (dinoDead && dinoLose.complete && dinoLose.naturalWidth) {
        dinoCtx.drawImage(dinoLose, px, py, dino.w, dino.h);
    } else if (!dino.jumping) {
        // running animation
        const runFrame = Math.floor(dinoFrameCount / 6) % 2;
        const img = runFrame === 0 ? dinoRun0 : dinoRun1;
        if (img.complete && img.naturalWidth) {
            dinoCtx.drawImage(img, px, py, dino.w, dino.h);
        } else if (dinoStationary.complete && dinoStationary.naturalWidth) {
            dinoCtx.drawImage(dinoStationary, px, py, dino.w, dino.h);
        } else {
            // fallback block
            dinoCtx.fillStyle = '#1f1f1f';
            dinoCtx.fillRect(px, py, dino.w, dino.h);
        }
    } else {
        // jumping frame - use stationary or first run frame
        if (dinoStationary.complete && dinoStationary.naturalWidth) dinoCtx.drawImage(dinoStationary, px, py, dino.w, dino.h);
        else {
            dinoCtx.fillStyle = '#1f1f1f'; dinoCtx.fillRect(px, py, dino.w, dino.h);
        }
    }

    // If death was just triggered, stop after drawing death sprite
    if (dinoDead) {
        stopDino();
        return;
    }

    // Draw score
    dinoCtx.fillStyle = '#222';
    dinoCtx.font = '20px monospace';
    dinoCtx.fillText('Score: ' + dinoScore, Math.max(10, dinoCanvas.width - 180), 28);

    // Debug overlay removed
}
function restartDino() {
    document.getElementById('dinoGameOver').style.display = 'none';
    startDino();
}
// ======= End Dino Game =======

// Geometry Dash placeholder is handled in HTML

// Optionally: expose closeGame on window to avoid strict scope limitation
window.closeGame = closeGame;
window.showGame = showGame;
window.restartDino = restartDino;
window.startFlappy = startFlappy; // If you use this globally

// Plug your Flappy Bird logic/events as needed using these IDs.
