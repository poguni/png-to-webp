import { cropRect, type Pixels, type Rect } from './crop.ts'

export type SizePreset =
  | 'original'
  | '1920x1080'
  | '1080x1920'
  | '1024x1024'
  | '512x512'
  | '256x256'
  | '128x128'
  | 'custom'

export const SIZE_PRESETS: SizePreset[] = [
  'original',
  '1920x1080',
  '1080x1920',
  '1024x1024',
  '512x512',
  '256x256',
  '128x128',
  'custom',
]

/**
 * - `contain`: 비율을 지키며 안에 맞추고 남는 공간은 투명하게 채운다
 * - `cover`: 비율을 지키며 꽉 채우고 넘치는 부분은 가운데 기준으로 잘라 낸다
 * - `stretch`: 비율을 무시하고 늘린다
 * - `long`: 긴 변만 목표 크기의 긴 변에 맞춘다
 */
export type FitMode = 'contain' | 'cover' | 'stretch' | 'long'

export interface ResizeSettings {
  size: SizePreset
  custom: { width: number; height: number }
  fit: FitMode
  /** 원본이 목표보다 작으면 키우지 않는다 (F5-3) */
  noUpscale: boolean
}

export interface Size {
  width: number
  height: number
}

/** 설정에서 목표 크기를 구한다. 원본 유지거나 값이 잘못되면 null. */
export function targetSize(resize: ResizeSettings): Size | null {
  if (resize.size === 'original') return null
  if (resize.size === 'custom') {
    const width = Math.round(resize.custom.width)
    const height = Math.round(resize.custom.height)
    return width > 0 && height > 0 ? { width, height } : null
  }
  const [width, height] = resize.size.split('x').map(Number)
  return { width, height }
}

export interface ResizePlan {
  /** 결과 캔버스 크기 */
  width: number
  height: number
  /** 원본에서 쓸 영역 (cover일 때만 전체가 아니다) */
  source: Rect
  /** 그 영역을 캔버스의 어디에, 어떤 크기로 그릴지 */
  dest: Rect
}

const center = { x: 0.5, y: 0.5 } as const

/**
 * 크기 조절 계획을 세운다. 바꿀 것이 없으면 null.
 * 확대 금지는 원본이 목표 크기 안에 다 들어갈 때만 적용하고, 이때는 여백도 붙이지 않는다.
 * 예: 1600×900을 1920×1080 Contain + 확대 금지 → 1600×900 그대로 (AC-4)
 */
export function resizePlan(width: number, height: number, target: Size | null, fit: FitMode, noUpscale: boolean): ResizePlan | null {
  if (!target) return null
  const full: Rect = { x: 0, y: 0, width, height }
  const keepSmall = noUpscale && width <= target.width && height <= target.height
  let plan: ResizePlan

  if (fit === 'contain') {
    if (keepSmall) return null
    const scale = Math.min(target.width / width, target.height / height)
    const w = Math.max(1, Math.round(width * scale))
    const h = Math.max(1, Math.round(height * scale))
    plan = {
      width: target.width,
      height: target.height,
      source: full,
      dest: { x: Math.floor((target.width - w) / 2), y: Math.floor((target.height - h) / 2), width: w, height: h },
    }
  } else if (fit === 'cover') {
    const source = cropRect(width, height, target.width / target.height, center)
    // 작은 원본은 비율에 맞게 자르기만 하고 키우지 않는다.
    const size = keepSmall ? { width: source.width, height: source.height } : target
    plan = { ...size, source, dest: { x: 0, y: 0, ...size } }
  } else if (fit === 'stretch') {
    if (keepSmall) return null
    plan = { ...target, source: full, dest: { x: 0, y: 0, ...target } }
  } else {
    let scale = Math.max(target.width, target.height) / Math.max(width, height)
    if (noUpscale) scale = Math.min(scale, 1)
    const w = Math.max(1, Math.round(width * scale))
    const h = Math.max(1, Math.round(height * scale))
    plan = { width: w, height: h, source: full, dest: { x: 0, y: 0, width: w, height: h } }
  }

  const unchanged =
    plan.width === width &&
    plan.height === height &&
    plan.source.width === width &&
    plan.source.height === height &&
    plan.dest.width === width &&
    plan.dest.height === height
  return unchanged ? null : plan
}

/** 크기를 바꾼 픽셀을 투명한 캔버스의 dest 위치에 놓는다. */
export function placePixels(canvas: Size, pixels: Pixels, dest: Rect): Pixels {
  if (dest.x === 0 && dest.y === 0 && pixels.width === canvas.width && pixels.height === canvas.height) {
    return pixels
  }
  const data = new Uint8ClampedArray(canvas.width * canvas.height * 4)
  const rowBytes = pixels.width * 4
  for (let row = 0; row < pixels.height; row++) {
    data.set(
      pixels.data.subarray(row * rowBytes, (row + 1) * rowBytes),
      ((dest.y + row) * canvas.width + dest.x) * 4,
    )
  }
  return { data, width: canvas.width, height: canvas.height }
}
