import { create } from 'zustand'
import type { BackgroundMode, BackgroundSettings } from './lib/background.ts'
import { forEachLimited } from './lib/concurrency.ts'
import { ratioOf, type Anchor, type CropSettings } from './lib/crop.ts'
import type { ModelProgress } from './lib/aiBackground.ts'
import { cancelAll, encodeToWebp, onModelProgress, WORKER_COUNT } from './lib/encoder.ts'
import type { ImageKind } from './lib/imageFiles.ts'
import { listFileNames, openSubdirectory, resolveOutputTarget, writeFile } from './lib/output.ts'
import { outputFileName, resolveName, withSizeSuffix, type ConflictPolicy, type NamingOptions } from './lib/outputNames.ts'
import { scanSource, type Source } from './lib/pickers.ts'
import { BUILTIN_PRESETS, DEFAULT_SETTINGS, loadUserPresets, saveUserPresets, type Preset } from './lib/presets.ts'
import { targetSizes, type ResizeSettings } from './lib/resize.ts'
import type { TrimSettings } from './lib/trim.ts'
import type { BackgroundResult, ConvertOptions } from './workers/encode.worker.ts'
import { createThumbnail } from './lib/thumbnail.ts'

/** 이 이미지에만 적용하는 설정 (S4, F4-3) */
export interface ImageOverrides {
  /** 배경 제거 방식. `off`면 지우지 않는다. */
  background?: BackgroundMode | 'off'
  /** 자르기 위치와 크기. 비율을 정했을 때만 쓴다. */
  crop?: { anchor: Anchor; scale: number }
}

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
  overrides?: ImageOverrides
}

export type KindFilter = 'all' | ImageKind

export interface Settings {
  background: BackgroundSettings
  crop: CropSettings
  trim: TrimSettings
  resize: ResizeSettings
  /** WebP 품질 0~100 (F6-1) */
  quality: number
  /** 무손실 압축 (F6-2) */
  lossless: boolean
  /** 투명 영역 경계의 압축 품질 0~100 (F6-3) */
  alphaQuality: number
  /** 압축 노력도 0~6 (F6-4) */
  effort: number
  naming: NamingOptions
  conflict: ConflictPolicy
}

export type ResultStatus = 'waiting' | 'running' | 'done' | 'failed' | 'skipped' | 'cancelled'

export interface ItemResult {
  status: ResultStatus
  /** 저장 위치 기준 경로. 여러 크기로 출력하면 첫 번째 파일. 예: `sub/hero.webp` */
  outputPath?: string
  /** 저장한 파일 수 */
  outputCount?: number
  /** 저장한 파일 용량의 합 */
  outputSize?: number
  error?: string
  /** 처리 중 참고할 내용. 예: 배경 제거 결과 */
  note?: string
}

export interface Batch {
  ids: string[]
  results: Record<string, ItemResult>
  outputLabel: string
  startedAt: number
  finishedAt?: number
  /** 취소를 눌렀으면 true */
  cancelled?: boolean
  /** AI 모델을 내려받는 중일 때만 있다 */
  modelProgress?: ModelProgress
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
  /** 브라우저에 저장한 내 프리셋 (F9-1) */
  userPresets: Preset[]

  open(source: Source): Promise<void>
  setRecursive(recursive: boolean): Promise<void>
  setFilter(filter: KindFilter): void
  select(id: string): void
  toggleChecked(id: string): void
  setChecked(ids: readonly string[], checked: boolean): void
  updateSettings(patch: Partial<Settings>): void
  /** 이미지별 설정을 바꾼다. 값을 undefined로 주면 그 항목을 전체 설정으로 되돌린다. */
  setOverrides(id: string, patch: ImageOverrides): void
  /** 현재 설정을 내 프리셋으로 저장한다. 같은 이름이 있으면 덮어쓴다. 실패하면 이유를 돌려준다. */
  savePreset(name: string): string | null
  deletePreset(name: string): void
  startBatch(): Promise<void>
  /** 처리 중인 작업을 멈춘다. 이미 저장한 파일은 그대로 둔다. (AC-9) */
  cancelBatch(): void
  closeBatch(): void
}

export function backgroundNote(result: BackgroundResult): string {
  if (result.method === 'ai') return '배경 제거: AI'
  if (result.method === 'color') return result.kind === 'checker' ? '배경 제거: 체커보드' : '배경 제거: 단색'
  if (result.kind === 'transparent') return '배경 제거 안 함: 이미 투명'
  if (result.kind === 'complex') return '배경 제거 안 함: 배경이 복잡함'
  return '배경 제거 안 함: 체커보드가 아님'
}

