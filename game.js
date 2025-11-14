// --- 全域變數和狀態管理 ---
let gameState = 0;
let canvas;
let returnToMenuButton;
let restartGame1Button;
let canvasContainer;

// --- 圖片變數 ---
let cardImages = {};

// --- 遊戲一 (配對) 變數 ---
let cards = [];
let flipped = [];
let matchedCount = 0;
let attempts = 0;
const totalPairs = 5;
const cardConfig = { size: 100, spacing: 20, cols: 4, rows: 3 };

const pairsData = [
  { han: "소주", image: "soju.jpg" },
  { han: "한복", image: "hanbok.jpg" },
  { han: "치킨", image: "bulgogi.jpg" },
  { han: "김치", image: "kimchi.jpg" },
  { han: "비빔밥", image: "bibimbap.jpg" }
];
let cardContent;

// --- 遊戲二 (射擊機) 變數 ---
let game2 = {
  letters: [],
  buttons: [],
  score: 0,
  spawnRate: 90,
  frameCounter: 0,
  availableLetters: [
    { hangul: 'ㅏ', roman: 'a' },
    { hangul: 'ㅓ', roman: 'eo' },
    { hangul: 'ㅗ', roman: 'o' },
    { hangul: 'ㅜ', roman: 'u' },
    { hangul: 'ㅣ', roman: 'i' },
    { hangul: 'ㅡ', roman: 'eu' }
  ]
};
const shooterRomans = ['a', 'eo', 'o', 'u'];

// --- p5.js 核心函數：preload ---
function preload() {
    // 即使您確定不是圖片問題，preload 仍然需要載入這些資源，以確保程式能啟動
    for (let data of pairsData) {
        try {
            cardImages[data.image] = loadImage(data.image);
        } catch (e) {
            // 如果載入失敗，可以在控制台拋出錯誤，但程式不會被無限阻塞
            console.error("無法載入圖片: " + data.image, e);
        }
    }
}


// --- p5.js 核心函數：setup ---
function setup() {
  canvas = createCanvas(600, 700);
  canvasContainer = select('#p5-canvas-container');
  canvas.parent('p5-canvas-container');
  canvas.hide();
  noLoop();
 
  // 創建返回主選單按鈕
  returnToMenuButton = createButton('◀ 返回主選單');
  returnToMenuButton.mousePressed(resetGame);
  returnToMenuButton.class('menu-button');
  returnToMenuButton.hide();
  // 初始時設定一個虛擬位置，避免定位錯誤
  returnToMenuButton.position(0, 0);

  // 創建遊戲一的重新開始按鈕
  restartGame1Button = createButton('🔄 重新開始 (配對)');
  restartGame1Button.mousePressed(resetGame1);
  restartGame1Button.class('menu-button');
  restartGame1Button.hide();
  restartGame1Button.position(0, 0);
 
  // 初始化卡牌物件結構
  initGame1Cards();
 
  // 初始化遊戲二的射擊按鈕 DOM 元素
  initGame2Buttons();

  // 初始調用一次定位，確保按鈕在畫布容器旁邊
  positionElements();
}

// --- p5.js 核心函數：draw ---
function draw() {
  clear();
 
  if (gameState === 1) {
    background(255);
    drawGame1();
  } else if (gameState === 2) {
    background(220, 240, 255);
    drawGame2();
  }
}

// --- 遊戲狀態切換函數 (從 HTML 調用) ---
function startGame(gameId) {
  gameState = gameId;
  canvas.show();
  loop(); // <--- 確保 draw() 循環開始
 
  select('#main-menu-controls').hide();
  select('#description').html('挑戰中...');
  returnToMenuButton.show();
 
  if (gameId === 1) {
    let w = cardConfig.cols * (cardConfig.size + cardConfig.spacing) + cardConfig.spacing;
    let h = cardConfig.rows * (cardConfig.size + cardConfig.spacing) + 90;
    resizeCanvas(w, h);
    resetGame1();
    hideGame2Elements();
    restartGame1Button.show();
  } else if (gameId === 2) {
    resizeCanvas(600, 700);
    resetGame2();
    showGame2Elements();
    restartGame1Button.hide();
  }

  // 修正：在 resizeCanvas 之後和 loop 啟動之後，確保 DOM 元素正確定位
  positionElements();
}

function resetGame() {
  gameState = 0;
  noLoop();
  canvas.hide();
 
  select('#main-menu-controls').show();
  select('#description').html('歡迎來到韓文小遊戲挑戰，請選擇一個遊戲開始學習吧！');
  returnToMenuButton.hide();
  restartGame1Button.hide();
 
  hideGame2Elements();
}

