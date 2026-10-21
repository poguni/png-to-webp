import { pickDirectory, pickFiles, type Source } from '../lib/pickers.ts'
import { useAppStore } from '../store.ts'

/** 폴더 열기, 파일 선택 버튼이 함께 쓰는 동작 */
export function useOpenSource() {
  const open = useAppStore((s) => s.open)

  async function openFrom(pick: () => Promise<Source | null>) {
    try {
      const source = await pick()
      if (source) await open(source)
    } catch (error) {
      useAppStore.setState({ scanError: `불러오지 못했습니다. (${(error as Error).message})` })
    }
  }

  return {
    openDirectory: () => openFrom(pickDirectory),
    openFiles: () => openFrom(pickFiles),
  }
}
