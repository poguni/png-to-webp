import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import { useElementSize } from '../hooks/useElementSize.ts'
import { useResultPreview } from '../hooks/useResultPreview.ts'
import type { BackgroundMode } from '../lib/background.ts'
import type { Rect } from '../lib/crop.ts'
import { formatBytes, formatSaving } from '../lib/format.ts'
import { cropInSource, cropOverride, resultPlacement } from '../lib/preview.ts'
import { resizePlan } from '../lib/resize.ts'
import { convertOptions, useAppStore, type ImageOverrides } from '../store.ts'
import { AlertIcon } from './icons.tsx'

type ViewMode = 'compare' | 'original' | 'result'
type Backdrop = 'checker' | 'white' | 'black'

const VIEW_MODES: { value: ViewMode; label: string }[] = [
  { value: 'compare', label: '비교' },
  { value: 'original', label: '원본' },
  { value: 'result', label: '결과' },
]

const IMAGE_BACKGROUNDS: { value: BackgroundMode | 'off'; label: string }[] = [
  { value: 'off', label: '지우지 않음' },
  { value: 'auto', label: '자동' },
  { value: 'solid', label: '단색' },
  { value: 'checker', label: '체커보드' },
  { value: 'ai', label: 'AI' },
]

const smallButton = 'h-8 rounded-lg border border-line-strong px-2.5 text-xs text-ink hover:border-[#3a404b]'

/** 투명 영역 뒤에 깔 배경 (F2-3) */
const BACKDROPS: { value: Backdrop; label: string; className: string }[] = [
  { value: 'checker', label: '체크무늬', className: 'checker' },
  { value: 'white', label: '흰색', className: 'bg-white' },
  { value: 'black', label: '검은색', className: 'bg-black' },
]

