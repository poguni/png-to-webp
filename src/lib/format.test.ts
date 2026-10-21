import { describe, expect, it } from 'vitest'
import { formatBytes } from './format.ts'

describe('formatBytes', () => {
  it('크기에 맞는 단위로 표시한다', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(88_064)).toBe('86 KB')
    expect(formatBytes(1_488_978)).toBe('1.42 MB')
  })
})
