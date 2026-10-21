import { useState, type DragEvent } from 'react'
import AppHeader from './components/AppHeader.tsx'
import FileList from './components/FileList.tsx'
import PreviewPanel from './components/PreviewPanel.tsx'
import StartScreen from './components/StartScreen.tsx'
import StatusBar from './components/StatusBar.tsx'
import { readDrop } from './lib/pickers.ts'
import { useAppStore } from './store.ts'

export default function App() {
  const hasSource = useAppStore((s) => s.source !== null)
  const open = useAppStore((s) => s.open)
  const [dragging, setDragging] = useState(false)

  function handleDragOver(e: DragEvent) {
    if (!e.dataTransfer.types.includes('Files')) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    setDragging(true)
  }

  function handleDragLeave(e: DragEvent) {
    // 창 밖으로 나갔을 때만 해제한다. 자식 요소 사이를 오갈 때는 유지한다.
    if (e.relatedTarget === null) setDragging(false)
  }

  async function handleDrop(e: DragEvent) {
    e.preventDefault()
    setDragging(false)
    try {
      const source = await readDrop(e.dataTransfer)
      if (source) await open(source)
    } catch (error) {
      useAppStore.setState({ scanError: `불러오지 못했습니다. (${(error as Error).message})` })
    }
  }

  return (
    <div
      className="flex min-h-screen flex-col lg:h-screen"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <AppHeader />
      {hasSource ? (
        <>
          <div className="flex flex-1 flex-wrap lg:min-h-0">
            <FileList />
            <PreviewPanel />
          </div>
          <StatusBar />
        </>
      ) : (
        <StartScreen />
      )}
      {dragging && (
        <div className="pointer-events-none fixed inset-3 z-50 flex items-center justify-center rounded-[20px] border-2 border-dashed border-accent bg-ground/85 text-xl font-semibold text-accent">
          놓으면 이미지를 불러옵니다
        </div>
      )}
    </div>
  )
}
