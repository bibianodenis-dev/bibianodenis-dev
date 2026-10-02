const fs = require('fs');
const path = require('path');

// ==========================================
// 1. SPEC-COMPLIANT GIF89a ENCODER (Zero-Dep)
// ==========================================
class FastGifEncoder {
  constructor(width, height, palette) {
    this.width = width;
    this.height = height;
    this.palette = palette;
    this.buffers = [];

    while (this.palette.length < 256) {
      this.palette.push([0, 0, 0]);
    }
    this.writeHeader();
  }

  writeHeader() {
    const buf = Buffer.alloc(13 + 768);
    buf.write('GIF89a', 0);
    buf.writeUInt16LE(this.width, 6);
    buf.writeUInt16LE(this.height, 8);
    buf[10] = 0xF7; // Global Color Table (256 colors)
    buf[11] = 0;    // Background color index (0 = #0d1117)
    buf[12] = 0;    // Pixel aspect ratio

    for (let i = 0; i < 256; i++) {
      buf[13 + i * 3]     = this.palette[i][0];
      buf[13 + i * 3 + 1] = this.palette[i][1];
      buf[13 + i * 3 + 2] = this.palette[i][2];
    }
    this.buffers.push(buf);

    // Netscape 2.0 Loop Extension
    this.buffers.push(Buffer.from([
      0x21, 0xFF, 0x0B,
      0x4E, 0x45, 0x54, 0x53, 0x43, 0x41, 0x50, 0x45, 0x32, 0x2E, 0x30,
      0x03, 0x01, 0x00, 0x00, 0x00
    ]));
  }

  addFrame(pixels, delayMs = 40) {
    const delayHundredths = Math.max(2, Math.round(delayMs / 10));

    // Graphic Control Extension
    const gce = Buffer.from([
      0x21, 0xF9, 0x04,
      0x00, // Disposal method: none
      delayHundredths & 0xFF, (delayHundredths >> 8) & 0xFF,
      0x00, // Transparent index unused
      0x00
    ]);
    this.buffers.push(gce);

    // Image Descriptor
    const id = Buffer.alloc(10);
    id[0] = 0x2C;
    id.writeUInt16LE(0, 1);
    id.writeUInt16LE(0, 3);
    id.writeUInt16LE(this.width, 5);
    id.writeUInt16LE(this.height, 7);
    id[9] = 0x00;
    this.buffers.push(id);

    // Optimized LZW Encoder
    this.buffers.push(this.lzwEncode(pixels, 8));
  }

  lzwEncode(pixels, minCodeSize) {
    const clearCode = 1 << minCodeSize;
    const eofCode = clearCode + 1;
    let codeSize = minCodeSize + 1;
    let nextCode = eofCode + 1;

    // Fast numeric hash map for LZW transitions
    // Key: (prefixCode << 8) | pixelByte
    const dict = new Map();
    const resetDict = () => {
      dict.clear();
      codeSize = minCodeSize + 1;
      nextCode = eofCode + 1;
    };

    const outputBits = [];
    const writeBits = (val, count) => {
      for (let i = 0; i < count; i++) {
        outputBits.push((val >> i) & 1);
      }
    };

    writeBits(clearCode, codeSize);

    let prefix = pixels[0];
    for (let i = 1; i < pixels.length; i++) {
      const byte = pixels[i];
      const key = (prefix << 8) | byte;

      if (dict.has(key)) {
        prefix = dict.get(key);
      } else {
        writeBits(prefix, codeSize);
        if (nextCode < 4096) {
          dict.set(key, nextCode++);
          if (nextCode === (1 << codeSize) && codeSize < 12) {
            codeSize++;
          }
        } else {
          writeBits(clearCode, codeSize);
          resetDict();
        }
        prefix = byte;
      }
    }

    writeBits(prefix, codeSize);
    writeBits(eofCode, codeSize);

    const bytes = [];
    for (let i = 0; i < outputBits.length; i += 8) {
      let b = 0;
      for (let bit = 0; bit < 8; bit++) {
        if (i + bit < outputBits.length) {
          b |= (outputBits[i + bit] << bit);
        }
      }
      bytes.push(b);
    }

    const subBlocks = [Buffer.from([minCodeSize])];
    for (let i = 0; i < bytes.length; i += 255) {
      const chunk = bytes.slice(i, i + 255);
      subBlocks.push(Buffer.from([chunk.length, ...chunk]));
    }
    subBlocks.push(Buffer.from([0x00]));

    return Buffer.concat(subBlocks);
  }

