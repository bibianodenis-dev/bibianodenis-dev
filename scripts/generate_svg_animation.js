const fs = require('fs');
const path = require('path');

function generateSvgAnimation() {
  const width = 760;
  const height = 220;
  const cols = 16;
  const rows = 6;
  const padX = 30, padY = 25;
  const blockGap = 8;
  const gridW = (width - 2 * padX - (cols - 1) * blockGap) / cols;
  const gridH = (height - 2 * padY - (rows - 1) * blockGap) / rows;

  const initialGreen = new Set([
    '1,2', '1,3', '1,7', '1,8', '1,12', '1,13',
    '2,4', '2,5', '2,9', '2,10',
    '3,1', '3,6', '3,11', '3,14',
    '4,3', '4,4', '4,8', '4,9', '4,12', '4,13'
  ]);

  let svgBlocks = '';

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = padX + c * (gridW + blockGap);
      const y = padY + r * (gridH + blockGap);
      const key = `${r},${c}`;
      const isGreen = initialGreen.has(key);

      const delay = ((r * 13 + c * 7) % 20) * 0.15;
      const fillClass = isGreen ? 'block-green' : 'block-gray';

      svgBlocks += `  <rect class="block ${fillClass}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${gridW.toFixed(1)}" height="${gridH.toFixed(1)}" rx="4" style="animation-delay: ${delay.toFixed(2)}s;" />\n`;
    }
  }

  const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="100%">
  <defs>
    <style>
      .bg { fill: #0d1117; }
      .grid-line { stroke: #161b22; stroke-width: 1; }
      .block { transform-origin: center; transition: all 0.4s ease; }
      .block-gray { fill: #21262d; animation: pulseGray 4s infinite ease-in-out; }
      .block-green { fill: #238636; animation: pulseGreen 3s infinite ease-in-out; }
      
      @keyframes pulseGreen {
        0%, 100% { fill: #238636; transform: scale(1); }
        50% { fill: #3fb950; transform: scale(1.04); filter: drop-shadow(0 0 6px rgba(63,185,80,0.6)); }
      }
      @keyframes pulseGray {
        0%, 100% { fill: #21262d; }
        45%, 55% { fill: #2ea043; transform: scale(1.05); }
      }

      /* Glowing Ball Path */
      .ball-glow {
        fill: #38bdf8;
        filter: drop-shadow(0 0 10px #38bdf8) drop-shadow(0 0 20px #0ea5e9);
        animation: ballMotion 8s infinite linear;
      }
      .ball-aura {
        fill: rgba(56, 189, 248, 0.25);
        animation: ballMotion 8s infinite linear;
      }

      @keyframes ballMotion {
        0%   { transform: translate(60px, 45px); }
        25%  { transform: translate(320px, 175px); }
        50%  { transform: translate(680px, 60px); }
        75%  { transform: translate(420px, 180px); }
        100% { transform: translate(60px, 45px); }
      }
    </style>
  </defs>

  <!-- Background -->
  <rect width="${width}" height="${height}" class="bg" rx="8" />

  <!-- Grid Lines -->
  <g class="grid-line">
    ${Array.from({length: rows + 1}, (_, i) => `<line x1="0" y1="${padY + i * (gridH + blockGap) - blockGap/2}" x2="${width}" y2="${padY + i * (gridH + blockGap) - blockGap/2}" />`).join('\n    ')}
    ${Array.from({length: cols + 1}, (_, i) => `<line x1="${padX + i * (gridW + blockGap) - blockGap/2}" y1="0" x2="${padX + i * (gridW + blockGap) - blockGap/2}" y2="${height}" />`).join('\n    ')}
  </g>

  <!-- Blocks -->
  <g>
${svgBlocks}  </g>

  <!-- Glowing Blue Ball -->
  <g>
    <circle class="ball-aura" r="18" />
    <circle class="ball-glow" r="9" />
    <circle class="ball-highlight" cx="-2" cy="-2" r="3" fill="#ffffff" style="animation: ballMotion 8s infinite linear;" />
  </g>
</svg>`;

  const outputDir = path.join(__dirname, '..', 'assets');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const svgPath = path.join(outputDir, 'animation.svg');
  fs.writeFileSync(svgPath, svgContent);

  console.log(`Animated SVG generated: ${svgPath}`);
}

generateSvgAnimation();
