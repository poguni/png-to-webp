import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// AC-11: 배포 환경이 crossOriginIsolated가 되려면 vercel.json에 COOP/COEP 헤더가 있어야 한다.
describe('vercel.json', () => {
  const config = JSON.parse(readFileSync('vercel.json', 'utf8'))
  const rule = config.headers.find((h: { source: string }) => h.source === '/(.*)')
  const headers = Object.fromEntries(
    rule.headers.map((h: { key: string; value: string }) => [h.key, h.value]),
  )

  it('모든 경로에 COOP same-origin을 보낸다', () => {
    expect(headers['Cross-Origin-Opener-Policy']).toBe('same-origin')
  })

  it('모든 경로에 COEP credentialless를 보낸다', () => {
    expect(headers['Cross-Origin-Embedder-Policy']).toBe('credentialless')
  })
})
