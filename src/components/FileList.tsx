import { useEffect, useRef } from 'react'
import { formatBytes } from '../lib/format.ts'
import { hasFolderStructure } from '../lib/pickers.ts'
import { useAppStore, type ImageItem, type KindFilter } from '../store.ts'
import { AlertIcon } from './icons.tsx'

const FILTERS: { value: KindFilter; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'PNG', label: 'PNG' },
  { value: 'JPG', label: 'JPG' },
]

export default function FileList() {
  const items = useAppStore((s) => s.items)
  const filter = useAppStore((s) => s.filter)
  const recursive = useAppStore((s) => s.recursive)
  const scanning = useAppStore((s) => s.scanning)
  const source = useAppStore((s) => s.source)
  const { setFilter, setChecked, setRecursive } = useAppStore.getState()

  const visible = filter === 'all' ? items : items.filter((item) => item.kind === filter)
  const visibleChecked = visible.filter((item) => item.checked).length
  const totalChecked = items.filter((item) => item.checked).length

  const selectAllRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = visibleChecked > 0 && visibleChecked < visible.length
    }
  }, [visibleChecked, visible.length])

  function countOf(value: KindFilter) {
    return value === 'all' ? items.length : items.filter((item) => item.kind === value).length
  }

  return (
    <aside className="flex min-h-0 grow basis-[300px] flex-col border-line bg-panel lg:border-r">
      <div className="flex flex-col gap-3 px-4 pt-4 pb-3">
        <div className="flex items-center justify-between">
          <h2 className="m-0 text-[13px] font-semibold">파일</h2>
          <span className="text-xs text-muted">
            {totalChecked} / {items.length} 선택
          </span>
        </div>
        <div className="flex gap-1.5" role="group" aria-label="형식으로 거르기">
          {FILTERS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
              className={
                filter === value
                  ? 'h-[30px] rounded-full bg-[#2b3140] px-2.5 text-xs text-ink'
                  : 'h-[30px] rounded-full border border-line-strong px-2.5 text-xs text-muted hover:text-ink'
              }
            >
              {label} {countOf(value)}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-xs text-muted">
          <input
            ref={selectAllRef}
            type="checkbox"
            checked={visible.length > 0 && visibleChecked === visible.length}
            onChange={(e) => setChecked(visible.map((item) => item.id), e.target.checked)}
            className="size-[15px] accent-accent"
          />
          {filter === 'all' ? '전체 선택' : `${filter} 전체 선택`}
        </label>
      </div>

      <ul className="m-0 flex max-h-[50vh] min-h-0 flex-1 list-none flex-col gap-0.5 overflow-y-auto px-2 pb-2 lg:max-h-none">
        {visible.map((item) => (
          <FileRow key={item.id} item={item} />
        ))}
        {visible.length === 0 && (
          <li className="px-2 py-6 text-center text-xs text-subtle">해당하는 파일이 없습니다</li>
        )}
      </ul>

      {source && hasFolderStructure(source) && (
        <div className="flex items-center justify-between border-t border-line px-4 py-3 text-xs text-muted">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={recursive}
              disabled={scanning}
              onChange={(e) => setRecursive(e.target.checked)}
              className="size-[15px] accent-accent"
            />
            하위 폴더 포함
          </label>
          {scanning && <span>다시 읽는 중…</span>}
        </div>
      )}
    </aside>
  )
}

function FileRow({ item }: { item: ImageItem }) {
  const selected = useAppStore((s) => s.selectedId === item.id)
  const { select, toggleChecked } = useAppStore.getState()

  const meta = item.error
    ? item.error
    : item.width
      ? `${item.width}×${item.height} · ${formatBytes(item.file.size)}`
      : formatBytes(item.file.size)

  return (
    <li
      className={`flex items-center gap-2.5 rounded-lg py-2 pl-2 ${
        selected ? 'bg-[#1b2016] shadow-[inset_0_0_0_1px_#3c4a20]' : 'hover:bg-surface'
      }`}
    >
      <input
        type="checkbox"
        checked={item.checked}
        onChange={() => toggleChecked(item.id)}
        aria-label={`${item.id} 선택`}
        className="size-[15px] shrink-0 accent-accent"
      />
      <button
        type="button"
        onClick={() => select(item.id)}
        aria-current={selected}
        title={item.id}
        className="flex min-w-0 flex-1 items-center gap-2.5 pr-2 text-left"
      >
        <span className="checker-sm flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md">
          {item.thumbUrl ? (
            <img src={item.thumbUrl} alt="" className="max-h-full max-w-full" />
          ) : item.error ? (
            <AlertIcon className="text-danger" />
          ) : null}
        </span>
        <span className="min-w-0 flex-1">
          <span className={`block truncate text-[13px] ${item.checked ? 'text-ink' : 'text-subtle'}`}>
            {item.id}
          </span>
          <span className={`block truncate text-[11px] ${item.error ? 'text-danger' : 'font-mono text-subtle'}`}>
            {meta}
          </span>
        </span>
        <span className="rounded bg-line px-1.5 py-0.5 text-[10px] font-semibold text-muted">{item.kind}</span>
      </button>
    </li>
  )
}
