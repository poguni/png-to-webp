import decodePng from '@jsquash/png/decode'
import encodeWebp from '@jsquash/webp/encode'
import pica from 'pica'
import { cropPixels, cropRect, type Anchor, type Pixels } from '../lib/crop.ts'
import type { ImageKind } from '../lib/imageFiles.ts'
import { placePixels, resizePlan, type FitMode, type Size } from '../lib/resize.ts'

/** 변환 단계별 옵션. 파이프라인: 디코딩 → 자르기 → 크기 조절 → WebP 인코딩 */
export interface ConvertOptions {
  /** 자를 가로/세로 비율. null이면 자르지 않는다. */
  ratio: number | null
  anchor: Anchor
  /** 목표 크기. null이면 크기를 바꾸지 않는다. */
  target: Size | null
  fit: FitMode
  noUpscale: boolean
  quality: number
}

// Worker 안이라 pica가 Worker를 또 만들지 않도록 js/wasm만 쓴다.
const resizer = pica({ features: ['js', 'wasm'] })

export interface EncodeRequest {
  id: number
  file: File
  kind: ImageKind
  options: ConvertOptions
}

export type EncodeResponse =
  | { id: number; ok: true; buffer: ArrayBuffer }
  | { id: number; ok: false; error: string }

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

function crop(image: Pixels, options: ConvertOptions): Pixels {
  return cropPixels(image, cropRect(image.width, image.height, options.ratio, options.anchor))
}

/** 고품질(mks2013 필터)로 크기를 바꾸고, Contain이면 투명한 여백 위에 놓는다. */
async function resize(image: Pixels, options: ConvertOptions): Promise<Pixels> {
  const plan = resizePlan(image.width, image.height, options.target, options.fit, options.noUpscale)
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

self.onmessage = async (event: MessageEvent<EncodeRequest>) => {
  const { id, file, kind, options } = event.data
  let image: ImageData
  try {
    image = await decode(file, kind)
  } catch {
    const response: EncodeResponse = { id, ok: false, error: '이미지를 읽을 수 없습니다. 파일이 손상되었을 수 있습니다.' }
    self.postMessage(response)
    return
  }
  try {
    const result = await resize(crop(image, options), options)
    const buffer = await encodeWebp(toImageData(result), { quality: options.quality })
    const response: EncodeResponse = { id, ok: true, buffer }
    self.postMessage(response, { transfer: [buffer] })
  } catch (error) {
    const response: EncodeResponse = { id, ok: false, error: `WebP로 변환하지 못했습니다. (${(error as Error).message})` }
    self.postMessage(response)
  }
}
