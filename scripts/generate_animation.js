const fs = require('fs');
const path = require('path');

// Simple, self-contained GIF89a Encoder in pure Node.js
class SimpleGifEncoder {
  constructor(width, height, palette) {
    this.width = width;
    this.height = height;
    this.palette = palette; // Array of [r,g,b] up to 256
    this.buffers = [];
    
    // Fill palette to 256 colors if smaller
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
    buf[10] = 0xF7; // 256 colors
    buf[11] = 0;    // bg index
    buf[12] = 0;    // aspect ratio

    // Write Global Color Table (768 bytes)
    for (let i = 0; i < 256; i++) {
      buf[13 + i * 3] = this.palette[i][0];
      buf[13 + i * 3 + 1] = this.palette[i][1];
      buf[13 + i * 3 + 2] = this.palette[i][2];
    }
    this.buffers.push(buf);

    // Application Extension for Netscape Loop Count
    const loopBuf = Buffer.from([
      0x21, 0xFF, 0x0B,
      0x4E, 0x45, 0x54, 0x53, 0x43, 0x41, 0x50, 0x45, 0x32, 0x2E, 0x30, // NETSCAPE2.0
      0x03, 0x01, 0x00, 0x00, 0x00 // Infinite loop
    ]);
    this.buffers.push(loopBuf);
  }

  addFrame(pixelIndices, delayMs = 40) {
    const delayHundredths = Math.round(delayMs / 10);
    
    // Graphic Control Extension
    const gce = Buffer.from([
      0x21, 0xF9, 0x04,
      0x04, // Disposal method: 1 (do not dispose)
      delayHundredths & 0xFF, (delayHundredths >> 8) & 0xFF,
      0xFF, // transparent index (none)
      0x00
    ]);
    this.buffers.push(gce);

    // Image Descriptor
    const id = Buffer.alloc(10);
    id[0] = 0x2C; // ','
    id.writeUInt16LE(0, 1);
    id.writeUInt16LE(0, 3);
    id.writeUInt16LE(this.width, 5);
    id.writeUInt16LE(this.height, 7);
    id[9] = 0x00; // no local color table
    this.buffers.push(id);

    // LZW Compression
    const lzwData = this.lzwEncode(pixelIndices, 8);
    this.buffers.push(lzwData);
  }

