import type { Pixels } from './crop.ts'

export type BackgroundMode = 'auto' | 'solid' | 'checker' | 'ai'

export interface BackgroundSettings {
  enabled: boolean
  /** auto: 가장자리를 보고 단색·체커보드는 색으로 지우고, 복잡한 배경은 AI로 지운다 (F2-2) */
  mode: BackgroundMode
  /** 배경색과 얼마나 달라도 배경으로 볼지. 0~100 */
  tolerance: number
  /** 경계 다듬기 폭(px). 경계에서 이 폭 안의 픽셀은 섞인 배경색을 빼고 반투명하게 만든다. 0이면 끈다 */
  feather: number
  /** JPG에도 적용할지. 기본은 PNG에만 적용 (F2) */
  applyToJpg: boolean
}

export type RGB = [number, number, number]

export type BackgroundKind = 'solid' | 'checker' | 'complex' | 'transparent'

export interface Detection {
  kind: BackgroundKind
  /** 많이 나온 순서의 가장자리 색 (최대 2개) */
  colors: RGB[]
}

const MAX_DISTANCE = Math.sqrt(3 * 255 * 255)

/** 두 색의 차이를 0~100으로 나타낸다. */
export function colorDistance(r: number, g: number, b: number, color: RGB): number {
  const dr = r - color[0]
  const dg = g - color[1]
  const db = b - color[2]
  return (Math.sqrt(dr * dr + dg * dg + db * db) / MAX_DISTANCE) * 100
}

function* borderIndexes(width: number, height: number): Generator<number> {
  for (let x = 0; x < width; x++) {
    yield x
    if (height > 1) yield (height - 1) * width + x
  }
  for (let y = 1; y < height - 1; y++) {
    yield y * width
    if (width > 1) yield y * width + width - 1
  }
}

/**
 * 가장자리 픽셀로 배경을 판별한다.
 * - 가장자리 절반 이상이 투명: 이미 투명한 이미지 (`transparent`)
 * - 한 색이 60% 이상: 단색 (`solid`)
 * - 무채색 두 색이 합쳐 70% 이상이고 각각 20% 이상: 가짜 체커보드 (`checker`)
 * - 그 밖: 복잡한 배경 (`complex`)
 */
export function detectBackground(image: Pixels): Detection {
  const { data, width, height } = image
  // 비슷한 색을 묶기 위해 채널마다 16단계로 나눈다.
  const buckets = new Map<number, { count: number; r: number; g: number; b: number }>()
  let total = 0
  let transparent = 0

  for (const i of borderIndexes(width, height)) {
    const p = i * 4
    total++
    if (data[p + 3] < 16) {
      transparent++
      continue
    }
    const key = ((data[p] >> 4) << 8) | ((data[p + 1] >> 4) << 4) | (data[p + 2] >> 4)
    const bucket = buckets.get(key) ?? { count: 0, r: 0, g: 0, b: 0 }
    bucket.count++
    bucket.r += data[p]
    bucket.g += data[p + 1]
    bucket.b += data[p + 2]
    buckets.set(key, bucket)
  }

  if (transparent * 2 >= total) return { kind: 'transparent', colors: [] }

  const sorted = [...buckets.values()].sort((a, b) => b.count - a.count)
  const colors = sorted
    .slice(0, 2)
    .map((b): RGB => [Math.round(b.r / b.count), Math.round(b.g / b.count), Math.round(b.b / b.count)])
  const share = (index: number) => (sorted[index]?.count ?? 0) / total

  if (share(0) >= 0.6) return { kind: 'solid', colors }

  const isGray = (c: RGB) => Math.max(...c) - Math.min(...c) <= 24
  if (
    colors.length === 2 &&
    share(0) + share(1) >= 0.7 &&
    share(1) >= 0.2 &&
    isGray(colors[0]) &&
    isGray(colors[1])
  ) {
    return { kind: 'checker', colors }
  }
  return { kind: 'complex', colors }
}

/**
 * 설정과 감지 결과로 색으로 지울 배경색을 정한다. 색으로 지우지 않을 때는 null.
 * 자동 모드에서 복잡한 배경은 색 하나만 지우면 피사체에 구멍이 날 수 있어 null(→ AI가 맡는다).
 */
export function backgroundColors(detection: Detection, mode: BackgroundMode): RGB[] | null {
  if (mode === 'ai' || detection.kind === 'transparent' || detection.colors.length === 0) return null
  if (mode === 'solid') return detection.colors.slice(0, 1)
  if (mode === 'checker') return detection.colors.length === 2 ? detection.colors : null
  if (detection.kind === 'checker') return detection.colors
  if (detection.kind === 'solid') return detection.colors.slice(0, 1)
  return null
}

/** 색으로 지우지 못할 때 AI로 지울지 */
export function shouldUseAi(detection: Detection, mode: BackgroundMode): boolean {
  if (detection.kind === 'transparent') return false
  return mode === 'ai' || (mode === 'auto' && detection.kind === 'complex')
}

