window.addEventListener('contextmenu', e => e.preventDefault());

const STORAGE_KEY = 'manna_catcher_v2.3';

const bgm = document.getElementById('bgm');
const sfxCollect = document.getElementById('sfx-collect');
const sfxHit = document.getElementById('sfx-hit');
const sfxSuccess = document.getElementById('sfx-success');
const sfxGameover = document.getElementById('sfx-gameover');

let isMuted = false;

function toggleMute() {
    isMuted = !isMuted;
    const btn = document.getElementById('mute-btn');
    if (isMuted) {
        btn.innerText = "🔇";
        bgm.pause();
    } else {
        btn.innerText = "🔊";
        bgm.play().catch(e => { });
    }
}

function playSound(sound) {
    if (isMuted) return;
    sound.currentTime = 0;
    sound.play().catch(e => { });
}

let savedData = {
    shekels: 0, highScores: [], unlockedChars: ['default'], selectedChar: 'default'
};

function loadData() {
    const str = localStorage.getItem(STORAGE_KEY);
    if (str) {
        const parsed = JSON.parse(str);
        if (parsed.totalManna !== undefined) {
            parsed.shekels = Math.floor(parsed.totalManna / 10);
            delete parsed.totalManna;
        }
        savedData = { ...savedData, ...parsed };
    }
}
function saveData() { localStorage.setItem(STORAGE_KEY, JSON.stringify(savedData)); }
loadData();

// 캐릭터 DB
const characterDB = {
    'default': { name: "기본 소년", price: 0, emoji: '🧺', img: 'assets/images/char_default.png', type: 'head', desc: "기본에 충실한 소년", abilityDesc: "없음", bonus: { speed: 0.7 } },
    'miriam': { name: "미리암", price: 50, emoji: '🥁', img: 'assets/images/char_miriam.png', type: 'hand', desc: "찬양하며 춤춰요", abilityDesc: "이동 속도 +30% (신남!)", bonus: { speed: 1.6 } },
    'david': { name: "다윗", price: 150, emoji: '🪨', img: 'assets/images/char_david.png', type: 'hand_spin', desc: "물매돌을 빙글빙글", abilityDesc: "획득 범위 +100% (명사수!)", bonus: { range: 2.0 } },
    'moses': { name: "모세", price: 300, emoji: '🦯', img: 'assets/images/char_moses.png', type: 'hand_hold', desc: "지팡이를 높이 들어요", abilityDesc: "점수 획득 +50% (축복!)", bonus: { score: 1.5 } },
    'ark': { name: "제사장", price: 500, emoji: '⚱️', img: 'assets/images/char_ark.png', type: 'shoulder', desc: "언약궤를 메고 가요", abilityDesc: "최대 생명력 +3 (임재!)", bonus: { life: 3 } }
};

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// 에셋 로더 구현
const assets = {
    images: {
        'main_title': 'assets/images/main_title.png',
        'midbar_back_day': 'assets/images/midbar_back_image_day.png',
        'seven_day': 'assets/images/sevenday.png',
        'char_ark': 'assets/images/char_ark.png',
        'char_david': 'assets/images/char_david.png',
        'char_default': 'assets/images/char_default.png',
        'char_miriam': 'assets/images/char_miriam.png',
        'char_moses': 'assets/images/char_moses.png',
        'idol': 'assets/images/idol.png',
        'snake': 'assets/images/snake.png',
        'shekel': 'assets/images/shekel.png',
        'scroll': 'assets/images/scroll.png',
        'bitter_water': 'assets/images/bitter_water.png',
        'manna': 'assets/images/manna.png',
        'quail': 'assets/images/quail.png',
        'magnet': 'assets/images/magnet.png'
    },
    audio: {
        'bgm': 'assets/audio/bgm.mp3',
        'collect': 'assets/audio/collect.mp3',
        'gameover': 'assets/audio/gameover.mp3',
        'hit': 'assets/audio/hit.mp3',
        'success': 'assets/audio/success.mp3'
    }
};

const loadedAssets = { images: {}, audio: {} };
let totalAssets = Object.keys(assets.images).length + Object.keys(assets.audio).length;
let loadedCount = 0;

function updateLoadingBar() {
    loadedCount++;
    const percent = (loadedCount / totalAssets) * 100;
    document.getElementById('loading-bar').style.width = percent + '%';
    if (loadedCount === totalAssets) {
        setTimeout(() => {
            document.getElementById('loading-screen').classList.add('hidden');
            document.getElementById('start-screen').classList.remove('hidden');
        }, 500);
    }
}

