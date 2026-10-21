import { useOpenSource } from '../hooks/useOpenSource.ts'
import { useAppStore } from '../store.ts'
import { FolderIcon, FolderUploadIcon } from './icons.tsx'

export default function StartScreen() {
  const scanning = useAppStore((s) => s.scanning)
  const scanError = useAppStore((s) => s.scanError)
  const { openDirectory, openFiles } = useOpenSource()

  return (
    <main className="mx-auto box-border flex w-full max-w-[1360px] flex-1 flex-col gap-10 px-4 pt-12 pb-14 sm:px-8">
      <section className="checker flex flex-col items-center gap-5 rounded-[20px] border-[1.5px] border-dashed border-[#3a404b] px-8 py-[72px] text-center">
        <div className="flex size-[72px] items-center justify-center rounded-[20px] border border-line-strong bg-surface">
          <FolderUploadIcon width="34" height="34" strokeWidth="1.8" className="text-accent" />
        </div>
        <div className="flex flex-col gap-2">
          <h1 className="m-0 text-[34px] font-bold tracking-tight">이미지 폴더를 끌어다 놓으세요</h1>
          <p className="m-0 text-[15px] text-muted">
            PNG와 JPG를 한 번에 불러와 배경 제거, 자르기, 크기 조절을 거쳐 WebP로 저장합니다.
          </p>
        </div>
        <div className="mt-1 flex flex-wrap justify-center gap-2.5">
          <button
            type="button"
            onClick={openDirectory}
            disabled={scanning}
            className="flex h-[46px] items-center gap-2 rounded-xl bg-accent px-[22px] text-[15px] font-bold text-ground disabled:opacity-60"
          >
            <FolderIcon width="18" height="18" strokeWidth="2.2" />
            {scanning ? '불러오는 중…' : '폴더 열기'}
          </button>
          <button
            type="button"
            onClick={openFiles}
            disabled={scanning}
            className="h-[46px] rounded-xl border border-[#3a404b] bg-surface px-[22px] text-[15px] font-medium text-ink disabled:opacity-60"
          >
            파일 선택
          </button>
        </div>
        <div className="text-xs text-subtle">지원 형식 PNG · JPG · JPEG &nbsp;|&nbsp; 하위 폴더까지 불러오기</div>
        {scanError && (
          <p role="alert" className="m-0 text-sm text-danger">
            {scanError}
          </p>
        )}
      </section>
    </main>
  )
}
