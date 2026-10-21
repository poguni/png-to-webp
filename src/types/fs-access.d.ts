// TypeScript DOM 타입에 아직 없는 File System Access API (Chrome/Edge 지원)

interface Window {
  showDirectoryPicker?(options?: {
    id?: string
    mode?: 'read' | 'readwrite'
  }): Promise<FileSystemDirectoryHandle>
}

interface DataTransferItem {
  getAsFileSystemHandle?(): Promise<FileSystemHandle | null>
}
