const fs = require('fs');
const path = require('path');

function generateCommitPongSvg() {
  const width = 800;
  const height = 240;
  const cols = 26;
  const rows = 7;
  const startX = 98;
  const startY = 52;
  const cellW = 19;
  const cellH = 21;
  const gap = 4;

  const lvlColors = ['#161b22', '#0e4429', '#006d32', '#26a641', '#39d353'];

  let cellsSvg = '';
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = startX + c * (cellW + gap);
      const y = startY + r * (cellH + gap);
      const baseIdx = ((r * 11 + c * 7) % 5);
      const fill = lvlColors[baseIdx];
      const delay = ((r * 5 + c * 3) % 15) * 0.2;
      cellsSvg += `    <rect class="commit-cell" x="${x}" y="${y}" width="${cellW}" height="${cellH}" rx="3" fill="${fill}" style="animation-delay: ${delay.toFixed(1)}s;" />\n`;
    }
  }

  const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="100%">
  <defs>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@500;700;800&amp;display=swap');
      .bg { fill: #0d1117; }
      .court-bg { fill: #0f141e; }
      .court-border { stroke: #30363d; stroke-width: 2; fill: none; }
      .font-mono { font-family: 'JetBrains Mono', monospace, Consolas, sans-serif; }
      
      .commit-cell {
        transition: all 0.3s ease;
      }
      
      .p1-paddle {
        fill: #38bdf8;
        filter: drop-shadow(0 0 8px #0ea5e9);
        animation: p1Motion 4.8s infinite ease-in-out;
      }
      
      .p2-paddle {
        fill: #c084fc;
        filter: drop-shadow(0 0 8px #9333ea);
        animation: p2Motion 4.8s infinite ease-in-out;
      }
      
      .ball-glow {
        fill: #ffffff;
        filter: drop-shadow(0 0 10px #38bdf8) drop-shadow(0 0 16px #0ea5e9);
        animation: ballMotion 4.8s infinite linear;
      }
      
      .ball-trail {
        fill: #0ea5e9;
        opacity: 0.35;
        animation: ballMotion 4.8s infinite linear;
      }
      
      .pulse-dot {
        animation: livePulse 1.4s infinite ease-in-out;
      }

      @keyframes livePulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.4; transform: scale(0.85); }
      }

      @keyframes ballMotion {
        0%   { transform: translate(60px, 115px); }
        24%  { transform: translate(380px, 60px); }
        48%  { transform: translate(740px, 140px); }
        72%  { transform: translate(410px, 210px); }
        94%  { transform: translate(60px, 140px); }
        100% { transform: translate(60px, 115px); }
      }

      @keyframes p1Motion {
        0%   { transform: translateY(90px); }
        25%  { transform: translateY(60px); }
        50%  { transform: translateY(130px); }
        75%  { transform: translateY(85px); }
        94%  { transform: translateY(115px); }
        100% { transform: translateY(90px); }
      }

      @keyframes p2Motion {
        0%   { transform: translateY(110px); }
        25%  { transform: translateY(65px); }
        48%  { transform: translateY(115px); }
        70%  { transform: translateY(140px); }
        88%  { transform: translateY(95px); }
        100% { transform: translateY(110px); }
      }
    </style>
  </defs>

  <!-- Background -->
  <rect width="${width}" height="${height}" rx="10" class="bg" />

  <!-- Top HUD Bar -->
  <g class="font-mono">
    <!-- P1 Header -->
    <rect x="20" y="10" width="10" height="12" rx="2" fill="#38bdf8" />
    <text x="38" y="20" fill="#bae6fd" font-size="12" font-weight="700">DENIS ALVES [P1]</text>
    <text x="180" y="22" fill="#38bdf8" font-size="18" font-weight="800">07</text>

    <!-- Center GitHub Commit HUD -->
    <rect x="265" y="6" width="270" height="22" rx="6" fill="#141a26" stroke="#30363d" stroke-width="1" />
    <circle cx="278" cy="17" r="4" fill="#39d353" class="pulse-dot" />
    <text x="288" y="21" fill="#f0f6fc" font-size="11" font-weight="700">COMMITS:</text>
    <text x="350" y="22" fill="#39d353" font-size="13" font-weight="800">842+</text>
    
    <text x="420" y="21" fill="#8b949e" font-size="9">Less</text>
    <rect x="446" y="13" width="6" height="8" rx="1" fill="#161b22" />
    <rect x="454" y="13" width="6" height="8" rx="1" fill="#0e4429" />
    <rect x="462" y="13" width="6" height="8" rx="1" fill="#006d32" />
    <rect x="470" y="13" width="6" height="8" rx="1" fill="#26a641" />
    <rect x="478" y="13" width="6" height="8" rx="1" fill="#39d353" />
    <text x="490" y="21" fill="#8b949e" font-size="9">More</text>

    <!-- P2 Header -->
    <text x="590" y="22" fill="#c084fc" font-size="18" font-weight="800">05</text>
    <text x="625" y="20" fill="#f3e8ff" font-size="12" font-weight="700">AI BOT [P2]</text>
    <rect x="770" y="10" width="10" height="12" rx="2" fill="#c084fc" />
  </g>

  <!-- Court Arena -->
  <rect x="20" y="42" width="760" height="186" rx="6" class="court-bg" />
  <rect x="20" y="42" width="760" height="186" rx="6" class="court-border" />

  <!-- GitHub Commit Heatmap Cells -->
  <g>
${cellsSvg}  </g>

  <!-- Left Paddle (Denis Alves) -->
  <rect x="34" y="0" width="10" height="50" rx="4" class="p1-paddle" />

  <!-- Right Paddle (AI Opponent) -->
  <rect x="756" y="0" width="10" height="50" rx="4" class="p2-paddle" />

  <!-- Glowing Pong Ball & Trail -->
  <g>
    <circle r="7" class="ball-trail" />
    <circle r="5" class="ball-glow" />
  </g>
</svg>`;

  const outputDir = path.join(__dirname, '..', 'assets');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const svgPath = path.join(outputDir, 'pong.svg');
  fs.writeFileSync(svgPath, svgContent);
  fs.writeFileSync(path.join(outputDir, 'animation.svg'), svgContent);
  console.log(`Commit Pong SVG generated: ${svgPath}`);
}

generateCommitPongSvg();