// --- 遊戲一：配對遊戲邏輯 (維持原樣) ---
function initGame1Cards() {
  cardContent = [];
  for (let data of pairsData) {
    cardContent.push({ type: 'image', content: data.image, pairID: data.han });
    cardContent.push({ type: 'text', content: data.han, pairID: data.han });
  }

  let cols = cardConfig.cols;
  let rows = cardConfig.rows;
  let startX = cardConfig.spacing;
  let startY = 80;
 
  for (let i = 0; i < cardContent.length; i++) {
    let col = i % cols;
    let row = floor(i / cols);
    let x = startX + col * (cardConfig.size + cardConfig.spacing);
    let y = startY + row * (cardConfig.size + cardConfig.spacing);
    cards.push(new Card(x, y, cardConfig.size, "", "", i));
  }
}

function resetGame1() {
  matchedCount = 0;
  flipped = [];
  attempts = 0;
 
  let tempContent = shuffle([...cardContent]);
 
  for(let i=0; i<cards.length; i++) {
      cards[i].type = tempContent[i].type;
      cards[i].content = tempContent[i].content;
      cards[i].pairID = tempContent[i].pairID;
      cards[i].isFlipped = false;
      cards[i].isMatched = false;
  }
}

function drawGame1() {
  for (let card of cards) {
    card.display();
  }

  let successRate = (matchedCount === 0 && attempts === 0) ? 'N/A' : (matchedCount * 100 / attempts).toFixed(1) + '%';
 
  fill(0);
  textSize(24);
  textAlign(LEFT, TOP);
  text(`配對進度: ${matchedCount} / ${totalPairs}`, 10, 10);
  textAlign(RIGHT, TOP);
  text(`嘗試次數: ${attempts} | 答對率: ${successRate}`, width - 10, 10);


  if (matchedCount === totalPairs) {
    fill(0, 150, 0, 200);
    rect(0, height / 3, width, height / 3, 10);
    fill(255);
    textSize(50);
    textAlign(CENTER, CENTER);
    text("🎉 配對成功！ 🎉", width / 2, height / 2);
  }
}

function handleGame1Click() {
  if (matchedCount === totalPairs) return;
 
  for (let i = 0; i < cards.length; i++) {
    let card = cards[i];
    if (card.isClicked(mouseX, mouseY) && !card.isFlipped && flipped.length < 2 && !card.isMatched) {
      card.flip();
      flipped.push(i);
     
      if (flipped.length === 2) {
        attempts++;
        let card1 = cards[flipped[0]];
        let card2 = cards[flipped[1]];
       
        if (card1.pairID === card2.pairID) {
          card1.match();
          card2.match();
          matchedCount++;
          flipped = [];
        } else {
          setTimeout(unflipCards, 1000);
        }
      }
      return;
    }
  }
}

function unflipCards() {
  if (gameState !== 1) return;
  for (let index of flipped) {
    cards[index].flip();
  }
  flipped = [];
}

// Card Class (維持原樣)
class Card {
  constructor(x, y, size, type, content, pairID) {
    this.x = x; this.y = y; this.size = size;
    this.type = type;
    this.content = content;
    this.pairID = pairID;
    this.isFlipped = false; this.isMatched = false;
  }
 
  display() {
    rectMode(CORNER);
    if (this.isMatched) { fill('#a5d6a7'); } else { fill(255); }
    stroke('#4db6ac');
    rect(this.x, this.y, this.size, this.size, 8);
   
    if (this.isFlipped || this.isMatched) {
      if (this.type === 'image') {
          if (cardImages[this.content]) {
              image(cardImages[this.content], this.x, this.y, this.size, this.size);
          }
      } else {
          fill(0); textSize(20); textAlign(CENTER, CENTER);
          text(this.content, this.x + this.size / 2, this.y + this.size / 2);
      }
    } else {
      fill('#c2185b');
      textSize(30); textAlign(CENTER, CENTER);
      text("🇰🇷", this.x + this.size / 2, this.y + this.size / 2);
    }
  }
 
  isClicked(mx, my) {
    return mx > this.x && mx < this.x + this.size && my > this.y && my < this.y + this.size;
  }
 
  flip() { this.isFlipped = !this.isFlipped; }
  match() { this.isMatched = true; this.isFlipped = true; }
}


// --- 遊戲二：射擊機邏輯 (維持原樣) ---

