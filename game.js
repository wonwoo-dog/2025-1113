// 全域變數
let gameTable;       
let quizData = [];   
let gameState = 'menu'; // 'menu', 'game1', 'game2', 'result'
let score = 0;       
let game1Index = 0;  

// 特效與系統變數
let particleSystem;
let dataLoaded = false;
let font; // 為了顯示韓文，我們可以使用一個佔位符字體

// 遊戲 2 相關變數
let fallingLetters = [];
let buttonData; // 儲存按鈕位置資訊

// === 1. 檔案載入與初始化 ===

function preload() {
    // 1. 載入 CSV 檔案
    // 如果檔案路徑或伺服器運行有問題，dataLoaded 將為 false
    gameTable = loadTable('quiz_data.csv', 'csv', 'header', 
        () => { dataLoaded = true; }, 
        (err) => { 
            console.error("CSV 載入失敗！請確認檔案路徑和伺服器運行:", err); 
            dataLoaded = false; 
        }
    );

    // 2. 載入字體 (可選，如果沒有字體文件，此行可註釋掉)
    // font = loadFont('ArialUnicodeMS.ttf'); 
}

function setup() {
    createCanvas(800, 600); // 畫布尺寸固定為 800x600
    noStroke();
    textAlign(CENTER, CENTER);
    
    // if (font) { textFont(font); } // 如果有載入字體，設定字體
    
    if (dataLoaded) {
        parseGameData(gameTable);
    } else {
        // 載入失敗時提供少量測試數據，防止遊戲完全崩潰
        quizData = [
            { type: 'match', korean: '사과', imgPath: 'N/A', correctVowel: '' },
            { type: 'drop', korean: '가', imgPath: 'N/A', correctVowel: 'ㅏ' }
        ];
        console.warn("使用預設測試數據啟動遊戲，CSV 載入失敗的警告訊息仍在控制台！");
    }
    
    particleSystem = new ParticleSystem();
    initializeButtons(); // 初始化所有按鈕的繪圖座標
    
    // 初始化遊戲 2 的第一個掉落字母 (如果數據存在)
    if (quizData.length > 0) {
        spawnNextFallingLetter();
    }
}

// 初始化所有固定按鈕的位置 (純繪圖按鈕)
function initializeButtons() {
    buttonData = {
        // 主選單按鈕 (中心點座標)
        menuBtn1: { x: width / 2, y: 250, w: 250, h: 60, text: "遊戲 1: 單字配對" },
        menuBtn2: { x: width / 2, y: 350, w: 250, h: 60, text: "遊戲 2: 韓文射擊機" },
        
        // 遊戲控制按鈕 (右上角，中心點座標)
        restart: { x: 700, y: 30, w: 120, h: 30, text: "重新開始" }, 
        backToMenu: { x: 550, y: 30, w: 120, h: 30, text: "返回選單" },
        
        // 遊戲 2 元音輸入按鈕 (左上角座標 + 寬高，方便 CORNER 繪圖)
        vowelInputs: [
            { char: 'ㅏ', label: 'a', x: 200, y: 520, w: 60, h: 40 },
            { char: 'ㅓ', label: 'eo', x: 270, y: 520, w: 60, h: 40 },
            { char: 'ㅗ', label: 'o', x: 340, y: 520, w: 60, h: 40 },
            { char: 'ㅜ', label: 'u', x: 410, y: 520, w: 60, h: 40 },
            { char: 'ㅣ', label: 'i', x: 480, y: 520, w: 60, h: 40 },
        ]
    };
}

function parseGameData(table) {
    let rows = table.getRows();
    for (let row of rows) {
        quizData.push({
            type: row.getString('type'),
            korean: row.getString('korean_word'),
            imgPath: row.getString('image_path'),
            correctVowel: row.getString('correct_vowel') 
        });
    }
}

// === 2. 主要繪圖迴圈 ===

function draw() {
    background(240); // 淺灰色背景
    
    if (gameState === 'menu') {
        drawMenu();
    } else if (gameState === 'game1') {
        drawGame1(); 
    } else if (gameState === 'game2') {
        drawGame2(); 
    } else if (gameState === 'result') {
        drawResult();
    }

    particleSystem.run();
}

// === 3. 滑鼠事件處理 (純繪圖按鈕的點擊邏輯) ===

