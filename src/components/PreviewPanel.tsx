import { useEffect, useRef } from 'react'
import { formatBytes } from '../lib/format.ts'
import { useAppStore } from '../store.ts'
import { AlertIcon } from './icons.tsx'

export default function PreviewPanel() {
  const item = useAppStore((s) => s.items.find((i) => i.id === s.selectedId))
  const file = item?.file
  const broken = Boolean(item?.error)
  const imgRef = useRef<HTMLImageElement>(null)

  // 원본을 그대로 보여 준다. 다른 이미지를 고르면 이전 주소를 해제한다.
  useEffect(() => {
    const img = imgRef.current
    if (!file || !img) return
    const objectUrl = URL.createObjectURL(file)
    img.src = objectUrl
    return () => URL.revokeObjectURL(objectUrl)
  }, [file, broken])

  if (!item) {
    return (
      <main className="flex min-w-0 grow-[999] basis-[560px] items-center justify-center p-8 text-sm text-subtle">
        불러온 이미지가 없습니다
      </main>
    )
  }

  return (
    <main className="flex min-w-0 grow-[999] basis-[560px] flex-col gap-4 px-5 pt-4 pb-5 lg:min-h-0">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="m-0 text-[15px] font-semibold">{item.name}</h2>
        {item.id !== item.name && <span className="font-mono text-xs text-subtle">{item.id}</span>}
      </div>

      <div className="checker relative flex min-h-[360px] flex-1 items-center justify-center overflow-hidden rounded-[14px] border border-line p-6">
        {item.error ? (
          <div className="flex flex-col items-center gap-2 text-sm text-danger">
            <AlertIcon width="28" height="28" />
            {item.error}
          </div>
        ) : (
          <img
            ref={imgRef}
            alt={`${item.name} 원본`}
            className="absolute inset-6 m-auto max-h-[calc(100%-48px)] max-w-[calc(100%-48px)] object-contain"
          />
        )}
        <span className="absolute top-3.5 left-3.5 rounded-md bg-ground/80 px-2.5 py-1 text-xs">원본 · {item.kind}</span>
      </div>

      <dl className="m-0 grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
        <InfoCard label="파일 용량" value={formatBytes(item.file.size)} mono />
        <InfoCard label="해상도" value={item.width ? `${item.width}×${item.height}` : '확인 중'} mono />
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