  lzwEncode(pixels, minCodeSize) {
    const clearCode = 1 << minCodeSize;
    const eofCode = clearCode + 1;
    let codeSize = minCodeSize + 1;
    let nextCode = eofCode + 1;

    let dictionary = new Map();
    const resetDict = () => {
      dictionary.clear();
      for (let i = 0; i < clearCode; i++) {
        dictionary.set(String.fromCharCode(i), i);
      }
      codeSize = minCodeSize + 1;
      nextCode = eofCode + 1;
    };

    resetDict();

    const outputBits = [];
    const writeBits = (val, count) => {
      for (let i = 0; i < count; i++) {
        outputBits.push((val >> i) & 1);
      }
    };

    writeBits(clearCode, codeSize);

    let prefix = '';
    for (let i = 0; i < pixels.length; i++) {
      const char = String.fromCharCode(pixels[i]);
      const combo = prefix + char;

      if (dictionary.has(combo)) {
        prefix = combo;
      } else {
        writeBits(dictionary.get(prefix), codeSize);
        if (nextCode < 4096) {
          dictionary.set(combo, nextCode++);
          if (nextCode === (1 << codeSize) && codeSize < 12) {
            codeSize++;
          }
        } else {
          writeBits(clearCode, codeSize);
          resetDict();
        }
        prefix = char;
      }
    }

    if (prefix !== '') {
      writeBits(dictionary.get(prefix), codeSize);
    }
    writeBits(eofCode, codeSize);

    // Convert bit stream to byte sub-blocks
    const bytes = [];
    for (let i = 0; i < outputBits.length; i += 8) {
      let byte = 0;
      for (let bit = 0; bit < 8; bit++) {
        if (i + bit < outputBits.length) {
          byte |= (outputBits[i + bit] << bit);
        }
      }
      bytes.push(byte);
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
    this.buffers.push(Buffer.from([0x3B])); // Trailer ';'
    return Buffer.concat(this.buffers);
  }
}

// Color Palette Definition (256 entries)
function buildPalette() {
  const palette = [
    [13, 17, 23],    // 0: #0d1117 (bg)
    [22, 27, 34],    // 1: #161b22 (grid)
    [33, 38, 45],    // 2: #21262d (inactive gray block)
    [48, 54, 61],    // 3: #30363d (gray border)
    [35, 134, 54],   // 4: #238636 (active green)
    [46, 160, 67],   // 5: #2ea043 (vibrant green)
    [63, 185, 80],   // 6: #3fb950 (glow green)
    [86, 211, 100],  // 7: #56d364 (bright flash)
    [56, 189, 248],  // 8: #38bdf8 (cyan blue ball core)
    [14, 165, 233],  // 9: #0ea5e9 (blue trail)
    [96, 165, 250],  // 10: #60a5fa (blue glow)
    [255, 255, 255], // 11: white specular
    [20, 60, 95],    // 12: dark blue aura
    [15, 23, 42]     // 13: slate shadow
  ];

  // Gradients for blue ball & green impact
  for (let i = 0; i < 240; i++) {
    const r = Math.min(255, Math.floor(13 + i * 0.8));
    const g = Math.min(255, Math.floor(17 + i * 0.9));
    const b = Math.min(255, Math.floor(23 + i * 1.0));
    palette.push([r, g, b]);
  }
  return palette;
}

function findNearestColorIndex(r, g, b, palette) {
  let minDistance = Infinity;
  let bestIdx = 0;
  for (let i = 0; i < palette.length; i++) {
    const dr = r - palette[i][0];
    const dg = g - palette[i][1];
    const db = b - palette[i][2];
    const dist = dr * dr + dg * dg + db * db;
    if (dist < minDistance) {
      minDistance = dist;
      bestIdx = i;
      if (dist === 0) break;
    }
  }
  return bestIdx;
}

function renderAnimation() {
  const width = 760;
  const height = 220;
  const totalFrames = 60;
  const palette = buildPalette();

  const encoder = new SimpleGifEncoder(width, height, palette);

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

  // Pre-calculate trajectory of blue ball
  const ballPos = [];
  let bx = padX + 40, by = padY + 30;
  let vx = 7.8, vy = 5.2;

  const minX = padX + 15, maxX = width - padX - 15;
  const minY = padY + 15, maxY = height - padY - 15;

  const hitEvents = new Map();

  for (let f = 0; f < totalFrames; f++) {
    bx += vx;
    by += vy;

    if (bx <= minX || bx >= maxX) {
      vx *= -1;
      bx = Math.max(minX, Math.min(bx, maxX));
    }
    if (by <= minY || by >= maxY) {
      vy *= -1;
      by = Math.max(minY, Math.min(by, maxY));
    }

    ballPos.push({ x: bx, y: by });

    // Collision detection with blocks
    const colIdx = Math.floor((bx - padX) / (gridW + blockGap));
    const rowIdx = Math.floor((by - padY) / (gridH + blockGap));

    if (colIdx >= 0 && colIdx < cols && rowIdx >= 0 && rowIdx < rows) {
      const key = `${rowIdx},${colIdx}`;
      if (!hitEvents.has(key)) {
        hitEvents.set(key, f);
        // Cascade activation to neighbors
        for (let dr of [-1, 0, 1]) {
          for (let dc of [-1, 0, 1]) {
            const nr = rowIdx + dr, nc = colIdx + dc;
            if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
              const nKey = `${nr},${nc}`;
              if (!hitEvents.has(nKey) && Math.abs(dr) + Math.abs(dc) === 1) {
                hitEvents.set(nKey, f + 5);
              }
            }
          }
        }
      }
    }
  }

