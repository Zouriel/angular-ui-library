/** Error correction level for QR codes (`'L'` ~7%, `'M'` ~15%, `'Q'` ~25%, `'H'` ~30%). */
export type UiQrErrorCorrection = 'L' | 'M' | 'Q' | 'H';

const LEVEL_INDEX: Record<UiQrErrorCorrection, number> = { L: 0, M: 1, Q: 2, H: 3 };
// Format info 2-bit EC level indicator: L=01, M=00, Q=11, H=10.
const FORMAT_EC_BITS: Record<UiQrErrorCorrection, number> = { L: 1, M: 0, Q: 3, H: 2 };

// [ecCodewordsPerBlock, totalBlocks] for versions 1..40, indexed by level L/M/Q/H.
// Total data codewords = totalCodewords - ecPerBlock * totalBlocks.
// Group 1 has (totalBlocks - rem) blocks of floor(data / totalBlocks) bytes;
// Group 2 has (rem) blocks of floor(data / totalBlocks) + 1 bytes.
const EC_TABLE: Record<UiQrErrorCorrection, readonly (readonly [number, number])[]> = {
  L: [
    [7, 1], [10, 1], [15, 1], [20, 1], [26, 1], [18, 2], [20, 2], [24, 2], [30, 2], [18, 4],
    [20, 4], [24, 4], [26, 4], [30, 4], [22, 6], [24, 6], [28, 6], [30, 6], [28, 7], [28, 8],
    [28, 8], [28, 9], [30, 9], [30, 10], [26, 12], [28, 12], [30, 12], [30, 13], [30, 14], [30, 15],
    [30, 16], [30, 17], [30, 18], [30, 19], [30, 19], [30, 20], [30, 21], [30, 22], [30, 24], [30, 25],
  ],
  M: [
    [10, 1], [16, 1], [26, 1], [18, 2], [24, 2], [16, 4], [18, 4], [22, 4], [22, 5], [26, 5],
    [30, 5], [22, 8], [22, 9], [24, 9], [24, 10], [28, 10], [28, 11], [26, 13], [26, 14], [26, 16],
    [26, 17], [28, 17], [28, 18], [28, 20], [28, 21], [28, 23], [28, 25], [28, 26], [28, 28], [28, 29],
    [28, 31], [28, 33], [28, 35], [28, 37], [28, 38], [28, 40], [28, 43], [28, 45], [28, 47], [28, 49],
  ],
  Q: [
    [13, 1], [22, 1], [18, 2], [26, 2], [18, 4], [24, 4], [18, 6], [22, 6], [20, 8], [24, 8],
    [28, 8], [26, 10], [24, 12], [20, 16], [30, 12], [24, 17], [28, 16], [28, 18], [26, 21], [30, 20],
    [28, 23], [30, 23], [30, 25], [30, 27], [30, 29], [28, 34], [30, 34], [30, 35], [30, 38], [30, 40],
    [30, 43], [30, 45], [30, 48], [30, 51], [30, 53], [30, 56], [30, 59], [30, 62], [30, 65], [30, 68],
  ],
  H: [
    [17, 1], [28, 1], [22, 2], [16, 4], [22, 4], [28, 4], [26, 5], [26, 6], [24, 8], [28, 8],
    [24, 11], [28, 11], [22, 16], [24, 16], [24, 18], [30, 16], [28, 19], [28, 21], [26, 25], [28, 25],
    [30, 25], [24, 34], [30, 30], [30, 32], [30, 35], [30, 37], [30, 40], [30, 42], [30, 45], [30, 48],
    [30, 51], [30, 54], [30, 57], [30, 60], [30, 63], [30, 66], [30, 70], [30, 74], [30, 77], [30, 81],
  ],
};

// Alignment pattern center coordinates for versions 2..40 (version 1 has none).
const ALIGNMENT_POSITIONS: readonly (readonly number[])[] = [
  [],
  [6, 18], [6, 22], [6, 26], [6, 30], [6, 34],
  [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50], [6, 30, 54],
  [6, 32, 58], [6, 34, 62], [6, 26, 46, 66], [6, 26, 48, 70], [6, 26, 50, 74],
  [6, 30, 54, 78], [6, 30, 56, 82], [6, 30, 58, 86], [6, 34, 62, 90], [6, 28, 50, 72, 94],
  [6, 26, 50, 74, 98], [6, 30, 54, 78, 102], [6, 28, 54, 80, 106], [6, 32, 58, 84, 110], [6, 30, 58, 86, 114],
  [6, 34, 62, 90, 118], [6, 26, 50, 74, 98, 122], [6, 30, 54, 78, 102, 126], [6, 26, 52, 78, 104, 130], [6, 30, 56, 82, 108, 134],
  [6, 34, 60, 86, 112, 138], [6, 30, 58, 86, 114, 142], [6, 34, 62, 90, 118, 146], [6, 30, 54, 78, 102, 126, 150], [6, 24, 50, 76, 102, 128, 154],
  [6, 28, 54, 80, 106, 132, 158], [6, 32, 58, 84, 110, 136, 162], [6, 26, 54, 82, 110, 138, 166], [6, 30, 58, 86, 114, 142, 170],
];

