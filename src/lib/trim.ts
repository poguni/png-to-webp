import type { Pixels, Rect } from './crop.ts'

export type PaddingUnit = 'px' | '%'

/** 여백 다듬기 (F3) */
export interface TrimSettings {
  enabled: boolean
  /** 다듬은 뒤 사방에 더할 여백 */
  padding: number
  /** `%`는 다듬은 영역의 긴 변 기준 */
  unit: PaddingUnit
}

/** 투명하지 않은 픽셀을 모두 감싸는 가장 작은 영역. 모두 투명하면 null. */
export function opaqueBounds(image: Pixels): Rect | null {
  const { data, width, height } = image
  let left = width
  let right = -1
  let top = height
  let bottom = -1
  for (let y = 0; y < height; y++) {
    const row = y * width * 4
    for (let x = 0; x < width; x++) {
      if (data[row + x * 4 + 3] === 0) continue
      if (x < left) left = x
      if (x > right) right = x
      if (y < top) top = y
      bottom = y
    }
  }
  if (right < 0) return null
  return { x: left, y: top, width: right - left + 1, height: bottom - top + 1 }
}

/** 여백을 픽셀 수로 바꾼다. */
export function paddingPixels(bounds: Rect, padding: number, unit: PaddingUnit): number {
  const value = Math.max(0, padding)
  if (unit === 'px') return Math.round(value)
  return Math.round((Math.max(bounds.width, bounds.height) * value) / 100)
}

/**
 * 투명한 가장자리를 잘라 내고 사방에 투명한 여백을 더한다. (F3-1, F3-2)
 * rect는 결과가 원본의 어느 영역인지 나타낸다. 여백 때문에 원본 바깥으로 나갈 수 있다.
 * 모두 투명하면 그대로 둔다.
 */
export function trimPixels(image: Pixels, padding: number, unit: PaddingUnit): { image: Pixels; rect: Rect } {
  const bounds = opaqueBounds(image)
  if (!bounds) return { image, rect: { x: 0, y: 0, width: image.width, height: image.height } }

  const pad = paddingPixels(bounds, padding, unit)
  const rect = { x: bounds.x - pad, y: bounds.y - pad, width: bounds.width + pad * 2, height: bounds.height + pad * 2 }
  if (rect.x === 0 && rect.y === 0 && rect.width === image.width && rect.height === image.height) {
    return { image, rect }
  }

  const data = new Uint8ClampedArray(rect.width * rect.height * 4)
  const rowBytes = bounds.width * 4
  for (let row = 0; row < bounds.height; row++) {
    const start = ((bounds.y + row) * image.width + bounds.x) * 4
    data.set(image.data.subarray(start, start + rowBytes), ((pad + row) * rect.width + pad) * 4)
  }
  return { image: { data, width: rect.width, height: rect.height }, rect }
}
