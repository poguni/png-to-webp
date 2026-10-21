import { describe, expect, it } from 'vitest'
import { forEachLimited } from './concurrency.ts'

const tick = () => new Promise((r) => setTimeout(r, 1))

describe('forEachLimited', () => {
  it('동시에 limit개를 넘지 않고 모든 항목을 처리한다', async () => {
    let running = 0
    let peak = 0
    const done: number[] = []
    await forEachLimited([1, 2, 3, 4, 5, 6, 7], 3, async (n) => {
      running++
      peak = Math.max(peak, running)
      await tick()
      done.push(n)
      running--
    })
    expect(peak).toBe(3)
    expect(done.sort()).toEqual([1, 2, 3, 4, 5, 6, 7])
  })

  it('하나가 실패해도 나머지를 처리한다', async () => {
    const done: number[] = []
    await forEachLimited([1, 2, 3], 2, async (n) => {
      if (n === 2) throw new Error('broken')
      done.push(n)
    })
    expect(done.sort()).toEqual([1, 3])
  })
})