function initAssets() {
    // 이미지 로드
    for (const [key, src] of Object.entries(assets.images)) {
        const img = new Image();
        img.src = src;
        img.onload = () => {
            loadedAssets.images[key] = img;
            updateLoadingBar();
        };
    }
    // 오디오 로드 (단순 로드 완료 체크)
    for (const [key, src] of Object.entries(assets.audio)) {
        const audio = new Audio();
        audio.src = src;
        audio.oncanplaythrough = () => {
            if (!loadedAssets.audio[key]) {
                loadedAssets.audio[key] = audio;
                updateLoadingBar();
            }
        };
        audio.load();
    }
}

// 초기 호출
document.getElementById('start-screen').classList.add('hidden'); // 일단 숨김
initAssets();

// 캐릭터 이미지 매핑 (기존 코드와 호환 유지)
const charImages = {};
Object.keys(characterDB).forEach(key => {
    charImages[key] = {
        get img() { return loadedAssets.images[`char_${key}`] || loadedAssets.images['char_default']; },
        get loaded() { return !!loadedAssets.images[`char_${key}`]; }
    };
});

let logicalWidth, logicalHeight;
let player;
let items = [];

let gameState = {
    score: 0, manna: 0, shekels: 0, lives: 3, maxLives: 3,
    day: 1, timePhase: 1, phaseProgress: 0,
    isPaused: false, shield: false,
    magnetActive: false, magnetTimer: 0,
    blindnessActive: false, blindnessTimer: 0,
    isInvulnerable: false, invulnerableTimer: 0
};

let fps = 60;
let fpsInterval = 1000 / fps;
let now, then, elapsed;
let gameLoopId;
let frameCount = 0;
let pendingScoreSubmitCallback = null;

function closeScreens() {
    document.getElementById('collection-screen').classList.add('hidden');
    document.getElementById('ranking-screen').classList.add('hidden');
}

function openCollection() {
    document.getElementById('collection-screen').classList.remove('hidden');
    document.getElementById('collection-shekel').innerText = savedData.shekels;
    const list = document.getElementById('char-list');
    list.innerHTML = '';

    for (const [id, char] of Object.entries(characterDB)) {
        const isUnlocked = savedData.unlockedChars.includes(id);
        const isSelected = savedData.selectedChar === id;

        const div = document.createElement('div');
        div.className = `char-card ${isUnlocked ? 'unlocked' : 'locked'} ${isSelected ? 'selected' : ''}`;
        div.innerHTML = `
        <img src="${char.img}" style="width: 60px; height: 60px; object-fit: contain; margin-bottom: 5px;">
        <div style="font-weight:bold; font-size:16px;">${char.name}</div>
        <div style="font-size:12px; color:#555; margin: 4px 0;">${char.desc}</div>
        <div style="font-size:12px; color:#27ae60; font-weight:bold;">${char.abilityDesc}</div>
        ${!isUnlocked ? `<div style="color:#d35400; font-weight:bold; margin-top:5px;">🪙 ${char.price}</div>` : ''}
    `;

        div.onclick = () => {
            if (isUnlocked) {
                savedData.selectedChar = id;
                saveData();
                openCollection();
            } else {
                if (savedData.shekels >= char.price) {
                    if (confirm(`${char.price} 세겔로 구매하시겠습니까?`)) {
                        savedData.shekels -= char.price;
                        savedData.unlockedChars.push(id);
                        saveData();
                        openCollection();
                    }
                } else {
                    showToast("세겔이 부족합니다!");
                }
            }
        };
        list.appendChild(div);
    }
}

async function openRanking() {
    document.getElementById('ranking-screen').classList.remove('hidden');
    const list = document.getElementById('rank-list');
    list.innerHTML = '<li style="padding:20px; text-align:center;">불러오는 중...</li>';

    // 로컬 랭킹 표시 (기존 유지)
    // savedData.highScores.sort((a, b) => b.score - a.score).slice(0, 5).forEach((r, i) => { ... });

    // Firebase 랭킹 불러오기
    if (window.Leaderboard) {
        const scores = await window.Leaderboard.getScores(10);
        list.innerHTML = ''; // 초기화

        if (scores.length === 0) {
            list.innerHTML = "<li style='padding:20px; text-align:center;'>기록이 없습니다. (API 키 확인 필요)</li>";
        } else {
            scores.forEach((r, i) => {
                const date = r.date ? new Date(r.date.seconds * 1000).toLocaleDateString() : '';
                // 1~3위 강조
                let rankStyle = "font-weight:bold;";
                if (i === 0) rankStyle += "color:#f1c40f; font-size:1.1em;";
                else if (i === 1) rankStyle += "color:#95a5a6;";
                else if (i === 2) rankStyle += "color:#cd7f32;";

                list.innerHTML += `<li style="padding:15px 10px; border-bottom:1px solid #eee; display:flex; justify-content:space-between; align-items:center;">
                    <span style="${rankStyle}">${i + 1}위 ${r.name || '익명'}</span> 
                    <div style="text-align:right;">
                        <span style="display:block; font-weight:bold; color:#27ae60;">${r.score}점</span>
                        <span style="font-size:12px; color:#888;">${r.day}일차 (${date})</span>
                    </div>
                </li>`;
            });
        }
    } else {
        list.innerHTML = "<li style='padding:20px; text-align:center;'>리더보드 연결 실패</li>";
    }
}