/** 설정을 이미지 한 장의 변환 옵션으로 바꾼다. 일괄 처리와 미리보기가 함께 쓴다. */
export function convertOptions(settings: Settings, item: Pick<ImageItem, 'kind' | 'overrides'>): ConvertOptions {
  const bg = settings.background
  // 이미지별로 배경 제거 방식을 고르면 전체 설정이나 JPG 여부와 관계없이 그 방식을 쓴다.
  const mode = item.overrides?.background
  const removeBg = mode ? mode !== 'off' : bg.enabled && (item.kind === 'PNG' || bg.applyToJpg)
  const ratio = ratioOf(settings.crop)
  const crop = ratio !== null ? item.overrides?.crop : undefined
  return {
    background: removeBg
      ? { mode: mode && mode !== 'off' ? mode : bg.mode, tolerance: bg.tolerance, feather: bg.feather }
      : null,
    trim: settings.trim.enabled ? { padding: settings.trim.padding, unit: settings.trim.unit } : null,
    ratio,
    anchor: crop?.anchor ?? settings.crop.anchor,
    cropScale: crop?.scale ?? 1,
    targets: targetSizes(settings.resize),
    fit: settings.resize.fit,
    noUpscale: settings.resize.noUpscale,
    quality: settings.quality,
    lossless: settings.lossless,
    alphaQuality: settings.alphaQuality,
    effort: settings.effort,
  }
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
    settings: DEFAULT_SETTINGS,
    batch: null,
    batchError: null,
    userPresets: loadUserPresets(),

    updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

    setOverrides(id, patch) {
      set((s) => ({
        items: s.items.map((item) => {
          if (item.id !== id) return item
          const next: ImageOverrides = { ...item.overrides, ...patch }
          for (const key of Object.keys(next) as (keyof ImageOverrides)[]) if (next[key] === undefined) delete next[key]
          return { ...item, overrides: Object.keys(next).length > 0 ? next : undefined }
        }),
      }))
    },

    savePreset(name) {
      const trimmed = name.trim()
      if (!trimmed) return '이름을 입력하세요.'
      if (BUILTIN_PRESETS.some((p) => p.name === trimmed)) return '기본 프리셋과 같은 이름은 쓸 수 없습니다.'
      const { settings, userPresets } = get()
      const others = userPresets.filter((p) => p.name !== trimmed)
      const next = [...others, { name: trimmed, settings }]
      try {
        saveUserPresets(next)
      } catch (error) {
        return `브라우저에 저장하지 못했습니다. (${(error as Error).message})`
      }
      set({ userPresets: next })
      return null
    },

    deletePreset(name) {
      const next = get().userPresets.filter((p) => p.name !== name)
      try {
        saveUserPresets(next)
      } catch {
        // 저장하지 못해도 이번 세션의 목록에서는 지운다.
      }
      set({ userPresets: next })
    },

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

      onModelProgress((progress) => {
        const downloading = progress.loaded < progress.total
        set((s) => (s.batch ? { batch: { ...s.batch, modelProgress: downloading ? progress : undefined } } : {}))
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

      const cancelled = () => get().batch?.cancelled === true

      // Worker 수만큼 동시에 처리한다. 이름은 await 없이 정하고 바로 예약하므로 동시에 처리해도 겹치지 않는다.
      await forEachLimited(targets, WORKER_COUNT, async (item) => {
        if (cancelled()) return
        setResult(item.id, { status: 'running' })
        try {
          const slash = item.id.lastIndexOf('/')
          const dirPath = slash >= 0 ? item.id.slice(0, slash) : ''
          const dir = await dirFor(dirPath)
          const pathOf = (name: string) => (dirPath ? `${dirPath}/${name}` : name)
          const options = convertOptions(settings, item)
          // 여러 크기로 출력하면 크기마다 이름을 정한다. 예: hero_512.webp, hero_256.webp (F5-5)
          const baseName = outputFileName(item.name, settings.naming)
          const planned = options.targets.map((size) => ({
            size,
            decision: resolveName(
              settings.resize.multi && size ? withSizeSuffix(baseName, size) : baseName,
              dir.existing,
              dir.produced,
              settings.conflict,
            ),
          }))
          const writes = planned.filter((p) => p.decision.action !== 'skip')
          if (writes.length === 0) {
            setResult(item.id, {
              status: 'skipped',
              outputPath: pathOf(planned[0].decision.name),
              error: '같은 이름의 파일이 있어 건너뛰었습니다',
            })
            return
          }
          for (const p of writes) dir.produced.add(p.decision.name.toLowerCase())
          // 폴더를 여는 동안 취소했을 수 있다.
          if (cancelled()) {
            setResult(item.id, { status: 'cancelled' })
            return
          }

          const { outputs, background } = await encodeToWebp(item.file, item.kind, {
            ...options,
            targets: writes.map((p) => p.size),
          })
          for (let i = 0; i < writes.length; i++) await writeFile(dir.handle, writes[i].decision.name, outputs[i].buffer)
          const skippedSizes = planned.length - writes.length
          setResult(item.id, {
            status: 'done',
            outputPath: pathOf(writes[0].decision.name),
            outputCount: writes.length,
            outputSize: outputs.reduce((sum, o) => sum + o.buffer.byteLength, 0),
            note:
              [
                background && backgroundNote(background),
                skippedSizes > 0 && `${skippedSizes}개 크기는 같은 이름이 있어 건너뜀`,
              ]
                .filter(Boolean)
                .join(' · ') || undefined,
          })
        } catch (error) {
          if (cancelled()) setResult(item.id, { status: 'cancelled' })
          else setResult(item.id, { status: 'failed', error: (error as Error).message })
        }
      })

      onModelProgress(null)
      set((s) => {
        if (!s.batch) return {}
        // 취소해서 시작하지 못한 파일을 표시한다.
        const results = { ...s.batch.results }
        for (const id of s.batch.ids) if (results[id].status === 'waiting') results[id] = { status: 'cancelled' }
        return { batch: { ...s.batch, results, finishedAt: Date.now(), modelProgress: undefined } }
      })
    },

    cancelBatch() {
      const { batch } = get()
      if (!batch || batch.finishedAt !== undefined || batch.cancelled) return
      set({ batch: { ...batch, cancelled: true } })
      // 처리 중인 변환을 바로 끝낸다. 변환을 마치고 저장 중인 파일은 끝까지 저장한다.
      cancelAll()
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
