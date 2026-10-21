import { scanDirectory, scanFileList, type ScanResult } from './imageFiles.ts'

/** 불러온 이미지의 출처. 폴더 핸들이 있어야 C3에서 같은 폴더의 `output/`에 저장할 수 있다. */
export type Source =
  | { kind: 'directory'; name: string; handle: FileSystemDirectoryHandle }
  | { kind: 'files'; name: string; files: File[] }

export function scanSource(source: Source, recursive: boolean): Promise<ScanResult> {
  if (source.kind === 'directory') return scanDirectory(source.handle, { recursive })
  return Promise.resolve(scanFileList(source.files, { recursive }))
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

/** 숨긴 `<input type="file">`을 열어 고른 파일을 받는다. 취소하면 빈 배열. */
function pickWithInput(options: { directory: boolean }): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = true
    if (options.directory) input.webkitdirectory = true
    else input.accept = '.png,.jpg,.jpeg,image/png,image/jpeg'
    input.addEventListener('change', () => resolve([...(input.files ?? [])]))
    input.addEventListener('cancel', () => resolve([]))
    input.click()
  })
}

/** 폴더를 고른다. Chrome/Edge는 폴더 핸들을, 그 밖의 브라우저는 파일 목록을 받는다. (F1-1) */
export async function pickDirectory(): Promise<Source | null> {
  if (window.showDirectoryPicker) {
    try {
      const handle = await window.showDirectoryPicker({ id: 'pngtowebp-source', mode: 'read' })
      return { kind: 'directory', name: handle.name, handle }
    } catch (error) {
      if (isAbort(error)) return null
      throw error
    }
  }
  const files = await pickWithInput({ directory: true })
  if (files.length === 0) return null
  return { kind: 'files', name: files[0].webkitRelativePath.split('/')[0], files }
}

/** 이미지 파일을 직접 고른다. */
export async function pickFiles(): Promise<Source | null> {
  const files = await pickWithInput({ directory: false })
  if (files.length === 0) return null
  return { kind: 'files', name: '선택한 파일', files }
}

/** 하위 폴더 구조가 있는 출처인지. 개별 파일 선택이나 파일 드롭은 폴더 구조가 없다. */
export function hasFolderStructure(source: Source): boolean {
  return source.kind === 'directory' || source.files.some((file) => file.webkitRelativePath !== '')
}

/** 드래그 앤 드롭으로 받은 폴더나 파일을 읽는다. (F1-2) */
export async function readDrop(dataTransfer: DataTransfer): Promise<Source | null> {
  // 드롭 이벤트가 끝나면 항목에 접근할 수 없으므로, 기다리기 전에 필요한 것을 모두 꺼낸다.
  const items = [...dataTransfer.items].filter((item) => item.kind === 'file')
  const plainFiles = [...dataTransfer.files]
  const handlePromises = items.map((item) => item.getAsFileSystemHandle?.())

  if (handlePromises.length > 0 && handlePromises.every((p) => p !== undefined)) {
    const handles = (await Promise.all(handlePromises)).filter((h) => h != null)
    if (handles.length === 1 && handles[0].kind === 'directory') {
      const handle = handles[0] as FileSystemDirectoryHandle
      return { kind: 'directory', name: handle.name, handle }
    }
    const files = await Promise.all(
      handles
        .filter((h): h is FileSystemFileHandle => h.kind === 'file')
        .map((h) => h.getFile()),
    )
    if (files.length === 0) return null
    return { kind: 'files', name: '끌어다 놓은 파일', files }
  }

  if (plainFiles.length === 0) return null
  return { kind: 'files', name: '끌어다 놓은 파일', files: plainFiles }
}
