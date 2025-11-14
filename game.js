// --- 全域變數和狀態管理 ---
let gameTable;       
let quizData = [];   
let gameState = 'menu'; // 'menu', 'game1', 'game2', 'result'
let score = 0;       
let game1Attempts = 0; // 遊戲 1 嘗試次數
let game1Matches = 0;  // 遊戲 1 成功配對數
let totalPairs = 5;    // 遊戲 1 總配對數 (5組卡牌)

// --- 圖片變數 (用於遊戲 1) ---
let cardImages = {};

// --- 遊戲 1 (配對) 變數 ---
let game1Cards = [];
let flippedCards = []; // 儲存被翻開的卡牌物件
const cardConfig = { size: 80, spacing: 20, cols: 5, rows: 2, startX: 100, startY: 150 };

// --- 遊戲 2 變數 ---
let fallingLetters = [];
let buttonData; 
let game2MaxLetters = 10; // 遊戲 2 最大掉落數量 (10個)
let game2LettersSpawned = 0; // 遊戲 2 已掉落數量

// 特效與系統變數
let particleSystem;
let dataLoaded = false;
let font; 

// === 1. 檔案載入與初始化 ===

function preload() {
    // 1. 載入 CSV 檔案
    gameTable = loadTable('quiz_data.csv', 'csv', 'header', 
        () => { 
            dataLoaded = true;
            // 載入 CSV 後，開始根據數據載入圖片
            if (gameTable.getRows().length > 0) {
                let rows = gameTable.getRows();
                let imagePaths = [];
                for (let row of rows) {
                    let path = row.getString('image_path');
                    // 檢查是否為 match 類型且圖片路徑有效且不重複
                    if (row.getString('type') === 'match' && path && path !== 'N/A' && !imagePaths.includes(path)) {
                        imagePaths.push(path);
                    }
                }
                
                // 嘗試載入所有獨特的圖片
                for (let path of imagePaths) {
                    cardImages[path] = loadImage(path, 
                        () => console.log(`圖片 ${path} 載入成功`),
                        (err) => console.error(`圖片 ${path} 載入失敗！請檢查路徑。`, err)
                    );
                }
            }
        }, 
        (err) => { 
            console.error("CSV 載入失敗！請確認檔案路徑和伺服器運行:", err); 
            dataLoaded = false; 
        }
    );
}

