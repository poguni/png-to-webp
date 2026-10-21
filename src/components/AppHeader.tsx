export default function AppHeader() {
  return (
    <header className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-line px-5 py-3">
      <div className="flex items-center gap-2.5">
        <div className="flex size-[30px] items-center justify-center rounded-lg bg-accent">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#0E1014"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="3" y="3" width="11" height="11" rx="2" />
            <path d="M10 21h9a2 2 0 0 0 2-2v-9" />
          </svg>
        </div>
        <span className="text-base font-bold tracking-tight">PNGtoWebP</span>
      </div>
      <div className="flex-1" />
      <span className="flex items-center gap-2 text-xs text-muted">
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="4" y="11" width="16" height="10" rx="2" />
          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </svg>
        이미지는 이 기기 밖으로 나가지 않습니다
      </span>
    </header>
  )
}
