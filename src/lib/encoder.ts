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

/**
 * 동시에 변환하는 Worker 수. 메인 스레드 몫으로 코어 하나를 남기고, 큰 이미지를 한꺼번에 디코딩해
 * 메모리가 부족해지지 않도록 6개를 넘기지 않는다. (6장 메모리 요구사항: 코어 수 이하)
 */
export const WORKER_COUNT = Math.max(1, Math.min((navigator.hardwareConcurrency || 4) - 1, 6))

/** AI 모델은 크기가 커서 이 번호의 Worker에만 올린다. */
const AI_SLOT = 0

interface Job {
  file: File
  kind: ImageKind
  options: ConvertOptions
  resolve(result: EncodeResult): void
  reject(error: Error): void
}

interface Slot {
  worker: Worker
  job: Job | null
  jobId: number
}

const slots: (Slot | null)[] = Array.from({ length: WORKER_COUNT }, () => null)
const queue: Job[] = []
/** AI가 필요해 AI Worker를 기다리는 작업 */
const aiQueue: Job[] = []
let nextId = 1
let modelProgressListener: ((progress: ModelProgress) => void) | null = null

/** AI 모델을 내려받는 동안 진행률을 받을 함수를 정한다. */
export function onModelProgress(listener: ((progress: ModelProgress) => void) | null) {
  modelProgressListener = listener
}

function createSlot(index: number): Slot {
  const worker = new Worker(new URL('../workers/encode.worker.ts', import.meta.url), { type: 'module' })
  const slot: Slot = { worker, job: null, jobId: 0 }
  worker.onmessage = (event: MessageEvent<EncodeResponse | ModelProgressMessage>) => {
    if ('type' in event.data) {
      modelProgressListener?.(event.data)
      return
    }
    const response = event.data
    const job = slot.job
    if (!job || response.id !== slot.jobId) return
    slot.job = null
    if (response.ok) job.resolve({ outputs: response.outputs, background: response.background, trimmed: response.trimmed })
    else if ('needsAi' in response) aiQueue.push(job)
    else job.reject(new Error(response.error))
    dispatch()
  }
  worker.onerror = (event) => {
    // Worker가 죽으면 맡긴 작업만 실패로 돌리고, 다음 작업 때 새로 만든다.
    slot.job?.reject(new Error(`변환 작업이 중단되었습니다. (${event.message})`))
    worker.terminate()
    slots[index] = null
    dispatch()
  }
  return slot
}

/** 쉬는 Worker에 기다리는 작업을 맡긴다. AI Worker는 AI가 필요한 작업을 먼저 맡는다. */
function dispatch() {
  for (let i = 0; i < WORKER_COUNT; i++) {
    if (slots[i]?.job) continue
    const job = (i === AI_SLOT && aiQueue.shift()) || queue.shift()
    if (!job) return
    const slot = (slots[i] ??= createSlot(i))
    slot.job = job
    slot.jobId = nextId++
    const request: EncodeRequest = {
      id: slot.jobId,
      file: job.file,
      kind: job.kind,
      options: job.options,
      allowAi: i === AI_SLOT,
    }
    slot.worker.postMessage(request)
  }
}

/** 이미지 파일을 Web Worker에서 WebP로 변환한다. 여러 장을 동시에 맡기면 Worker 수만큼 함께 처리한다. */
export function encodeToWebp(file: File, kind: ImageKind, options: ConvertOptions): Promise<EncodeResult> {
  return new Promise((resolve, reject) => {
    queue.push({ file, kind, options, resolve, reject })
    dispatch()
  })
}

/**
 * 기다리거나 처리 중인 작업을 모두 취소한다. 처리 중인 Worker는 바로 끝내고, 다음 작업 때 새로 만든다.
 * 취소된 작업은 예외로 끝난다.
 */
export function cancelAll() {
  const error = new Error('취소했습니다')
  for (const job of [...queue.splice(0), ...aiQueue.splice(0)]) job.reject(error)
  for (let i = 0; i < WORKER_COUNT; i++) {
    const slot = slots[i]
    if (!slot) continue
    slot.job?.reject(error)
    slot.worker.terminate()
    slots[i] = null
  }
}
