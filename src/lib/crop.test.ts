import { describe, expect, it } from 'vitest'
import { cropPixels, cropRect, ratioOf, type Anchor, type CropSettings } from './crop.ts'

const center: Anchor = { x: 0.5, y: 0.5 }

function settings(patch: Partial<CropSettings>): CropSettings {
  return { ratio: 'original', custom: { width: 1, height: 1 }, anchor: center, ...patch }
}

describe('ratioOf', () => {
  it('프리셋 비율을 숫자로 바꾼다', () => {
    expect(ratioOf(settings({ ratio: '16:9' }))).toBeCloseTo(16 / 9)
    expect(ratioOf(settings({ ratio: '3:4' }))).toBeCloseTo(0.75)
    expect(ratioOf(settings({ ratio: '1:1' }))).toBe(1)
  })

  it('원본 유지는 null', () => {
    expect(ratioOf(settings({ ratio: 'original' }))).toBeNull()
  })

  it('사용자 지정 비율을 쓰고, 0 이하이면 자르지 않는다', () => {
    expect(ratioOf(settings({ ratio: 'custom', custom: { width: 21, height: 9 } }))).toBeCloseTo(21 / 9)
    expect(ratioOf(settings({ ratio: 'custom', custom: { width: 0, height: 9 } }))).toBeNull()
  })
})

describe('cropRect', () => {
  // AC-4의 자르기 부분: 1600×1200에 16:9 가운데 → 1600×900
  it('가로로 긴 비율은 위아래를 잘라 가운데에 맞춘다', () => {
    expect(cropRect(1600, 1200, 16 / 9, center)).toEqual({ x: 0, y: 150, width: 1600, height: 900 })
  })

  it('세로로 긴 비율은 좌우를 자른다', () => {
    expect(cropRect(1920, 1080, 9 / 16, center)).toEqual({ x: 656, y: 0, width: 608, height: 1080 })
  })

  it('기준 위치에 따라 남기는 영역이 바뀐다', () => {
    expect(cropRect(1600, 1200, 16 / 9, { x: 0.5, y: 0 })).toMatchObject({ y: 0 })
    expect(cropRect(1600, 1200, 16 / 9, { x: 0.5, y: 1 })).toMatchObject({ y: 300 })
    expect(cropRect(1000, 500, 1, { x: 0, y: 0.5 })).toEqual({ x: 0, y: 0, width: 500, height: 500 })
    expect(cropRect(1000, 500, 1, { x: 1, y: 0.5 })).toEqual({ x: 500, y: 0, width: 500, height: 500 })
  })

  it('이미 같은 비율이거나 원본 유지면 전체를 쓴다', () => {
    expect(cropRect(1024, 1024, 1, center)).toEqual({ x: 0, y: 0, width: 1024, height: 1024 })
    expect(cropRect(800, 600, null, center)).toEqual({ x: 0, y: 0, width: 800, height: 600 })
  })

  it('아주 납작한 비율이어도 1픽셀 이상을 남긴다', () => {
    expect(cropRect(10, 10, 1000, center).height).toBe(1)
  })
})

describe('cropPixels', () => {
  // 4×2 이미지: 각 픽셀의 R 값이 인덱스 (0~7)
  const source = {
    width: 4,
    height: 2,
    data: new Uint8ClampedArray(Array.from({ length: 8 }, (_, i) => [i, 0, 0, 255]).flat()),
  }

  it('지정한 영역의 픽셀만 남긴다', () => {
    const result = cropPixels(source, { x: 1, y: 0, width: 2, height: 2 })
    expect(result.width).toBe(2)
    expect(result.height).toBe(2)
    expect([...result.data].filter((_, i) => i % 4 === 0)).toEqual([1, 2, 5, 6])
  })

  it('전체 영역이면 원본을 그대로 돌려준다', () => {
    expect(cropPixels(source, { x: 0, y: 0, width: 4, height: 2 })).toBe(source)
  })
})