  finish() {
    this.buffers.push(Buffer.from([0x3B]));
    return Buffer.concat(this.buffers);
  }
}

// ==========================================
// 2. COLOR PALETTE DEFINITION
// ==========================================
function buildPongPalette() {
  const palette = [
    [13, 17, 23],    // 0: Background #0d1117
    [18, 24, 34],    // 1: Court inner fill #121822
    [30, 41, 59],    // 2: Grid & bounds subtle #1e293b
    [51, 65, 85],    // 3: Court border #334155
    [71, 85, 105],   // 4: Center net dashed #475569
    [148, 163, 184], // 5: Muted text #94a3b8
    [226, 232, 240], // 6: Bright text #e2e8f0
    [255, 255, 255], // 7: Pure white (Ball core, highlights)
    
    // Cyan Theme (Denis / Left Paddle)
    [3, 105, 161],   // 8: Deep Cyan #0369a1
    [14, 165, 233],  // 9: Cyan Aura #0ea5e9
    [56, 189, 248],  // 10: Bright Cyan #38bdf8
    [186, 230, 253], // 11: Light Cyan #bae6fd
    
    // Purple Theme (AI Bot / Right Paddle)
    [109, 40, 217],  // 12: Deep Purple #6d28d9
    [147, 51, 234],  // 13: Purple Aura #9333ea
    [192, 132, 252], // 14: Bright Purple #c084fc
    [243, 232, 255], // 15: Light Purple #f3e8ff
    
    // FX Colors (Sparks, Hits, Badges)
    [245, 158, 11],  // 16: Amber Spark #f59e0b
    [251, 191, 36],  // 17: Yellow Highlight #fbbf24
    [16, 185, 129],  // 18: Emerald Pulse #10b981
    [52, 211, 153],  // 19: Light Emerald #34d399
    [239, 68, 68],   // 20: Crimson Alert #ef4444
    [24, 30, 42]     // 21: Scoreboard Card BG #181e2a
  ];

  while (palette.length < 256) {
    palette.push([0, 0, 0]);
  }
  return palette;
}

// ==========================================
// 3. PIXEL DRAWING UTILITIES & BITMAP FONTS
// ==========================================
const FONT_5X7 = {
  'A': [0x0C, 0x12, 0x12, 0x1E, 0x12, 0x12, 0x12],
  'B': [0x1C, 0x12, 0x12, 0x1C, 0x12, 0x12, 0x1C],
  'C': [0x0E, 0x10, 0x10, 0x10, 0x10, 0x10, 0x0E],
  'D': [0x1C, 0x12, 0x12, 0x12, 0x12, 0x12, 0x1C],
  'E': [0x1E, 0x10, 0x10, 0x1C, 0x10, 0x10, 0x1E],
  'F': [0x1E, 0x10, 0x10, 0x1C, 0x10, 0x10, 0x10],
  'G': [0x0E, 0x10, 0x10, 0x16, 0x12, 0x12, 0x0E],
  'H': [0x12, 0x12, 0x12, 0x1E, 0x12, 0x12, 0x12],
  'I': [0x0E, 0x04, 0x04, 0x04, 0x04, 0x04, 0x0E],
  'J': [0x02, 0x02, 0x02, 0x02, 0x12, 0x12, 0x0C],
  'K': [0x12, 0x14, 0x18, 0x10, 0x18, 0x14, 0x12],
  'L': [0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x1E],
  'M': [0x11, 0x1B, 0x15, 0x15, 0x11, 0x11, 0x11],
  'N': [0x11, 0x19, 0x15, 0x13, 0x11, 0x11, 0x11],
  'O': [0x0E, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0E],
  'P': [0x1C, 0x12, 0x12, 0x1C, 0x10, 0x10, 0x10],
  'Q': [0x0E, 0x11, 0x11, 0x11, 0x15, 0x12, 0x0D],
  'R': [0x1C, 0x12, 0x12, 0x1C, 0x14, 0x12, 0x11],
  'S': [0x0E, 0x10, 0x10, 0x0E, 0x01, 0x01, 0x1E],
  'T': [0x1F, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04],
  'U': [0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0E],
  'V': [0x11, 0x11, 0x11, 0x11, 0x11, 0x0A, 0x04],
  'W': [0x11, 0x11, 0x11, 0x15, 0x15, 0x1B, 0x11],
  'X': [0x11, 0x11, 0x0A, 0x04, 0x0A, 0x11, 0x11],
  'Y': [0x11, 0x11, 0x0A, 0x04, 0x04, 0x04, 0x04],
  'Z': [0x1F, 0x01, 0x02, 0x04, 0x08, 0x10, 0x1F],
  '0': [0x0E, 0x11, 0x13, 0x15, 0x19, 0x11, 0x0E],
  '1': [0x04, 0x0C, 0x04, 0x04, 0x04, 0x04, 0x0E],
  '2': [0x0E, 0x11, 0x01, 0x06, 0x08, 0x10, 0x1F],
  '3': [0x1E, 0x01, 0x01, 0x0E, 0x01, 0x01, 0x1E],
  '4': [0x02, 0x06, 0x0A, 0x12, 0x1F, 0x02, 0x02],
  '5': [0x1F, 0x10, 0x1E, 0x01, 0x01, 0x11, 0x0E],
  '6': [0x06, 0x08, 0x10, 0x1E, 0x11, 0x11, 0x0E],
  '7': [0x1F, 0x01, 0x02, 0x04, 0x08, 0x08, 0x08],
  '8': [0x0E, 0x11, 0x11, 0x0E, 0x11, 0x11, 0x0E],
  '9': [0x0E, 0x11, 0x11, 0x0F, 0x01, 0x02, 0x0C],
  ':': [0x00, 0x04, 0x00, 0x00, 0x04, 0x00, 0x00],
  '-': [0x00, 0x00, 0x00, 0x1F, 0x00, 0x00, 0x00],
  '.': [0x00, 0x00, 0x00, 0x00, 0x00, 0x04, 0x04],
  '/': [0x01, 0x02, 0x02, 0x04, 0x08, 0x08, 0x10],
  '[': [0x0E, 0x08, 0x08, 0x08, 0x08, 0x08, 0x0E],
  ']': [0x0E, 0x02, 0x02, 0x02, 0x02, 0x02, 0x0E],
  ' ': [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]
};

