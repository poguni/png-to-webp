import decodePng from '@jsquash/png/decode'
import encodeWebp from '@jsquash/webp/encode'
import type { ImageKind } from '../lib/imageFiles.ts'

export interface EncodeRequest {
  id: number
  file: File
  kind: ImageKind
  quality: number
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

self.onmessage = async (event: MessageEvent<EncodeRequest>) => {
  const { id, file, kind, quality } = event.data
  let image: ImageData
  try {
    image = await decode(file, kind)
  } catch {
    const response: EncodeResponse = { id, ok: false, error: '이미지를 읽을 수 없습니다. 파일이 손상되었을 수 있습니다.' }
    self.postMessage(response)
    return
  }
  try {
    const buffer = await encodeWebp(image, { quality })
    const response: EncodeResponse = { id, ok: true, buffer }
    self.postMessage(response, { transfer: [buffer] })
  } catch (error) {
    const response: EncodeResponse = { id, ok: false, error: `WebP로 변환하지 못했습니다. (${(error as Error).message})` }
    self.postMessage(response)
  }
}
