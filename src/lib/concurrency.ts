/** `items`를 최대 `limit`개씩 동시에 처리한다. 하나가 실패해도 나머지는 계속한다. */
export async function forEachLimited<T>(
  items: readonly T[],
  limit: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  let next = 0
  async function worker() {
    while (next < items.length) {
      const item = items[next++]
      try {
        await fn(item)
      } catch {
        // 개별 실패는 fn 안에서 처리한다.
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
}
