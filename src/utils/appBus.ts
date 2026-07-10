// 轻量跨 Tab 事件总线：识别页 → 和弦页 / 编曲台 的联动入口。
// 各 Tab 组件始终保持挂载（App 里只是 hidden），所以用 window CustomEvent 即可。

export interface ChordRef {
  root: string     // 显示名（C / C# / Eb …，与 dbUtils ROOTS 一致）
  suffix: string   // chords-db 后缀（major / m7 / add11 …）
}

export const EV_VIEW_CHORD  = 'app:view-chord'    // 跳到和弦页并选中该和弦
export const EV_ADD_TO_COMPOSE = 'app:add-chord-to-compose'  // 追加到编曲台
export const EV_SWITCH_TAB  = 'app:switch-tab'    // 切换底部 Tab

export function viewChordInBrowse(chord: ChordRef): void {
  window.dispatchEvent(new CustomEvent(EV_VIEW_CHORD, { detail: chord }))
  window.dispatchEvent(new CustomEvent(EV_SWITCH_TAB, { detail: 'browse' }))
}

export function addChordToCompose(chord: ChordRef): void {
  window.dispatchEvent(new CustomEvent(EV_ADD_TO_COMPOSE, { detail: chord }))
}

export function onAppEvent<T>(name: string, handler: (detail: T) => void): () => void {
  const fn = (e: Event) => handler((e as CustomEvent<T>).detail)
  window.addEventListener(name, fn)
  return () => window.removeEventListener(name, fn)
}
