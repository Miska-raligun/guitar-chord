function AcousticGuitar({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 270" fill="none" stroke="currentColor" strokeWidth="2.2"
      strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="33" y="1" width="34" height="18" rx="3" />
      <line x1="42" y1="18" x2="42" y2="82" />
      <line x1="58" y1="18" x2="58" y2="82" />
      <line x1="42" y1="23" x2="58" y2="23" strokeWidth="1.5" />
      <path d="M50,82 C74,82 88,96 87,113 C86,130 77,143 67,151
               C62,154 59,158 59,163 C59,168 62,172 67,176
               C81,186 93,204 93,226 C93,252 75,266 50,266
               C25,266 7,252 7,226 C7,204 19,186 33,176
               C38,172 41,168 41,163 C41,158 38,154 33,151
               C23,143 14,130 13,113 C12,96 26,82 50,82 Z" />
      <circle cx="50" cy="192" r="16" />
      <rect x="36" y="228" width="28" height="6" rx="2" />
    </svg>
  )
}

function StratGuitar({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 118 308" fill="none" stroke="currentColor" strokeWidth="2.2"
      strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M44,1 L44,24 L76,24 L76,10 C76,4 72,1 66,1 Z" />
      <line x1="48" y1="24" x2="48" y2="108" />
      <line x1="68" y1="24" x2="68" y2="108" />
      <path d="M48,108 C38,108 26,106 20,114 C13,122 12,132 18,142
               C10,152 4,172 4,198 C4,234 22,268 58,272
               C84,276 106,260 112,238 C118,218 110,190 100,174
               C108,164 112,150 108,136 C104,122 90,110 74,108 Z" />
      <path d="M54,114 C44,122 36,138 34,156" strokeWidth="1.5" />
      <rect x="44" y="188" width="32" height="10" rx="2" strokeWidth="1.5" />
    </svg>
  )
}

function LesPaulGuitar({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 104 285" fill="none" stroke="currentColor" strokeWidth="2.2"
      strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M34,2 C30,2 28,5 28,9 L28,24 L76,24 L76,14 C76,7 72,2 66,2 Z" />
      <line x1="43" y1="24" x2="43" y2="100" />
      <line x1="61" y1="24" x2="61" y2="100" />
      <path d="M43,100 C28,100 14,108 10,126 C6,144 8,172 8,200
               C8,234 24,270 56,274 C80,278 98,260 98,236
               C98,214 90,192 86,178 C94,170 98,154 94,138
               C90,122 78,108 61,100 Z" />
      <rect x="34" y="150" width="36" height="13" rx="3" strokeWidth="1.5" />
      <rect x="34" y="180" width="36" height="13" rx="3" strokeWidth="1.5" />
    </svg>
  )
}

function ClassicalGuitar({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 96 265" fill="none" stroke="currentColor" strokeWidth="2.2"
      strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="32" y="1" width="32" height="17" rx="3" />
      <line x1="41" y1="17" x2="41" y2="78" />
      <line x1="55" y1="17" x2="55" y2="78" />
      {/* Classical has a more symmetric hourglass body */}
      <path d="M48,78 C70,78 86,90 87,108 C88,126 78,136 68,143
               C63,146 60,150 60,155 C60,160 63,164 68,168
               C80,178 90,196 90,216 C90,242 72,258 48,258
               C24,258 6,242 6,216 C6,196 16,178 28,168
               C33,164 36,160 36,155 C36,150 33,146 28,143
               C18,136 8,126 9,108 C10,90 26,78 48,78 Z" />
      <circle cx="48" cy="185" r="18" />
      <rect x="34" y="220" width="28" height="7" rx="2" />
    </svg>
  )
}

export default function GuitarBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden select-none" aria-hidden="true">
      {/* Acoustic - top left, tilted */}
      <AcousticGuitar className="absolute -left-10 top-4 w-32 opacity-[0.08] text-amber-900 -rotate-[8deg]" />
      {/* Strat - right middle */}
      <StratGuitar className="absolute -right-6 top-[28%] w-28 opacity-[0.07] text-amber-800 rotate-[13deg]" />
      {/* LP - bottom left area */}
      <LesPaulGuitar className="absolute left-[30%] -bottom-6 w-24 opacity-[0.09] text-amber-950 rotate-[-5deg]" />
      {/* Classical - top right, small */}
      <ClassicalGuitar className="absolute right-[8%] top-[2%] w-16 opacity-[0.06] text-amber-800 rotate-[22deg]" />
      {/* Strat - bottom right, small */}
      <StratGuitar className="absolute right-[2%] bottom-[12%] w-20 opacity-[0.05] text-amber-900 -rotate-[10deg]" />
      {/* Acoustic - left middle, small */}
      <AcousticGuitar className="absolute -left-4 top-[55%] w-[4.5rem] opacity-[0.06] text-amber-800 rotate-[6deg]" />
    </div>
  )
}
