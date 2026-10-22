import { useOpenSource } from '../hooks/useOpenSource.ts'
import { useAppStore } from '../store.ts'
import { FolderIcon, LockIcon, LogoIcon, PlayIcon } from './icons.tsx'
import PresetControls from './PresetControls.tsx'

export default function AppHeader() {
  const source = useAppStore((s) => s.source)
  const count = useAppStore((s) => s.items.length)
  const checked = useAppStore((s) => s.items.filter((item) => item.checked).length)
  const scanning = useAppStore((s) => s.scanning)
  const batch = useAppStore((s) => s.batch)
  const { startBatch } = useAppStore.getState()
  const { openDirectory } = useOpenSource()

  return (
    <header className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-line px-5 py-3">
      <div className="flex items-center gap-2.5">
        <div className="flex size-[30px] items-center justify-center rounded-lg bg-accent">
          <LogoIcon width="18" height="18" stroke="#0E1014" />
        </div>
        <span className="text-base font-bold tracking-tight">PNGtoWebP</span>
      </div>
      {source && (
        <button
          type="button"
          onClick={openDirectory}
          disabled={batch !== null}
          title={source.kind === 'directory' ? '다른 폴더 열기' : '폴더 열기'}
          className="flex h-9 items-center gap-2 rounded-lg border border-line-strong bg-surface px-3 text-[13px] hover:border-[#3a404b] disabled:opacity-60"
        >
          <FolderIcon className="text-muted" />
          <span className={`max-w-[40ch] truncate text-xs ${source.kind === 'directory' ? 'font-mono' : ''}`}>
            {source.name}
          </span>
          <span className="text-muted">· 이미지 {count}개</span>
          <span className="ml-1 text-xs text-muted">{source.kind === 'directory' ? '폴더 변경' : '폴더 열기'}</span>
        </button>
      )}
      <div className="flex-1" />
      {source && batch === null && <PresetControls />}
      {source ? (
        batch === null && (
          <button
            type="button"
            onClick={startBatch}
            disabled={checked === 0 || scanning}
            className="flex h-10 items-center gap-2 rounded-[10px] bg-accent px-[18px] text-sm font-bold text-ground disabled:opacity-50"
          >
            <PlayIcon />
            {checked}개 처리하기
          </button>
        )
      ) : (
        <span className="flex items-center gap-2 text-xs text-muted">
          <LockIcon width="15" height="15" />
          이미지는 이 기기 밖으로 나가지 않습니다
        </span>
      )}
    </header>
  )
}
