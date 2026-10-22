import { OUTPUT_DIR } from './imageFiles.ts'
import type { Source } from './pickers.ts'

export type OutputTarget =
  | {
      kind: 'folder'
      root: FileSystemDirectoryHandle
      /** 화면에 보여 줄 저장 위치. 예: `sprites/output` */
      label: string
    }
  /** 폴더에 바로 쓸 수 없는 브라우저는 결과를 ZIP으로 내려받는다. (F1-8) */
  | { kind: 'zip'; label: string; fileName: string }

/** 폴더에 바로 저장할 수 있는 브라우저인지. Firefox와 Safari는 ZIP으로 내려받는다. */
export function canWriteFolders(): boolean {
  return typeof window.showDirectoryPicker === 'function'
}

/**
 * 결과를 저장할 곳을 정한다. 사용자의 클릭 직후에 불러야 권한 요청 창이 뜬다.
 * - 폴더를 불러온 경우: 그 폴더 안의 `output/` (F7-1)
 * - 파일을 불러온 경우: 저장할 폴더를 고르게 한다
 * - 폴더에 쓸 수 없는 브라우저: ZIP 파일
 * 사용자가 취소하면 null.
 */
export async function resolveOutputTarget(source: Source): Promise<OutputTarget | null> {
  if (!canWriteFolders()) {
    const base = source.kind === 'files' && source.files[0]?.webkitRelativePath ? source.name : 'webp'
    return { kind: 'zip', label: 'ZIP 파일', fileName: `${base}-${OUTPUT_DIR}.zip` }
  }

  if (source.kind === 'directory') {
    const { handle } = source
    const mode = { mode: 'readwrite' } as const
    if ((await handle.queryPermission?.(mode)) !== 'granted') {
      if ((await handle.requestPermission?.(mode)) !== 'granted') {
        throw new Error('폴더에 저장할 권한을 받지 못했습니다. 권한 요청 창에서 허용을 눌러 주세요.')
      }
    }
    const root = await handle.getDirectoryHandle(OUTPUT_DIR, { create: true })
    return { kind: 'folder', root, label: `${handle.name}/${OUTPUT_DIR}` }
  }

  try {
    const root = await window.showDirectoryPicker!({ id: 'pngtowebp-output', mode: 'readwrite' })
    return { kind: 'folder', root, label: root.name }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return null
    throw error
  }
}

/** `a/b` 경로의 하위 폴더를 만들거나 연다. 빈 문자열이면 root. */
export async function openSubdirectory(root: FileSystemDirectoryHandle, path: string) {
  let dir = root
  for (const part of path.split('/').filter(Boolean)) {
    dir = await dir.getDirectoryHandle(part, { create: true })
  }
  return dir
}

/** 폴더에 있는 파일 이름을 소문자로 모은다. */
export async function listFileNames(dir: FileSystemDirectoryHandle): Promise<Set<string>> {
  const names = new Set<string>()
  for await (const [name, entry] of dir.entries()) {
    if (entry.kind === 'file') names.add(name.toLowerCase())
  }
  return names
}

export async function writeFile(dir: FileSystemDirectoryHandle, name: string, data: ArrayBuffer) {
  const handle = await dir.getFileHandle(name, { create: true })
  const writable = await handle.createWritable()
  try {
    await writable.write(data)
  } finally {
    await writable.close()
  }
}
