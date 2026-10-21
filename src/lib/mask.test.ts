import { describe, expect, it } from 'vitest'
import { applyAlphaMask } from './mask.ts'

describe('applyAlphaMask', () => {
  const image = {
    width: 3,
    height: 1,
    data: new Uint8ClampedArray([10, 20, 30, 255, 40, 50, 60, 255, 70, 80, 90, 128]),
  }

  it('마스크 알파를 곱하고 색은 그대로 둔다', () => {
    const mask = new Uint8Array([255, 255, 255, 0, 255, 255, 255, 255, 255, 255, 255, 255])
    const result = applyAlphaMask(image, mask)
    expect([...result.data]).toEqual([10, 20, 30, 0, 40, 50, 60, 255, 70, 80, 90, 128])
  })

  it('반투명 마스크는 비율대로 줄인다', () => {
    const mask = new Uint8Array([0, 0, 0, 128, 0, 0, 0, 128, 0, 0, 0, 128])
    const alpha = [...applyAlphaMask(image, mask).data].filter((_, i) => i % 4 === 3)
    expect(alpha).toEqual([128, 128, 64])
  })

  it('크기가 다른 마스크는 거부한다', () => {
    expect(() => applyAlphaMask(image, new Uint8Array(4))).toThrow('마스크 크기')
  })

  it('원본은 바꾸지 않는다', () => {
    applyAlphaMask(image, new Uint8Array(12))
    expect(image.data[3]).toBe(255)
  })
})