function mousePressed() {
    if (gameState === 'menu') {
        // 點擊主選單按鈕
        if (checkClick(buttonData.menuBtn1)) {
            gameState = 'game1';
            game1Index = 0;
            score = 0;
        } else if (checkClick(buttonData.menuBtn2)) {
            gameState = 'game2';
            resetCurrentGame();
        }
    } else if (gameState === 'game1' || gameState === 'game2') {
        // 檢查控制按鈕 (右上角)
        if (checkClick(buttonData.restart)) {
            resetCurrentGame();
        } else if (checkClick(buttonData.backToMenu)) {
            gameState = 'menu';
            score = 0;
            fallingLetters = [];
        }

        if (gameState === 'game2') {
            // 遊戲 2 元音輸入按鈕
            for (let btn of buttonData.vowelInputs) {
                // checkClick 參數調整以適應 CORNER 模式繪製的按鈕
                let rect = {x: btn.x + btn.w/2, y: btn.y + btn.h/2, w: btn.w, h: btn.h};
                if (checkClick(btn, rect)) {
                    handleVowelInput(btn.char);
                    return; 
                }
            }
        }
    } else if (gameState === 'result') {
        // 點擊返回選單按鈕
        let menuBtn = { x: width / 2, y: height * 0.7, w: 150, h: 50, text: "返回選單" };
        if (checkClick(menuBtn)) {
             gameState = 'menu';
        }
    }
}

function handleVowelInput(vowel) {
    if (fallingLetters.length > 0) {
        let currentLetter = fallingLetters[0]; 
        
        if (currentLetter.data.correctVowel === vowel) {
            score++;
            particleSystem.createParticles('praise', currentLetter.pos.x, currentLetter.pos.y, 30);
            fallingLetters.splice(0, 1); 
            spawnNextFallingLetter();
        } else {
            particleSystem.createParticles('encourage', width / 2, height - 50, 15);
        }
    }
}

function spawnNextFallingLetter() {
    const dropQuestions = quizData.filter(d => d.type === 'drop');
    if(dropQuestions.length > 0) {
        let nextIndex = floor(random(dropQuestions.length));
        fallingLetters.push(new FallingLetter(dropQuestions[nextIndex]));
    }
}

// 輔助函式：檢查點擊是否在按鈕內 (所有按鈕都使用 CENTER 模式繪製/檢查)
// 為了簡化，所有 checkClick 都以中心點來檢查
function checkClick(btn, rect=btn) {
    // rect.x, rect.y 是中心點
    if (mouseX > rect.x - rect.w / 2 && mouseX < rect.x + rect.w / 2 &&
        mouseY > rect.y - rect.h / 2 && mouseY < rect.y + rect.h / 2) {
        return true;
    }
    return false;
}

// === 4. 繪圖與遊戲邏輯函式 ===

function drawMenu() {
    textSize(48);
    fill(50, 100, 200);
    text("🇰🇷 韓文學習測驗系統 🇰🇷", width / 2, 100);

    drawButton(buttonData.menuBtn1, 20); // 繪製遊戲 1 按鈕
    drawButton(buttonData.menuBtn2, 20); // 繪製遊戲 2 按鈕

    if (!dataLoaded) {
        textSize(20);
        fill(255, 50, 50);
        text("⚠️ 警告：CSV 文件載入失敗！請使用 Live Server 或檢查路徑。", width / 2, height - 50);
    }
}

function drawGame1() {
    textSize(32);
    fill(50);
    text("遊戲 1: 圖像與單詞配對", width / 2, 80);

    drawControlButtons(); // 繪製控制按鈕 (右上角)
    
    const matchQuestions = quizData.filter(d => d.type === 'match');
    
    // ... 遊戲 1 的繪圖邏輯 (卡牌/文字佔位符)
    if (matchQuestions.length > 0 && game1Index < matchQuestions.length) {
        let currentItem = matchQuestions[game1Index];
        
        // 繪製圖像佔位符
        fill(200, 200, 255);
        rectMode(CENTER);
        rect(width / 2, 250, 250, 250, 15);
        
        fill(50);
        textSize(18);
        text(`[圖案佔位符: ${currentItem.imgPath}]`, width / 2, 250);
        
        // 繪製韓文單詞
        textSize(36);
        fill(255, 100, 100);
        text(currentItem.korean, width / 2, 450);
        
    } else {
         textSize(24);
         fill(50, 200, 50);
         text("遊戲 1 結束或數據不足。", width / 2, height / 2);
         // 遊戲結束時導向結果畫面
         setTimeout(() => gameState = 'result', 2000);
    }
    rectMode(CORNER);
}

function drawGame2() {
    textSize(32);
    fill(50);
    text("遊戲 2: 韓文元音輸入", width / 2, 80);
    text(`分數: ${score}`, 100, 30);
    
    drawControlButtons(); 

    // 運行掉落邏輯
    for (let letter of fallingLetters) {
        letter.update();
        letter.display();
    }
    
    // 移除掉落超過底部的字母 (懲罰)
    for (let i = fallingLetters.length - 1; i >= 0; i--) {
        if (fallingLetters[i].pos.y > height) {
            fallingLetters.splice(i, 1);
            score = max(0, score - 5); // 扣分
            particleSystem.createParticles('encourage', width / 2, 0, 10);
            spawnNextFallingLetter();
        }
    }

    // 繪製元音輸入按鈕
    drawVowelButtons();
}

