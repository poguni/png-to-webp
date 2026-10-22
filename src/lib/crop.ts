export type RatioPreset = 'original' | '16:9' | '9:16' | '4:3' | '3:4' | '1:1' | 'custom'

export const RATIO_PRESETS: RatioPreset[] = ['original', '16:9', '9:16', '4:3', '3:4', '1:1', 'custom']

/** 자르기 기준 위치. 0은 왼쪽(위), 0.5는 가운데, 1은 오른쪽(아래). 이미지별로 끌어 옮기면 그 사이 값도 쓴다. */
export interface Anchor {
  x: number
  y: number
}

export interface CropSettings {
  ratio: RatioPreset
  /** `custom`일 때 쓰는 가로:세로 */
  custom: { width: number; height: number }
  anchor: Anchor
}

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/** 설정에서 가로/세로 비율을 구한다. 자르지 않으면 null. */
export function ratioOf(crop: CropSettings): number | null {
  if (crop.ratio === 'original') return null
  if (crop.ratio === 'custom') {
    const { width, height } = crop.custom
    return width > 0 && height > 0 ? width / height : null
  }
  const [w, h] = crop.ratio.split(':').map(Number)
  return w / h
}

/**
 * 이미지 안에서 비율에 맞는 가장 큰 영역을 기준 위치에 맞춰 잡는다. (F4-1, F4-2)
 * scale이 1보다 작으면 그 비율만큼 줄인 영역을 잡는다. (F4-3 이미지별 조정)
 * 예: 1600×1200에 16:9 가운데 → x 0, y 150, 1600×900
 */
export function cropRect(width: number, height: number, ratio: number | null, anchor: Anchor, scale = 1): Rect {
  if (ratio === null) return { x: 0, y: 0, width, height }

  let cropWidth = width
  let cropHeight = height
  if (width / height > ratio) cropWidth = Math.max(1, Math.min(width, Math.round(height * ratio)))
  else cropHeight = Math.max(1, Math.min(height, Math.round(width / ratio)))
  if (scale < 1) {
    cropWidth = Math.max(1, Math.round(cropWidth * scale))
    cropHeight = Math.max(1, Math.round(cropHeight * scale))
  }

  return {
    x: Math.round((width - cropWidth) * anchor.x),
    y: Math.round((height - cropHeight) * anchor.y),
    width: cropWidth,
    height: cropHeight,
  }
}

export interface Pixels {
  data: Uint8ClampedArray
  width: number
  height: number
}

/** RGBA 픽셀 배열에서 영역을 잘라 낸다. */
export function cropPixels(source: Pixels, rect: Rect): Pixels {
  if (rect.x === 0 && rect.y === 0 && rect.width === source.width && rect.height === source.height) {
    return source
  }
  const data = new Uint8ClampedArray(rect.width * rect.height * 4)
  const rowBytes = rect.width * 4
  for (let row = 0; row < rect.height; row++) {
    const start = ((rect.y + row) * source.width + rect.x) * 4
    data.set(source.data.subarray(start, start + rowBytes), row * rowBytes)
  }
  return { data, width: rect.width, height: rect.height }
}