/**
 * 가장자리와 이어진 배경색 영역을 투명하게 만든다. (F2 단색·체커보드 제거)
 * 안쪽에 갇힌 같은 색(예: 캐릭터 눈의 흰자)은 남긴다.
 * feather > 0이면 경계 픽셀이 배경과 섞인 비율을 계산해 반투명하게 만들고, 섞인 배경색을 빼낸다. (F2-1)
 */
export function removeBackground(image: Pixels, colors: RGB[], tolerance: number, feather: number): Pixels {
  const { width, height } = image
  const src = image.data
  const total = width * height

  const nearest = (p: number): { distance: number; color: RGB } => {
    let best = { distance: Infinity, color: colors[0] }
    for (const color of colors) {
      const distance = colorDistance(src[p], src[p + 1], src[p + 2], color)
      if (distance < best.distance) best = { distance, color }
    }
    return best
  }

  // 1) 가장자리에서 시작하는 플러드 필 (상하좌우 4방향)
  const removed = new Uint8Array(total)
  const queue = new Int32Array(total)
  let head = 0
  let tail = 0
  const visit = (i: number) => {
    if (removed[i]) return
    const p = i * 4
    if (src[p + 3] < 16 || nearest(p).distance <= tolerance) {
      removed[i] = 1
      queue[tail++] = i
    }
  }
  for (const i of borderIndexes(width, height)) visit(i)
  while (head < tail) {
    const i = queue[head++]
    const x = i % width
    if (x > 0) visit(i - 1)
    if (x < width - 1) visit(i + 1)
    if (i >= width) visit(i - width)
    if (i < total - width) visit(i + width)
  }

  const out = new Uint8ClampedArray(src)
  for (let i = 0; i < total; i++) if (removed[i]) out[i * 4 + 3] = 0

  const radius = Math.round(Math.max(0, feather))
  if (radius === 0) return { data: out, width, height }

  // 2) 지운 영역에서 radius 안쪽까지의 경계 띠를 찾는다. ring[i]: 1~radius = 경계, INTERIOR = 안쪽
  const INTERIOR = 255
  const ring = new Uint8Array(total).fill(INTERIOR)
  head = 0
  tail = 0
  for (let i = 0; i < total; i++) {
    if (removed[i]) {
      ring[i] = 0
      queue[tail++] = i
    }
  }
  while (head < tail) {
    const i = queue[head++]
    if (ring[i] >= radius) continue
    const x = i % width
    const next = ring[i] + 1
    for (const j of [x > 0 ? i - 1 : -1, x < width - 1 ? i + 1 : -1, i - width, i + width]) {
      if (j >= 0 && j < total && ring[j] === INTERIOR) {
        ring[j] = next
        queue[tail++] = j
      }
    }
  }

  // 3) 경계 픽셀마다 근처 안쪽 픽셀 중 배경과 가장 다른 색을 피사체 색으로 보고,
  //    "배경색 → 피사체 색" 직선 위에서 이 픽셀의 위치로 섞인 비율(알파)을 구한다.
  const search = radius + 1
  for (let i = 0; i < total; i++) {
    if (ring[i] === 0 || ring[i] === INTERIOR) continue
    const p = i * 4
    const bg = nearest(p).color
    const x0 = i % width
    const y0 = (i - x0) / width

    let subject: number | null = null
    let farthest = -1
    for (let y = Math.max(0, y0 - search); y <= Math.min(height - 1, y0 + search); y++) {
      for (let x = Math.max(0, x0 - search); x <= Math.min(width - 1, x0 + search); x++) {
        const j = y * width + x
        if (ring[j] !== INTERIOR) continue
        const d = colorDistance(src[j * 4], src[j * 4 + 1], src[j * 4 + 2], bg)
        if (d > farthest) {
          farthest = d
          subject = j * 4
        }
      }
    }

    let coverage: number
    if (subject === null) {
      // 가는 선처럼 안쪽 픽셀이 없으면 배경과의 차이로 어림한다.
      coverage = Math.min(1, colorDistance(src[p], src[p + 1], src[p + 2], bg) / 50)
    } else {
      let dot = 0
      let length = 0
      for (let c = 0; c < 3; c++) {
        const toSubject = src[subject + c] - bg[c]
        dot += (src[p + c] - bg[c]) * toSubject
        length += toSubject * toSubject
      }
      coverage = length > 0 ? Math.min(1, Math.max(0, dot / length)) : 1
    }

    if (coverage < 0.02) {
      out[p + 3] = 0
      continue
    }
    for (let c = 0; c < 3; c++) out[p + c] = (src[p + c] - (1 - coverage) * bg[c]) / coverage
    out[p + 3] = Math.round(src[p + 3] * coverage)
  }
  return { data: out, width, height }
}
