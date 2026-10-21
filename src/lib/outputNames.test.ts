import { describe, expect, it } from 'vitest'
import { outputFileName, resolveName, type NamingOptions } from './outputNames.ts'

const keep: NamingOptions = { case: 'keep', prefix: '', suffix: '' }
const kebab: NamingOptions = { case: 'kebab', prefix: '', suffix: '' }

describe('outputFileName', () => {
  it('원래 이름을 유지하고 확장자만 webp로 바꾼다', () => {
    expect(outputFileName('slime_blue.png', keep)).toBe('slime_blue.webp')
    expect(outputFileName('Hero.JPG', keep)).toBe('Hero.webp')
    expect(outputFileName('archive.v2.png', keep)).toBe('archive.v2.webp')
  })

  it('소문자와 하이픈으로 바꾼다 (F7-2 예시)', () => {
    expect(outputFileName('My Hero.png', kebab)).toBe('my-hero.webp')
    expect(outputFileName('  Big   Boss  .png', kebab)).toBe('big-boss.webp')
    expect(outputFileName('슬라임 파랑.png', kebab)).toBe('슬라임-파랑.webp')
  })

  it('접두사와 접미사를 붙인다', () => {
    expect(outputFileName('hero.png', { case: 'keep', prefix: 'sprite_', suffix: '@2x' })).toBe('sprite_hero@2x.webp')
    expect(outputFileName('Hero.png', { case: 'kebab', prefix: 'Game ', suffix: '' })).toBe('game-hero.webp')
  })

  it('Windows에서 쓸 수 없는 문자와 끝의 점을 없앤다', () => {
    expect(outputFileName('a.png', { case: 'keep', prefix: 'x:y/', suffix: '?.' })).toBe('xya.webp')
  })

  it('이름이 비면 image를 쓴다', () => {
    expect(outputFileName('???.png', keep)).toBe('image.webp')
  })
})

describe('resolveName', () => {
  const none = new Set<string>()

  it('겹치지 않으면 그대로 쓴다', () => {
    expect(resolveName('a.webp', none, none, 'number')).toEqual({ action: 'write', name: 'a.webp' })
  })

  // AC-8: output에 같은 이름이 있으면 name-1.webp로 저장하고 기존 파일은 그대로 둔다
  it('번호 붙이기: 비어 있는 가장 작은 번호를 붙인다', () => {
    const existing = new Set(['name.webp', 'name-1.webp'])
    expect(resolveName('name.webp', new Set(['name.webp']), none, 'number')).toEqual({
      action: 'write',
      name: 'name-1.webp',
    })
    expect(resolveName('name.webp', existing, none, 'number').name).toBe('name-2.webp')
  })

  it('대소문자만 다른 이름도 같은 이름으로 본다', () => {
    expect(resolveName('Hero.webp', new Set(['hero.webp']), none, 'number').name).toBe('Hero-1.webp')
  })

  it('덮어쓰기와 건너뛰기 정책을 따른다', () => {
    const existing = new Set(['a.webp'])
    expect(resolveName('a.webp', existing, none, 'overwrite')).toEqual({ action: 'overwrite', name: 'a.webp' })
    expect(resolveName('a.webp', existing, none, 'skip')).toEqual({ action: 'skip', name: 'a.webp' })
  })

  it('이번 작업에서 만든 이름과 겹치면 정책과 관계없이 번호를 붙인다', () => {
    // hero.png와 hero.jpg가 둘 다 hero.webp가 되는 경우
    const produced = new Set(['hero.webp'])
    for (const policy of ['number', 'overwrite', 'skip'] as const) {
      expect(resolveName('hero.webp', none, produced, policy)).toEqual({ action: 'write', name: 'hero-1.webp' })
    }
  })
})
