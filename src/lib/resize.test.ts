import { describe, expect, it } from 'vitest'
import { placePixels, resizePlan, targetSize, targetSizes, type ResizeSettings } from './resize.ts'

function settings(patch: Partial<ResizeSettings>): ResizeSettings {
  return { size: 'original', custom: { width: 800, height: 600 }, fit: 'contain', noUpscale: true, multi: false, sizes: [], ...patch }
}

describe('targetSize', () => {
  it('프리셋과 사용자 지정 크기를 읽는다', () => {
    expect(targetSize(settings({ size: '1920x1080' }))).toEqual({ width: 1920, height: 1080 })
    expect(targetSize(settings({ size: 'custom', custom: { width: 300, height: 200 } }))).toEqual({ width: 300, height: 200 })
  })

  it('원본 유지나 잘못된 값은 null', () => {
    expect(targetSize(settings({ size: 'original' }))).toBeNull()
    expect(targetSize(settings({ size: 'custom', custom: { width: 0, height: 200 } }))).toBeNull()
  })
})

describe('resizePlan', () => {
  const fhd = { width: 1920, height: 1080 }
  const square = { width: 512, height: 512 }

  // AC-4: 16:9로 자른 1600×900을 1920×1080 Contain에 맞춘다
  it('Contain + 확대 금지: 작은 이미지는 그대로 둔다', () => {
    expect(resizePlan(1600, 900, fhd, 'contain', true)).toBeNull()
  })

  it('Contain + 확대 허용: 목표 크기로 키운다', () => {
    expect(resizePlan(1600, 900, fhd, 'contain', false)).toEqual({
      width: 1920,
      height: 1080,
      source: { x: 0, y: 0, width: 1600, height: 900 },
      dest: { x: 0, y: 0, width: 1920, height: 1080 },
    })
  })

  // AC-5: 1000×500을 512×512 Contain → 512×512, 위아래 투명 여백 128px
  it('Contain: 비율이 다르면 가운데에 놓고 여백을 남긴다', () => {
    expect(resizePlan(1000, 500, square, 'contain', true)).toEqual({
      width: 512,
      height: 512,
      source: { x: 0, y: 0, width: 1000, height: 500 },
      dest: { x: 0, y: 128, width: 512, height: 256 },
    })
  })

  // AC-5: Cover → 512×512, 여백 없음
  it('Cover: 가운데를 잘라 꽉 채운다', () => {
    expect(resizePlan(1000, 500, square, 'cover', true)).toEqual({
      width: 512,
      height: 512,
      source: { x: 250, y: 0, width: 500, height: 500 },
      dest: { x: 0, y: 0, width: 512, height: 512 },
    })
  })

  it('Cover + 확대 금지: 작은 이미지는 비율만 맞춰 자른다', () => {
    expect(resizePlan(300, 400, square, 'cover', true)).toMatchObject({
      width: 300,
      height: 300,
      source: { x: 0, y: 50, width: 300, height: 300 },
    })
  })

  it('Stretch: 비율을 무시하고 목표 크기로 만든다', () => {
    expect(resizePlan(1000, 500, square, 'stretch', true)).toMatchObject({ width: 512, height: 512 })
    expect(resizePlan(300, 200, square, 'stretch', true)).toBeNull()
    expect(resizePlan(300, 200, square, 'stretch', false)).toMatchObject({ width: 512, height: 512 })
  })

  it('확대 금지는 원본이 목표 안에 다 들어갈 때만 적용한다', () => {
    // 가로는 목표보다 크므로 Contain으로 줄이고 여백을 둔다
    expect(resizePlan(600, 100, square, 'contain', true)).toMatchObject({ width: 512, height: 512 })
  })

  it('긴 변 기준: 목표의 긴 변에 원본의 긴 변을 맞춘다', () => {
    expect(resizePlan(4000, 3000, fhd, 'long', true)).toMatchObject({ width: 1920, height: 1440 })
    expect(resizePlan(3000, 4000, fhd, 'long', true)).toMatchObject({ width: 1440, height: 1920 })
    expect(resizePlan(800, 600, fhd, 'long', true)).toBeNull()
  })

  it('목표가 없거나 이미 같은 크기면 null', () => {
    expect(resizePlan(800, 600, null, 'contain', true)).toBeNull()
    expect(resizePlan(512, 512, square, 'contain', false)).toBeNull()
    expect(resizePlan(512, 512, square, 'cover', true)).toBeNull()
  })
})

describe('placePixels', () => {
  it('투명한 캔버스의 지정한 위치에 놓는다', () => {
    const pixels = { width: 1, height: 1, data: new Uint8ClampedArray([10, 20, 30, 255]) }
    const result = placePixels({ width: 2, height: 3 }, pixels, { x: 1, y: 1, width: 1, height: 1 })
    expect(result.width).toBe(2)
    expect(result.height).toBe(3)
    const alpha = [...result.data].filter((_, i) => i % 4 === 3)
    expect(alpha).toEqual([0, 0, 0, 255, 0, 0])
    expect([...result.data.subarray(12, 16)]).toEqual([10, 20, 30, 255])
  })
})

describe('targetSizes', () => {
  const base: ResizeSettings = {
    size: '512x512',
    custom: { width: 300, height: 200 },
    fit: 'contain',
    noUpscale: true,
    multi: false,
    sizes: [],
  }

  it('하나만 출력할 때는 지금 크기 하나', () => {
    expect(targetSizes(base)).toEqual([{ width: 512, height: 512 }])
  })

  it('여러 크기는 프리셋 순서로, 겹치는 크기는 한 번만', () => {
    const sizes = targetSizes({ ...base, multi: true, sizes: ['64x64', 'custom', '512x512'], custom: { width: 64, height: 64 } })
    expect(sizes).toEqual([
      { width: 512, height: 512 },
      { width: 64, height: 64 },
    ])
  })

  it('여러 크기인데 고른 것이 없으면 크기를 바꾸지 않는다', () => {
    expect(targetSizes({ ...base, multi: true, sizes: [] })).toEqual([null])
  })
})