  // Render Frame Pixels
  for (let f = 0; f < totalFrames; f++) {
    const pixels = new Uint8Array(width * height);
    pixels.fill(0); // 0 = #0d1117

    // Draw Grid Lines
    for (let r = 0; r <= rows; r++) {
      const y = Math.floor(padY + r * (gridH + blockGap) - blockGap / 2);
      if (y >= 0 && y < height) {
        for (let x = 0; x < width; x++) pixels[y * width + x] = 1;
      }
    }
    for (let c = 0; c <= cols; c++) {
      const x = Math.floor(padX + c * (gridW + blockGap) - blockGap / 2);
      if (x >= 0 && x < width) {
        for (let y = 0; y < height; y++) pixels[y * width + x] = 1;
      }
    }

    // Draw Blocks
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        let x0 = padX + c * (gridW + blockGap);
        let y0 = padY + r * (gridH + blockGap);
        let x1 = x0 + gridW;
        let y1 = y0 + gridH;

        const key = `${r},${c}`;
        const isHit = hitEvents.has(key) && hitEvents.get(key) <= f;
        const isActive = initialGreen.has(key) || isHit;

        let colorIdx = isActive ? 4 : 2; // Green vs Gray

        // Scale & Flash effect on hit
        if (hitEvents.has(key)) {
          const hitF = hitEvents.get(key);
          if (f >= hitF && f < hitF + 10) {
            const prog = (f - hitF) / 10.0;
            const scale = 1.0 + 0.2 * Math.sin(prog * Math.PI);
            const cw = (x1 - x0) / 2, ch = (y1 - y0) / 2;
            const cx = x0 + cw, cy = y0 + ch;

            x0 = cx - cw * scale;
            x1 = cx + cw * scale;
            y0 = cy - ch * scale;
            y1 = cy + ch * scale;

            colorIdx = prog < 0.5 ? 7 : 6; // Flash bright green
          }
        }

        // Draw Rounded Rect Block
        const rad = 3;
        for (let py = Math.floor(y0); py < Math.ceil(y1); py++) {
          for (let px = Math.floor(x0); px < Math.ceil(x1); px++) {
            if (px >= 0 && px < width && py >= 0 && py < height) {
              // Corner rounding check
              const dx = Math.max(0, Math.max(x0 + rad - px, px - (x1 - rad)));
              const dy = Math.max(0, Math.max(y0 + rad - py, py - (y1 - rad)));
              if (dx * dx + dy * dy <= rad * rad) {
                pixels[py * width + px] = colorIdx;
              }
            }
          }
        }
      }
    }

    // Draw Blue Ball Trail
    for (let t = 1; t <= 5; t++) {
      if (f - t >= 0) {
        const tp = ballPos[f - t];
        const trRad = Math.max(2, 7 - t);
        for (let py = Math.floor(tp.y - trRad); py <= Math.ceil(tp.y + trRad); py++) {
          for (let px = Math.floor(tp.x - trRad); px <= Math.ceil(tp.x + trRad); px++) {
            if (px >= 0 && px < width && py >= 0 && py < height) {
              const distSq = (px - tp.x) * (px - tp.x) + (py - tp.y) * (py - tp.y);
              if (distSq <= trRad * trRad) {
                pixels[py * width + px] = 9; // trail blue
              }
            }
          }
        }
      }
    }

    // Draw Blue Ball
    const b = ballPos[f];
    const bRad = 9;

    // Glow ring
    for (let py = Math.floor(b.y - bRad - 3); py <= Math.ceil(b.y + bRad + 3); py++) {
      for (let px = Math.floor(b.x - bRad - 3); px <= Math.ceil(b.x + bRad + 3); px++) {
        if (px >= 0 && px < width && py >= 0 && py < height) {
          const distSq = (px - b.x) * (px - b.x) + (py - b.y) * (py - b.y);
          if (distSq <= (bRad + 3) * (bRad + 3)) {
            if (pixels[py * width + px] === 0 || pixels[py * width + px] === 1) {
              pixels[py * width + px] = 12; // aura
            }
          }
        }
      }
    }

    // Ball Core
    for (let py = Math.floor(b.y - bRad); py <= Math.ceil(b.y + bRad); py++) {
      for (let px = Math.floor(b.x - bRad); px <= Math.ceil(b.x + bRad); px++) {
        if (px >= 0 && px < width && py >= 0 && py < height) {
          const distSq = (px - b.x) * (px - b.x) + (py - b.y) * (py - b.y);
          if (distSq <= bRad * bRad) {
            pixels[py * width + px] = 8; // cyan core
          }
        }
      }
    }

    // Specular Highlight
    for (let py = Math.floor(b.y - 4); py <= Math.floor(b.y - 1); py++) {
      for (let px = Math.floor(b.x - 4); px <= Math.floor(b.x - 1); px++) {
        if (px >= 0 && px < width && py >= 0 && py < height) {
          pixels[py * width + px] = 11; // white
        }
      }
    }

    encoder.addFrame(pixels, 40); // 40ms = 25 fps
  }

  const gifBuffer = encoder.finish();
  const outputDir = path.join(__dirname, '..', 'assets');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const gifPath = path.join(outputDir, 'animation.gif');
  fs.writeFileSync(gifPath, gifBuffer);

  console.log(`GIF animation generated successfully: ${gifPath}`);
  console.log(`Size: ${(gifBuffer.length / 1024).toFixed(2)} KB`);
}

renderAnimation();
