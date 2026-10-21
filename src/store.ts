import { create } from 'zustand'
import { forEachLimited } from './lib/concurrency.ts'
import type { ImageKind } from './lib/imageFiles.ts'
import { scanSource, type Source } from './lib/pickers.ts'
import { createThumbnail } from './lib/thumbnail.ts'

export interface ImageItem {
  /** 불러온 폴더 기준 경로. 목록 안에서 유일하다. */
  id: string
  name: string
  kind: ImageKind
  file: File
  checked: boolean
  width?: number
  height?: number
  thumbUrl?: string
  error?: string
}

export type KindFilter = 'all' | ImageKind

interface AppState {
  source: Source | null
  items: ImageItem[]
  skipped: number
  recursive: boolean
  filter: KindFilter
  selectedId: string | null
  scanning: boolean
  scanError: string | null

  open(source: Source): Promise<void>
  setRecursive(recursive: boolean): Promise<void>
  setFilter(filter: KindFilter): void
  select(id: string): void
  toggleChecked(id: string): void
  setChecked(ids: readonly string[], checked: boolean): void
}

/** 썸네일을 동시에 만드는 개수. 큰 이미지를 한꺼번에 디코딩해 메모리가 부족해지는 것을 막는다. */
const THUMBNAIL_CONCURRENCY = 3

// 다른 폴더를 다시 불러오면 이전 썸네일 작업의 결과를 버리기 위한 번호
let loadId = 0

export const useAppStore = create<AppState>()((set, get) => {
  function patchItem(id: string, patch: Partial<ImageItem>) {
    set((s) => ({ items: s.items.map((item) => (item.id === id ? { ...item, ...patch } : item)) }))
  }

  async function load(source: Source, recursive: boolean) {
    const myLoad = ++loadId
    set({ scanning: true, scanError: null })

    let result
    try {
      result = await scanSource(source, recursive)
    } catch (error) {
      if (myLoad === loadId) {
        set({ scanning: false, scanError: `폴더를 읽지 못했습니다. (${(error as Error).message})` })
      }
      return
    }
    if (myLoad !== loadId) return

    for (const item of get().items) if (item.thumbUrl) URL.revokeObjectURL(item.thumbUrl)

    const items: ImageItem[] = result.images.map((image) => ({
      id: image.relativePath,
      name: image.file.name,
      kind: image.kind,
      file: image.file,
      checked: true,
    }))
    set({
      source,
      items,
      skipped: result.skipped,
      recursive,
      selectedId: items[0]?.id ?? null,
      scanning: false,
    })

    await forEachLimited(items, THUMBNAIL_CONCURRENCY, async (item) => {
      if (myLoad !== loadId) return
      try {
        const thumb = await createThumbnail(item.file)
        if (myLoad !== loadId) {
          URL.revokeObjectURL(thumb.url)
          return
        }
        patchItem(item.id, { width: thumb.width, height: thumb.height, thumbUrl: thumb.url })
      } catch {
        if (myLoad === loadId) patchItem(item.id, { error: '이미지를 읽을 수 없습니다' })
      }
    })
  }

  return {
    source: null,
    items: [],
    skipped: 0,
    recursive: true,
    filter: 'all',
    selectedId: null,
    scanning: false,
    scanError: null,

    open: (source) => load(source, get().recursive),

    async setRecursive(recursive) {
      const { source } = get()
      if (source) await load(source, recursive)
      else set({ recursive })
    },

    setFilter: (filter) => set({ filter }),
    select: (id) => set({ selectedId: id }),
    toggleChecked: (id) =>
      set((s) => ({
        items: s.items.map((item) => (item.id === id ? { ...item, checked: !item.checked } : item)),
      })),
    setChecked(ids, checked) {
      const target = new Set(ids)
      set((s) => ({
        items: s.items.map((item) => (target.has(item.id) ? { ...item, checked } : item)),
      }))
    },
  }
})
