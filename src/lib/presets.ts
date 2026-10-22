import type { Settings } from '../store.ts'

export const DEFAULT_SETTINGS: Settings = {
  background: { enabled: false, mode: 'auto', tolerance: 15, feather: 1, applyToJpg: false },
  crop: { ratio: 'original', custom: { width: 21, height: 9 }, anchor: { x: 0.5, y: 0.5 } },
  resize: { size: 'original', custom: { width: 800, height: 600 }, fit: 'contain', noUpscale: true },
  quality: 80,
  lossless: false,
  alphaQuality: 100,
  effort: 4,
  naming: { case: 'keep', prefix: '', suffix: '' },
  conflict: 'number',
}

export interface Preset {
  name: string
  settings: Settings
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** 기본값의 모양을 따라가며 value의 값을 고른다. 없거나 종류가 다른 값은 기본값을 쓴다. */
function fill<T>(base: T, value: unknown): T {
  if (!isObject(base)) return typeof value === typeof base ? (value as T) : base
  const source = isObject(value) ? value : {}
  const result: Record<string, unknown> = {}
  for (const [key, baseValue] of Object.entries(base)) result[key] = fill(baseValue, source[key])
  return result as T
}

/**
 * 저장해 둔 설정을 지금 설정 형식에 맞춘다.
 * 나중에 새로 생긴 설정은 기본값으로 채우고, 지금은 없는 설정은 버린다.
 */
export function completeSettings(value: unknown): Settings {
  return fill(DEFAULT_SETTINGS, value)
}

/** 두 설정의 모든 값이 같은지 비교한다. */
export function sameSettings(a: Settings, b: Settings): boolean {
  const equal = (x: unknown, y: unknown): boolean => {
    if (!isObject(x) || !isObject(y)) return x === y
    const keys = Object.keys(x)
    return keys.length === Object.keys(y).length && keys.every((key) => equal(x[key], y[key]))
  }
  return equal(a, b)
}

/**
 * 기본 프리셋 (F9-2)
 * 여백 다듬기와 다중 크기 출력은 C10에서 기능을 만든 뒤 반영한다.
 */
export const BUILTIN_PRESETS: Preset[] = [
  {
    name: '게임 스프라이트',
    settings: completeSettings({
      background: { enabled: true, mode: 'auto' },
      crop: { ratio: '1:1' },
      resize: { size: '512x512', fit: 'contain' },
      quality: 85,
    }),
  },
  {
    name: '앱 아이콘 세트',
    settings: completeSettings({
      background: { enabled: true, mode: 'ai' },
      crop: { ratio: '1:1' },
      resize: { size: '512x512', fit: 'contain' },
      lossless: true,
    }),
  },
  {
    name: '웹 배경 이미지',
    settings: completeSettings({
      crop: { ratio: '16:9' },
      resize: { size: '1920x1080', fit: 'cover' },
      quality: 75,
    }),
  },
  {
    name: '모바일 세로 배경',
    settings: completeSettings({
      crop: { ratio: '9:16' },
      resize: { size: '1080x1920', fit: 'cover' },
      quality: 75,
    }),
  },
]

const STORAGE_KEY = 'pngtowebp.presets'

type PresetStorage = Pick<Storage, 'getItem' | 'setItem'>

/** 브라우저에 저장한 내 프리셋을 읽는다. 읽을 수 없거나 형식이 잘못되면 빈 목록. */
export function loadUserPresets(storage?: PresetStorage): Preset[] {
  try {
    // 브라우저 설정에 따라 localStorage에 접근하는 것만으로 예외가 날 수 있다.
    const data: unknown = JSON.parse((storage ?? localStorage).getItem(STORAGE_KEY) ?? '[]')
    if (!Array.isArray(data)) return []
    return data
      .filter((entry) => isObject(entry) && typeof entry.name === 'string' && entry.name.trim() !== '')
      .map((entry) => ({ name: entry.name as string, settings: completeSettings(entry.settings) }))
  } catch {
    return []
  }
}

/** 내 프리셋을 브라우저에 저장한다. 저장하지 못하면 예외를 던진다. */
export function saveUserPresets(presets: Preset[], storage: PresetStorage = localStorage) {
  storage.setItem(STORAGE_KEY, JSON.stringify(presets))
}
