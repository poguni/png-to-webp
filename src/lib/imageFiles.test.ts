import { describe, expect, it } from 'vitest'
import {
  comparePaths,
  imageKind,
  scanDirectory,
  scanFileList,
  type DirectoryLike,
  type FileLike,
} from './imageFiles.ts'

type Tree = { [name: string]: Tree | string }

/** `{ 'a.png': '', sub: { 'b.jpg': '' } }` 형태의 트리로 가짜 폴더 핸들을 만든다. */
function fakeDir(tree: Tree): DirectoryLike {
  return {
    kind: 'directory',
    async *entries() {
      for (const [name, value] of Object.entries(tree)) {
        if (typeof value === 'string') {
          const file: FileLike = { kind: 'file', getFile: async () => new File([value], name) }
          yield [name, file] as [string, FileLike]
        } else {
          yield [name, fakeDir(value)] as [string, DirectoryLike]
        }
      }
    },
  }
}

function fileWithPath(path: string): File {
  const file = new File([''], path.split('/').pop()!)
  Object.defineProperty(file, 'webkitRelativePath', { value: path })
  return file
}

describe('imageKind', () => {
  it('png, jpg, jpeg를 대소문자 구분 없이 인식한다', () => {
    expect(imageKind('a.png')).toBe('PNG')
    expect(imageKind('B.PNG')).toBe('PNG')
    expect(imageKind('c.jpg')).toBe('JPG')
    expect(imageKind('d.JPEG')).toBe('JPG')
  })

  it('그 밖의 형식과 확장자가 없는 파일은 null', () => {
    expect(imageKind('notes.txt')).toBeNull()
    expect(imageKind('icon.webp')).toBeNull()
    expect(imageKind('png')).toBeNull()
    expect(imageKind('archive.png.zip')).toBeNull()
  })
})

describe('comparePaths', () => {
  it('숫자를 숫자 크기대로 정렬한다', () => {
    const names = ['slime_10.png', 'slime_2.png', 'slime_1.png']
    expect(names.sort(comparePaths)).toEqual(['slime_1.png', 'slime_2.png', 'slime_10.png'])
  })
})

describe('scanDirectory', () => {
  // AC-1: PNG 5장, JPG 5장, TXT 1장 → 이미지 10장, 1개 건너뜀
  it('이미지만 모으고 나머지는 건너뛴 개수로 센다', async () => {
    const tree: Tree = { 'readme.txt': '' }
    for (let i = 1; i <= 5; i++) {
      tree[`p${i}.png`] = ''
      tree[`j${i}.jpg`] = ''
    }
    const result = await scanDirectory(fakeDir(tree), { recursive: false })
    expect(result.images).toHaveLength(10)
    expect(result.skipped).toBe(1)
  })

  it('하위 폴더 포함을 끄면 하위 폴더를 보지 않는다', async () => {
    const dir = fakeDir({ 'a.png': '', sub: { 'b.png': '' } })
    const result = await scanDirectory(dir, { recursive: false })
    expect(result.images.map((i) => i.relativePath)).toEqual(['a.png'])
  })

  it('하위 폴더 포함을 켜면 경로를 유지해 모은다', async () => {
    const dir = fakeDir({ 'a.png': '', sub: { 'b.jpg': '', deep: { 'c.png': '' } } })
    const result = await scanDirectory(dir, { recursive: true })
    expect(result.images.map((i) => i.relativePath)).toEqual(['a.png', 'sub/b.jpg', 'sub/deep/c.png'])
    expect(result.images.map((i) => i.kind)).toEqual(['PNG', 'JPG', 'PNG'])
  })

  it('최상위 output 폴더는 건너뛰지만 하위의 output 폴더는 본다', async () => {
    const dir = fakeDir({
      'a.png': '',
      output: { 'old.png': '' },
      sub: { output: { 'keep.png': '' } },
    })
    const result = await scanDirectory(dir, { recursive: true })
    expect(result.images.map((i) => i.relativePath)).toEqual(['a.png', 'sub/output/keep.png'])
  })
})

describe('scanFileList', () => {
  it('폴더 선택 결과에서 선택한 폴더 이름을 떼고 경로를 만든다', () => {
    const files = [fileWithPath('sprites/b.png'), fileWithPath('sprites/sub/a.png'), fileWithPath('sprites/x.txt')]
    const result = scanFileList(files, { recursive: true })
    expect(result.images.map((i) => i.relativePath)).toEqual(['b.png', 'sub/a.png'])
    expect(result.skipped).toBe(1)
  })

  it('하위 폴더 포함을 끄면 최상위 파일만 남긴다', () => {
    const files = [fileWithPath('sprites/b.png'), fileWithPath('sprites/sub/a.png')]
    const result = scanFileList(files, { recursive: false })
    expect(result.images.map((i) => i.relativePath)).toEqual(['b.png'])
  })

  it('최상위 output 폴더의 파일은 제외한다', () => {
    const files = [fileWithPath('sprites/b.png'), fileWithPath('sprites/output/b.png')]
    const result = scanFileList(files, { recursive: true })
    expect(result.images.map((i) => i.relativePath)).toEqual(['b.png'])
  })

  it('개별 파일 선택은 파일 이름을 경로로 쓴다', () => {
    const result = scanFileList([new File([''], 'hero.PNG')], { recursive: true })
    expect(result.images[0]).toMatchObject({ relativePath: 'hero.PNG', kind: 'PNG' })
  })
})
