import type { BackgroundResult, ConvertOptions, EncodeRequest, EncodeResponse } from '../workers/encode.worker.ts'
import type { ImageKind } from './imageFiles.ts'

export interface EncodeResult {
  buffer: ArrayBuffer
  background: BackgroundResult | null
}

let worker: Worker | null = null
let nextId = 1
const pending = new Map<number, { resolve(result: EncodeResult): void; reject(error: Error): void }>()

function getWorker(): Worker {
  if (worker) return worker
  worker = new Worker(new URL('../workers/encode.worker.ts', import.meta.url), { type: 'module' })
  worker.onmessage = (event: MessageEvent<EncodeResponse>) => {
    const response = event.data
    const request = pending.get(response.id)
    if (!request) return
    pending.delete(response.id)
    if (response.ok) request.resolve({ buffer: response.buffer, background: response.background })
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
