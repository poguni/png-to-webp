import decodePng from '@jsquash/png/decode'
import encodeWebp from '@jsquash/webp/encode'
import pica from 'pica'
import type { ModelProgress } from '../lib/aiBackground.ts'
import {
  backgroundColors,
  detectBackground,
  removeBackground,
  shouldUseAi,
  type BackgroundKind,
  type BackgroundMode,
  type Point,
} from '../lib/background.ts'
import { cropPixels, cropRect, type Anchor, type Pixels, type Rect } from '../lib/crop.ts'
import type { ImageKind } from '../lib/imageFiles.ts'
import { placePixels, resizePlan, type FitMode, type Size } from '../lib/resize.ts'
import { trimPixels, type PaddingUnit } from '../lib/trim.ts'

/** 변환 단계별 옵션. 파이프라인: 디코딩 → 배경 제거 → 여백 다듬기 → 자르기 → 크기 조절 → WebP 인코딩 */
export interface ConvertOptions {
  /** null이면 배경을 지우지 않는다. */
  background: { mode: BackgroundMode; tolerance: number; feather: number } | null
  /** 마술봉으로 찍은 점(원본 픽셀 좌표). 그 점과 이어진 같은 색 영역을 지운다. null이면 쓰지 않는다. */
  wand: { points: Point[]; tolerance: number; feather: number } | null
  /** null이면 여백을 다듬지 않는다. */
  trim: { padding: number; unit: PaddingUnit } | null
  /** 자를 가로/세로 비율. null이면 자르지 않는다. */
  ratio: number | null
  anchor: Anchor
  /** 자르기 영역 크기. 1이면 비율에 맞는 가장 큰 영역 */
  cropScale: number
  /** 출력할 목표 크기들. 크기마다 파일을 하나씩 만든다. null이면 크기를 바꾸지 않는다. */
  targets: (Size | null)[]
  fit: FitMode
  noUpscale: boolean
  /** 손실 압축 품질 0~100 (F6-1). 무손실이면 쓰지 않는다. */
  quality: number
  /** 무손실 압축 (F6-2) */
  lossless: boolean
  /** 투명 영역 경계의 압축 품질 0~100 (F6-3) */
  alphaQuality: number
  /** 압축 노력도 0~6. 높을수록 작고 느리다 (F6-4) */
  effort: number
}

export interface EncodeRequest {
  id: number
  file: File
  kind: ImageKind
  options: ConvertOptions
  /** false면 AI가 필요할 때 처리하지 않고 needsAi로 돌려준다. AI 모델은 Worker 하나에만 올린다. */
  allowAi: boolean
}

/** 배경 제거 결과. method가 null이면 지우지 않았고, 이유는 kind로 알 수 있다. */
export interface BackgroundResult {
  kind: BackgroundKind
  method: 'color' | 'ai' | null
}

export interface EncodedImage {
  buffer: ArrayBuffer
  width: number
  height: number
}

export type EncodeResponse =
  | {
      id: number
      ok: true
      /** targets와 같은 순서 */
      outputs: EncodedImage[]
      background: BackgroundResult | null
      /** 여백 다듬기 결과가 원본의 어느 영역인지. 다듬지 않았으면 null */
      trimmed: Rect | null
    }
  | { id: number; ok: false; error: string }
  /** AI가 필요하지만 이 Worker에서는 쓸 수 없다. AI를 쓰는 Worker에 다시 맡겨야 한다. */
  | { id: number; ok: false; needsAi: true }

/** AI 모델을 처음 내려받는 동안 보내는 진행률 */
export interface ModelProgressMessage extends ModelProgress {
  type: 'model-progress'
}

// Worker 안이라 pica가 Worker를 또 만들지 않도록 js/wasm만 쓴다.
const resizer = pica({ features: ['js', 'wasm'] })

/**
 * PNG는 캔버스를 거치지 않고 직접 디코딩한다. 캔버스는 반투명 픽셀의 색을 미세하게 바꾸기 때문이다.
 * JPG는 투명도가 없으므로 브라우저 디코더를 쓴다. EXIF 회전 정보도 이때 반영된다.
 */
async function decode(file: File, kind: ImageKind): Promise<ImageData> {
  if (kind === 'PNG') return decodePng(await file.arrayBuffer())

  const bitmap = await createImageBitmap(file)
  try {
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(bitmap, 0, 0)
    return ctx.getImageData(0, 0, canvas.width, canvas.height)
  } finally {
    bitmap.close()
  }
}

