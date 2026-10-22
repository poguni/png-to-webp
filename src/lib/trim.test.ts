import { describe, expect, it } from 'vitest'
import { opaqueBounds, paddingPixels, trimPixels } from './trim.ts'

/** width×height 투명 이미지에 (x, y)부터 w×h 영역을 불투명하게 칠한다. */
function image(width: number, height: number, box?: { x: number; y: number; w: number; h: number }) {
  const data = new Uint8ClampedArray(width * height * 4)
  if (box) {
    for (let y = box.y; y < box.y + box.h; y++) {
      for (let x = box.x; x < box.x + box.w; x++) data.set([200, 10, 10, 255], (y * width + x) * 4)
    }
  }
  return { data, width, height }
}

describe('opaqueBounds', () => {
  it('불투명한 픽셀을 감싸는 영역을 찾는다', () => {
    expect(opaqueBounds(image(10, 8, { x: 2, y: 3, w: 4, h: 2 }))).toEqual({ x: 2, y: 3, width: 4, height: 2 })
  })

  it('모두 투명하면 null', () => {
    expect(opaqueBounds(image(4, 4))).toBeNull()
  })
})

describe('paddingPixels', () => {
  it('%는 긴 변 기준이다', () => {
    expect(paddingPixels({ x: 0, y: 0, width: 200, height: 100 }, 10, '%')).toBe(20)
    expect(paddingPixels({ x: 0, y: 0, width: 200, height: 100 }, 4, 'px')).toBe(4)
  })
})

describe('trimPixels', () => {
  it('투명한 가장자리를 잘라 내고 여백을 더한다 (F3)', () => {
    const { image: result, rect } = trimPixels(image(10, 8, { x: 2, y: 3, w: 4, h: 2 }), 1, 'px')
    expect(rect).toEqual({ x: 1, y: 2, width: 6, height: 4 })
    expect([result.width, result.height]).toEqual([6, 4])
    const alpha = (x: number, y: number) => result.data[(y * result.width + x) * 4 + 3]
    expect(alpha(0, 0)).toBe(0)
    expect(alpha(1, 1)).toBe(255)
    expect(alpha(4, 2)).toBe(255)
    expect(alpha(5, 3)).toBe(0)
  })

  it('여백이 원본보다 넓어도 된다', () => {
    const { rect } = trimPixels(image(4, 4, { x: 0, y: 0, w: 4, h: 4 }), 2, 'px')
    expect(rect).toEqual({ x: -2, y: -2, width: 8, height: 8 })
  })

  it('모두 투명하면 그대로 둔다', () => {
    const source = image(4, 4)
    expect(trimPixels(source, 2, 'px').image).toBe(source)
  })
})