export default function PreviewPanel() {
  const item = useAppStore((s) => s.items.find((i) => i.id === s.selectedId))
  const settings = useAppStore((s) => s.settings)
  const preview = useResultPreview(item, settings)
  const [mode, setMode] = useState<ViewMode>('compare')
  const [backdrop, setBackdrop] = useState<Backdrop>('checker')
  const [split, setSplit] = useState(0.5)
  const drag = useRef<{ kind: 'move' | 'resize'; x: number; y: number; start: Rect } | null>(null)
  const file = item?.file
  const ready = Boolean(item?.width)
  const imgRef = useRef<HTMLImageElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const frame = useElementSize(frameRef)

  // 원본을 그대로 보여 준다. 다른 이미지를 고르면 이전 주소를 해제한다.
  useEffect(() => {
    const img = imgRef.current
    if (!file || !img) return
    const objectUrl = URL.createObjectURL(file)
    img.src = objectUrl
    return () => URL.revokeObjectURL(objectUrl)
  }, [file, ready, mode])

  if (!item) {
    return (
      <main className="flex min-w-0 grow-[999] basis-[560px] items-center justify-center p-8 text-sm text-subtle">
        불러온 이미지가 없습니다
      </main>
    )
  }

  const width = item.width ?? 0
  const height = item.height ?? 0
  const full: Rect = { x: 0, y: 0, width, height }
  const result = preview.result
  const options = convertOptions(settings, item)
  const { ratio } = options
  // 자르기는 여백을 다듬은 이미지에 적용한다. 다듬은 영역은 픽셀을 봐야 알 수 있으므로 최근 미리보기 결과를 쓴다.
  const base = settings.trim.enabled && result?.trimmed ? result.trimmed : full
  const rect = ready ? cropInSource(base, ratio, options.anchor, options.cropScale) : null
  const outlined = rect !== null && (rect.x !== 0 || rect.y !== 0 || rect.width !== width || rect.height !== height)
  const plan = rect
    ? resizePlan(rect.width, rect.height, options.targets[0], options.fit, options.noUpscale)
    : null
  // 결과가 최신이면 실제 크기를, 아니면 설정으로 계산한 크기를 보여 준다.
  const final = result && !preview.updating ? result : (plan ?? rect)
  const sizeCount = options.targets.length
  const backdropClass = BACKDROPS.find((b) => b.value === backdrop)!.className

  // 결과는 그 결과를 만든 설정으로 원본 위에 겹친다. 설정을 바꾸는 중에도 어긋나지 않는다.
  let placement: Rect | null = null
  if (result && ready) {
    const o = result.options
    const r = cropInSource(result.trimmed ?? full, o.ratio, o.anchor, o.cropScale)
    placement = resultPlacement(r, resizePlan(r.width, r.height, o.targets[0], o.fit, o.noUpscale))
  }

  const { setOverrides } = useAppStore.getState()
  const setOverride = (patch: ImageOverrides) => setOverrides(item.id, patch)
  const canDragCrop = mode === 'original' && ratio !== null && rect !== null

  function startCropDrag(e: PointerEvent<HTMLElement>, kind: 'move' | 'resize') {
    if (!rect) return
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { kind, x: e.clientX, y: e.clientY, start: rect }
  }

  function moveCropDrag(e: PointerEvent<HTMLElement>) {
    const d = drag.current
    if (!d || ratio === null || scale === 0) return
    const dx = (e.clientX - d.x) / scale
    const dy = (e.clientY - d.y) / scale
    let next: Rect
    if (d.kind === 'move') {
      next = { ...d.start, x: d.start.x + dx, y: d.start.y + dy }
    } else {
      // 왼쪽 위를 고정하고, 비율을 지키며 모서리를 따라 늘리거나 줄인다.
      const w = Math.max(d.start.width + dx, (d.start.height + dy) * (d.start.width / d.start.height))
      next = { ...d.start, width: w, height: w / (d.start.width / d.start.height) }
    }
    setOverride({ crop: cropOverride(base, ratio, next) })
  }

  // 결과만 볼 때는 결과 크기에 맞추고, 그 밖에는 원본 크기에 맞춘다. 작은 이미지는 키우지 않는다.
  const shown = mode === 'result' && final ? final : { width, height }
  const scale = ready && frame.width > 0 ? Math.min(frame.width / shown.width, frame.height / shown.height, 1) : 0

  function moveSplit(e: PointerEvent<HTMLDivElement>) {
    const box = e.currentTarget.getBoundingClientRect()
    setSplit(Math.min(1, Math.max(0, (e.clientX - box.left) / box.width)))
  }

  function handleSplitKey(e: KeyboardEvent) {
    const step = e.shiftKey ? 0.1 : 0.02
    if (e.key === 'ArrowLeft') setSplit((s) => Math.max(0, s - step))
    else if (e.key === 'ArrowRight') setSplit((s) => Math.min(1, s + step))
    else return
    e.preventDefault()
  }

  const resultStatus = preview.modelProgress
    ? `AI 모델 내려받는 중 ${formatBytes(preview.modelProgress.loaded)} / ${formatBytes(preview.modelProgress.total)}`
    : preview.updating
      ? '미리보기 만드는 중…'
      : null


  return (
    <main className="flex min-w-0 grow-[999] basis-[560px] flex-col gap-4 px-5 pt-4 pb-5 lg:min-h-0">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-[10px] border border-line-strong bg-surface p-[3px]" role="group" aria-label="보기 방식">
          {VIEW_MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              aria-pressed={mode === m.value}
              onClick={() => setMode(m.value)}
              className={`h-[30px] rounded-[7px] px-3.5 text-[13px] ${
                mode === m.value ? 'bg-[#2b3140] font-medium text-ink' : 'text-muted hover:text-ink'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <h2 className="m-0 text-[13px] font-medium">{item.name}</h2>
        {item.id !== item.name && <span className="font-mono text-xs text-subtle">{item.id}</span>}
        <div className="flex-1" />
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted">투명 영역</span>
          {BACKDROPS.map((b) => (
            <button
              key={b.value}
              type="button"
              aria-label={`${b.label} 배경으로 보기`}
              aria-pressed={backdrop === b.value}
              onClick={() => setBackdrop(b.value)}
              className={`size-[26px] rounded-md ${b.value === 'checker' ? 'checker-sm' : b.className} ${
                backdrop === b.value ? 'border-2 border-accent' : 'border border-line-strong'
              }`}
            />
          ))}
        </div>
      </div>

      <div className={`${backdropClass} relative flex min-h-[360px] flex-1 overflow-hidden rounded-[14px] border border-line p-6`}>
        <div ref={frameRef} className="flex min-w-0 flex-1 items-center justify-center">
          {item.error ? (
            <div className="flex flex-col items-center gap-2 text-sm text-danger">
              <AlertIcon width="28" height="28" />
              {item.error}
            </div>
          ) : !ready ? (
            <span className="text-sm text-subtle">불러오는 중…</span>
          ) : mode === 'result' ? (
            result ? (
              <img
                src={result.url}
                alt={`${item.name} 결과`}
                className="block"
                style={{ width: Math.round(shown.width * scale), height: Math.round(shown.height * scale) }}
              />
            ) : (
              <ResultMessage error={preview.error} />
            )
          ) : (
            <div
              className={`relative overflow-hidden ${mode === 'compare' ? 'cursor-ew-resize touch-none select-none' : ''}`}
              style={{ width: Math.round(width * scale), height: Math.round(height * scale) }}
              onPointerDown={
                mode === 'compare'
                  ? (e) => {
                      e.currentTarget.setPointerCapture(e.pointerId)
                      moveSplit(e)
                    }
                  : undefined
              }
              onPointerMove={mode === 'compare' ? (e) => e.buttons === 1 && moveSplit(e) : undefined}
            >
              {/* 비교할 때는 원본도 왼쪽만 남긴다. 겹쳐 두면 결과 쪽 가장자리에 원본이 가늘게 비친다. */}
              <img
                ref={imgRef}
                alt={`${item.name} 원본`}
                className="block size-full"
                draggable={false}
                style={mode === 'compare' ? { clipPath: `inset(0 ${(1 - split) * 100}% 0 0)` } : undefined}
              />
              {mode === 'original' && outlined && rect && (
                <div
                  className={`absolute border-2 border-accent shadow-[0_0_0_9999px_rgba(14,16,20,0.62)] ${
                    canDragCrop ? 'cursor-move touch-none' : 'pointer-events-none'
                  }`}
                  style={{
                    left: rect.x * scale,
                    top: rect.y * scale,
                    width: rect.width * scale,
                    height: rect.height * scale,
                  }}
                  onPointerDown={canDragCrop ? (e) => startCropDrag(e, 'move') : undefined}
                  onPointerMove={canDragCrop ? moveCropDrag : undefined}
                  onPointerUp={() => (drag.current = null)}
                >
                  <span className="pointer-events-none absolute top-1.5 left-1.5 rounded bg-accent px-1.5 py-0.5 font-mono text-[11px] font-medium text-ground">
                    {rect.width}×{rect.height}
                  </span>
                  {canDragCrop && (
                    <span
                      aria-hidden="true"
                      className="absolute -right-2 -bottom-2 size-4 cursor-nwse-resize touch-none rounded-sm border-2 border-ground bg-accent"
                      onPointerDown={(e) => startCropDrag(e, 'resize')}
                      onPointerMove={moveCropDrag}
                      onPointerUp={() => (drag.current = null)}
                    />
                  )}
                </div>
              )}
              {mode === 'compare' && (
                <>
                  <div
                    className={`${backdropClass} absolute inset-0 overflow-hidden`}
                    style={{ clipPath: `inset(0 0 0 ${split * 100}%)` }}
                  >
                    {result && placement ? (
                      <img
                        src={result.url}
                        alt={`${item.name} 결과`}
                        draggable={false}
                        className="absolute block max-w-none"
                        style={{
                          left: placement.x * scale,
                          top: placement.y * scale,
                          width: placement.width * scale,
                          height: placement.height * scale,
                        }}
                      />
                    ) : (
                      <div className="flex size-full items-center justify-end p-4">
                        <ResultMessage error={preview.error} />
                      </div>
                    )}
                  </div>
                  <div className="pointer-events-none absolute inset-y-0 -ml-px w-0.5 bg-accent" style={{ left: `${split * 100}%` }} />
                  <div
                    role="slider"
                    tabIndex={0}
                    aria-label="비교 위치 조절"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(split * 100)}
                    onKeyDown={handleSplitKey}
                    className="absolute top-1/2 -mt-5 -ml-5 flex size-10 items-center justify-center rounded-full bg-accent shadow-[0_4px_16px_rgba(0,0,0,0.4)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                    style={{ left: `${split * 100}%` }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0E1014" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="m9 6-6 6 6 6" />
                      <path d="m15 6 6 6-6 6" />
                    </svg>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
        {mode !== 'result' && (
          <span className="absolute top-3.5 left-3.5 rounded-md bg-ground/80 px-2.5 py-1 text-xs">
            원본 · {item.kind}
            {mode === 'original' && outlined && (canDragCrop ? ' · 끌어서 옮기기, 모서리로 크기 조절' : ' · 결과 영역')}
          </span>
        )}
        {mode !== 'original' && (
          <span className="absolute top-3.5 right-3.5 rounded-md bg-ground/80 px-2.5 py-1 text-xs" role="status">
            결과 · WebP
            {resultStatus && <span className="text-muted"> · {resultStatus}</span>}
          </span>
        )}
      </div>

      {/* 이 이미지에만 적용하는 설정 (S4, F4-3) */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-line bg-surface px-4 py-2.5 text-xs text-muted">
        <span className="font-semibold text-ink">이 이미지만</span>
        <label className="flex items-center gap-2">
          배경 제거
          <select
            value={item.overrides?.background ?? ''}
            onChange={(e) => setOverride({ background: (e.target.value || undefined) as ImageOverrides['background'] })}
            className={`${smallButton} bg-surface focus:border-accent focus:outline-none`}
          >
            <option value="">전체 설정 따름</option>
            {IMAGE_BACKGROUNDS.map((b) => (
              <option key={b.value} value={b.value}>
                {b.label}
              </option>
            ))}
          </select>
        </label>
        <span className="flex items-center gap-2">
          자르기 영역
          {ratio === null ? (
            <span className="text-subtle">비율을 고르면 조정할 수 있습니다</span>
          ) : item.overrides?.crop ? (
            <>
              <span className="text-accent">직접 조정함</span>
              <button type="button" onClick={() => setOverride({ crop: undefined })} className={smallButton}>
                되돌리기
              </button>
            </>
          ) : mode === 'original' ? (
            <span className="text-subtle">위의 영역을 끌어서 조정하세요</span>
          ) : (
            <button type="button" onClick={() => setMode('original')} className={smallButton}>
              원본 보기에서 조정
            </button>
          )}
        </span>
      </div>

      <dl className="m-0 grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
        <InfoCard label="파일 용량">
          <Change
            before={formatBytes(item.file.size)}
            after={result ? formatBytes(result.size) : '—'}
            extra={result ? formatSaving(item.file.size, result.size) : null}
          />
        </InfoCard>
        <InfoCard label={sizeCount > 1 ? `해상도 (${sizeCount}개 크기 중 첫 번째)` : '해상도'}>
          {!ready || !final ? (
            <span className="font-mono text-lg font-medium">확인 중</span>
          ) : (
            <Change before={`${width}×${height}`} after={`${final.width}×${final.height}`} />
          )}
        </InfoCard>
        <InfoCard label="배경 제거">
          <span className="text-base font-medium">{result ? (result.note?.replace(/^배경 제거: /, '') ?? '사용 안 함') : '—'}</span>
        </InfoCard>
        <InfoCard label="처리 시간">
          <span className="font-mono text-lg font-medium">{result ? `${(result.ms / 1000).toFixed(1)}초` : '—'}</span>
        </InfoCard>
      </dl>
    </main>
  )
}

function ResultMessage({ error }: { error: string | null }) {
  if (!error) return <span className="rounded-md bg-ground/80 px-2.5 py-1 text-sm text-muted">미리보기 만드는 중…</span>
  return (
    <div className="flex max-w-[320px] flex-col items-center gap-2 rounded-lg bg-ground/85 p-3 text-center text-sm text-danger">
      <AlertIcon width="24" height="24" />
      {error}
    </div>
  )
}

function Change({ before, after, extra }: { before: string; after: string; extra?: string | null }) {
  return (
    <span className="flex flex-wrap items-baseline gap-2 font-mono">
      <span className="text-sm text-muted">{before}</span>
      <span className="text-[#5b6270]">→</span>
      <span className="text-lg font-medium">{after}</span>
      {extra && <span className={`text-[13px] ${extra.startsWith('+') ? 'text-danger' : 'text-accent'}`}>{extra}</span>}
    </span>
  )
}

function InfoCard({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-surface px-4 py-3.5">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="m-0 mt-1">{children}</dd>
    </div>
  )
}
