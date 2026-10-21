import { useOpenSource } from '../hooks/useOpenSource.ts'
import { useAppStore } from '../store.ts'
import { FolderIcon, LockIcon, LogoIcon } from './icons.tsx'

export default function AppHeader() {
  const source = useAppStore((s) => s.source)
  const count = useAppStore((s) => s.items.length)
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
          title={source.kind === 'directory' ? '다른 폴더 열기' : '폴더 열기'}
          className="flex h-9 items-center gap-2 rounded-lg border border-line-strong bg-surface px-3 text-[13px] hover:border-[#3a404b]"
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
      <span className="flex items-center gap-2 text-xs text-muted">
        <LockIcon width="15" height="15" />
        이미지는 이 기기 밖으로 나가지 않습니다
      </span>
    </header>
  )
}