function togglePause() {
    if (gameState.lives <= 0) return;
    if (!document.getElementById('typing-modal').classList.contains('hidden')) return;

    gameState.isPaused = !gameState.isPaused;

    if (gameState.isPaused) {
        document.getElementById('pause-screen').classList.remove('hidden');
        bgm.pause();
    } else {
        document.getElementById('pause-screen').classList.add('hidden');
        if (!isMuted) bgm.play().catch(e => { });
        then = Date.now();
        gameLoop();
    }
}

function quitGame() {
    // 점수가 0보다 크면 랭킹 등록 모달 띄우기
    if (gameState.score > 0) {
        openNameInputModal(() => {
            finalizeQuit();
        });
    } else {
        finalizeQuit();
    }
}

function finalizeQuit() {
    savedData.shekels += gameState.shekels;
    // [수정] 점수 저장은 서버 전송 시 하므로 여기서는 로컬 히스토리만? 
    // 로컬 히스토리도 서버 전송 성공 여부와 관계없이 남기는 게 좋음.
    if (gameState.score > 0) {
        savedData.highScores.push({ score: gameState.score, day: gameState.day });
    }
    saveData();

    document.getElementById('pause-screen').classList.add('hidden');
    document.getElementById('camp-screen').classList.add('hidden');
    document.getElementById('gameover-screen').classList.add('hidden');
    document.getElementById('touch-guide').classList.add('hidden');
    document.getElementById('start-screen').classList.remove('hidden');

    const container = document.getElementById('game-container');
    document.getElementById('time-overlay').style.backgroundColor = 'rgba(255, 100, 50, 0.4)';

    gameState.isPaused = true;
    bgm.pause();
    bgm.currentTime = 0;
}

function startGame() {
    const char = characterDB[savedData.selectedChar] || characterDB['default'];
    let initialLives = 3;
    if (char.bonus && char.bonus.life) {
        initialLives += char.bonus.life;
    }

    let baseSpeed = 7;
    if (char.bonus && char.bonus.speed) {
        baseSpeed *= char.bonus.speed;
    }
    if (player) player.speed = baseSpeed;

    gameState = {
        score: 0, manna: 0, shekels: 0, lives: initialLives, maxLives: initialLives,
        day: 1, timePhase: 1, phaseProgress: 0,
        isPaused: false, shield: false,
        // basketFillLevel: 0, // 삭제됨
        // hasQuail: false,    // 삭제됨
        magnetActive: false, magnetTimer: 0,
        blindnessActive: false, blindnessTimer: 0
    };
    items = [];
    frameCount = 0;

    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('gameover-screen').classList.add('hidden');
    document.getElementById('camp-screen').classList.add('hidden');
    document.getElementById('touch-guide').classList.remove('hidden');
    document.getElementById('blindness-overlay').style.opacity = 0;
    document.getElementById('pause-btn').style.display = 'flex';

    if (!isMuted) {
        bgm.volume = 0.5;
        bgm.play().catch(e => { });
    }

    startDay();
}

function startDay() {
    if (gameState.day % 7 === 0) {
        showSabbathScreen();
        return;
    }

    if (gameState.day % 7 === 6) {
        showDay6Modal();
        return;
    }

    startActualGame();
}

function startActualGame() {
    gameState.timePhase = 1;
    gameState.phaseProgress = 0;
    updateEnvironment();

    if (gameState.day === 1) resizeCanvas();
    if (gameLoopId) cancelAnimationFrame(gameLoopId);

    then = Date.now();
    gameLoop();
}

function showDay6Modal() {
    document.getElementById('day6-modal').classList.remove('hidden');
}

function confirmDay6() {
    document.getElementById('day6-modal').classList.add('hidden');
    startActualGame();
}

function showSabbathScreen() {
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    document.getElementById('time-overlay').style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
    document.getElementById('center-indicator').innerText = `제 ${gameState.day}일: 안식일 (주 안에서 쉼)`;
    showToast("오늘은 거룩한 안식일입니다.");

    // 캔버스 초기화
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 새로운 안식일 화면(이미지 포함) 표시
    const sabbathScreen = document.getElementById('sabbath-screen');
    sabbathScreen.classList.remove('hidden');

    setTimeout(() => {
        sabbathScreen.classList.add('hidden');
        endDay();
    }, 4000);
}

