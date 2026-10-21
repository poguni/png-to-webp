import decodePng from '@jsquash/png/decode'
import encodeWebp from '@jsquash/webp/encode'
import { cropPixels, cropRect, type Anchor } from '../lib/crop.ts'
import type { ImageKind } from '../lib/imageFiles.ts'

/** 변환 단계별 옵션. 파이프라인: 디코딩 → 자르기 → WebP 인코딩 */
export interface ConvertOptions {
  /** 자를 가로/세로 비율. null이면 자르지 않는다. */
  ratio: number | null
  anchor: Anchor
  quality: number
}

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

function crop(image: ImageData, options: ConvertOptions): ImageData {
  const rect = cropRect(image.width, image.height, options.ratio, options.anchor)
  const cropped = cropPixels(image, rect)
  return cropped === image ? image : new ImageData(cropped.data as Uint8ClampedArray<ArrayBuffer>, cropped.width, cropped.height)
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
    image = crop(image, options)
    const buffer = await encodeWebp(image, { quality: options.quality })
    const response: EncodeResponse = { id, ok: true, buffer }
    self.postMessage(response, { transfer: [buffer] })
  } catch (error) {
    const response: EncodeResponse = { id, ok: false, error: `WebP로 변환하지 못했습니다. (${(error as Error).message})` }
    self.postMessage(response)
  }
}
