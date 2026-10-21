// AI 배경 제거. @imgly/background-removal(AGPL-3.0)은 이 파일에서만 쓴다.
// 다른 모델로 바꿀 때는 이 파일만 고치면 된다. (PRD 10장)
import { segmentForeground, type Config } from '@imgly/background-removal'
import type { Pixels } from './crop.ts'
import { applyAlphaMask } from './mask.ts'

export interface ModelProgress {
  loaded: number
  total: number
}

// 모델 파일별 내려받기 진행률을 모아 하나의 진행률로 알린다.
const downloads = new Map<string, { current: number; total: number }>()
let device: 'gpu' | 'cpu' = 'gpu' in navigator ? 'gpu' : 'cpu'

function config(onProgress: (progress: ModelProgress) => void): Config {
  return {
    device,
    model: 'isnet_fp16',
    output: { format: 'image/x-rgba8' },
    progress: (key, current, total) => {
      if (!key.startsWith('fetch:')) return
      downloads.set(key, { current, total })
      let loaded = 0
      let sum = 0
      for (const d of downloads.values()) {
        loaded += d.current
        sum += d.total
      }
      onProgress({ loaded, total: sum })
    },
  }
}

/** AI로 피사체를 찾아 배경을 투명하게 만든다. */
export async function removeBackgroundWithAi(image: Pixels, onProgress: (progress: ModelProgress) => void): Promise<Pixels> {
  // ImageData는 라이브러리(1.7.0)가 변환하지 못하므로, 원시 RGBA 형식의 Blob으로 넘긴다.
  const input = new Blob([image.data as Uint8ClampedArray<ArrayBuffer>], {
    type: `image/x-rgba8;width=${image.width};height=${image.height}`,
  })
  let blob: Blob
  try {
    blob = await segmentForeground(input, config(onProgress))
  } catch (error) {
    if (device !== 'gpu') throw error
    // WebGPU에서 실패하면 CPU(WASM)로 다시 시도하고, 이후로는 CPU를 쓴다.
    device = 'cpu'
    blob = await segmentForeground(input, config(onProgress))
  }
  const mask = new Uint8Array(await blob.arrayBuffer())
  return applyAlphaMask(image, mask)
}