function nextDay() {
    document.getElementById('camp-screen').classList.add('hidden');
    gameState.day++;
    gameState.isPaused = false;
    items = []; // 이전 날의 아이템 모두 제거
    startDay();
}

function buyItem(type) {
    if (type === 'life') {
        if (gameState.manna >= 30 && gameState.lives < gameState.maxLives) {
            gameState.manna -= 30;
            gameState.lives++;
            showToast("생명력 회복!");
            playSound(sfxSuccess);
        } else if (gameState.lives >= gameState.maxLives) {
            showToast("생명이 이미 가득 찼습니다.");
        } else {
            showToast("만나가 부족합니다.");
        }
    } else if (type === 'shield') {
        if (gameState.manna >= 50 && !gameState.shield) {
            gameState.manna -= 50;
            gameState.shield = true;
            showToast("방패 구매 완료!");
            playSound(sfxSuccess);
        } else if (gameState.shield) showToast("이미 방패가 있습니다.");
        else showToast("만나가 부족합니다.");
    }
    updateUI();
    document.getElementById('shop-manna-balance').innerText = gameState.manna;
}

function updateTime() {
    const phaseDuration = 900;
    gameState.phaseProgress++;

    if (gameState.phaseProgress >= phaseDuration) {
        gameState.phaseProgress = 0;
        gameState.timePhase++;

        if (gameState.timePhase > 3) {
            endDay();
            return;
        }
        updateEnvironment();
    }

    if (gameState.timePhase >= 2 && frameCount % 60 === 0) {
        gameState.score += 5;
        updateUI();
    }

    if (gameState.isInvulnerable) {
        gameState.invulnerableTimer--;
        if (gameState.invulnerableTimer <= 0) {
            gameState.isInvulnerable = false;
        }
    }

    if (gameState.magnetActive) {
        gameState.magnetTimer--;
        if (gameState.magnetTimer <= 0) {
            gameState.magnetActive = false;
            showToast("은혜의 이끌림 효과 종료");
        }
    }
    if (gameState.blindnessActive) {
        gameState.blindnessTimer--;
        if (gameState.blindnessTimer <= 0) {
            gameState.blindnessActive = false;
            document.getElementById('blindness-overlay').style.opacity = 0;
            showToast("시야가 돌아왔습니다.");
        }
    }
}

function updateEnvironment() {
    const overlay = document.getElementById('time-overlay');
    const indicator = document.getElementById('center-indicator');

    if (gameState.timePhase === 1) {
        overlay.style.backgroundColor = 'rgba(255, 100, 50, 0.4)';
        indicator.innerText = `제 ${gameState.day}일: 새벽 (만나를 거두라)`;
        showToast(`제 ${gameState.day}일이 밝았습니다.`);
    } else if (gameState.timePhase === 2) {
        overlay.style.backgroundColor = 'rgba(0, 0, 0, 0)';
        indicator.innerText = `제 ${gameState.day}일: 한낮 (더위를 피하라)`;
        showToast("해가 뜨겁게 내리쬡니다. 만나는 녹아버렸습니다.");
    } else {
        overlay.style.backgroundColor = 'rgba(10, 10, 50, 0.8)';
        indicator.innerText = `제 ${gameState.day}일: 밤 (위험을 경계하라)`;
        showToast("어둠이 깔리고 뱀들이 나옵니다!");
    }
}

function endDay() {
    gameState.isPaused = true;
    document.getElementById('camp-screen').classList.remove('hidden');
    document.getElementById('shop-manna-balance').innerText = gameState.manna;
    document.getElementById('touch-guide').classList.add('hidden');
}