/** AI가 필요한데 allowAi가 false면 null을 돌려준다. */
async function background(
  image: Pixels,
  options: ConvertOptions,
  allowAi: boolean,
): Promise<{ image: Pixels; result: BackgroundResult | null } | null> {
  if (!options.background) return { image, result: null }
  const { mode, tolerance, feather } = options.background
  const detection = detectBackground(image)

  const colors = backgroundColors(detection, mode)
  if (colors) {
    // 마술봉 점도 같은 플러드 필에서 함께 지운다.
    const cleared = removeBackground(image, colors, tolerance, feather, options.wand?.points)
    return { image: cleared, result: { kind: detection.kind, method: 'color' } }
  }
  if (!shouldUseAi(detection, mode)) return { image, result: { kind: detection.kind, method: null } }
  if (!allowAi) return null

  // AI 모듈(모델 포함)은 AI를 쓸 때만 불러온다.
  try {
    const { removeBackgroundWithAi } = await import('../lib/aiBackground.ts')
    const cleared = await removeBackgroundWithAi(image, (progress) => {
      const message: ModelProgressMessage = { type: 'model-progress', ...progress }
      self.postMessage(message)
    })
    return { image: cleared, result: { kind: detection.kind, method: 'ai' } }
  } catch (error) {
    throw new Error(
      `AI 배경 제거에 실패했습니다. 처음 한 번은 모델을 내려받아야 하므로 인터넷 연결이 필요합니다. (${(error as Error).message})`,
    )
  }
}

function crop(image: Pixels, options: ConvertOptions): Pixels {
  return cropPixels(image, cropRect(image.width, image.height, options.ratio, options.anchor, options.cropScale))
}

/** 고품질(mks2013 필터)로 크기를 바꾸고, Contain이면 투명한 여백 위에 놓는다. */
async function resize(image: Pixels, target: Size | null, options: ConvertOptions): Promise<Pixels> {
  const plan = resizePlan(image.width, image.height, target, options.fit, options.noUpscale)
  if (!plan) return image
  const source = cropPixels(image, plan.source)
  const resized =
    source.width === plan.dest.width && source.height === plan.dest.height
      ? source.data
      : await resizer.resizeBuffer({
          src: source.data,
          width: source.width,
          height: source.height,
          toWidth: plan.dest.width,
          toHeight: plan.dest.height,
          filter: 'mks2013',
        })
  const pixels = {
    data: new Uint8ClampedArray(resized.buffer, resized.byteOffset, resized.byteLength),
    width: plan.dest.width,
    height: plan.dest.height,
  }
  return placePixels(plan, pixels, plan.dest)
}

function toImageData(pixels: Pixels): ImageData {
  if (pixels instanceof ImageData) return pixels
  return new ImageData(pixels.data as Uint8ClampedArray<ArrayBuffer>, pixels.width, pixels.height)
}

function fail(id: number, error: string) {
  const response: EncodeResponse = { id, ok: false, error }
  self.postMessage(response)
}

self.onmessage = async (event: MessageEvent<EncodeRequest>) => {
  const { id, file, kind, options, allowAi } = event.data
  let image: ImageData
  try {
    image = await decode(file, kind)
  } catch {
    fail(id, '이미지를 읽을 수 없습니다. 파일이 손상되었을 수 있습니다.')
    return
  }

  let cleared
  try {
    cleared = await background(image, options, allowAi)
  } catch (error) {
    fail(id, (error as Error).message)
    return
  }
  if (!cleared) {
    const response: EncodeResponse = { id, ok: false, needsAi: true }
    self.postMessage(response)
    return
  }
  // 색으로 지우지 않았으면(배경 제거 끔, AI, 이미 투명 등) 마술봉 영역만 따로 지운다.
  const { wand } = options
  if (wand && cleared.result?.method !== 'color') {
    cleared = { ...cleared, image: removeBackground(cleared.image, [], wand.tolerance, wand.feather, wand.points) }
  }

  try {
    const trimmed = options.trim ? trimPixels(cleared.image, options.trim.padding, options.trim.unit) : null
    const cropped = crop(trimmed?.image ?? cleared.image, options)
    const outputs: EncodedImage[] = []
    for (const target of options.targets) {
      const result = await resize(cropped, target, options)
      const buffer = await encodeWebp(toImageData(result), {
        quality: options.quality,
        lossless: options.lossless ? 1 : 0,
        alpha_quality: options.alphaQuality,
        method: options.effort,
      })
      outputs.push({ buffer, width: result.width, height: result.height })
    }
    const response: EncodeResponse = { id, ok: true, outputs, background: cleared.result, trimmed: trimmed?.rect ?? null }
    self.postMessage(response, { transfer: outputs.map((o) => o.buffer) })
  } catch (error) {
    fail(id, `WebP로 변환하지 못했습니다. (${(error as Error).message})`)
  }
}
