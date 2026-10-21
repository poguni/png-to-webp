import { create } from 'zustand'
import { forEachLimited } from './lib/concurrency.ts'
import { ratioOf, type CropSettings } from './lib/crop.ts'
import { encodeToWebp } from './lib/encoder.ts'
import type { ImageKind } from './lib/imageFiles.ts'
import { listFileNames, openSubdirectory, resolveOutputTarget, writeFile } from './lib/output.ts'
import { outputFileName, resolveName, type ConflictPolicy, type NamingOptions } from './lib/outputNames.ts'
import { scanSource, type Source } from './lib/pickers.ts'
import { targetSize, type ResizeSettings } from './lib/resize.ts'
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

export interface Settings {
  crop: CropSettings
  resize: ResizeSettings
  /** WebP 품질 0~100 (F6-1) */
  quality: number
  naming: NamingOptions
  conflict: ConflictPolicy
}

export type ResultStatus = 'waiting' | 'running' | 'done' | 'failed' | 'skipped'

export interface ItemResult {
  status: ResultStatus
  /** 저장 위치 기준 경로. 예: `sub/hero.webp` */
  outputPath?: string
  outputSize?: number
  error?: string
}

export interface Batch {
  ids: string[]
  results: Record<string, ItemResult>
  outputLabel: string
  startedAt: number
  finishedAt?: number
}

interface AppState {
  source: Source | null
  items: ImageItem[]
  skipped: number
  recursive: boolean
  filter: KindFilter
  selectedId: string | null
  scanning: boolean
  scanError: string | null
  settings: Settings
  batch: Batch | null
  batchError: string | null

  open(source: Source): Promise<void>
  setRecursive(recursive: boolean): Promise<void>
  setFilter(filter: KindFilter): void
  select(id: string): void
  toggleChecked(id: string): void
  setChecked(ids: readonly string[], checked: boolean): void
  updateSettings(patch: Partial<Settings>): void
  startBatch(): Promise<void>
  closeBatch(): void
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
    set({ scanning: true, scanError: null, batchError: null })

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

  function setResult(id: string, result: ItemResult) {
    set((s) => (s.batch ? { batch: { ...s.batch, results: { ...s.batch.results, [id]: result } } } : {}))
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
    settings: {
      crop: { ratio: 'original', custom: { width: 21, height: 9 }, anchor: { x: 0.5, y: 0.5 } },
      resize: { size: 'original', custom: { width: 800, height: 600 }, fit: 'contain', noUpscale: true },
      quality: 80,
      naming: { case: 'keep', prefix: '', suffix: '' },
      conflict: 'number',
    },
    batch: null,
    batchError: null,

    updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

    async startBatch() {
      const { source, items, settings } = get()
      const targets = items.filter((item) => item.checked)
      if (!source || targets.length === 0) return

      // 권한 요청은 클릭 직후여야 하므로 다른 작업보다 먼저 한다.
      let target
      try {
        target = await resolveOutputTarget(source)
      } catch (error) {
        set({ batchError: (error as Error).message })
        return
      }
      if (!target) return

      set({
        batchError: null,
        batch: {
          ids: targets.map((item) => item.id),
          results: Object.fromEntries(targets.map((item) => [item.id, { status: 'waiting' }])),
          outputLabel: target.label,
          startedAt: Date.now(),
        },
      })

      // 하위 폴더별로 폴더 핸들과 이름 목록을 한 번만 읽는다.
      const dirs = new Map<string, Promise<{ handle: FileSystemDirectoryHandle; existing: Set<string>; produced: Set<string> }>>()
      function dirFor(path: string) {
        let dir = dirs.get(path)
        if (!dir) {
          dir = openSubdirectory(target!.root, path).then(async (handle) => ({
            handle,
            existing: await listFileNames(handle),
            produced: new Set<string>(),
          }))
          dirs.set(path, dir)
        }
        return dir
      }

      for (const item of targets) {
        setResult(item.id, { status: 'running' })
        try {
          const slash = item.id.lastIndexOf('/')
          const dirPath = slash >= 0 ? item.id.slice(0, slash) : ''
          const dir = await dirFor(dirPath)
          const decision = resolveName(
            outputFileName(item.name, settings.naming),
            dir.existing,
            dir.produced,
            settings.conflict,
          )
          const outputPath = dirPath ? `${dirPath}/${decision.name}` : decision.name
          if (decision.action === 'skip') {
            setResult(item.id, { status: 'skipped', outputPath, error: '같은 이름의 파일이 있어 건너뛰었습니다' })
            continue
          }
          dir.produced.add(decision.name.toLowerCase())

          const buffer = await encodeToWebp(item.file, item.kind, {
            ratio: ratioOf(settings.crop),
            anchor: settings.crop.anchor,
            target: targetSize(settings.resize),
            fit: settings.resize.fit,
            noUpscale: settings.resize.noUpscale,
            quality: settings.quality,
          })
          await writeFile(dir.handle, decision.name, buffer)
          setResult(item.id, { status: 'done', outputPath, outputSize: buffer.byteLength })
        } catch (error) {
          setResult(item.id, { status: 'failed', error: (error as Error).message })
        }
      }

      set((s) => (s.batch ? { batch: { ...s.batch, finishedAt: Date.now() } } : {}))
    },

    closeBatch: () => set({ batch: null }),

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