// GF(256) lookup tables with primitive polynomial 0x11d.
const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
{
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255];
}

function gfMul(a: number, b: number): number {
  return a === 0 || b === 0 ? 0 : GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

function rsGenerator(degree: number): Uint8Array {
  let poly = new Uint8Array([1]);
  for (let i = 0; i < degree; i++) {
    const next = new Uint8Array(poly.length + 1);
    const factor = GF_EXP[i];
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], factor);
    }
    poly = next;
  }
  return poly;
}

function rsEncode(data: Uint8Array, ecCount: number): Uint8Array {
  const gen = rsGenerator(ecCount);
  const res = new Uint8Array(ecCount);
  for (let i = 0; i < data.length; i++) {
    const factor = data[i] ^ res[0];
    res.copyWithin(0, 1);
    res[ecCount - 1] = 0;
    for (let j = 0; j < ecCount; j++) {
      res[j] ^= gfMul(gen[j + 1], factor);
    }
  }
  return res;
}

function totalModulesCapacity(version: number): number {
  const size = 4 * version + 17;
  let total = size * size;
  // Three 8x8 finder+separator corners, two timing strips (excluding overlaps), one dark module, 30 format modules
  total -= 3 * 64 + 2 * (size - 16) + 31;
  if (version >= 7) total -= 36;
  const pos = ALIGNMENT_POSITIONS[version - 1];
  if (pos.length > 0) {
    const k = pos.length;
    total -= (k * k - 3) * 25;
    // Subtract back the 5 modules per alignment pattern on row 6 or col 6 that overlap timing patterns
    if (k >= 3) total += 2 * (k - 2) * 5;
  }
  return total;
}

function bchFormatInfo(ecBits: number, mask: number): number {
  const data = (ecBits << 3) | mask;
  let rem = data << 10;
  for (let i = 14; i >= 10; i--) {
    if ((rem >> i) & 1) rem ^= 0x537 << (i - 10);
  }
  return ((data << 10) | rem) ^ 0x5412;
}

function bchVersionInfo(version: number): number {
  let rem = version << 12;
  for (let i = 17; i >= 12; i--) {
    if ((rem >> i) & 1) rem ^= 0x1f25 << (i - 12);
  }
  return (version << 12) | rem;
}

function maskBit(mask: number, r: number, c: number): boolean {
  switch (mask) {
    case 0: return (r + c) % 2 === 0;
    case 1: return r % 2 === 0;
    case 2: return c % 3 === 0;
    case 3: return (r + c) % 3 === 0;
    case 4: return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0;
    case 5: return ((r * c) % 2 + (r * c) % 3) === 0;
    case 6: return (((r * c) % 2 + (r * c) % 3) % 2) === 0;
    case 7: return (((r + c) % 2 + (r * c) % 3) % 2) === 0;
    default: return false;
  }
}

function penaltyScore(grid: boolean[][]): number {
  const n = grid.length;
  let score = 0;

  // Rule 1: 5+ consecutive same-colour modules in rows and columns
  // Rule 3: 1:1:3:1:1 dark:light:dark:light:dark preceded or followed by 4 light modules
  const checkLine = (get: (i: number) => boolean) => {
    let runColor = get(0);
    let runLen = 1;
    let bits = runColor ? 1 : 0;
    for (let i = 1; i < n; i++) {
      const bit = get(i);
      if (bit === runColor) {
        runLen++;
      } else {
        if (runLen >= 5) score += 3 + (runLen - 5);
        runColor = bit;
        runLen = 1;
      }
      bits = ((bits << 1) | (bit ? 1 : 0)) & 0x7ff;
      if (i >= 10 && (bits === 0b10111010000 || bits === 0b00001011101)) {
        score += 40;
      }
    }
    if (runLen >= 5) score += 3 + (runLen - 5);
  };

  for (let i = 0; i < n; i++) {
    checkLine((c) => grid[i][c]);
    checkLine((r) => grid[r][i]);
  }

  // Rule 2: 2x2 blocks of the same colour
  for (let r = 0; r < n - 1; r++) {
    const row0 = grid[r];
    const row1 = grid[r + 1];
    for (let c = 0; c < n - 1; c++) {
      const v = row0[c];
      if (v === row0[c + 1] && v === row1[c] && v === row1[c + 1]) {
        score += 3;
      }
    }
  }

  // Rule 4: proportion of dark modules
  let dark = 0;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) if (grid[r][c]) dark++;
  }
  const pct = (dark * 100) / (n * n);
  const k = Math.floor(Math.abs(pct - 50) / 5);
  score += k * 10;

  return score;
}