// Big 7-Segment style Font for Scoreboard (width: 12, height: 16)
const SCORE_PATTERNS = {
  '0': [' #### ', '#    #', '#    #', '#    #', '#    #', '#    #', ' #### '],
  '1': ['   #  ', '  ##  ', '   #  ', '   #  ', '   #  ', '   #  ', ' #####'],
  '2': [' #### ', '#    #', '     #', ' #### ', '#     ', '#     ', '######'],
  '3': [' #### ', '#    #', '     #', '  ### ', '     #', '#    #', ' #### '],
  '4': ['#    #', '#    #', '#    #', '######', '     #', '     #', '     #'],
  '5': ['######', '#     ', '##### ', '     #', '     #', '#    #', ' #### '],
  '6': [' #### ', '#     ', '##### ', '#    #', '#    #', '#    #', ' #### '],
  '7': ['######', '     #', '    # ', '   #  ', '  #   ', '  #   ', '  #   '],
  '8': [' #### ', '#    #', '#    #', ' #### ', '#    #', '#    #', ' #### '],
  '9': [' #### ', '#    #', '#    #', ' #####', '     #', '     #', ' #### ']
};

function drawScoreDigit(pixels, W, H, x0, y0, digitStr, colorIndex, scale = 2) {
  const pattern = SCORE_PATTERNS[digitStr] || SCORE_PATTERNS['0'];
  for (let r = 0; r < pattern.length; r++) {
    const row = pattern[r];
    for (let c = 0; c < row.length; c++) {
      if (row[c] === '#') {
        for (let dy = 0; dy < scale; dy++) {
          for (let dx = 0; dx < scale; dx++) {
            const px = x0 + c * scale + dx;
            const py = y0 + r * scale + dy;
            if (px >= 0 && px < W && py >= 0 && py < H) {
              pixels[py * W + px] = colorIndex;
            }
          }
        }
      }
    }
  }
}

function drawText(pixels, W, H, x0, y0, text, colorIndex) {
  let cx = x0;
  text = text.toUpperCase();
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const bitmap = FONT_5X7[ch] || FONT_5X7[' '];
    for (let r = 0; r < 7; r++) {
      const rowBits = bitmap[r];
      for (let c = 0; c < 5; c++) {
        if ((rowBits >> (4 - c)) & 1) {
          const px = cx + c;
          const py = y0 + r;
          if (px >= 0 && px < W && py >= 0 && py < H) {
            pixels[py * W + px] = colorIndex;
          }
        }
      }
    }
    cx += 6;
  }
}

