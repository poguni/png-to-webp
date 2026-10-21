import { formatBytes } from '../lib/format.ts'
import { useAppStore, type Batch, type ImageItem, type ResultStatus } from '../store.ts'
import { AlertIcon } from './icons.tsx'

const STATUS: Record<ResultStatus, { label: string; className: string }> = {
  waiting: { label: '대기', className: 'bg-raised text-muted' },
  running: { label: '처리 중', className: 'bg-[#1a2333] text-[#7fb2ff]' },
  done: { label: '완료', className: 'bg-[#1b2614] text-[#9be15d]' },
  failed: { label: '실패', className: 'bg-[#2a1719] text-danger' },
  skipped: { label: '건너뜀', className: 'bg-raised text-[#f5b84a]' },
}

function formatDuration(ms: number): string {
  const seconds = Math.max(1, Math.round(ms / 1000))
  if (seconds < 60) return `${seconds}초`
  return `${Math.floor(seconds / 60)}분 ${seconds % 60}초`
}

function summarize(batch: Batch, items: Map<string, ImageItem>) {
  const results = batch.ids.map((id) => batch.results[id])
  const count = (status: ResultStatus) => results.filter((r) => r.status === status).length
  const done = count('done')
  const failed = count('failed')
  const skipped = count('skipped')
  const finished = done + failed + skipped

  let before = 0
  let after = 0
  for (const id of batch.ids) {
    const result = batch.results[id]
    if (result.status === 'done') {
      before += items.get(id)?.file.size ?? 0
      after += result.outputSize ?? 0
    }
  }

  const elapsed = (batch.finishedAt ?? Date.now()) - batch.startedAt
  const remaining = finished > 0 ? (elapsed / finished) * (batch.ids.length - finished) : null
  const current = batch.ids.find((id) => batch.results[id].status === 'running')

  return { done, failed, skipped, finished, before, after, elapsed, remaining, current }
}