function buildFunctionGrid(version: number): { base: boolean[][]; fn: boolean[][] } {
  const n = 4 * version + 17;
  const base = Array.from({ length: n }, () => Array<boolean>(n).fill(false));
  const fn = Array.from({ length: n }, () => Array<boolean>(n).fill(false));

  const setFn = (r: number, c: number, dark: boolean) => {
    if (r >= 0 && r < n && c >= 0 && c < n) {
      base[r][c] = dark;
      fn[r][c] = true;
    }
  };

  const placeFinder = (top: number, left: number) => {
    for (let dr = -1; dr <= 7; dr++) {
      for (let dc = -1; dc <= 7; dc++) {
        const r = top + dr;
        const c = left + dc;
        if (r < 0 || r >= n || c < 0 || c >= n) continue;
        const inOuter = dr === 0 || dr === 6 || dc === 0 || dc === 6;
        const inInner = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4;
        const inSep = dr === -1 || dr === 7 || dc === -1 || dc === 7;
        setFn(r, c, !inSep && (inOuter || inInner));
      }
    }
  };

  placeFinder(0, 0);
  placeFinder(0, n - 7);
  placeFinder(n - 7, 0);

  // Alignment patterns
  const pos = ALIGNMENT_POSITIONS[version - 1];
  for (const ar of pos) {
    for (const ac of pos) {
      if (fn[ar][ac]) continue;
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const dark = Math.max(Math.abs(dr), Math.abs(dc)) !== 1;
          setFn(ar + dr, ac + dc, dark);
        }
      }
    }
  }

  // Timing patterns
  for (let i = 8; i < n - 8; i++) {
    const dark = i % 2 === 0;
    if (!fn[6][i]) setFn(6, i, dark);
    if (!fn[i][6]) setFn(i, 6, dark);
  }

  // Dark module
  setFn(4 * version + 9, 8, true);

  // Reserve format info modules
  for (let i = 0; i < 9; i++) {
    if (i !== 6) {
      fn[8][i] = true;
      fn[i][8] = true;
    }
  }
  for (let i = 0; i < 8; i++) {
    fn[8][n - 1 - i] = true;
    if (i < 7) fn[n - 1 - i][8] = true;
  }

  // Reserve version info modules (versions 7..40)
  if (version >= 7) {
    const verBits = bchVersionInfo(version);
    for (let i = 0; i < 18; i++) {
      const dark = ((verBits >> i) & 1) === 1;
      const a = Math.floor(i / 3);
      const b = n - 11 + (i % 3);
      setFn(a, b, dark);
      setFn(b, a, dark);
    }
  }

  return { base, fn };
}

function writeFormatInfo(grid: boolean[][], ecBits: number, mask: number): void {
  const n = grid.length;
  const bits = bchFormatInfo(ecBits, mask);

  for (let i = 0; i < 15; i++) {
    const dark = ((bits >> i) & 1) === 1;
    // Vertical strip (top-left and bottom-left)
    if (i < 6) grid[i][8] = dark;
    else if (i < 8) grid[i + 1][8] = dark;
    else grid[n - 15 + i][8] = dark;

    // Horizontal strip (top-right and top-left)
    if (i < 8) grid[8][n - 1 - i] = dark;
    else if (i === 8) grid[8][7] = dark;
    else grid[8][14 - i] = dark;
  }
}

/**
 * Encodes `value` as a UTF-8 byte-mode QR code (versions 1–40) at the given error correction level.
 * Returns a square `boolean[][]` matrix where `true` is a dark module and `false` is a light module,
 * without any quiet zone. Throws if the UTF-8 payload exceeds version 40 capacity.
 */