function initGame2Buttons() {
    for (let i = 0; i < shooterRomans.length; i++) {
      let btn = createButton(shooterRomans[i]);
      btn.class('shooter-button');
      btn.size(100, 40);
      btn.mousePressed(() => checkMatch(shooterRomans[i]));
      btn.hide();
      // 初始時設定一個虛擬位置
      btn.position(0, 0);
      game2.buttons.push(btn);
    }
}

function positionGame2Buttons() {
    // 獲取畫布容器的全局位置
    let containerPos = canvasContainer.position();
    let buttonWidth = 100;
    let startX = (width - shooterRomans.length * buttonWidth) / (shooterRomans.length + 1);
    let buttonY = 630;

    for (let i = 0; i < game2.buttons.length; i++) {
      let btn = game2.buttons[i];
      let btnX = containerPos.x + startX + i * (buttonWidth + startX);
      let btnY = containerPos.y + buttonY;
      btn.position(btnX, btnY);
    }
}

function showGame2Elements() {
  for (let btn of game2.buttons) {
    btn.show();
  }
}

function hideGame2Elements() {
  for (let btn of game2.buttons) {
    btn.hide();
  }
}

function drawGame2() {
  game2.frameCounter++;
  if (game2.frameCounter % game2.spawnRate === 0) {
    spawnNewLetter();
  }

  for (let i = game2.letters.length - 1; i >= 0; i--) {
    let letter = game2.letters[i];
    letter.update();
    letter.display();

    if (letter.missed) {
      game2.letters.splice(i, 1);
    }
  }

  fill(0);
  textSize(32);
  textAlign(CENTER, TOP);
  text("🚀 分數: " + game2.score, width / 2, 15);

  stroke(255, 0, 0);
  strokeWeight(2);
  line(0, 600, width, 600);
  noStroke();

  if (game2.score >= 50 && game2.spawnRate > 30) { game2.spawnRate = 60; }
  if (game2.score >= 100 && game2.spawnRate > 30) { game2.spawnRate = 30; }
}

class HangulLetter {
  constructor(hangul, roman) {
    this.hangul = hangul; this.roman = roman;
    this.x = random(50, width - 50); this.y = -50;
    this.speed = random(1.5, 3.5);
    this.size = 40; this.missed = false;
  }

  update() {
    this.y += this.speed;
    if (this.y > 600 && !this.missed) {
      this.missed = true;
      game2.score = max(0, game2.score - 5);
    }
  }

  display() {
    push();
    if (this.missed) { fill(255, 0, 0); } else { fill(0, 0, 0); }
    textSize(this.size);
    textAlign(CENTER, CENTER);
    text(this.hangul, this.x, this.y);
    pop();
  }
}

function checkMatch(romanClicked) {
  if (gameState !== 2) return;
 
  for (let i = game2.letters.length - 1; i >= 0; i--) {
    let letter = game2.letters[i];
   
    if (letter.roman === romanClicked && !letter.missed && letter.y < 600) {
      game2.score += 10;
      game2.letters.splice(i, 1);
      break;
    }
  }
}

function spawnNewLetter() {
  let filteredLetters = game2.availableLetters.filter(l => shooterRomans.includes(l.roman));
  let { hangul, roman } = random(filteredLetters);
  game2.letters.push(new HangulLetter(hangul, roman));
}

// --- 輔助函數和定位 (專門用於處理 DOM 元素定位) ---

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    let j = floor(random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function positionElements() {
    // 修正：確保畫布容器位置可用
    let containerPos = canvasContainer.position();
    let canvasW = width;
    let canvasH = height;
   
    // 定位返回主選單按鈕
    let btnY = containerPos.y + canvasH + 20;

    if (gameState === 1) {
        // 遊戲一：返回按鈕和重新開始按鈕分開
        let center = containerPos.x + canvasW / 2;
        returnToMenuButton.position(center - 10 - returnToMenuButton.width, btnY);
        restartGame1Button.position(center + 10, btnY);
    } else if (gameState === 2) {
        // 遊戲二：返回按鈕居中
        let center = containerPos.x + canvasW / 2 - returnToMenuButton.width / 2;
        returnToMenuButton.position(center, btnY);
        positionGame2Buttons(); // 射擊按鈕定位
    } else {
        // 初始或菜單狀態，按鈕都在畫布外或隱藏
    }
}

function windowResized() {
    // 視窗大小改變時重新定位所有 DOM 元素
    positionElements();
}
