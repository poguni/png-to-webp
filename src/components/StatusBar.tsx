import { useAppStore } from '../store.ts'

export default function StatusBar() {
  const items = useAppStore((s) => s.items)
  const skipped = useAppStore((s) => s.skipped)

  const checked = items.filter((item) => item.checked).length
  const loading = items.filter((item) => !item.thumbUrl && !item.error).length
  const broken = items.filter((item) => item.error).length

  return (
    <footer className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line px-5 py-2.5 text-xs text-muted">
      <span className="flex items-center gap-1.5">
        <span className={`size-2 rounded-full ${loading > 0 ? 'bg-muted' : 'bg-accent'}`} />
        {loading > 0 ? `썸네일 만드는 중 (${items.length - loading}/${items.length})` : '준비됨'}
      </span>
      <span>
        전체 {items.length}개 중 <b className="font-medium text-ink">{checked}개</b> 선택
      </span>
      {skipped > 0 && <span>지원하지 않는 형식 {skipped}개 건너뜀</span>}
      {broken > 0 && <span className="text-danger">읽을 수 없는 파일 {broken}개</span>}
    </footer>
  )
}
