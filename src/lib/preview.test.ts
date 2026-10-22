import { describe, expect, it } from 'vitest'
import { cropRect } from './crop.ts'
import { cropInSource, cropOverride, resultPlacement } from './preview.ts'
import { resizePlan } from './resize.ts'

const center = { x: 0.5, y: 0.5 } as const

describe('resultPlacement', () => {
  it('크기를 바꾸지 않으면 자르기 영역 그대로다', () => {
    const crop = cropRect(1600, 1200, 16 / 9, center)
    expect(resultPlacement(crop, null)).toEqual({ x: 0, y: 150, width: 1600, height: 900 })
  })

  it('Contain의 여백은 원본 바깥으로 이어진다', () => {
    const crop = cropRect(1000, 500, null, center)
    const plan = resizePlan(1000, 500, { width: 512, height: 512 }, 'contain', true)
    expect(resultPlacement(crop, plan)).toEqual({ x: 0, y: -250, width: 1000, height: 1000 })
  })

  it('Cover는 잘라 낸 가운데 영역에 맞춘다', () => {
    const crop = cropRect(1000, 500, null, center)
    const plan = resizePlan(1000, 500, { width: 512, height: 512 }, 'cover', true)
    expect(resultPlacement(crop, plan)).toEqual({ x: 250, y: 0, width: 500, height: 500 })
  })

  it('자르기 위치와 Stretch를 함께 반영한다', () => {
    const crop = cropRect(1600, 1200, 1, { x: 1, y: 0.5 })
    const plan = resizePlan(crop.width, crop.height, { width: 600, height: 300 }, 'stretch', true)
    expect(resultPlacement(crop, plan)).toEqual({ x: 400, y: 0, width: 1200, height: 1200 })
  })
})

describe('cropInSource', () => {
  it('여백 다듬기 영역 안에서 자르고 원본 좌표로 돌려준다', () => {
    const base = { x: 100, y: -10, width: 400, height: 200 }
    expect(cropInSource(base, 1, { x: 1, y: 0.5 }, 1)).toEqual({ x: 300, y: -10, width: 200, height: 200 })
  })
})

describe('cropOverride (F4-3)', () => {
  const base = { x: 0, y: 0, width: 1600, height: 1200 }

  it('옮긴 영역을 기준 위치로 바꾼다', () => {
    const override = cropOverride(base, 1, { x: 300, y: 0, width: 1200, height: 1200 })
    expect(override.scale).toBe(1)
    expect(override.anchor.x).toBeCloseTo(0.75)
    expect(cropInSource(base, 1, override.anchor, override.scale)).toEqual({ x: 300, y: 0, width: 1200, height: 1200 })
  })

  it('줄인 영역을 크기 비율로 바꾸고, 왕복하면 같은 영역이다', () => {
    const rect = { x: 250, y: 600, width: 600, height: 600 }
    const override = cropOverride(base, 1, rect)
    expect(override.scale).toBe(0.5)
    expect(cropInSource(base, 1, override.anchor, override.scale)).toEqual(rect)
  })

  it('이미지 밖으로 나가거나 너무 커지면 안으로 맞춘다', () => {
    const override = cropOverride(base, 1, { x: 1500, y: -50, width: 3000, height: 3000 })
    expect(override).toEqual({ anchor: { x: 1, y: 0.5 }, scale: 1 })
  })
})
