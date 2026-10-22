/** 파일 크기를 `86 KB`, `1.42 MB`처럼 표시한다. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

/** 원본 대비 용량 변화. 줄었으면 `−93%`, 늘었으면 `+17%` */
export function formatSaving(before: number, after: number): string {
  const percent = Math.round((1 - after / before) * 100)
  return percent >= 0 ? `−${percent}%` : `+${-percent}%`
}
