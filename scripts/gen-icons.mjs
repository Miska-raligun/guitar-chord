#!/usr/bin/env node
// Generates public/icon-192.png and public/icon-512.png
// Guitar pick shape on dark background — no external dependencies
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'

const AMBER  = [197, 98,  47]   // #c5622f
const BG     = [17,  16,  13]   // #11100d (zinc-950)
const AMBER2 = [229, 140, 100]  // lighter highlight

// CRC32 helper
const crcTable = new Int32Array(256)
for (let i = 0; i < 256; i++) {
  let c = i
  for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)
  crcTable[i] = c
}
function crc32(buf) {
  let crc = -1
  for (const b of buf) crc = crcTable[(crc ^ b) & 0xFF] ^ (crc >>> 8)
  return (crc ^ -1) >>> 0
}
function pngChunk(type, data) {
  const typeB = Buffer.from(type, 'ascii')
  const len = Buffer.allocUnsafe(4); len.writeUInt32BE(data.length)
  const crcB = Buffer.allocUnsafe(4)
  crcB.writeUInt32BE(crc32(Buffer.concat([typeB, data])))
  return Buffer.concat([len, typeB, data, crcB])
}

// Guitar pick SDF: returns distance to pick edge (negative = inside)
function pickSDF(nx, ny) {
  // ny positive = downward; pick has round top and pointed bottom
  const TOP_CY    = -0.18   // center of top circle
  const TOP_R     = 0.72    // radius of top circle
  const TRANS_Y   = 0.12    // y where taper begins
  const TRANS_HW  = 0.58    // half-width at transition
  const TIP_Y     = 0.84    // y of bottom tip

  // Round top: circle SDF
  const circleDist = Math.hypot(nx, ny - TOP_CY) - TOP_R

  // Bottom taper: linear narrowing to tip
  if (ny < TRANS_Y) return circleDist

  const progress = (ny - TRANS_Y) / (TIP_Y - TRANS_Y)
  const halfW = TRANS_HW * (1 - progress)
  const taperDist = Math.max(Math.abs(nx) - halfW, ny - TIP_Y)

  return Math.min(circleDist, taperDist)
}

function generatePNG(size) {
  const pixels = new Uint8Array(size * size * 3)
  const AA = 1.5 / size * 2  // anti-aliasing width in normalised units

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Normalise to -1..1
      const nx = (x / size - 0.5) * 2
      const ny = (y / size - 0.5) * 2

      const d = pickSDF(nx, ny)
      const t = Math.max(0, Math.min(1, -d / AA + 0.5))

      // Slight highlight on upper-left quadrant for depth
      const highlight = nx < 0 && ny < -0.1 ? 0.18 : 0

      const r = Math.round(BG[0] + (AMBER[0] + (AMBER2[0] - AMBER[0]) * highlight - BG[0]) * t)
      const g = Math.round(BG[1] + (AMBER[1] + (AMBER2[1] - AMBER[1]) * highlight - BG[1]) * t)
      const b = Math.round(BG[2] + (AMBER[2] + (AMBER2[2] - AMBER[2]) * highlight - BG[2]) * t)

      const i = (y * size + x) * 3
      pixels[i] = r; pixels[i+1] = g; pixels[i+2] = b
    }
  }

  // Build PNG
  const ihdr = Buffer.allocUnsafe(13)
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0

  const raw = Buffer.allocUnsafe(size * (1 + size * 3))
  for (let y = 0; y < size; y++) {
    raw[y * (1 + size * 3)] = 0  // filter: None
    for (let x = 0; x < size; x++) {
      const src = (y * size + x) * 3
      const dst = y * (1 + size * 3) + 1 + x * 3
      raw[dst] = pixels[src]; raw[dst+1] = pixels[src+1]; raw[dst+2] = pixels[src+2]
    }
  }

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw, { level: 6 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

mkdirSync('public', { recursive: true })
writeFileSync('public/icon-192.png', generatePNG(192))
writeFileSync('public/icon-512.png', generatePNG(512))
console.log('Icons generated: public/icon-192.png, public/icon-512.png')