function resizeCanvas() {
    const c = document.getElementById('game-container');
    const dpr = window.devicePixelRatio || 1;
    logicalWidth = c.clientWidth;
    logicalHeight = c.clientHeight;

    canvas.width = logicalWidth * dpr;
    canvas.height = logicalHeight * dpr;

    ctx.scale(dpr, dpr);

    if (!player) {
        const char = characterDB[savedData.selectedChar] || characterDB['default'];
        let baseSpeed = 7;
        if (char.bonus && char.bonus.speed) {
            baseSpeed *= char.bonus.speed;
        }

        player = {
            x: logicalWidth / 2,
            y: logicalHeight - 20,
            width: 100,
            height: 100,
            speed: baseSpeed,
            draw: function () {
                if (gameState.isInvulnerable && frameCount % 10 < 5) return; // 깜빡임 효과

                const charId = savedData.selectedChar;
                const imgObj = charImages[charId];

                ctx.save();
                ctx.translate(this.x, this.y);
                ctx.scale(2.4, 2.4);

                if (gameState.magnetActive) {
                    ctx.beginPath();
                    ctx.arc(0, -40, 60, 0, Math.PI * 2);
                    ctx.strokeStyle = 'rgba(255, 215, 0, 0.5)'; ctx.lineWidth = 2;
                    ctx.setLineDash([5, 5]); ctx.stroke(); ctx.setLineDash([]);
                }

                if (gameState.shield) {
                    ctx.beginPath();
                    ctx.arc(0, -40, 50, 0, Math.PI * 2);
                    ctx.strokeStyle = '#00ffff'; ctx.lineWidth = 3; ctx.stroke();
                    ctx.fillStyle = 'rgba(0, 255, 255, 0.2)'; ctx.fill();
                }

                if (imgObj && imgObj.loaded) {
                    ctx.drawImage(imgObj.img, -25, -70, 50, 70);
                } else {
                    // 백업용 드로잉
                    ctx.fillStyle = '#ecf0f1';
                    ctx.strokeStyle = '#3e2723';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.roundRect(-15, -45, 30, 45, 8);
                    ctx.fill(); ctx.stroke();

                    ctx.fillStyle = '#f1c27d';
                    ctx.strokeStyle = '#3e2723';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.arc(0, -55, 18, 0, Math.PI * 2);
                    ctx.fill(); ctx.stroke();

                    ctx.fillStyle = '#333';
                    ctx.beginPath(); ctx.arc(-6, -57, 2, 0, Math.PI * 2); ctx.fill();
                    ctx.beginPath(); ctx.arc(6, -57, 2, 0, Math.PI * 2); ctx.fill();
                    ctx.beginPath(); ctx.arc(0, -53, 3, 0, Math.PI, false); ctx.lineWidth = 1.5; ctx.strokeStyle = '#333'; ctx.stroke();
                }

                // [수정] 기본 캐릭터일 때 만나 쌓이는 효과 완전히 제거됨
                // (이전 코드에서 해당 로직 삭제)

                ctx.restore();
            },
            update: function () {
                // 입력에 따라 이동
                if (input.left) this.x -= this.speed;
                if (input.right) this.x += this.speed;
                if (this.x < 30) this.x = 30;
                if (this.x > logicalWidth - 30) this.x = logicalWidth - 30;
            }
        };
    } else {
        player.y = logicalHeight - 20;
        // 창 크기 조절 시 플레이어가 화면 밖으로 나가는 것 방지
        if (player.x > logicalWidth - 30) player.x = logicalWidth - 30;
        if (player.x < 30) player.x = 30;
    }
}

function drawMiniManna(x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 0.5;
    ctx.stroke();
}

window.addEventListener('resize', () => setTimeout(resizeCanvas, 100));
resizeCanvas();

class Item {
    constructor() {
        this.x = Math.random() * (logicalWidth - 60) + 30;
        this.y = -50;
        let speedBase = 3 + (gameState.day * 0.3);
        if (gameState.timePhase === 3) speedBase *= 1.5;
        this.speed = speedBase + Math.random() * 2;
        this.type = this.getType();
        this.marked = false;
    }

    getType() {
        const r = Math.random();
        if (r < 0.005) return 'magnet';
        if (r < 0.02) return 'bitter_water';

        if (gameState.timePhase === 1) { // 새벽
            if (r < 0.55) return 'manna';
            if (r < 0.70) return 'quail';
            if (r < 0.80) return 'shekel';
            if (r < 0.92) return 'snake';
            if (r < 0.98) return 'idol';
            return 'scroll'; // 2% 미만
        } else if (gameState.timePhase === 2) { // 낮
            if (r < 0.1) return 'shekel';
            if (r < 0.5) return 'snake';
            if (r < 0.9) return 'idol';
            if (r < 0.91) return 'scroll';
            return 'snake';
        } else { // 밤
            if (r < 0.1) return 'shekel';
            if (r < 0.6) return 'snake';
            return 'idol';
        }
    }

    update() {
        if (gameState.magnetActive && (this.type === 'manna' || this.type === 'quail' || this.type === 'shekel')) {
            const dx = player.x - this.x;
            const dy = (player.y - 50) - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            this.x += (dx / dist) * 20;
            this.y += (dy / dist) * 20;
        } else {
            this.y += this.speed;
        }

        if (this.y > logicalHeight + 50) this.marked = true;
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);

        const img = loadedAssets.images[this.type];
        if (img) {
            // [수정 v2.2] 모든 아이템 이미지 적용 및 1.7배 확대
            const scaleFactor = 1.7;
            // 기본 크기 설정 (아이템별 미세 조정이 필요하면 여기서 분기)
            let baseSize = 30;
            if (this.type === 'quail' || this.type === 'magnet') baseSize = 35;

            const size = baseSize * scaleFactor;
            ctx.drawImage(img, -size / 2, -size / 2, size, size);
        } else {
            // 이미지 로드 실패 시 백업 렌더링 (텍스트/도형)
            ctx.fillStyle = '#fff';
            ctx.font = '20px sans-serif';
            ctx.fillText('?', 0, 0);
        }

