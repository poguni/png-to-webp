export type NameCase = 'keep' | 'kebab'

export interface NamingOptions {
  /** `keep`: 원래 이름 유지, `kebab`: 소문자와 하이픈으로 변환 */
  case: NameCase
  prefix: string
  suffix: string
}

/** 같은 이름의 파일이 이미 있을 때: 번호 붙이기, 덮어쓰기, 건너뛰기 (F7-3) */
export type ConflictPolicy = 'number' | 'overwrite' | 'skip'

export interface NameDecision {
  action: 'write' | 'overwrite' | 'skip'
  name: string
}

// Windows에서 파일 이름에 쓸 수 없는 문자
// eslint-disable-next-line no-control-regex
const INVALID_CHARS = /[<>:"/\\|?*\u0000-\u001f]/g

/** 원본 파일 이름으로 결과 파일 이름을 만든다. 예: `My Hero.png` → `my-hero.webp` (F7-2) */
export function outputFileName(sourceName: string, naming: NamingOptions): string {
  const dot = sourceName.lastIndexOf('.')
  let base = dot > 0 ? sourceName.slice(0, dot) : sourceName
  base = `${naming.prefix}${base}${naming.suffix}`

  if (naming.case === 'kebab') {
    base = base
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/-{2,}/g, '-')
      .replace(/^-|-$/g, '')
  }

  // Windows는 이름 끝의 점과 공백을 허용하지 않는다.
  base = base.replace(INVALID_CHARS, '').replace(/[. ]+$/, '')
  return `${base || 'image'}.webp`
}

/** 여러 크기로 출력할 때 이름 끝에 크기를 붙인다. 예: `hero.webp` → `hero_512.webp`, `bg_1920x1080.webp` (F5-5) */
export function withSizeSuffix(fileName: string, size: { width: number; height: number }): string {
  const label = size.width === size.height ? `${size.width}` : `${size.width}x${size.height}`
  return `${fileName.slice(0, -'.webp'.length)}_${label}.webp`
}

/**
 * 저장할 이름을 정한다. 이름 비교는 대소문자를 구분하지 않는다(Windows 기준).
 * @param existing 폴더에 원래 있던 파일 이름 (소문자)
 * @param produced 이번 작업에서 이미 쓴 이름 (소문자). 이번 작업끼리 겹치면 정책과 관계없이 번호를 붙인다.
 */
export function resolveName(
  name: string,
  existing: ReadonlySet<string>,
  produced: ReadonlySet<string>,
  policy: ConflictPolicy,
): NameDecision {
  const key = name.toLowerCase()
  if (!produced.has(key)) {
    if (!existing.has(key)) return { action: 'write', name }
    if (policy === 'overwrite') return { action: 'overwrite', name }
    if (policy === 'skip') return { action: 'skip', name }
  }

  const base = name.slice(0, -'.webp'.length)
  for (let n = 1; ; n++) {
    const candidate = `${base}-${n}.webp`
    const candidateKey = candidate.toLowerCase()
    if (!existing.has(candidateKey) && !produced.has(candidateKey)) {
      return { action: 'write', name: candidate }
    }
  }
}
