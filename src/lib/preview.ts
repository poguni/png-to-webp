import { cropRect, type Anchor, type Rect } from './crop.ts'
import type { ResizePlan } from './resize.ts'

/**
 * 결과 이미지 전체가 원본의 어느 영역에 해당하는지 구한다. 처리 전후 비교에서 두 이미지를 겹칠 때 쓴다.
 * crop은 원본 좌표다. Contain의 투명한 여백은 원본 바깥으로 나갈 수 있다.
 * 예: 1000×500에 512×512 Contain → x 0, y −250, 1000×1000
 */
export function resultPlacement(crop: Rect, plan: ResizePlan | null): Rect {
  if (!plan) return crop
  const sx = plan.source.width / plan.dest.width
  const sy = plan.source.height / plan.dest.height
  return {
    x: crop.x + plan.source.x - plan.dest.x * sx,
    y: crop.y + plan.source.y - plan.dest.y * sy,
    width: plan.width * sx,
    height: plan.height * sy,
  }
}

/**
 * 자르기 영역을 원본 좌표로 구한다.
 * base는 자르기 직전 이미지(여백 다듬기 결과)가 원본에서 차지하는 영역이다. 다듬지 않았으면 원본 전체.
 */
export function cropInSource(base: Rect, ratio: number | null, anchor: Anchor, scale: number): Rect {
  const rect = cropRect(base.width, base.height, ratio, anchor, scale)
  return { ...rect, x: rect.x + base.x, y: rect.y + base.y }
}

/** 이미지별 자르기 설정의 가장 작은 크기 비율 */
const MIN_SCALE = 0.05

/**
 * 미리보기에서 끌어 옮기거나 크기를 바꾼 자르기 영역(원본 좌표)을 이미지별 설정으로 바꾼다. (F4-3)
 * 영역은 비율을 지킨 채 base 안으로 들어가도록 맞춘다.
 */
export function cropOverride(base: Rect, ratio: number, rect: Rect): { anchor: Anchor; scale: number } {
  const largest = cropRect(base.width, base.height, ratio, { x: 0.5, y: 0.5 })
  const scale = Math.min(1, Math.max(MIN_SCALE, rect.width / largest.width))
  const width = Math.round(largest.width * scale)
  const height = Math.round(largest.height * scale)
  const position = (offset: number, free: number) => (free > 0 ? Math.min(1, Math.max(0, offset / free)) : 0.5)
  return {
    anchor: { x: position(rect.x - base.x, base.width - width), y: position(rect.y - base.y, base.height - height) },
    scale,
  }
}