        ctx.restore();
    }
}

function checkCollisions() {
    const char = characterDB[savedData.selectedChar] || characterDB['default'];
    let charRangeBonus = 1.0;
    if (char.bonus && char.bonus.range) {
        charRangeBonus = char.bonus.range;
    }

    items.forEach(item => {
        if (item.marked) return;

        // [수정] 좋은 아이템일 때만 범위 보너스 적용
        // 나쁜 아이템(뱀, 우상, 쓴물)은 보너스 없이 기본 범위로만 충돌
        let effectiveBonus = 1.0;
        const goodItems = ['manna', 'shekel', 'quail', 'scroll', 'magnet'];

        if (goodItems.includes(item.type)) {
            effectiveBonus = charRangeBonus;
        }

        const dx = item.x - player.x;
        const basketY = player.y - 110;
        const distBasket = Math.sqrt(dx * dx + (item.y - basketY) * (item.y - basketY));
        const bodyY = player.y - 40;
        const distBody = Math.sqrt(dx * dx + (item.y - bodyY) * (item.y - bodyY));

        // hitRangeBonus 대신 effectiveBonus 사용
        if (distBasket < 50 * effectiveBonus || distBody < 45 * effectiveBonus) {
            item.marked = true;
            applyEffect(item.type);
        }
    });
}

function applyEffect(type) {
    const isDoubleDay = (gameState.day % 7 === 6);
    let multiplier = isDoubleDay ? 2 : 1;

    const char = characterDB[savedData.selectedChar] || characterDB['default'];
    if (char.bonus && char.bonus.score) {
        multiplier *= char.bonus.score;
    }

    if (type === 'manna') {
        gameState.manna += 1 * multiplier;
        gameState.score += Math.floor(10 * multiplier);
        // basketFillLevel 업데이트 제거
        playSound(sfxCollect);
        createFloatingText(player.x, player.y, `+${Math.floor(10 * multiplier)}`, "#fff");
    } else if (type === 'shekel') {
        gameState.shekels += 1;
        gameState.score += 50;
        playSound(sfxCollect);
        createFloatingText(player.x, player.y, "+1 세겔", "#f1c40f");
    } else if (type === 'quail') {
        gameState.manna += 5 * multiplier;
        gameState.score += Math.floor(30 * multiplier);
        // basketFillLevel 업데이트 제거
        // hasQuail 업데이트 제거
        playSound(sfxCollect);
        createFloatingText(player.x, player.y, `+${Math.floor(30 * multiplier)}`, "orange");
    } else if (type === 'snake' || type === 'idol') {
        if (gameState.isInvulnerable) return; // 무적 상태면 무시

        if (gameState.shield) {
            gameState.shield = false;
            gameState.isInvulnerable = true;
            gameState.invulnerableTimer = 60; // 짧은 무적 시간 부여
            createFloatingText(player.x, player.y, "방어!", "cyan");
            playSound(sfxSuccess);
        } else {
            gameState.lives--;
            gameState.isInvulnerable = true;
            gameState.invulnerableTimer = 120; // 피해 시 무적 시간 부여
            createFloatingText(player.x, player.y, "아야!", "red");
            playSound(sfxHit);
            canvas.style.transform = "translate(5px, 0)";
            setTimeout(() => canvas.style.transform = "none", 50);
            if (gameState.lives <= 0) {
                playSound(sfxGameover);
                gameOver();
            }
        }
    } else if (type === 'scroll') {
        gameState.isPaused = true;
        openTypingModal();
    } else if (type === 'magnet') {
        gameState.magnetActive = true;
        gameState.magnetTimer = 300;
        showToast("🧲 은혜의 이끌림 발동!");
        playSound(sfxSuccess);
        createFloatingText(player.x, player.y, "자석 효과!", "gold");
    } else if (type === 'bitter_water') {
        gameState.lives--;
        gameState.blindnessActive = true;
        gameState.blindnessTimer = 180;
        document.getElementById('blindness-overlay').style.opacity = 1;
        playSound(sfxHit);
        createFloatingText(player.x, player.y, "마라의 쓴물...", "purple");
        if (gameState.lives <= 0) {
            playSound(sfxGameover);
            gameOver();
        }
    }
    updateUI();
}

function createFloatingText(x, y, text, color) {
    const el = document.createElement('div');
    el.className = 'floating-text';
    el.innerText = text;
    el.style.left = x + 'px';
    el.style.top = (y - 50) + 'px';
    el.style.color = color;
    document.getElementById('game-container').appendChild(el);
    requestAnimationFrame(() => {
        el.style.transform = 'translate(-50%, -50px)';
        el.style.opacity = '0';
    });
    setTimeout(() => el.remove(), 1000);
}

