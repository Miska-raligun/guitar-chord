// Tone / pickup configuration — module-level singleton so all audio functions
// read the same state without prop drilling.

export type PickupType = 'S' | 'H' | null   // Single, Humbucker, Off/absent
export type PickupPos  = 'B' | 'BM' | 'M' | 'MN' | 'N'
export type EffectType = 'clean' | 'overdrive' | 'distortion'
export type GuitarMode = 'acoustic' | 'electric'

export interface PickupConfig {
  mode:     GuitarMode
  bridge:   PickupType
  middle:   PickupType
  neck:     PickupType
  position: PickupPos
  effect:   EffectType
}

export interface KsToneParams {
  loopFilterA: number  // KS averaging coefficient: 0.5=neutral, higher=brighter
  decay:       number  // per-sample decay factor
  driveAmount: number  // 0=clean, 0-1=overdrive/distortion
  lpCutoff:    number  // post-drive lowpass Hz (0=bypass)
}

// ── Lookup table for (position × active_type) → base KS params ──────────────
// active_type: 'S' | 'H' | 'SH' (mixed combined position)
// lpClean: gentle post-KS lowpass for clean mode (0 = bypass / bright)
const TONE_TABLE: Record<string, { loopA: number; decay: number; lpClean: number }> = {
  B_S:    { loopA: 0.82, decay: 0.9960, lpClean: 0     },
  B_H:    { loopA: 0.66, decay: 0.9975, lpClean: 5500  },
  BM_S:   { loopA: 0.76, decay: 0.9968, lpClean: 0     },
  BM_SH:  { loopA: 0.72, decay: 0.9970, lpClean: 4000  },
  BM_H:   { loopA: 0.61, decay: 0.9978, lpClean: 5000  },
  M_S:    { loopA: 0.64, decay: 0.9970, lpClean: 4500  },
  M_H:    { loopA: 0.52, decay: 0.9982, lpClean: 5500  },
  MN_S:   { loopA: 0.58, decay: 0.9972, lpClean: 5000  },
  MN_SH:  { loopA: 0.54, decay: 0.9975, lpClean: 5200  },
  MN_H:   { loopA: 0.44, decay: 0.9985, lpClean: 5200  },
  N_S:    { loopA: 0.52, decay: 0.9973, lpClean: 5000  },
  N_H:    { loopA: 0.32, decay: 0.9988, lpClean: 4000  },
}

function activeTypeKey(cfg: PickupConfig): string {
  const { bridge, middle, neck, position } = cfg
  const p1 = position.length === 1 ? position : position[0] as 'B' | 'M' | 'N'
  const p2 = position.length === 2 ? position[1] as 'M' | 'N' : null

  if (!p2) {
    const t = p1 === 'B' ? bridge : p1 === 'M' ? middle : neck
    return t ?? 'S'
  }
  // Combined position
  const ta = p1 === 'B' ? bridge : middle
  const tb = p1 === 'M' ? (p2 === 'N' ? neck : middle) : neck
  if (ta === tb) return ta ?? 'S'
  return 'SH'
}

const ACOUSTIC_PARAMS: KsToneParams = {
  loopFilterA: 0.50,
  decay:       0.998,
  driveAmount: 0,
  lpCutoff:    0,
}

export function computeKsParams(cfg: PickupConfig): KsToneParams {
  if (cfg.mode === 'acoustic') return ACOUSTIC_PARAMS

  const key = `${cfg.position}_${activeTypeKey(cfg)}`
  const base = TONE_TABLE[key] ?? { loopA: 0.60, decay: 0.997, lpClean: 0 }

  const driveAmount = cfg.effect === 'clean' ? 0 : cfg.effect === 'overdrive' ? 0.35 : 0.75
  const decayBoost  = cfg.effect === 'clean' ? 0 : cfg.effect === 'overdrive' ? 0.001 : 0.0015
  const lpCutoff    = cfg.effect === 'overdrive' ? 6000
                    : cfg.effect === 'distortion' ? 4000
                    : base.lpClean

  return {
    loopFilterA: base.loopA,
    decay:       Math.min(0.9998, base.decay + decayBoost),
    driveAmount,
    lpCutoff,
  }
}

// ── Valid pickup positions based on which slots are configured ────────────────
export function validPositions(cfg: PickupConfig): PickupPos[] {
  const { bridge, middle, neck } = cfg
  const pos: PickupPos[] = []
  if (bridge) pos.push('B')
  if (bridge && middle) pos.push('BM')
  if (middle) pos.push('M')
  if (middle && neck) pos.push('MN')
  if (neck) pos.push('N')
  return pos.length ? pos : ['M']  // fallback
}

export const POS_LABEL: Record<PickupPos, string> = {
  B: '桥', BM: '桥+中', M: '中', MN: '中+颈', N: '颈',
}

// ── Module state ──────────────────────────────────────────────────────────────
const LS_KEY = 'guitar-chord-tone'

const DEFAULT: PickupConfig = {
  mode: 'acoustic', bridge: 'S', middle: null, neck: 'H', position: 'B', effect: 'clean',
}

function load(): PickupConfig {
  try {
    const s = localStorage.getItem(LS_KEY)
    if (s) return { ...DEFAULT, ...JSON.parse(s) }
  } catch { /* ignore */ }
  return { ...DEFAULT }
}

let _cfg: PickupConfig = load()
const _listeners = new Set<() => void>()

export function getToneConfig(): PickupConfig { return _cfg }

export function setToneConfig(patch: Partial<PickupConfig>): void {
  _cfg = { ..._cfg, ...patch }

  // Auto-fix position if it's no longer valid
  const valid = validPositions(_cfg)
  if (!valid.includes(_cfg.position)) {
    _cfg.position = valid[0]
  }

  try { localStorage.setItem(LS_KEY, JSON.stringify(_cfg)) } catch { /* ignore */ }
  _listeners.forEach(fn => fn())
}

export function subscribeTone(fn: () => void): () => void {
  _listeners.add(fn)
  return () => _listeners.delete(fn)
}
