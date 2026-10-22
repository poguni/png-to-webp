import type {
  BackgroundResult,
  ConvertOptions,
  EncodedImage,
  EncodeRequest,
  EncodeResponse,
  ModelProgressMessage,
} from '../workers/encode.worker.ts'
import type { Rect } from './crop.ts'
import type { ModelProgress } from './aiBackground.ts'
import type { ImageKind } from './imageFiles.ts'

export interface EncodeResult {
  outputs: EncodedImage[]
  background: BackgroundResult | null
  trimmed: Rect | null
}

let worker: Worker | null = null
let nextId = 1
const pending = new Map<number, { resolve(result: EncodeResult): void; reject(error: Error): void }>()
let modelProgressListener: ((progress: ModelProgress) => void) | null = null

/** AI 모델을 내려받는 동안 진행률을 받을 함수를 정한다. */
export function onModelProgress(listener: ((progress: ModelProgress) => void) | null) {
  modelProgressListener = listener
}

function getWorker(): Worker {
  if (worker) return worker
  worker = new Worker(new URL('../workers/encode.worker.ts', import.meta.url), { type: 'module' })
  worker.onmessage = (event: MessageEvent<EncodeResponse | ModelProgressMessage>) => {
    if ('type' in event.data) {
      modelProgressListener?.(event.data)
      return
    }
    const response = event.data
    const request = pending.get(response.id)
    if (!request) return
    pending.delete(response.id)
    if (response.ok) request.resolve({ outputs: response.outputs, background: response.background, trimmed: response.trimmed })
    else request.reject(new Error(response.error))
  }
  worker.onerror = (event) => {
    // Worker가 죽으면 기다리던 작업을 모두 실패로 돌리고, 다음 요청 때 새로 만든다.
    for (const request of pending.values()) request.reject(new Error(`변환 작업이 중단되었습니다. (${event.message})`))
    pending.clear()
    worker?.terminate()
    worker = null
  }
  return worker
}

/** 이미지 파일을 Web Worker에서 WebP로 변환한다. */
export function encodeToWebp(file: File, kind: ImageKind, options: ConvertOptions): Promise<EncodeResult> {
  const id = nextId++
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    const request: EncodeRequest = { id, file, kind, options }
    getWorker().postMessage(request)
  })
}
