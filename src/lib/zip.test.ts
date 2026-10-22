import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import { createZip } from './zip.ts'

describe('createZip', () => {
  it('하위 폴더 구조와 내용을 그대로 담는다 (F1-8)', async () => {
    const a = new Uint8Array([1, 2, 3]).buffer
    const b = new Uint8Array([4, 5]).buffer
    const blob = await createZip([
      { path: 'hero.webp', data: a },
      { path: 'sub/enemy_64.webp', data: b },
    ])

    const zip = await JSZip.loadAsync(await blob.arrayBuffer())
    const names = Object.values(zip.files)
      .filter((f) => !f.dir)
      .map((f) => f.name)
    expect(names.sort()).toEqual(['hero.webp', 'sub/enemy_64.webp'])
    expect([...(await zip.file('sub/enemy_64.webp')!.async('uint8array'))]).toEqual([4, 5])
  })
})
