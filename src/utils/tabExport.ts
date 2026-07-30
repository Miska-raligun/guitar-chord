import type { ChordPosition } from '../types/chord'
import type { ChordSlot, MelodyNote, SequencerState, TimeSig } from '../types/audio'
import { getMasterSlotsPerBar, getChordMasterDuration } from './sequencerUtils'

// 把编曲渲染成文本六线谱（ASCII tab）。
// 行序：① 高音e 在最上，⑥ 低音E 在最下（与吉他谱习惯一致）。

const STRING_LABELS = ['e', 'B', 'G', 'D', 'A', 'E']  // 显示顺序：高→低
const BARS_PER_LINE = 4

export interface TabInput {
  pattern: SequencerState['pattern']
  timeSig: TimeSig
  capo: number
  chords: ChordSlot[]
  melody: (MelodyNote | null)[][]
  getPosition: (slot: ChordSlot) => ChordPosition | null
}

// 一个物理小节的列数据：每列 6 根弦上的品位（null=不弹），外加和弦名/旋律标注
interface Col {
  frets: (number | null)[]   // index 0=高音e … 5=低音E（显示顺序）
  label: string              // 该列上方标注（和弦名或空）
}

function fingeringCols(pos: ChordPosition | null, strum: 'D' | 'U' | 'X' | null): (number | null)[] {
  // frets 数组是 index 0=低音E … 5=高音e；显示需要反转
  if (!pos) return Array(6).fill(null)
  if (strum === 'X') return Array(6).fill(null)   // 闷音列用 x 单独标
  const disp: (number | null)[] = []
  for (let i = 5; i >= 0; i--) {
    const f = pos.frets[i]
    // 生成型和弦存的是相对品位，配合 baseFret 还原绝对品位
    const abs = f === -1 ? null : (f === 0 ? 0 : f + (pos.baseFret > 1 ? pos.baseFret - 1 : 0))
    disp.push(abs)
  }
  return disp
}

export function renderTab(input: TabInput): string {
  const { pattern, timeSig, capo, chords, melody, getPosition } = input
  const master = getMasterSlotsPerBar(timeSig)
  const isStrum = pattern === 'strum'

  // 按物理小节分组和弦事件
  const bars: { slots: { slot: ChordSlot; idx: number }[] }[] = []
  let acc = 0
  let cur: { slot: ChordSlot; idx: number }[] = []
  chords.forEach((slot, idx) => {
    cur.push({ slot, idx })
    acc += isStrum ? getChordMasterDuration(slot, timeSig) : master
    if (acc >= master) { bars.push({ slots: cur }); cur = []; acc = 0 }
  })
  if (cur.length) bars.push({ slots: cur })

  // 每小节生成列
  const barCols: Col[][] = bars.map(bar => {
    const cols: Col[] = []
    bar.slots.forEach(({ slot, idx }) => {
      const pos = getPosition(slot)
      const name = slot.root ? `${slot.root}${slot.suffix && slot.suffix !== 'major' ? slot.suffix : ''}` : ''
      const dir = slot.strumDir ?? (isStrum ? 'D' : null)
      cols.push({ frets: fingeringCols(pos, isStrum ? dir as 'D'|'U'|'X' : null), label: name })

      // 该事件下的旋律音各占一列
      const row = melody[idx] ?? []
      const span = isStrum ? getChordMasterDuration(slot, timeSig) : master
      for (let m = 0; m < span; m++) {
        const note = row[m]
        if (!note) continue
        const frets: (number | null)[] = Array(6).fill(null)
        // 旋律统一记在 ① 弦上（近似，便于阅读）
        frets[0] = note.semitone
        cols.push({ frets, label: '' })
      }
    })
    return cols
  })

  // 排版：每行 BARS_PER_LINE 个小节
  const lines: string[] = []
  if (capo > 0) lines.push(`Capo ${capo} 品`, '')

  for (let start = 0; start < barCols.length; start += BARS_PER_LINE) {
    const group = barCols.slice(start, start + BARS_PER_LINE)

    // 和弦名标注行
    let nameLine = '    '
    group.forEach(cols => {
      cols.forEach(c => { nameLine += (c.label || '').padEnd(4).slice(0, 4) })
      nameLine += '  '
    })
    lines.push(nameLine.trimEnd())

    // 六根弦
    for (let s = 0; s < 6; s++) {
      let line = `${STRING_LABELS[s]}|--`
      group.forEach(cols => {
        cols.forEach(c => {
          const f = c.frets[s]
          line += f === null ? '----' : String(f).padEnd(2, '-').slice(0, 2) + '--'
        })
        line += '|-'
      })
      lines.push(line)
    }
    lines.push('')
  }

  return lines.join('\n')
}

export function downloadTab(text: string, filename = 'tab.txt'): void {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