export function uiQrMatrix(value: string, level: UiQrErrorCorrection = 'M'): boolean[][] {
  const bytes = new TextEncoder().encode(value);
  const table = EC_TABLE[level];

  let version = 0;
  let totalCodewords = 0;
  let totalDataCodewords = 0;
  let ecPerBlock = 0;
  let numBlocks = 0;

  for (let v = 1; v <= 40; v++) {
    const capBits = totalModulesCapacity(v);
    const codewords = Math.floor(capBits / 8);
    const [ec, blocks] = table[v - 1];
    const dataCodewords = codewords - ec * blocks;
    const countBits = v <= 9 ? 8 : 16;
    const neededBits = 4 + countBits + bytes.length * 8;
    if (neededBits <= dataCodewords * 8) {
      version = v;
      totalCodewords = codewords;
      totalDataCodewords = dataCodewords;
      ecPerBlock = ec;
      numBlocks = blocks;
      break;
    }
  }

  if (version === 0) {
    throw new Error(`QR code data (${bytes.length} bytes) exceeds version 40 capacity at level ${level}`);
  }

  // Build data bit stream (mode 0100 + length + UTF-8 bytes + terminator + padding)
  const dataBits: number[] = [];
  const pushBits = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) dataBits.push((val >> i) & 1);
  };
  pushBits(0b0100, 4);
  pushBits(bytes.length, version <= 9 ? 8 : 16);
  for (const b of bytes) pushBits(b, 8);

  const maxDataBits = totalDataCodewords * 8;
  const term = Math.min(4, maxDataBits - dataBits.length);
  for (let i = 0; i < term; i++) dataBits.push(0);
  while (dataBits.length % 8 !== 0) dataBits.push(0);

  const dataBytes = new Uint8Array(totalDataCodewords);
  for (let i = 0; i < dataBits.length; i += 8) {
    let byte = 0;
    for (let b = 0; b < 8; b++) byte = (byte << 1) | dataBits[i + b];
    dataBytes[i >> 3] = byte;
  }
  let padIdx = dataBits.length >> 3;
  for (let p = 0; padIdx < totalDataCodewords; padIdx++, p++) {
    dataBytes[padIdx] = p % 2 === 0 ? 0xec : 0x11;
  }

  // Split into blocks and compute RS error correction
  const g1Data = Math.floor(totalDataCodewords / numBlocks);
  const g2Blocks = totalDataCodewords % numBlocks;
  const g1Blocks = numBlocks - g2Blocks;
  const maxDataLen = g2Blocks > 0 ? g1Data + 1 : g1Data;

  const dataBlocks: Uint8Array[] = [];
  const ecBlocks: Uint8Array[] = [];
  let offset = 0;
  for (let b = 0; b < numBlocks; b++) {
    const len = b < g1Blocks ? g1Data : g1Data + 1;
    const block = dataBytes.subarray(offset, offset + len);
    offset += len;
    dataBlocks.push(block);
    ecBlocks.push(rsEncode(block, ecPerBlock));
  }

  // Interleave data and EC codewords
  const interleaved = new Uint8Array(totalCodewords);
  let out = 0;
  for (let col = 0; col < maxDataLen; col++) {
    for (let b = 0; b < numBlocks; b++) {
      if (col < dataBlocks[b].length) interleaved[out++] = dataBlocks[b][col];
    }
  }
  for (let col = 0; col < ecPerBlock; col++) {
    for (let b = 0; b < numBlocks; b++) {
      interleaved[out++] = ecBlocks[b][col];
    }
  }

  // Place function patterns and data modules
  const { base, fn } = buildFunctionGrid(version);
  const n = base.length;
  let bitIndex = 0;
  const totalBits = totalCodewords * 8;
  let dirUp = true;

  for (let col = n - 1; col > 0; col -= 2) {
    if (col === 6) col--;
    for (let step = 0; step < n; step++) {
      const r = dirUp ? n - 1 - step : step;
      for (let dc = 0; dc < 2; dc++) {
        const c = col - dc;
        if (fn[r][c]) continue;
        let dark = false;
        if (bitIndex < totalBits) {
          dark = ((interleaved[bitIndex >> 3] >> (7 - (bitIndex & 7))) & 1) === 1;
        }
        base[r][c] = dark;
        bitIndex++;
      }
    }
    dirUp = !dirUp;
  }

  // Evaluate all 8 masks and pick the lowest penalty score
  const ecBits = FORMAT_EC_BITS[level];
  let bestGrid: boolean[][] | null = null;
  let bestScore = Infinity;

  for (let mask = 0; mask < 8; mask++) {
    const candidate = base.map((row, r) =>
      row.map((val, c) => (fn[r][c] ? val : val !== maskBit(mask, r, c))),
    );
    writeFormatInfo(candidate, ecBits, mask);
    const score = penaltyScore(candidate);
    if (score < bestScore) {
      bestScore = score;
      bestGrid = candidate;
    }
  }

  return bestGrid!;
}