function updateUI() {
    document.getElementById('manna-display').innerText = gameState.manna;
    document.getElementById('shekel-display').innerText = gameState.shekels;
    let hearts = "";
    for (let i = 0; i < gameState.maxLives; i++) {
        if (i < gameState.lives) hearts += "❤️";
        else hearts += "🖤";
    }
    document.getElementById('life-board').innerText = hearts;
}

function showToast(msg) {
    const t = document.createElement('div');
    t.innerText = msg;
    t.style.position = 'absolute'; t.style.top = '20%'; t.style.left = '50%';
    t.style.transform = 'translate(-50%)'; t.style.background = 'rgba(0,0,0,0.7)';
    t.style.color = '#fff'; t.style.padding = '10px 20px'; t.style.borderRadius = '20px';
    t.style.fontFamily = 'Gaegu'; t.style.zIndex = 100;
    document.getElementById('game-container').appendChild(t);
    setTimeout(() => t.remove(), 2000);
}

function gameOver() {
    gameState.isPaused = true;
    savedData.shekels += gameState.shekels;
    savedData.highScores.push({ score: gameState.score, day: gameState.day });
    saveData();

    document.getElementById('final-day-display').innerText = `제 ${gameState.day}일차, 광야에서 잠들다`;
    document.getElementById('final-score').innerText = gameState.score;
    document.getElementById('final-shekel').innerText = gameState.shekels;

    document.getElementById('gameover-screen').classList.remove('hidden');
    document.getElementById('touch-guide').classList.add('hidden');
    document.getElementById('pause-btn').style.display = 'none';
    bgm.pause();

    // Firebase에 점수 전송 (모달 띄우기)
    if (window.Leaderboard && gameState.score > 0) {
        setTimeout(() => {
            openNameInputModal(null); // 콜백 없음 (그냥 모달만 닫음)
        }, 1000);
    }
}

function openNameInputModal(callback) {
    pendingScoreSubmitCallback = callback;
    document.getElementById('name-input-modal').classList.remove('hidden');
    document.getElementById('player-name-input').value = "";
    document.getElementById('player-name-input').focus();
}

// 전역으로 노출하여 HTML에서 호출 가능하도록 함
window.submitPlayerScore = async function () {
    const input = document.getElementById('player-name-input');
    const name = input.value.trim();

    if (!name) {
        alert("이름을 입력해주세요.");
        return;
    }

    if (window.Leaderboard) {
        const success = await window.Leaderboard.submitScore(name, gameState.score, gameState.day);
        if (success) {
            showToast("랭킹 등록 완료!");
        } else {
            showToast("랭킹 등록 실패...");
        }
    }

    document.getElementById('name-input-modal').classList.add('hidden');

    if (pendingScoreSubmitCallback) {
        pendingScoreSubmitCallback();
        pendingScoreSubmitCallback = null;
    }
};

const input = { left: false, right: false };
window.onkeydown = e => { if (e.key === 'ArrowLeft') input.left = true; if (e.key === 'ArrowRight') input.right = true; };
window.onkeyup = e => { if (e.key === 'ArrowLeft') input.left = false; if (e.key === 'ArrowRight') input.right = false; };
const gc = document.getElementById('game-container');
gc.ontouchstart = e => {
    // 버튼 및 모달 터치 예외 처리
    if (e.target.id === 'pause-btn' || e.target.parentNode.id === 'pause-btn' ||
        e.target.id === 'mute-btn' || e.target.parentNode.id === 'mute-btn') return;

    // 모달 내부 터치 시 게임 조작 무시 (스크롤 허용)
    if (e.target.closest('.shop-container') || e.target.closest('.scroll-paper')) return;

    if (gameState.isPaused) return;
    if (e.touches[0].clientX < window.innerWidth / 2) input.left = true; else input.right = true;
};
gc.ontouchend = () => { input.left = false; input.right = false; };

