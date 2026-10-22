import { describe, expect, it } from 'vitest'
import { backgroundColors, detectBackground, removeBackground, shouldUseAi, type RGB } from './background.ts'
import type { Pixels } from './crop.ts'

type RGBA = [number, number, number, number]

/** (x, y)마다 색을 정하는 함수로 이미지를 만든다. */
function image(width: number, height: number, paint: (x: number, y: number) => RGBA): Pixels {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) data.set(paint(x, y), (y * width + x) * 4)
  }
  return { data, width, height }
}

function pixel(img: Pixels, x: number, y: number): RGBA {
  const p = (y * img.width + x) * 4
  return [...img.data.subarray(p, p + 4)] as RGBA
}

const WHITE: RGBA = [255, 255, 255, 255]
const RED: RGBA = [220, 30, 30, 255]
const inCircle = (x: number, y: number, cx: number, cy: number, r: number) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r

/** 흰 배경 위의 빨간 원 (AC-3) */
const redCircle = image(64, 64, (x, y) => (inCircle(x, y, 32, 32, 20) ? RED : WHITE))

/** 회색·흰색 8px 체크무늬 위의 빨간 원 (AC-3, 나노바나나식 가짜 투명 배경) */
const checkerCircle = image(64, 64, (x, y) => {
  if (inCircle(x, y, 32, 32, 20)) return RED
  return (Math.floor(x / 8) + Math.floor(y / 8)) % 2 === 0 ? WHITE : [204, 204, 204, 255]
})

describe('detectBackground', () => {
  it('단색 배경을 알아낸다', () => {
    expect(detectBackground(redCircle)).toEqual({ kind: 'solid', colors: [[255, 255, 255]] })
  })

  it('회색·흰색 체크무늬를 알아낸다', () => {
    const detection = detectBackground(checkerCircle)
    expect(detection.kind).toBe('checker')
    expect(detection.colors).toHaveLength(2)
  })

  it('가장자리가 이미 투명하면 transparent', () => {
    const clear = image(16, 16, (x, y) => (inCircle(x, y, 8, 8, 4) ? RED : [0, 0, 0, 0]))
    expect(detectBackground(clear).kind).toBe('transparent')
  })

  it('여러 색이 섞인 배경은 complex', () => {
    const noisy = image(32, 32, (x, y) => [(x * 37) % 256, (y * 53) % 256, ((x + y) * 29) % 256, 255])
    expect(detectBackground(noisy).kind).toBe('complex')
  })
})

describe('backgroundColors', () => {
  const solid = { kind: 'solid' as const, colors: [[255, 255, 255], [0, 0, 0]] as RGB[] }
  const checker = { kind: 'checker' as const, colors: [[255, 255, 255], [204, 204, 204]] as RGB[] }

  it('자동이면 감지 결과를 따른다', () => {
    expect(backgroundColors(solid, 'auto')).toEqual([[255, 255, 255]])
    expect(backgroundColors(checker, 'auto')).toHaveLength(2)
  })

  it('단색 모드는 한 색, 체커보드 모드는 두 색을 쓴다', () => {
    expect(backgroundColors(checker, 'solid')).toEqual([[255, 255, 255]])
    expect(backgroundColors(solid, 'checker')).toHaveLength(2)
  })

  it('이미 투명한 이미지는 건드리지 않는다', () => {
    expect(backgroundColors({ kind: 'transparent', colors: [] }, 'auto')).toBeNull()
  })

  it('자동 모드에서 복잡한 배경은 색으로 지우지 않고, 단색 모드를 직접 고르면 지운다', () => {
    const complex = { kind: 'complex' as const, colors: [[10, 20, 30], [200, 100, 50]] as RGB[] }
    expect(backgroundColors(complex, 'auto')).toBeNull()
    expect(backgroundColors(complex, 'solid')).toEqual([[10, 20, 30]])
  })

  it('AI 모드는 색으로 지우지 않는다', () => {
    expect(backgroundColors(solid, 'ai')).toBeNull()
  })
})

describe('shouldUseAi', () => {
  const of = (kind: 'solid' | 'checker' | 'complex' | 'transparent') => ({ kind, colors: [] })

  it('자동 모드는 복잡한 배경에만 AI를 쓴다 (F2-2)', () => {
    expect(shouldUseAi(of('complex'), 'auto')).toBe(true)
    expect(shouldUseAi(of('solid'), 'auto')).toBe(false)
    expect(shouldUseAi(of('checker'), 'auto')).toBe(false)
  })

  it('AI 모드는 항상 AI를 쓰고, 이미 투명하면 어느 모드든 건너뛴다', () => {
    expect(shouldUseAi(of('solid'), 'ai')).toBe(true)
    expect(shouldUseAi(of('transparent'), 'ai')).toBe(false)
    expect(shouldUseAi(of('complex'), 'solid')).toBe(false)
  })
})