function setup() {
    createCanvas(800, 600); 
    noStroke();
    textAlign(CENTER, CENTER);
    
    if (dataLoaded) {
        parseGameData(gameTable);
        initGame1Cards(); 
    } else {
        // 載入失敗時提供少量測試數據，防止遊戲完全崩潰
        quizData = [
            // 模擬您最後的設定
            { type: 'match', korean: '비빔밥', imgPath: 'bibimbap.jpg', correctVowel: '' },
            { type: 'drop', korean: '가', imgPath: 'N/A', correctVowel: 'ㅏ' }
        ];
        console.warn("使用預設測試數據啟動遊戲，CSV 載入失敗的警告訊息仍在控制台！");
        initGame1Cards();
    }
    
    particleSystem = new ParticleSystem();
    initializeButtons(); 
    
    noLoop(); // 畫布靜止，等待點擊開始遊戲
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
        
        // 遊戲 2 元音輸入按鈕 
        vowelInputs: [
            { char: 'ㅏ', label: 'a', x: 200, y: 520, w: 60, h: 40, correctVowel: 'ㅏ' },
            { char: 'ㅓ', label: 'eo', x: 270, y: 520, w: 60, h: 40, correctVowel: 'ㅓ' },
            { char: 'ㅗ', label: 'o', x: 340, y: 520, w: 60, h: 40, correctVowel: 'ㅗ' },
            { char: 'ㅜ', label: 'u', x: 410, y: 520, w: 60, h: 40, correctVowel: 'ㅜ' },
            { char: 'ㅣ', label: 'i', x: 480, y: 520, w: 60, h: 40, correctVowel: 'ㅣ' },
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

// === 遊戲 1 (配對遊戲) 邏輯 ===

function initGame1Cards() {
    game1Cards = [];
    // 過濾出配對題，並只取前 totalPairs 組 (5組)
    const matchQuestions = quizData.filter(d => d.type === 'match').slice(0, totalPairs);

    // 1. 創建卡牌內容 (5組韓文 + 5組圖片)
    let cardContent = [];
    for (let i = 0; i < matchQuestions.length; i++) {
        let q = matchQuestions[i];
        cardContent.push({ type: 'text', value: q.korean, pairID: i }); // 韓文卡牌
        cardContent.push({ type: 'image', value: q.imgPath, pairID: i }); // 圖片卡牌
    }
    
    // 2. 實例化卡牌物件
    for (let i = 0; i < cardContent.length; i++) {
        let col = i % cardConfig.cols;
        let row = floor(i / cardConfig.cols);
        let x = cardConfig.startX + col * (cardConfig.size + cardConfig.spacing);
        let y = cardConfig.startY + row * (cardConfig.size + cardConfig.spacing);
        game1Cards.push(new Card(x, y, cardConfig.size, cardContent[i]));
    }
}

function resetGame1() {
    game1Attempts = 0;
    game1Matches = 0;
    flippedCards = [];
    
    // 將卡牌內容打亂並重置狀態
    let contentCopy = [];
    game1Cards.forEach(c => contentCopy.push(c.data));
    contentCopy = shuffle(contentCopy); 
    
    for (let i = 0; i < game1Cards.length; i++) {
        game1Cards[i].data = contentCopy[i];
        game1Cards[i].isFlipped = false;
        game1Cards[i].isMatched = false;
    }
    loop(); // 啟動 draw 循環
}

// === 2. 主要繪圖迴圈 ===

function draw() {
    background(240); 
    
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
            resetGame1(); 
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
            noLoop(); // 返回選單停止 draw 循環
        }

        if (gameState === 'game1') {
            handleGame1Click(); 
        } else if (gameState === 'game2') {
            // 遊戲 2 元音輸入按鈕
            for (let btn of buttonData.vowelInputs) {
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
             // *** 關鍵修正：從結果畫面返回菜單必須重新啟動 draw 循環！ ***
             loop(); // <--- 修正：使用 loop()
        }
    }
}

// 遊戲 1 點擊邏輯處理函式
function handleGame1Click() {
    if (game1Matches === totalPairs || flippedCards.length === 2) return;

    for (let i = 0; i < game1Cards.length; i++) {
        let card = game1Cards[i];
        if (card.isClicked(mouseX, mouseY) && !card.isFlipped && !card.isMatched) {
            
            card.isFlipped = true;
            flippedCards.push(card);

            if (flippedCards.length === 2) {
                game1Attempts++;
                let card1 = flippedCards[0];
                let card2 = flippedCards[1];

                if (card1.data.pairID === card2.data.pairID) {
                    // 配對成功
                    card1.isMatched = true;
                    card2.isMatched = true;
                    game1Matches++;
                    flippedCards = []; // 清空已配對
                    particleSystem.createParticles('praise', width / 2, height / 2, 50);

                    if (game1Matches === totalPairs) {
                        setTimeout(() => { gameState = 'result'; noLoop(); }, 1500); // 遊戲結束並停止循環
                    }
                } else {
                    // 配對失敗，延遲 1 秒後翻回去
                    setTimeout(() => {
                        card1.isFlipped = false;
                        card2.isFlipped = false;
                        flippedCards = [];
                    }, 1000);
                    particleSystem.createParticles('encourage', width / 2, height / 2, 20);
                }
            }
            return;
        }
    }
}

// 遊戲 2 元音輸入邏輯
function handleVowelInput(vowel) {
    if (fallingLetters.length > 0) {
        let currentLetter = fallingLetters[0]; 
        
        const buttonInfo = buttonData.vowelInputs.find(b => b.char === vowel);
        
        if (currentLetter.data.correctVowel === buttonInfo.correctVowel) {
            score += 10;
            particleSystem.createParticles('praise', currentLetter.pos.x, currentLetter.pos.y, 30);
            fallingLetters.splice(0, 1); 
            spawnNextFallingLetter();
        } else {
            particleSystem.createParticles('encourage', width / 2, height - 50, 15);
        }
    }
}

// 遊戲 2 生成字母邏輯
function spawnNextFallingLetter() {
    // 檢查是否已達到最大掉落數量 (10個)
    if (game2LettersSpawned >= game2MaxLetters) {
        return;
    }
    
    const dropQuestions = quizData.filter(d => d.type === 'drop');
    if(dropQuestions.length > 0) {
        let nextIndex = floor(random(dropQuestions.length));
        fallingLetters.push(new FallingLetter(dropQuestions[nextIndex]));
        game2LettersSpawned++; // 成功生成後計數
    }
}

// 輔助函式：檢查點擊是否在按鈕內 
function checkClick(btn, rect=btn) {
    if (mouseX > rect.x - rect.w / 2 && mouseX < rect.x + rect.w / 2 &&
        mouseY > rect.y - rect.h / 2 && mouseY < rect.y + rect.h / 2) {
        return true;
    }
    return false;
}

// 重置當前遊戲
function resetCurrentGame() {
    score = 0;
    if (gameState === 'game1') {
        resetGame1(); 
    } else if (gameState === 'game2') {
        fallingLetters = [];
        game2LettersSpawned = 0; 
        spawnNextFallingLetter();
        loop(); // 啟動 draw 循環
    }
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
    text("遊戲 1: 圖像與單詞配對", width / 2, 50);

    drawControlButtons(); 

    // 繪製卡牌
    for (let card of game1Cards) {
        card.display();
    }
    
    // 繪製分數/狀態
    let successRate = (game1Matches === 0 && game1Attempts === 0) ? 'N/A' : ((game1Matches / game1Attempts) * 100).toFixed(1) + '%';
    fill(0);
    textSize(20);
    textAlign(LEFT, TOP);
    text(`配對成功: ${game1Matches} / ${totalPairs}`, 20, 10);
    textAlign(RIGHT, TOP);
    text(`嘗試次數: ${game1Attempts} | 準確率: ${successRate}`, width - 20, 10);
    textAlign(CENTER, CENTER); // 繪圖後切回 CENTER

    // 遊戲結束提示 
    if (game1Matches === totalPairs) {
        fill(50, 200, 50, 180);
        rectMode(CENTER);
        rect(width/2, height/2, width, height, 0); 
        fill(255);
        textSize(60);
        text("🎉 完成配對！ 🎉", width / 2, height / 2);
        rectMode(CORNER);
    }
}

function drawGame2() {
    textSize(32);
    fill(50);
    text("遊戲 2: 韓文元音輸入", width / 2, 50);
    text(`分數: ${score}`, 100, 20);
    text(`進度: ${game2LettersSpawned} / ${game2MaxLetters}`, 300, 20); 
    
    drawControlButtons(); 

    // 運行掉落邏輯
    for (let i = fallingLetters.length - 1; i >= 0; i--) {
        let letter = fallingLetters[i];
        letter.update();
        letter.display();

        // 移除掉落超過底部的字母 (懲罰)
        if (letter.pos.y > height) {
            fallingLetters.splice(i, 1);
            score = max(0, score - 5); 
            particleSystem.createParticles('encourage', width / 2, 0, 10);
            
            // 只有在未達到最大數量時才生成新的
            if (game2LettersSpawned < game2MaxLetters) { 
                spawnNextFallingLetter();
            }
        }
    }
    
    // 檢查遊戲是否結束
    if (game2LettersSpawned >= game2MaxLetters && fallingLetters.length === 0) {
        setTimeout(() => { gameState = 'result'; noLoop(); }, 1000);
    }

    // 繪製元音輸入按鈕
    drawVowelButtons();
}

function drawResult() {
    background(255, 250, 200);
    textSize(50);
    fill(50);
    
    let resultText = "";
    let finalScoreText = "";
    
    // 根據遊戲 1 的完成狀態來判斷顯示哪個遊戲的結果
    if (game1Matches === totalPairs) { 
        let rate = (game1Attempts === 0) ? 'N/A' : ((game1Matches / game1Attempts) * 100).toFixed(1) + '%';
        resultText = "遊戲 1 結束！";
        finalScoreText = `成功配對: ${game1Matches} / ${totalPairs}\n準確率: ${rate}`;
    } else { 
        // 遊戲 2 或中途退出
        let maxPossibleScore = game2MaxLetters * 10;
        let rate = (maxPossibleScore === 0) ? 'N/A' : ((score / maxPossibleScore) * 100).toFixed(1) + '%';
        resultText = "遊戲 2 結束！";
        finalScoreText = `最終得分: ${score} / ${maxPossibleScore}\n打擊率: ${rate}`;
    }
    
    text(resultText, width / 2, height / 3);
    textSize(30);
    fill(200, 50, 50);
    text(finalScoreText, width / 2, height / 2);
    
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

// 繪製遊戲 2 的元音輸入按鈕 
function drawVowelButtons() {
    for (let btn of buttonData.vowelInputs) {
        let centerPoint = {x: btn.x + btn.w/2, y: btn.y + btn.h/2, w: btn.w, h: btn.h};
        let isHover = checkClick(btn, centerPoint);
        
        rectMode(CORNER);
        fill(isHover ? 255 : 200, 220, 100);
        rect(btn.x, btn.y, btn.w, btn.h, 5);
        
        fill(50);
        textSize(24);
        text(btn.char, btn.x + btn.w / 2, btn.y + btn.h / 2 - 5); 
        
        textSize(14);
        fill(100);
        text(btn.label, btn.x + btn.w / 2, btn.y + btn.h / 2 + 15); 
    }
}

// === 5. 特效與物件類別 ===

// 遊戲 1 卡牌類別
class Card {
    constructor(x, y, size, data) {
        this.x = x; this.y = y; this.size = size;
        this.data = data; 
        this.isFlipped = false;
        this.isMatched = false;
    }

    display() {
        rectMode(CORNER);
        
        // 背景顏色
        if (this.isMatched) { fill('#a5d6a7'); } 
        else if (this.isFlipped) { fill('#fff'); } 
        else { fill('#c2185b'); } // 背面顏色
        
        stroke('#4db6ac');
        rect(this.x, this.y, this.size, this.size, 8); // 畫方塊

        if (this.isFlipped || this.isMatched) {
            // 顯示正面內容
            // 檢查圖片是否已載入且有數據
            if (this.data.type === 'image' && cardImages[this.data.value] && cardImages[this.data.value].width > 1) {
                image(cardImages[this.data.value], this.x, this.y, this.size, this.size);
            } else {
                // 顯示文字
                fill(0); textSize(20); textAlign(CENTER, CENTER);
                text(this.data.value, this.x + this.size / 2, this.y + this.size / 2);
            }
        } else {
            // 顯示背面圖案
            fill(255);
            textSize(30); textAlign(CENTER, CENTER);
            text("🇰🇷", this.x + this.size / 2, this.y + this.size / 2);
        }
    }

    isClicked(mx, my) {
        return mx > this.x && mx < this.x + this.size && my > this.y && my < this.y + this.size;
    }
}

// 遊戲 2 掉落字母類別
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

// 粒子特效系統
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

// 輔助函式：打亂陣列 (使用 P5.js 內建的 shuffle)
// 註: 我們移除手動定義的 shuffle，避免與 P5.js 內建功能衝突。
