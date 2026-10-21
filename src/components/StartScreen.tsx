export default function StartScreen() {
  return (
    <main className="mx-auto box-border flex w-full max-w-[1360px] flex-1 flex-col gap-10 px-4 pt-12 pb-14 sm:px-8">
      <section className="checker flex flex-col items-center gap-5 rounded-[20px] border-[1.5px] border-dashed border-[#3a404b] px-8 py-[72px] text-center">
        <div className="flex size-[72px] items-center justify-center rounded-[20px] border border-line-strong bg-surface">
          <svg
            width="34"
            height="34"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-accent"
            aria-hidden="true"
          >
            <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <path d="M12 10v6" />
            <path d="m9 13 3-3 3 3" />
          </svg>
        </div>
        <div className="flex flex-col gap-2">
          <h1 className="m-0 text-[34px] font-bold tracking-tight">이미지 폴더를 끌어다 놓으세요</h1>
          <p className="m-0 text-[15px] text-muted">
            PNG와 JPG를 한 번에 불러와 배경 제거, 자르기, 크기 조절을 거쳐 WebP로 저장합니다.
          </p>
        </div>
        <div className="text-xs text-subtle">지원 형식 PNG · JPG · JPEG</div>
      </section>
    </main>
  )
}
