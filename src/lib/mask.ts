import type { Pixels } from './crop.ts'

/**
 * RGBA 마스크의 알파를 이미지 알파에 곱한다. 색은 원본 그대로 두고 투명도만 바꾼다.
 * 원래 반투명이던 픽셀은 더 투명해질 수는 있어도 더 불투명해지지는 않는다.
 */
export function applyAlphaMask(image: Pixels, maskRgba: Uint8Array): Pixels {
  const total = image.width * image.height
  if (maskRgba.length !== total * 4) {
    throw new Error(`마스크 크기가 이미지와 다릅니다. (${maskRgba.length} ≠ ${total * 4})`)
  }
  const data = new Uint8ClampedArray(image.data)
  for (let i = 0; i < total; i++) {
    const p = i * 4 + 3
    data[p] = Math.round((image.data[p] * maskRgba[p]) / 255)
  }
  return { data, width: image.width, height: image.height }
}
