import { useEffect, useState } from 'react'
import type { ModelProgress } from '../lib/aiBackground.ts'
import type { Rect } from '../lib/crop.ts'
import { encodeToWebp, onModelProgress } from '../lib/encoder.ts'
import { backgroundNote, convertOptions, type ImageItem, type Settings } from '../store.ts'
import type { ConvertOptions } from '../workers/encode.worker.ts'

export interface ResultPreview {
  url: string
  size: number
  width: number
  height: number
  /** 여백 다듬기 결과가 원본의 어느 영역인지. 다듬지 않았으면 null */
  trimmed: Rect | null
  /** 배경 제거 결과. 배경 제거를 쓰지 않았으면 null */
  note: string | null
  ms: number
  /** 이 결과를 만든 옵션. 비교 화면에서 결과를 원본 위에 겹칠 때 쓴다. */
  options: ConvertOptions
}

interface Outcome {
  file: File
  key: string
  result?: ResultPreview
  error?: string
}

function previewOptions(settings: Settings, item: ImageItem): ConvertOptions {
  const options = convertOptions(settings, item)
  return { ...options, targets: options.targets.slice(0, 1) }
}

/** 슬라이더를 끄는 동안 매번 변환하지 않도록, 설정이 이만큼 멈춰 있을 때 변환한다. */
const DELAY_MS = 250

/** 선택한 이미지를 현재 설정으로 변환해 결과를 미리 보여 준다. 설정이 바뀌면 다시 만든다. (F8) */
export function useResultPreview(item: ImageItem | undefined, settings: Settings) {
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const [modelProgress, setModelProgress] = useState<ModelProgress | null>(null)

  const file = item?.file
  const kind = item?.kind
  const ready = Boolean(item?.width) && !item?.error
  // 여러 크기로 출력할 때는 첫 번째 크기만 미리 본다.
  const key = item ? JSON.stringify(previewOptions(settings, item)) : ''

  useEffect(() => {
    if (!file || !kind || !ready) return
    let stale = false
    const timer = setTimeout(async () => {
      const options: ConvertOptions = JSON.parse(key)
      onModelProgress((progress) => {
        if (!stale) setModelProgress(progress.loaded < progress.total ? progress : null)
      })
      const started = performance.now()
      try {
        const { outputs, background, trimmed } = await encodeToWebp(file, kind, options)
        if (stale) return
        const [{ buffer, width, height }] = outputs
        setOutcome({
          file,
          key,
          result: {
            url: URL.createObjectURL(new Blob([buffer], { type: 'image/webp' })),
            size: buffer.byteLength,
            width,
            height,
            trimmed,
            note: background ? backgroundNote(background) : null,
            ms: performance.now() - started,
            options,
          },
        })
      } catch (error) {
        if (!stale) setOutcome({ file, key, error: (error as Error).message })
      } finally {
        if (!stale) setModelProgress(null)
      }
    }, DELAY_MS)
    return () => {
      stale = true
      clearTimeout(timer)
    }
  }, [file, kind, ready, key])

  // 결과가 바뀌거나 화면에서 사라지면 이전 이미지 주소를 해제한다.
  useEffect(() => {
    const url = outcome?.result?.url
    return () => {
      if (url) URL.revokeObjectURL(url)
    }
  }, [outcome])

  // 다른 이미지의 결과는 보여 주지 않는다. 같은 이미지라면 새 결과가 나올 때까지 이전 결과를 보여 준다.
  const current = outcome && outcome.file === file ? outcome : null
  return {
    result: current?.result ?? null,
    error: current?.error ?? null,
    updating: ready && current?.key !== key,
    modelProgress,
  }
}