function fillRect(pixels, W, H, x0, y0, w, h, colorIndex) {
  const rx0 = Math.max(0, Math.floor(x0));
  const ry0 = Math.max(0, Math.floor(y0));
  const rx1 = Math.min(W, Math.floor(x0 + w));
  const ry1 = Math.min(H, Math.floor(y0 + h));

  for (let y = ry0; y < ry1; y++) {
    const rowOffset = y * W;
    for (let x = rx0; x < rx1; x++) {
      pixels[rowOffset + x] = colorIndex;
    }
  }
}

function drawCircle(pixels, W, H, cx, cy, radius, colorIndex, filled = true) {
  const r2 = radius * radius;
  const x0 = Math.max(0, Math.floor(cx - radius));
  const x1 = Math.min(W - 1, Math.ceil(cx + radius));
  const y0 = Math.max(0, Math.floor(cy - radius));
  const y1 = Math.min(H - 1, Math.ceil(cy + radius));

  for (let y = y0; y <= y1; y++) {
    const dy = y - cy;
    const dy2 = dy * dy;
    const rowOffset = y * W;
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx;
      const d2 = dx * dx + dy2;
      if (filled) {
        if (d2 <= r2) pixels[rowOffset + x] = colorIndex;
      } else {
        if (Math.abs(d2 - r2) < radius * 1.5) pixels[rowOffset + x] = colorIndex;
      }
    }
  }
}

