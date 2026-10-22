import { describe, expect, it } from 'vitest'
import { cropRect } from './crop.ts'
import { resultPlacement } from './preview.ts'
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