function drawResult() {
    background(255, 250, 200);
    textSize(50);
    fill(50);
    text(`測驗結束！`, width / 2, height / 3);
    textSize(40);
    fill(200, 50, 50);
    text(`最終分數: ${score} 分`, width / 2, height / 2);
    
    let menuBtn = { x: width / 2, y: height * 0.7, w: 150, h: 50, text: "返回選單" };
    drawButton(menuBtn, 15);
}


// 繪製通用按鈕 (使用 CENTER 模式)
function drawButton(btn, size) {
    let isHover = checkClick(btn);
    
    rectMode(CENTER);
    fill(isHover ? 100 : 150, 150, 255);
    rect(btn.x, btn.y, btn.w, btn.h, size);
    
    fill(255);
    textSize(20);
    text(btn.text, btn.x, btn.y);
    rectMode(CORNER); // 繪製完畢切回 CORNER
}

// 繪製遊戲中的控制按鈕 (重新開始和返回選單)
function drawControlButtons() {
    drawButton(buttonData.restart, 8);
    drawButton(buttonData.backToMenu, 8);
}

// 繪製遊戲 2 的元音輸入按鈕 (使用 CORNER 模式繪製，但點擊仍然用 CENTER 檢查)
function drawVowelButtons() {
    for (let btn of buttonData.vowelInputs) {
        // checkClick 參數調整以適應 CORNER 模式繪製的按鈕
        let centerPoint = {x: btn.x + btn.w/2, y: btn.y + btn.h/2, w: btn.w, h: btn.h};
        let isHover = checkClick(btn, centerPoint);
        
        rectMode(CORNER);
        fill(isHover ? 255 : 200, 220, 100);
        rect(btn.x, btn.y, btn.w, btn.h, 5);
        
        fill(50);
        textSize(24);
        text(btn.char, btn.x + btn.w / 2, btn.y + btn.h / 2 - 5); // 韓文元音
        
        textSize(14);
        fill(100);
        text(btn.label, btn.x + btn.w / 2, btn.y + btn.h / 2 + 15); // 英文標籤
    }
}

function resetCurrentGame() {
    score = 0;
    if (gameState === 'game1') {
        game1Index = 0;
    } else if (gameState === 'game2') {
        fallingLetters = [];
        spawnNextFallingLetter();
    }
}

// === 5. 特效與物件類別 (與之前相同) ===

class FallingLetter {
    constructor(data) {
        this.data = data;
        this.pos = createVector(random(100, width - 100), -50);
        this.vel = createVector(0, random(1, 3));
        this.acc = createVector(0, 0.05);
        this.color = color(random(50, 150), 100, 200);
    }

    update() {
        this.vel.add(this.acc);
        this.pos.add(this.vel);
    }

    display() {
        fill(this.color);
        textSize(40);
        text(this.data.korean, this.pos.x, this.pos.y);
    }
}

class Particle {
    constructor(x, y, type) {
        this.pos = createVector(x, y);
        this.vel = p5.Vector.random2D().mult(random(2, 5));
        this.acc = createVector(0, 0);
        this.life = 255;
        this.type = type;
        this.size = random(5, 15);

        switch (this.type) {
            case 'praise': 
                this.color = color(random(100, 200), 255, random(100, 200), this.life);
                this.vel.y = random(-5, -1); 
                this.acc = createVector(0, -0.05); 
                break;
            case 'encourage': 
                this.color = color(random(100, 200), random(100, 200), 255, this.life);
                this.acc = createVector(0, 0.1); 
                break;
            default:
                this.color = color(255, 200, 0, this.life);
                this.vel = p5.Vector.random2D().mult(random(3, 8));
                this.acc = createVector(0, 0.2); 
        }
    }

    update() {
        this.vel.add(this.acc);
        this.pos.add(this.vel);
        this.life -= 4; 
        this.size *= 0.98;
    }

    display() {
        if (this.life > 0) {
            this.color.setAlpha(this.life);
            fill(this.color);
            ellipse(this.pos.x, this.pos.y, this.size);
        }
    }

    isFinished() {
        return this.life < 0;
    }
}

class ParticleSystem {
    constructor() {
        this.particles = [];
    }

    createParticles(type, x, y, count = 20) {
        for (let i = 0; i < count; i++) {
            this.particles.push(new Particle(x, y, type));
        }
    }

    run() {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            let p = this.particles[i];
            p.update();
            p.display();
            if (p.isFinished()) {
                this.particles.splice(i, 1);
            }
        }
    }
}