const bibleVerses = [
    { text: "항상 기뻐하라", ref: "살전 5:16" },
    { text: "쉬지 말고 기도하라", ref: "살전 5:17" },
    { text: "범사에 감사하라", ref: "살전 5:18" },
    { text: "빛이 있으라", ref: "창 1:3" },
    { text: "서로 사랑하라", ref: "요 13:34" },
    { text: "나를 따르라", ref: "마 4:19" },
    { text: "너희는 세상의 빛이라", ref: "마 5:14" },
    { text: "믿음 소망 사랑", ref: "고전 13:13" },
    { text: "내게 능력 주시는 자 안에서 내가 모든 것을 할 수 있느니라", ref: "빌 4:13" },
    { text: "여호와는 나의 목자시니 내게 부족함이 없으리로다", ref: "시 23:1" },
    { text: "너희는 먼저 그의 나라와 그의 의를 구하라", ref: "마 6:33" },
    { text: "두려워하지 말라 내가 너와 함께 함이라", ref: "사 41:10" },
    { text: "오직 성령이 너희에게 임하시면 너희가 권능을 받고", ref: "행 1:8" },
    { text: "믿음은 바라는 것들의 실상이요 보이지 않는 것들의 증거니", ref: "히 11:1" },
    { text: "수고하고 무거운 짐 진 자들아 다 내게로 오라", ref: "마 11:28" },
    { text: "사람이 마음으로 믿어 의에 이르고 입으로 시인하여 구원에 이르느니라", ref: "롬 10:10" },
    { text: "주의 말씀은 내 발에 등이요 내 길에 빛이니이다", ref: "시 119:105" },
    { text: "청년이 무엇으로 그 행실을 깨끗하게 하리이까", ref: "시 119:9" },
    { text: "너의 행사를 여호와께 맡기라 그리하면 네가 경영하는 것이 이루어지리라", ref: "잠 16:3" },
    { text: "하나님을 사랑하는 자 곧 그의 뜻대로 부르심을 입은 자들에게는", ref: "롬 8:28" },
    { text: "아무 것도 염려하지 말고 다만 모든 일에 기도와 간구로", ref: "빌 4:6" },
    { text: "내가 너를 지명하여 불렀나니 너는 내 것이라", ref: "사 43:1" },
    { text: "너희 착한 행실을 보고 하늘에 계신 너희 아버지께 영광을 돌리게 하라", ref: "마 5:16" },
    { text: "마음을 강하게 하고 담대히 하라 두려워 말며 놀라지 말라", ref: "수 1:9" },
    { text: "구하라 그리하면 너희에게 주실 것이요 찾으라 그리하면 찾아낼 것이요", ref: "마 7:7" },
    { text: "너희 중에 누구든지 지혜가 부족하거든 모든 사람에게 후히 주시는 하나님께 구하라", ref: "약 1:5" },
    { text: "사랑은 오래 참고 사랑은 온유하며 시기하지 아니하며", ref: "고전 13:4" }
];

function openTypingModal() {
    const modal = document.getElementById('typing-modal');
    if (!modal.classList.contains('hidden')) return;

    const v = bibleVerses[Math.floor(Math.random() * bibleVerses.length)];
    const input = document.getElementById('typing-input');

    document.getElementById('verse-text').innerText = v.text;
    document.getElementById('verse-ref').innerText = v.ref;
    input.value = '';
    document.getElementById('input-feedback').innerText = '';

    modal.classList.remove('hidden');
    setTimeout(() => input.focus(), 100);

    input.onkeypress = (e) => {
        if (e.key === 'Enter') {
            // [수정] 띄어쓰기 무시 로직 제거 (엄격한 비교)
            if (input.value === v.text) {
                finishTyping(modal);
            }
        }
    };

    input.oninput = (e) => {
        // [수정] 띄어쓰기 포함하여 실시간 비교
        const val = e.target.value; // 공백 제거 안 함
        const target = v.text;      // 공백 제거 안 함
        const feedback = document.getElementById('input-feedback');

        if (target.startsWith(val)) {
            feedback.innerText = "잘하고 있어요!";
            feedback.className = "correct";
        } else {
            feedback.innerText = "띄어쓰기와 오타를 확인하세요.";
            feedback.className = "wrong";
        }

        if (val === target) {
            finishTyping(modal);
        }
    };
}

function finishTyping(modal) {
    modal.classList.add('hidden');
    gameState.isPaused = false;

    const rand = Math.random();
    if (rand < 0.5) {
        gameState.shield = true;
        showToast("말씀 방패 획득!");
        playSound(sfxSuccess);
    } else {
        gameState.maxLives++;
        gameState.lives++;
        showToast("최대 생명력 증가! (+1)");
        playSound(sfxSuccess);
    }
    updateUI();

    then = Date.now();
    gameLoop();
}

function gameLoop() {
    if (gameState.isPaused) return;

    gameLoopId = requestAnimationFrame(gameLoop);

    now = Date.now();
    elapsed = now - then;

    if (elapsed > fpsInterval) {
        then = now - (elapsed % fpsInterval);

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        updateTime();

        let spawnRate = 60 - gameState.day * 2;
        if (gameState.timePhase === 3) spawnRate = 25;
        if (spawnRate < 15) spawnRate = 15;

        if (gameState.day % 7 === 6) {
            spawnRate = Math.max(5, Math.floor(spawnRate / 2));
        }

        if (frameCount % spawnRate === 0) {
            items.push(new Item());
        }

        player.update(input);
        player.draw();

        items.forEach((item) => {
            item.update();
            item.draw();
        });

        items = items.filter(item => !item.marked);

        checkCollisions();
        frameCount++;
    }
}
