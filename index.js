// Minimal Flappy Bird clone for offline.html
(function(){
    const canvas = document.getElementById('flappyCanvas');
    if(!canvas) return;
    const ctx = canvas.getContext('2d');
    const scoreEl = document.getElementById('flappyScore');
    const bestEl = document.getElementById('flappyBest');
    const overEl = document.getElementById('flappyGameOver');
    const finalScore = document.getElementById('flappyFinalScore');
    const restartBtn = document.getElementById('flappyRestart');

    const W = canvas.width, H = canvas.height;
        let gravity = 0.5, jump = -9;
        let bird = { x: 80, y: H/2-28, w: 56, h:56, vy:0 };
    let pipes = [], frame=0, score=0;
    let isOver = false; // when true, stop moving pipes/scrolling
    let best = parseInt(localStorage.getItem('pyraxisFlappyBest')||'0',10)||0; bestEl.textContent = best;

    const pipeImg = new Image(); pipeImg.src = 'Images/pipe.png';
    const PIPE_DISPLAY_W = 80;
        const groundImg = new Image(); groundImg.src = 'Images/flappy-ground.png';
        const bgImg = new Image(); bgImg.src = 'Images/flappy-bg.png';
        // Friend face image to be used as the bird sprite
        const friendImg = new Image();
        // Robust loader for GitHub Pages: try several candidate URLs (relative, repo base, raw.githubusercontent)
        (function loadFriendFromCandidates(){
            const candidates = [
                'Images/image3.png',
                'Images/image3.jpg',
                './Images/image3.png',
                './Images/image3.jpg'
            ];
            const parts = location.pathname.split('/').filter(Boolean);
            if(parts.length){
                // repo base like /repo-name/Images/... (project pages)
                candidates.push(`/${parts[0]}/Images/image3.png`, `/${parts[0]}/Images/image3.jpg`);
            }
            if(location.hostname && location.hostname.endsWith('.github.io')){
                const username = location.hostname.split('.')[0];
                const repo = parts[0] || `${username}.github.io`;
                candidates.push(
                    `https://raw.githubusercontent.com/${username}/${repo}/main/Images/image3.png`,
                    `https://raw.githubusercontent.com/${username}/${repo}/main/Images/image3.jpg`
                );
            }
            let idx = 0;
            friendImg.onload = () => console.info('friend image loaded ->', friendImg.src, friendImg.naturalWidth + 'x' + friendImg.naturalHeight);
            friendImg.onerror = (ev) => {
                console.warn('friend image failed to load ->', friendImg.src, ev);
                if(idx < candidates.length) friendImg.src = candidates[idx++];
            };
            if(candidates.length) friendImg.src = candidates[idx++];
        })();

    function spawnPipe(){
        const gap = 220; const min = 60; const max = H - gap - 80; const top = Math.floor(Math.random()*(max-min))+min;
            const w = PIPE_DISPLAY_W;
        pipes.push({ x: W, top: top, bottom: top+gap, w: w, passed:false });
    }

    function reset(){ pipes = []; frame=0; score=0; bird.y = H/2-20; bird.vy=0; scoreEl.textContent='0'; overEl.style.display='none'; isOver = false; }

    function draw(){
        // background
        if(bgImg && bgImg.complete && bgImg.naturalWidth){ ctx.drawImage(bgImg,0,0,W,H); } else { ctx.fillStyle='#87CEEB'; ctx.fillRect(0,0,W,H); }
        // pipes
        for(const p of pipes){
            const w = p.w; const topH = p.top; const bottomH = H - p.bottom;
            if(pipeImg && pipeImg.complete && pipeImg.naturalWidth){
                // draw inverted top
                ctx.save(); ctx.translate(p.x, p.top); ctx.scale(1,-1);
                ctx.drawImage(pipeImg, 0, 0, pipeImg.naturalWidth, pipeImg.naturalHeight, 0, 0, p.w, topH);
                ctx.restore();
                // bottom
                ctx.drawImage(pipeImg, 0, 0, pipeImg.naturalWidth, pipeImg.naturalHeight, p.x, p.bottom, p.w, bottomH);
            } else {
                ctx.fillStyle='#2ea44f'; ctx.fillRect(p.x,0,w,topH); ctx.fillRect(p.x,p.bottom,w,bottomH);
            }
        }
        // ground
        if(groundImg && groundImg.complete && groundImg.naturalWidth){ const gh=groundImg.naturalHeight; for(let x=0;x<W;x+=groundImg.naturalWidth){ ctx.drawImage(groundImg,x,H-gh); } } else { ctx.fillStyle='#DEB887'; ctx.fillRect(0,H-24,W,24); }
            // bird (image masked to circle if available)
            if(friendImg && friendImg.complete && friendImg.naturalWidth){
                ctx.save();
                // Softer tilt: lower sensitivity and narrower rotation range
                const angle = Math.max(-0.25, Math.min(0.5, bird.vy/25));
                ctx.translate(bird.x + bird.w/2, bird.y + bird.h/2);
                ctx.rotate(angle);
                const radius = Math.min(bird.w, bird.h) / 2;
                ctx.beginPath(); ctx.arc(0,0,radius,0,Math.PI*2); ctx.closePath(); ctx.clip();
                // Draw the friend image centered and scaled to fit the circle
                ctx.drawImage(friendImg, -radius, -radius, radius*2, radius*2);
                ctx.restore();
            } else {
                ctx.fillStyle='#FFD700'; ctx.beginPath(); ctx.arc(bird.x+bird.w/2, bird.y+bird.h/2, bird.w/2,0,Math.PI*2); ctx.fill();
            }
    }

    function update(){
        if(isOver) return; // freeze positions when game has ended
        frame++;
        bird.vy += gravity; bird.y += bird.vy;
        if(frame%90===0) spawnPipe();

        // move pipes and handle scoring
        for(const p of pipes){ p.x -= 3.5; if(!p.passed && p.x + p.w < bird.x){ p.passed=true; score++; scoreEl.textContent=score; if(score>best){ best=score; localStorage.setItem('pyraxisFlappyBest',String(best)); bestEl.textContent=best; } } }
        pipes = pipes.filter(p=>p.x>-200);

        // collision reduced hitbox (increase inward padding so hitbox is smaller)
        const padX = Math.round(bird.w*0.38); const padY = Math.round(bird.h*0.38);
        const bx1=bird.x+padX,bx2=bird.x+bird.w-padX,by1=bird.y+padY,by2=bird.y+bird.h-padY;
        if(bird.y + bird.h > H - 2){ endGame(); }
        if(bird.y < -20){ bird.y=-20; bird.vy=0; }
        for(const p of pipes){
            const px1 = p.x, px2 = p.x + p.w;
            // Check horizontal overlap first
            if(!(bx2 < px1 || bx1 > px2)){
                // If horizontally overlapping, collision occurs when the bird is NOT fully inside the vertical gap
                if(by1 < p.top || by2 > p.bottom){ endGame(); return; }
            }
        }
    }

    function endGame(){ isOver = true; overEl.style.display='block'; finalScore.textContent=score; if(score>best){ best=score; localStorage.setItem('pyraxisFlappyBest',String(best)); bestEl.textContent=best; } }

    function loop(){ update(); draw(); requestAnimationFrame(loop); }

    function flap(){ bird.vy = jump; }
    canvas.addEventListener('click', ()=>{ if(overEl.style.display==='block'){ reset(); } flap(); });
    document.addEventListener('keydown', (e)=>{ if(e.code==='Space'){ e.preventDefault(); if(overEl.style.display==='block'){ reset(); } flap(); } });
    restartBtn.addEventListener('click', ()=>{ reset(); });

    reset(); loop();
})();