export default function ProcessingView({ batch }: { batch: Batch }) {
  const items = useAppStore((s) => s.items)
  const { closeBatch } = useAppStore.getState()
  const byId = new Map(items.map((item) => [item.id, item]))
  const s = summarize(batch, byId)
  const running = batch.finishedAt === undefined
  const total = batch.ids.length
  const saved = s.before > 0 ? Math.round((1 - s.after / s.before) * 100) : null

  return (
    <main className="box-border flex w-full flex-1 flex-col gap-6 px-4 pt-8 pb-10 sm:px-8 lg:overflow-y-auto">
      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1">
            <div className={`flex items-center gap-2 text-[13px] ${running ? 'text-accent' : 'text-[#9be15d]'}`}>
              <span className={`size-2 rounded-full ${running ? 'bg-accent' : 'bg-[#9be15d]'}`} />
              {running ? '처리 중' : '처리 완료'}
            </div>
            <h1 className="m-0 font-mono text-[34px] font-bold tracking-tight">
              {s.finished} <span className="text-[#5b6270]">/ {total}</span>
            </h1>
          </div>
          <p className="m-0 pb-1.5 text-[13px] text-muted">
            {running ? (
              <>
                지금 처리 중: <span className="text-ink">{s.current ?? '준비 중'}</span>
              </>
            ) : (
              <>
                저장 위치: <span className="font-mono text-ink">{batch.outputLabel}</span>
              </>
            )}
          </p>
          <div className="flex-1" />
          {!running && (
            <button
              type="button"
              onClick={closeBatch}
              className="h-[42px] rounded-[10px] bg-accent px-[18px] text-sm font-bold text-ground"
            >
              작업 화면으로 돌아가기
            </button>
          )}
        </div>
        <div
          className="h-2.5 overflow-hidden rounded-full bg-raised"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={s.finished}
          aria-label="처리 진행률"
        >
          <div
            className="h-full rounded-full bg-accent transition-[width]"
            style={{ width: `${(s.finished / total) * 100}%` }}
          />
        </div>
      </section>

      <section className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
        <StatCard label="완료" value={String(s.done)} />
        <StatCard label="실패" value={String(s.failed)} danger={s.failed > 0} />
        {s.skipped > 0 && <StatCard label="건너뜀" value={String(s.skipped)} />}
        <StatCard
          label={running ? '남은 시간' : '걸린 시간'}
          value={running ? (s.remaining === null ? '계산 중' : `약 ${formatDuration(s.remaining)}`) : formatDuration(s.elapsed)}
        />
        <div className="rounded-[14px] border border-line bg-surface px-5 py-[18px]">
          <div className="text-xs text-muted">줄어든 용량 (완료분)</div>
          <div className="mt-1.5 flex flex-wrap items-baseline gap-2 font-mono">
            <span className="text-[15px] text-muted">{formatBytes(s.before)}</span>
            <span className="text-[#5b6270]">→</span>
            <span className="text-[28px] font-medium">{formatBytes(s.after)}</span>
            {saved !== null && <span className="text-sm text-accent">−{saved}%</span>}
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="m-0 text-base font-semibold">파일별 결과</h2>
        <div className="overflow-x-auto rounded-[14px] border border-line">
          <table className="w-full min-w-[760px] border-collapse text-[13px]">
            <thead>
              <tr className="bg-surface text-left text-xs text-muted">
                <th className="px-4 py-2.5 font-medium">파일</th>
                <th className="px-4 py-2.5 font-medium">원본</th>
                <th className="px-4 py-2.5 font-medium">결과</th>
                <th className="px-4 py-2.5 font-medium">절감</th>
                <th className="px-4 py-2.5 font-medium">상태</th>
              </tr>
            </thead>
            <tbody>
              {batch.ids.map((id) => (
                <ResultRow key={id} item={byId.get(id)} id={id} batch={batch} />
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}

function StatCard({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="rounded-[14px] border border-line bg-surface px-5 py-[18px]">
      <div className="text-xs text-muted">{label}</div>
      <div className={`mt-1.5 font-mono text-[28px] font-medium ${danger ? 'text-danger' : ''}`}>{value}</div>
    </div>
  )
}

function ResultRow({ id, item, batch }: { id: string; item: ImageItem | undefined; batch: Batch }) {
  const result = batch.results[id]
  const status = STATUS[result.status]
  const original = item?.file.size ?? 0
  const note =
    result.error ?? [result.outputPath && `→ ${result.outputPath}`, result.note].filter(Boolean).join(' · ')
  const saved =
    result.status === 'done' && result.outputSize !== undefined && original > 0
      ? `−${Math.round((1 - result.outputSize / original) * 100)}%`
      : '—'

  return (
    <tr className={`border-t border-[#1e2229] ${result.status === 'running' ? 'bg-[#141a24]' : result.status === 'failed' ? 'bg-[#1a1214]' : 'bg-panel'}`}>
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-3">
          <span className="checker-sm flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-md">
            {item?.thumbUrl ? (
              <img src={item.thumbUrl} alt="" className="max-h-full max-w-full" />
            ) : (
              <AlertIcon className="text-danger" />
            )}
          </span>
          <div className="flex min-w-0 flex-col">
            <span>{id}</span>
            {note && (
              <span className={`text-[11px] ${result.status === 'failed' ? 'text-danger' : 'text-subtle'}`}>{note}</span>
            )}
          </div>
        </div>
      </td>
      <td className="px-4 py-2.5 font-mono text-xs text-muted">{formatBytes(original)}</td>
      <td className="px-4 py-2.5 font-mono text-xs">
        {result.outputSize !== undefined ? formatBytes(result.outputSize) : '—'}
      </td>
      <td className={`px-4 py-2.5 font-mono text-xs ${result.status === 'done' ? 'text-accent' : 'text-subtle'}`}>{saved}</td>
      <td className="px-4 py-2.5">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs ${status.className}`}>
          <span className="size-1.5 rounded-full bg-current" />
          {status.label}
        </span>
      </td>
    </tr>
  )
}
