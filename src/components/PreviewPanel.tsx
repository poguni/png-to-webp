import { useEffect, useRef } from 'react'
import { useElementSize } from '../hooks/useElementSize.ts'
import { cropRect, ratioOf } from '../lib/crop.ts'
import { formatBytes } from '../lib/format.ts'
import { useAppStore } from '../store.ts'
import { AlertIcon } from './icons.tsx'

export default function PreviewPanel() {
  const item = useAppStore((s) => s.items.find((i) => i.id === s.selectedId))
  const crop = useAppStore((s) => s.settings.crop)
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
  }, [file, ready])

  if (!item) {
    return (
      <main className="flex min-w-0 grow-[999] basis-[560px] items-center justify-center p-8 text-sm text-subtle">
        불러온 이미지가 없습니다
      </main>
    )
  }

  const width = item.width ?? 0
  const height = item.height ?? 0
  const ratio = ratioOf(crop)
  const rect = ready ? cropRect(width, height, ratio, crop.anchor) : null
  const cropped = rect !== null && ratio !== null && (rect.width !== width || rect.height !== height)
  // 작은 이미지는 키우지 않고 원래 크기로 보여 준다.
  const scale = ready && frame.width > 0 ? Math.min(frame.width / width, frame.height / height, 1) : 0

  return (
    <main className="flex min-w-0 grow-[999] basis-[560px] flex-col gap-4 px-5 pt-4 pb-5 lg:min-h-0">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="m-0 text-[15px] font-semibold">{item.name}</h2>
        {item.id !== item.name && <span className="font-mono text-xs text-subtle">{item.id}</span>}
      </div>

      <div className="checker relative flex min-h-[360px] flex-1 overflow-hidden rounded-[14px] border border-line p-6">
        <div ref={frameRef} className="flex flex-1 items-center justify-center">
          {item.error ? (
            <div className="flex flex-col items-center gap-2 text-sm text-danger">
              <AlertIcon width="28" height="28" />
              {item.error}
            </div>
          ) : ready ? (
            <div className="relative overflow-hidden" style={{ width: width * scale, height: height * scale }}>
              <img ref={imgRef} alt={`${item.name} 원본`} className="block size-full" />
              {cropped && rect && (
                <div
                  className="pointer-events-none absolute border-2 border-accent shadow-[0_0_0_9999px_rgba(14,16,20,0.62)]"
                  style={{
                    left: rect.x * scale,
                    top: rect.y * scale,
                    width: rect.width * scale,
                    height: rect.height * scale,
                  }}
                >
                  <span className="absolute top-1.5 left-1.5 rounded bg-accent px-1.5 py-0.5 font-mono text-[11px] font-medium text-ground">
                    {rect.width}×{rect.height}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <span className="text-sm text-subtle">불러오는 중…</span>
          )}
        </div>
        <span className="absolute top-3.5 left-3.5 rounded-md bg-ground/80 px-2.5 py-1 text-xs">
          원본 · {item.kind}
          {cropped && ' · 자르기 미리보기'}
        </span>
      </div>

      <dl className="m-0 grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
        <InfoCard label="파일 용량" value={formatBytes(item.file.size)} mono />
        <InfoCard
          label={cropped ? `자른 뒤 해상도 (원본 ${width}×${height})` : '해상도'}
          value={!ready ? '확인 중' : cropped && rect ? `${rect.width}×${rect.height}` : `${width}×${height}`}
          mono
        />
        <InfoCard label="형식" value={item.kind} />
      </dl>
    </main>
  )
}

function InfoCard({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-xl border border-line bg-surface px-4 py-3.5">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className={`m-0 mt-1 text-lg font-medium ${mono ? 'font-mono' : ''}`}>{value}</dd>
    </div>
  )
}
