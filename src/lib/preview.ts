import type { Rect } from './crop.ts'
import type { ResizePlan } from './resize.ts'

/**
 * 결과 이미지 전체가 원본의 어느 영역에 해당하는지 구한다. 처리 전후 비교에서 두 이미지를 겹칠 때 쓴다.
 * Contain의 투명한 여백은 원본 바깥으로 나갈 수 있다.
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
