import JSZip from 'jszip'

export interface ZipEntry {
  /** ZIP 안의 경로. 예: `sub/hero.webp` */
  path: string
  data: ArrayBuffer
}

/**
 * 결과 파일을 ZIP 하나로 묶는다. (F1-8)
 * WebP는 이미 압축되어 있어 다시 압축해도 거의 줄지 않으므로, 압축하지 않고 묶기만 한다.
 */
export function createZip(entries: readonly ZipEntry[]): Promise<Blob> {
  const zip = new JSZip()
  for (const entry of entries) zip.file(entry.path, entry.data)
  return zip.generateAsync({ type: 'blob', compression: 'STORE' })
}

/** Blob을 파일로 내려받게 한다. */
export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  // 내려받기가 시작된 뒤에 주소를 해제한다.
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
