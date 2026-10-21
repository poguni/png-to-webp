export interface Thumbnail {
  /** 원본 이미지의 가로 픽셀 */
  width: number
  /** 원본 이미지의 세로 픽셀 */
  height: number
  url: string
}

/**
 * 이미지를 디코딩해 원본 해상도를 알아내고, 긴 변이 `size`인 썸네일을 만든다.
 * 디코딩에 실패하면 예외를 던진다. 손상된 파일을 미리 알아내는 역할도 한다.
 */
export async function createThumbnail(file: Blob, size = 96): Promise<Thumbnail> {
  const bitmap = await createImageBitmap(file)
  try {
    const { width, height } = bitmap
    const scale = Math.min(1, size / Math.max(width, height))
    const canvas = new OffscreenCanvas(
      Math.max(1, Math.round(width * scale)),
      Math.max(1, Math.round(height * scale)),
    )
    const ctx = canvas.getContext('2d')!
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const blob = await canvas.convertToBlob({ type: 'image/webp', quality: 0.8 })
    return { width, height, url: URL.createObjectURL(blob) }
  } finally {
    bitmap.close()
  }
}
