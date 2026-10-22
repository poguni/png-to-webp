import { describe, expect, it } from 'vitest'
import { formatBytes, formatSaving } from './format.ts'

describe('formatBytes', () => {
  it('크기에 맞는 단위로 표시한다', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(88_064)).toBe('86 KB')
    expect(formatBytes(1_488_978)).toBe('1.42 MB')
  })
})

describe('formatSaving', () => {
  it('줄었으면 −, 늘었으면 +를 붙인다', () => {
    expect(formatSaving(1000, 70)).toBe('−93%')
    expect(formatSaving(1000, 1170)).toBe('+17%')
  })
})
