import jsQR from 'jsqr';
import { describe, expect, it } from 'vitest';
import { uiQrMatrix, type UiQrErrorCorrection } from './qr-matrix';

const LEVELS: readonly UiQrErrorCorrection[] = ['L', 'M', 'Q', 'H'];

function decodeMatrix(matrix: boolean[][], margin = 4): { text: string; bytes: Uint8Array } | null {
  const scale = 4;
  const n = matrix.length;
  const side = (n + margin * 2) * scale;
  const rgba = new Uint8ClampedArray(side * side * 4);
  rgba.fill(255);

  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!matrix[r][c]) continue;
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const y = (r + margin) * scale + dy;
          const x = (c + margin) * scale + dx;
          const idx = (y * side + x) * 4;
          rgba[idx] = 0;
          rgba[idx + 1] = 0;
          rgba[idx + 2] = 0;
        }
      }
    }
  }

  const res = jsQR(rgba, side, side, { inversionAttempts: 'dontInvert' });
  if (!res) return null;
  const bytes = new Uint8Array(res.binaryData);
  return { text: new TextDecoder().decode(bytes), bytes };
}

// Reference 21x21 (Version 1, Level M, Byte mode, mask 4) matrix for "HELLO WORLD"
const HELLO_WORLD_V1_M = [
  '111111101100101111111',
  '100000100001001000001',
  '101110100101001011101',
  '101110101001001011101',
  '101110101110101011101',
  '100000101001001000001',
  '111111101010101111111',
  '000000001001100000000',
  '100010111111011111001',
  '000100001011100001111',
  '001111110011011010010',
  '111110001100010000000',
  '111110101010101100110',
  '000000001010111101011',
  '111111101110101011010',
  '100000100101110110011',
  '101110101101011000110',
  '101110100100100011011',
  '101110100111000111000',
  '100000100001010000000',
  '111111101111111110101',
];

describe('uiQrMatrix', () => {
  it('encodes and round-trips short ASCII, long URLs, and UTF-8 Thaana across all error levels', () => {
    const vectors = [
      '',
      'HELLO WORLD',
      'BCP-2026-0418',
      'https://addu.gov.mv/verify/permit/BCP-2026-0418?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
      'އައްޑޫ ސިޓީ ކައުންސިލް — ހުއްދަ BCP-2026-0418',
    ];

    for (const value of vectors) {
      for (const level of LEVELS) {
        const matrix = uiQrMatrix(value, level);
        expect(matrix.length).toBeGreaterThanOrEqual(21);
        expect((matrix.length - 17) % 4).toBe(0);
        for (const row of matrix) expect(row.length).toBe(matrix.length);

        const decoded = decodeMatrix(matrix);
        expect(decoded, `Failed to decode "${value}" at level ${level}`).not.toBeNull();
        expect(decoded!.text).toBe(value);
      }
    }
  });

  it('exercises version >= 7 (including BCH version info blocks) and decodes cleanly', () => {
    const longPayload = 'https://addu.gov.mv/verify?batch=' + 'A1B2C3D4E5'.repeat(22);
    for (const level of LEVELS) {
      const matrix = uiQrMatrix(longPayload, level);
      const version = (matrix.length - 17) / 4;
      expect(version).toBeGreaterThanOrEqual(7);

      const decoded = decodeMatrix(matrix);
      expect(decoded, `Failed to decode version ${version} at level ${level}`).not.toBeNull();
      expect(decoded!.text).toBe(longPayload);
    }
  });

  it('matches the pinned Version 1 Level M matrix for "HELLO WORLD"', () => {
    const matrix = uiQrMatrix('HELLO WORLD', 'M');
    const asStrings = matrix.map((row) => row.map((b) => (b ? '1' : '0')).join(''));
    expect(asStrings).toEqual(HELLO_WORLD_V1_M);
  });

  it('throws when the UTF-8 payload exceeds version 40 capacity', () => {
    const tooLong = 'x'.repeat(2954);
    expect(() => uiQrMatrix(tooLong, 'L')).toThrow();
    expect(() => uiQrMatrix('x'.repeat(1274), 'H')).toThrow();
  });
});