// ==========================================
// 4. PONG SIMULATION ENGINE (AUTONOMOUS AI)
// ==========================================
function generatePongSimulation() {
  const W = 800;
  const H = 240;
  const FPS = 25;
  const totalFrames = 80; // 3.2s of fast-paced high-tech Pong action
  const palette = buildPongPalette();
  const encoder = new FastGifEncoder(W, H, palette);

  // Court geometry
  const courtTop = 44;
  const courtBottom = 230;
  const courtLeft = 24;
  const courtRight = 776;
  const netX = Math.floor(W / 2);

  // Paddles
  const paddleW = 10;
  const paddleH = 46;
  const p1X = courtLeft + 16;       // Left paddle: x=40
  const p2X = courtRight - 16 - paddleW; // Right paddle: x=750

  // Pre-calculate realistic physics rally trajectory that loops seamlessly
  let bx = 180, by = 130;
  let vx = 11.2, vy = 6.4;
  const ballRadius = 4.5;

  let p1Y = 120;
  let p2Y = 120;

  const frameData = [];
  const sparks = []; // Particles on impacts

  for (let f = 0; f < totalFrames; f++) {
    // 1. Move Ball
    bx += vx;
    by += vy;

    let hit = false;
    let hitType = null;
    let hitX = bx, hitY = by;

    // Bounce top / bottom walls
    if (by - ballRadius <= courtTop) {
      by = courtTop + ballRadius;
      vy = Math.abs(vy);
      hit = true;
      hitType = 'wall';
    } else if (by + ballRadius >= courtBottom) {
      by = courtBottom - ballRadius;
      vy = -Math.abs(vy);
      hit = true;
      hitType = 'wall';
    }

    // AI Predictive paddle movement
    // Paddle 1 (Denis - Cyan): Smooth tracking with intentional curve
    const targetP1Y = (vx < 0) ? by + Math.sin(f * 0.18) * 8 : H / 2 + Math.sin(f * 0.12) * 20;
    p1Y += (targetP1Y - p1Y) * 0.22;
    p1Y = Math.max(courtTop + paddleH / 2, Math.min(courtBottom - paddleH / 2, p1Y));

    // Paddle 2 (AI Bot - Purple): Smooth defensive positioning
    const targetP2Y = (vx > 0) ? by - Math.cos(f * 0.15) * 6 : H / 2 - Math.cos(f * 0.12) * 20;
    p2Y += (targetP2Y - p2Y) * 0.22;
    p2Y = Math.max(courtTop + paddleH / 2, Math.min(courtBottom - paddleH / 2, p2Y));

    // Collision with P1 (Left paddle)
    if (vx < 0 && bx - ballRadius <= p1X + paddleW && bx + ballRadius >= p1X) {
      if (by >= p1Y - paddleH / 2 - 4 && by <= p1Y + paddleH / 2 + 4) {
        bx = p1X + paddleW + ballRadius;
        const offset = (by - p1Y) / (paddleH / 2);
        vx = Math.abs(vx);
        vy = offset * 7.5 + (Math.random() - 0.5) * 0.8;
        hit = true;
        hitType = 'p1';
        hitX = p1X + paddleW;
        hitY = by;
      }
    }

    // Collision with P2 (Right paddle)
    if (vx > 0 && bx + ballRadius >= p2X && bx - ballRadius <= p2X + paddleW) {
      if (by >= p2Y - paddleH / 2 - 4 && by <= p2Y + paddleH / 2 + 4) {
        bx = p2X - ballRadius;
        const offset = (by - p2Y) / (paddleH / 2);
        vx = -Math.abs(vx);
        vy = offset * 7.5 + (Math.random() - 0.5) * 0.8;
        hit = true;
        hitType = 'p2';
        hitX = p2X;
        hitY = by;
      }
    }

    // Safety bounds reset if ball escapes during rally
    if (bx < courtLeft) {
      bx = courtLeft + 10;
      vx = Math.abs(vx);
    } else if (bx > courtRight) {
      bx = courtRight - 10;
      vx = -Math.abs(vx);
    }

    // Spawn sparks on impact
    if (hit) {
      const count = (hitType === 'wall') ? 6 : 14;
      const sparkColor = (hitType === 'p1') ? 10 : (hitType === 'p2') ? 14 : 17;
      for (let s = 0; s < count; s++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 2.0 + Math.random() * 4.5;
        sparks.push({
          x: hitX,
          y: hitY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 8,
          maxLife: 8,
          color: sparkColor
        });
      }
    }

    // Update active sparks
    for (let s = sparks.length - 1; s >= 0; s--) {
      const sp = sparks[s];
      sp.x += sp.vx;
      sp.y += sp.vy;
      sp.life--;
      if (sp.life <= 0) sparks.splice(s, 1);
    }

    frameData.push({
      bx, by,
      p1Y, p2Y,
      sparks: sparks.map(sp => ({ x: sp.x, y: sp.y, color: sp.color, life: sp.life, maxLife: sp.maxLife }))
    });
  }

  // ==========================================
  // 5. RENDER FRAMES
  // ==========================================
  console.log(`Rendering ${totalFrames} frames for Autonomous Pong simulation...`);

  for (let f = 0; f < totalFrames; f++) {
    const pixels = new Uint8Array(W * H);
    pixels.fill(0); // GitHub Dark Background #0d1117

    const cur = frameData[f];

    // 1. Draw Court Background & Glow Border
    // Outer court border
    fillRect(pixels, W, H, courtLeft - 1, courtTop - 1, (courtRight - courtLeft) + 2, 2, 3); // top border
    fillRect(pixels, W, H, courtLeft - 1, courtBottom, (courtRight - courtLeft) + 2, 2, 3);   // bottom border
    fillRect(pixels, W, H, courtLeft - 1, courtTop, 2, courtBottom - courtTop, 2);           // left line
    fillRect(pixels, W, H, courtRight, courtTop, 2, courtBottom - courtTop, 2);              // right line

    // Inner court field (subtle dark tint)
    fillRect(pixels, W, H, courtLeft + 1, courtTop + 1, (courtRight - courtLeft) - 2, (courtBottom - courtTop) - 2, 1);

    // Tech Grid dots inside court
    for (let gx = courtLeft + 40; gx < courtRight; gx += 48) {
      for (let gy = courtTop + 20; gy < courtBottom; gy += 24) {
        pixels[gy * W + gx] = 2;
      }
    }

    // Center Net Line (Dashed neon dots down middle)
    for (let ny = courtTop + 4; ny < courtBottom - 4; ny += 10) {
      fillRect(pixels, W, H, netX - 1, ny, 2, 5, 4);
    }

    // Center Circle (Subtle cybernetic ring)
    drawCircle(pixels, W, H, netX, (courtTop + courtBottom) / 2, 32, 2, false);
    drawCircle(pixels, W, H, netX, (courtTop + courtBottom) / 2, 3, 4, true);

    // 2. Scoreboard & HUD Header (Top Bar)
    // P1 Info (Denis Alves)
    fillRect(pixels, W, H, courtLeft, 8, 12, 12, 10); // Cyan Accent block
    drawText(pixels, W, H, courtLeft + 18, 10, 'DENIS ALVES [P1]', 11);
    drawScoreDigit(pixels, W, H, courtLeft + 160, 8, '0', 10, 2);
    drawScoreDigit(pixels, W, H, courtLeft + 180, 8, '7', 10, 2);

    // Center Tournament Title / Badge
    fillRect(pixels, W, H, netX - 110, 7, 220, 16, 21); // Card BG
    fillRect(pixels, W, H, netX - 110, 7, 220, 1, 3);
    fillRect(pixels, W, H, netX - 110, 22, 220, 1, 3);
    drawCircle(pixels, W, H, netX - 96, 15, 3, 18, true); // Live green dot
    drawText(pixels, W, H, netX - 86, 12, 'AUTONOMOUS PONG // AI LIVE', 6);
    drawText(pixels, W, H, netX + 70, 12, 'RALLY', 19);

    // P2 Info (Logic AI)
    drawScoreDigit(pixels, W, H, courtRight - 195, 8, '0', 14, 2);
    drawScoreDigit(pixels, W, H, courtRight - 175, 8, '5', 14, 2);
    drawText(pixels, W, H, courtRight - 145, 10, 'AI BOT [P2]', 15);
    fillRect(pixels, W, H, courtRight - 12, 8, 12, 12, 14); // Purple Accent block

    // 3. Motion Trail for Ball (past 6 frames)
    for (let t = 1; t <= 5; t++) {
      if (f - t >= 0) {
        const past = frameData[f - t];
        const trailRadius = Math.max(1, 4 - t);
        const trailColor = (t <= 2) ? 9 : 8;
        drawCircle(pixels, W, H, past.bx, past.by, trailRadius, trailColor, true);
      }
    }

    // 4. Draw Ball with Glowing Halo
    drawCircle(pixels, W, H, cur.bx, cur.by, 8, 8, true);   // Deep Cyan Aura
    drawCircle(pixels, W, H, cur.bx, cur.by, 6, 10, true);  // Bright Cyan Ring
    drawCircle(pixels, W, H, cur.bx, cur.by, 3, 7, true);   // Pure White Core

    // 5. Draw Paddles with Aura and Rounded Edges
    // Paddle 1 (Left - Denis)
    const p1Top = Math.floor(cur.p1Y - paddleH / 2);
    // Outer glow
    fillRect(pixels, W, H, p1X - 2, p1Top - 2, paddleW + 4, paddleH + 4, 8);
    // Core paddle
    fillRect(pixels, W, H, p1X, p1Top, paddleW, paddleH, 10);
    // Specular inner strip
    fillRect(pixels, W, H, p1X + 2, p1Top + 4, 2, paddleH - 8, 11);

    // Paddle 2 (Right - AI Bot)
    const p2Top = Math.floor(cur.p2Y - paddleH / 2);
    // Outer glow
    fillRect(pixels, W, H, p2X - 2, p2Top - 2, paddleW + 4, paddleH + 4, 12);
    // Core paddle
    fillRect(pixels, W, H, p2X, p2Top, paddleW, paddleH, 14);
    // Specular inner strip
    fillRect(pixels, W, H, p2X + 6, p2Top + 4, 2, paddleH - 8, 15);

    // 6. Draw Sparks
    for (const sp of cur.sparks) {
      const sx = Math.floor(sp.x);
      const sy = Math.floor(sp.y);
      if (sx >= 0 && sx < W && sy >= 0 && sy < H) {
        pixels[sy * W + sx] = sp.color;
        // Make bright sparks 2x2
        if (sp.life > sp.maxLife / 2) {
          if (sx + 1 < W) pixels[sy * W + sx + 1] = 7;
          if (sy + 1 < H) pixels[(sy + 1) * W + sx] = 7;
        }
      }
    }

    // Add frame to GIF (40ms = 25 fps)
    encoder.addFrame(pixels, 40);
  }

  const gifBuffer = encoder.finish();
  const outputDir = path.join(__dirname, '..', 'assets');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputPath = path.join(outputDir, 'pong.gif');
  fs.writeFileSync(outputPath, gifBuffer);

  // Also replace or update animation.gif to keep compatibility if desired
  const legacyPath = path.join(outputDir, 'animation.gif');
  fs.writeFileSync(legacyPath, gifBuffer);

  console.log(`Autonomous Pong simulation successfully generated!`);
  console.log(`Saved to: ${outputPath} (${(gifBuffer.length / 1024).toFixed(2)} KB)`);
  console.log(`Also mirrored to: ${legacyPath}`);
}

generatePongSimulation();
