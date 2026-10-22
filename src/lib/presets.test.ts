import { describe, expect, it } from 'vitest'
import {
  BUILTIN_PRESETS,
  completeSettings,
  DEFAULT_SETTINGS,
  loadUserPresets,
  sameSettings,
  saveUserPresets,
} from './presets.ts'

function memoryStorage(initial?: string) {
  const data = new Map<string, string>()
  if (initial !== undefined) data.set('pngtowebp.presets', initial)
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  }
}

describe('completeSettings', () => {
  it('빠진 설정은 기본값으로 채운다', () => {
    const settings = completeSettings({ quality: 60, crop: { ratio: '1:1' } })
    expect(settings.quality).toBe(60)
    expect(settings.crop).toEqual({ ...DEFAULT_SETTINGS.crop, ratio: '1:1' })
    expect(settings.resize).toEqual(DEFAULT_SETTINGS.resize)
  })

  it('종류가 다른 값과 모르는 설정은 버린다', () => {
    const settings = completeSettings({ quality: '90', lossless: 1, unknown: true })
    expect(settings.quality).toBe(DEFAULT_SETTINGS.quality)
    expect(settings.lossless).toBe(DEFAULT_SETTINGS.lossless)
    expect(settings).not.toHaveProperty('unknown')
  })

  it('잘못된 값이면 기본 설정이다', () => {
    expect(completeSettings(null)).toEqual(DEFAULT_SETTINGS)
  })
})

describe('sameSettings', () => {
  it('키 순서와 관계없이 값으로 비교한다', () => {
    const reordered = { ...DEFAULT_SETTINGS, crop: { anchor: { y: 0.5, x: 0.5 }, custom: { height: 9, width: 21 }, ratio: 'original' } }
    expect(sameSettings(DEFAULT_SETTINGS, reordered as typeof DEFAULT_SETTINGS)).toBe(true)
    expect(sameSettings(DEFAULT_SETTINGS, { ...DEFAULT_SETTINGS, quality: 81 })).toBe(false)
    const withSizes = (sizes: typeof DEFAULT_SETTINGS.resize.sizes) => ({ ...DEFAULT_SETTINGS, resize: { ...DEFAULT_SETTINGS.resize, sizes } })
    expect(sameSettings(withSizes(['64x64']), withSizes(['64x64']))).toBe(true)
    expect(sameSettings(withSizes(['64x64']), withSizes(['128x128']))).toBe(false)
  })
})

describe('기본 프리셋 (F9-2)', () => {
  it('4종의 핵심 값', () => {
    const byName = Object.fromEntries(BUILTIN_PRESETS.map((p) => [p.name, p.settings]))
    expect(byName['게임 스프라이트']).toMatchObject({
      trim: { enabled: true, padding: 4, unit: 'px' },
      resize: { size: '512x512', fit: 'contain' },
      quality: 85,
    })
    expect(byName['앱 아이콘 세트']).toMatchObject({
      background: { enabled: true, mode: 'ai' },
      crop: { ratio: '1:1' },
      resize: { multi: true, sizes: ['512x512', '256x256', '128x128', '64x64'] },
      lossless: true,
    })
    expect(byName['웹 배경 이미지']).toMatchObject({ background: { enabled: false }, resize: { size: '1920x1080', fit: 'cover' }, quality: 75 })
    expect(byName['모바일 세로 배경']).toMatchObject({ crop: { ratio: '9:16' }, resize: { size: '1080x1920', fit: 'cover' }, quality: 75 })
  })
})

describe('내 프리셋 저장과 불러오기', () => {
  it('저장한 모든 설정값을 그대로 불러온다 (AC-7)', () => {
    const storage = memoryStorage()
    const settings = completeSettings({
      background: { enabled: true, mode: 'checker', tolerance: 33, feather: 2, applyToJpg: true },
      crop: { ratio: 'custom', custom: { width: 5, height: 4 }, anchor: { x: 1, y: 0 } },
      trim: { enabled: true, padding: 5, unit: '%' },
      resize: { size: 'custom', custom: { width: 300, height: 200 }, fit: 'long', noUpscale: false, multi: true, sizes: ['64x64', 'custom'] },
      quality: 42,
      lossless: true,
      alphaQuality: 70,
      effort: 6,
      naming: { case: 'kebab', prefix: 'a_', suffix: '_b' },
      conflict: 'skip',
    })
    saveUserPresets([{ name: '내 설정', settings }], storage)
    const [loaded] = loadUserPresets(storage)
    expect(loaded.name).toBe('내 설정')
    expect(loaded.settings).toEqual(settings)
  })

  it('저장된 내용이 깨져 있으면 빈 목록이다', () => {
    expect(loadUserPresets(memoryStorage('{not json'))).toEqual([])
    expect(loadUserPresets(memoryStorage('{"name":"x"}'))).toEqual([])
    expect(loadUserPresets(memoryStorage('[{"settings":{}},{"name":"ok"}]')).map((p) => p.name)).toEqual(['ok'])
  })
})