describe('removeBackground', () => {
  // AC-3: 네 모서리 알파 0, 원 중심 알파 255
  it('흰 배경을 지우고 원은 남긴다', () => {
    const result = removeBackground(redCircle, [[255, 255, 255]], 10, 0)
    for (const [x, y] of [[0, 0], [63, 0], [0, 63], [63, 63]]) expect(pixel(result, x, y)[3]).toBe(0)
    expect(pixel(result, 32, 32)).toEqual(RED)
  })

  it('체크무늬 배경을 지우고 원은 남긴다', () => {
    const colors = detectBackground(checkerCircle).colors
    const result = removeBackground(checkerCircle, colors, 10, 0)
    for (const [x, y] of [[0, 0], [63, 0], [0, 63], [63, 63], [9, 0]]) expect(pixel(result, x, y)[3]).toBe(0)
    expect(pixel(result, 32, 32)).toEqual(RED)
  })

  it('가장자리와 이어지지 않은 배경색(눈의 흰자)은 남긴다', () => {
    const eye = image(64, 64, (x, y) => {
      if (inCircle(x, y, 32, 32, 6)) return WHITE
      return inCircle(x, y, 32, 32, 20) ? RED : WHITE
    })
    const result = removeBackground(eye, [[255, 255, 255]], 10, 0)
    expect(pixel(result, 32, 32)).toEqual(WHITE)
    expect(pixel(result, 0, 0)[3]).toBe(0)
  })

  it('허용 오차 안의 비슷한 색(JPG 잡음)도 지운다', () => {
    const noisy = image(16, 16, (x, y) => (inCircle(x, y, 8, 8, 4) ? RED : [250 - (x % 3), 252, 249 + (y % 2), 255]))
    const result = removeBackground(noisy, [[251, 252, 250]], 5, 0)
    expect(pixel(result, 0, 0)[3]).toBe(0)
    expect(pixel(result, 15, 7)[3]).toBe(0)
  })

  it('경계를 부드럽게 하면 경계 픽셀은 반투명이 되고 흰 테두리가 빠진다', () => {
    // 왼쪽 절반 흰 배경, 가운데 한 줄은 빨강과 흰색이 반씩 섞인 분홍(안티앨리어싱), 오른쪽은 빨강
    const edge = image(20, 4, (x) => (x < 10 ? WHITE : x === 10 ? [238, 143, 143, 255] : RED))
    const result = removeBackground(edge, [[255, 255, 255]], 10, 1)
    const [r, g, b, a] = pixel(result, 10, 1)
    expect(a).toBeGreaterThan(0)
    expect(a).toBeLessThan(255)
    // 배경색(흰색)을 빼고 나면 원래의 빨강에 가까워져야 한다
    expect(r).toBeGreaterThan(200)
    expect(g).toBeLessThan(60)
    expect(b).toBeLessThan(60)
    // 경계에서 먼 안쪽은 그대로
    expect(pixel(result, 18, 1)).toEqual(RED)
  })

  it('원본 픽셀 배열은 바꾸지 않는다', () => {
    const before = [...redCircle.data]
    removeBackground(redCircle, [[255, 255, 255]], 10, 1)
    expect([...redCircle.data]).toEqual(before)
  })
})

describe('removeBackground 마술봉', () => {
  // 흰 배경 위의 빨간 고리. 고리 안쪽(반지름 8 안)은 바깥과 이어지지 않은 흰색이다.
  const ring = image(64, 64, (x, y) => (inCircle(x, y, 32, 32, 20) && !inCircle(x, y, 32, 32, 8) ? RED : WHITE))
  const white: RGB[] = [[255, 255, 255]]

  it('점을 찍지 않으면 안쪽에 갇힌 배경은 남는다', () => {
    const result = removeBackground(ring, white, 10, 0)
    expect(pixel(result, 0, 0)[3]).toBe(0)
    expect(pixel(result, 32, 32)[3]).toBe(255)
  })

  it('안쪽에 찍은 점과 이어진 같은 색 영역을 지운다', () => {
    const result = removeBackground(ring, white, 10, 1, [{ x: 32, y: 32 }])
    expect(pixel(result, 32, 32)[3]).toBe(0)
    expect(pixel(result, 32, 20)[3]).toBe(255)
    expect(pixel(result, 0, 0)[3]).toBe(0)
  })

  it('배경 색 없이 마술봉 영역만 지울 수 있다', () => {
    const result = removeBackground(ring, [], 10, 0, [{ x: 32, y: 32 }])
    expect(pixel(result, 32, 32)[3]).toBe(0)
    expect(pixel(result, 0, 0)[3]).toBe(255)
  })

  it('이미 투명한 곳을 건너 다른 영역으로 번지지 않는다', () => {
    // 왼쪽 절반은 투명, 오른쪽 절반은 흰색. 가운데에 투명한 줄이 흰 영역 둘을 나눈다.
    const split = image(20, 10, (x) => (x < 5 || x === 12 ? [0, 0, 0, 0] : WHITE))
    const result = removeBackground(split, [], 10, 0, [{ x: 8, y: 5 }])
    expect(pixel(result, 8, 5)[3]).toBe(0)
    expect(pixel(result, 15, 5)[3]).toBe(255)
  })

  it('이미지 밖이나 투명한 점은 무시한다', () => {
    expect(removeBackground(ring, [], 10, 0, [{ x: 100, y: 5 }])).toBe(ring)
  })
})
