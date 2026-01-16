let video;
let handPose;
let hands = [];

let particles = [];
let isPinching = false; 


const TREE_HEIGHT = 450; 
const TREE_WIDTH = 350;

const TOTAL_PARTICLES = 5400; 
const PARTICLES_PER_TREE = TOTAL_PARTICLES / 3;

function preload() {
  handPose = ml5.handPose();
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  video = createCapture(VIDEO);
  video.size(windowWidth, windowHeight);
  video.hide();
  handPose.detectStart(video, gotHands);


  initThreeTrees();
}

function gotHands(results) {
  hands = results;
}


function initThreeTrees() {
  particles = [];
  let baseY = height - 20;


  createTreeAt(width * 0.2, baseY);
  createTreeAt(width * 0.5, baseY);
  createTreeAt(width * 0.8, baseY);
}


function createTreeAt(startX, startY) {

  let treeCenterX = startX;
  let treeCenterY = startY - TREE_HEIGHT / 2;

  for (let i = 0; i < PARTICLES_PER_TREE; i++) {

    particles.push(new GalaxyParticle(startX, startY, treeCenterX, treeCenterY));
  }
}

function draw() {

  background(0, 40); 

  push();
  translate(width, 0);
  scale(-1, 1);


  blendMode(ADD);

  checkGesture();

  // 绘制所有粒子
  for (let p of particles) {
    p.update(isPinching);
    p.draw();
  }

  drawHandGhost();
  pop();

  blendMode(BLEND);
  drawUI();
}

function checkGesture() {
  isPinching = false; 
  if (hands.length > 0) {
    let hand = hands[0];
    let thumb = hand.keypoints[4];
    let index = hand.keypoints[8];
    let d = dist(thumb.x, thumb.y, index.x, index.y);

    if (d < 40) {
      isPinching = true;
    }
  }
}

function drawHandGhost() {
  if (hands.length > 0) {
    let hand = hands[0];
    let thumb = hand.keypoints[4];
    let index = hand.keypoints[8];
    noStroke();
    fill(255, 50); 
    circle(thumb.x, thumb.y, 20);
    circle(index.x, index.y, 20);
  }
}

function drawUI() {
  fill(255, 200);
  textAlign(CENTER);
  textSize(16);
  noStroke();
  // 加个阴影让字清楚点
  drawingContext.shadowBlur = 4;
  drawingContext.shadowColor = 'black';
  if (isPinching) {
    fill(255, 50, 50);
    text("💥 能量释放！", width/2, 30);
  } else {
    text("✨ 捏合手指打散三棵树", width/2, 30);
  }
  drawingContext.shadowBlur = 0;
}

// --- 核心粒子类 ---

class GalaxyParticle {
  // 新增构造参数：接收它所属那棵树的中心点
  constructor(originX, originY, treeCenterX, treeCenterY) {
    // 记录所属树的中心，用于计算爆炸方向
    this.treeCenterX = treeCenterX;
    this.treeCenterY = treeCenterY;

    // 生成位置 (相对于树底部 originX, originY)
    let h = random(TREE_HEIGHT); // 高度
    // 宽度随高度变化
    let currentTreeHalfWidth = map(h, 0, TREE_HEIGHT, TREE_WIDTH/2, 5); 
    // 高斯分布让树干中心更密
    let xOffset = randomGaussian(0, currentTreeHalfWidth * 0.4); 
    
    // 目标位置 (绝对坐标)
    this.targetX = originX + xOffset;
    this.targetY = originY - h;

    // 当前位置
    this.x = this.targetX;
    this.y = this.targetY;

    this.velX = 0;
    this.velY = 0;
    this.noiseOffset = random(1000); 

    // 色彩映射：需要传入 relativeX 的计算基准
    this.color = this.assignColor(this.targetX, this.targetY, h, originX);
    
    this.baseSize = random(1) < 0.96 ? random(1.5, 3) : random(5, 9);
    this.size = this.baseSize;
  }

  // 根据位置分配颜色
  // 重点修改：relativeX 现在是相对于它自己那棵树的中轴线计算的
  assignColor(x, y, h, treeStartX) {
    let relativeH = h / TREE_HEIGHT; // 0 (底) -> 1 (顶)
    // 计算相对于当前树中心的偏移比例 (-1 到 1)
    let relativeX = (x - treeStartX) / (TREE_WIDTH/2); 

    let c;
    // 顶部金色
    if (relativeH > 0.88) {
      c = color(255, 220, 120); 
    } 
    // 下部分区
    else {
      let n = noise(x * 0.005, y * 0.005); // 调整了 noise 缩放，让纹理更适合大树
      
      if (relativeX < -0.25) { // 左侧倾向绿色/青色
        c = lerpColor(color(0, 255, 128), color(0, 180, 255), n);
      } else if (relativeX > 0.25) { // 右侧倾向紫色/深蓝
        c = lerpColor(color(160, 43, 226), color(65, 105, 255), n);
      } else { // 中间倾向红色/橙色
        c = lerpColor(color(255, 60, 60), color(255, 180, 0), n);
      }
      
      if (random(1) < 0.08) c = color(255, 255, 255); // 钻石闪光
    }
    
    c.setAlpha(random(120, 220));
    return c;
  }

  update(pinching) {
    if (pinching) {
      // --- 爆炸模式 ---
      // 关键修改：计算相对于*自己所属树中心*的角度
      let angle = atan2(this.y - this.treeCenterY, this.x - this.treeCenterX);
      let force = random(3, 9); // 爆炸力度略微加大
      angle += 0.3; // 旋转旋涡

      this.velX += cos(angle) * force * 0.1;
      this.velY += sin(angle) * force * 0.1;
      this.velX *= 0.98;
      this.velY *= 0.98;

    } else {
      // --- 归位模式 ---
      // 飞回自己的目标位置
      let dx = this.targetX - this.x;
      let dy = this.targetY - this.y;
      this.velX += dx * 0.04; // 回归速度稍慢一点，更优雅
      this.velY += dy * 0.04;
      this.velX *= 0.82;
      this.velY *= 0.82;

      // 浮动效果
      this.noiseOffset += 0.01;
      this.x += map(noise(this.noiseOffset), 0, 1, -1, 1);
      this.y += map(noise(this.noiseOffset + 500), 0, 1, -1, 1);
    }

    this.x += this.velX;
    this.y += this.velY;
    // 闪烁
    this.size = this.baseSize + sin(frameCount * 0.15 + this.noiseOffset) * 1.5;
  }

  draw() {
    noStroke();
    fill(this.color);
    circle(this.x, this.y, this.size);
  }
}