export type ImageKind = 'PNG' | 'JPG'

export interface FoundImage {
  file: File
  /** 불러온 폴더 기준 경로. 예: `sub/hero.png` */
  relativePath: string
  kind: ImageKind
}

export interface ScanResult {
  images: FoundImage[]
  /** 지원하지 않는 형식이라 건너뛴 파일 수 */
  skipped: number
}

/** 결과 파일을 저장하는 폴더. 다시 불러올 때 스캔하지 않는다. */
export const OUTPUT_DIR = 'output'

/** 확장자로 지원 형식을 판별한다. 대소문자는 구분하지 않는다. (F1-3) */
export function imageKind(name: string): ImageKind | null {
  const dot = name.lastIndexOf('.')
  if (dot < 0) return null
  const ext = name.slice(dot + 1).toLowerCase()
  if (ext === 'png') return 'PNG'
  if (ext === 'jpg' || ext === 'jpeg') return 'JPG'
  return null
}

/** `slime_2`가 `slime_10`보다 앞에 오도록 숫자를 고려해 정렬한다. */
export function comparePaths(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
}

/** 테스트에서 가짜 폴더를 넘길 수 있도록 필요한 기능만 정의한다. */
export interface DirectoryLike {
  kind: 'directory'
  entries(): AsyncIterable<[string, DirectoryLike | FileLike]>
}
export interface FileLike {
  kind: 'file'
  getFile(): Promise<File>
}

function sortImages(images: FoundImage[]): FoundImage[] {
  return images.sort((a, b) => comparePaths(a.relativePath, b.relativePath))
}

/** 폴더 핸들을 훑어 PNG/JPG를 모은다. 최상위 `output/` 폴더는 건너뛴다. */
export async function scanDirectory(
  dir: DirectoryLike,
  options: { recursive: boolean },
): Promise<ScanResult> {
  const images: FoundImage[] = []
  let skipped = 0

  async function walk(current: DirectoryLike, prefix: string) {
    for await (const [name, entry] of current.entries()) {
      if (entry.kind === 'directory') {
        if (!options.recursive) continue
        if (prefix === '' && name === OUTPUT_DIR) continue
        await walk(entry, `${prefix}${name}/`)
        continue
      }
      const kind = imageKind(name)
      if (!kind) {
        skipped++
        continue
      }
      images.push({ file: await entry.getFile(), relativePath: `${prefix}${name}`, kind })
    }
  }

  await walk(dir, '')
  return { images: sortImages(images), skipped }
}

/**
 * `<input webkitdirectory>`나 파일 선택으로 받은 목록을 정리한다.
 * 폴더를 선택한 경우 `webkitRelativePath`의 첫 부분(선택한 폴더 이름)을 떼어 낸다.
 */
export function scanFileList(files: Iterable<File>, options: { recursive: boolean }): ScanResult {
  const images: FoundImage[] = []
  let skipped = 0

  for (const file of files) {
    const fullPath = file.webkitRelativePath || file.name
    const parts = fullPath.split('/')
    const relativePath = file.webkitRelativePath ? parts.slice(1).join('/') : file.name
    const depth = relativePath.split('/').length - 1

    if (depth > 0 && (!options.recursive || relativePath.startsWith(`${OUTPUT_DIR}/`))) continue

    const kind = imageKind(file.name)
    if (!kind) {
      skipped++
      continue
    }
    images.push({ file, relativePath, kind })
  }

  return { images: sortImages(images), skipped }
}
