import type { ReactNode } from 'react'
import { OUTPUT_DIR } from '../lib/imageFiles.ts'
import { outputFileName, type ConflictPolicy, type NameCase } from '../lib/outputNames.ts'
import { useAppStore } from '../store.ts'

const QUALITY_PRESETS = [
  { label: '고화질', value: 90 },
  { label: '균형', value: 80 },
  { label: '최소 용량', value: 60 },
]

const selectClass =
  'h-9 w-full rounded-lg border border-line-strong bg-surface px-2.5 text-[13px] text-ink focus:border-accent focus:outline-none'
const inputClass =
  'h-9 w-full min-w-0 rounded-lg border border-line-strong bg-surface px-2.5 text-[13px] text-ink placeholder:text-subtle focus:border-accent focus:outline-none'

export default function SettingsPanel() {
  const settings = useAppStore((s) => s.settings)
  const source = useAppStore((s) => s.source)
  const sample = useAppStore((s) => s.items.find((i) => i.id === s.selectedId) ?? s.items[0])
  const batchError = useAppStore((s) => s.batchError)
  const { updateSettings } = useAppStore.getState()
  const { quality, naming, conflict } = settings

  return (
    <aside className="flex grow basis-[320px] flex-col border-line bg-panel lg:overflow-y-auto lg:border-l">
      <Section title="WebP 압축">
        <label className="flex flex-col gap-1.5 text-xs text-muted">
          <span className="flex justify-between">
            품질 <span className="font-mono text-ink">{quality}</span>
          </span>
          <input
            type="range"
            min={0}
            max={100}
            value={quality}
            onChange={(e) => updateSettings({ quality: Number(e.target.value) })}
            className="accent-accent"
          />
        </label>
        <div className="flex gap-1.5">
          {QUALITY_PRESETS.map((preset) => (
            <button
              key={preset.value}
              type="button"
              aria-pressed={quality === preset.value}
              onClick={() => updateSettings({ quality: preset.value })}
              className={`h-[30px] flex-1 rounded-lg border text-xs ${
                quality === preset.value
                  ? 'border-accent bg-[#1d2414] font-semibold text-accent'
                  : 'border-line-strong text-muted hover:text-ink'
              }`}
            >
              {preset.label} {preset.value}
            </button>
          ))}
        </div>
        <p className="m-0 text-xs text-subtle">값이 높을수록 화질이 좋고 파일이 커집니다.</p>
      </Section>

      <Section title="출력">
        <div className="flex justify-between gap-3 text-xs">
          <span className="text-muted">저장 위치</span>
          <span className="truncate text-right font-mono">
            {source?.kind === 'directory' ? `${source.name}/${OUTPUT_DIR}` : '처리할 때 고릅니다'}
          </span>
        </div>

        <label className="flex flex-col gap-1.5 text-xs text-muted">
          파일 이름
          <select
            value={naming.case}
            onChange={(e) => updateSettings({ naming: { ...naming, case: e.target.value as NameCase } })}
            className={selectClass}
          >
            <option value="keep">원래 이름 유지</option>
            <option value="kebab">소문자와 하이픈으로 변환</option>
          </select>
        </label>

        <div className="grid grid-cols-2 gap-2">
          <label className="flex min-w-0 flex-col gap-1.5 text-xs text-muted">
            접두사
            <input
              value={naming.prefix}
              onChange={(e) => updateSettings({ naming: { ...naming, prefix: e.target.value } })}
              placeholder="예: sprite_"
              className={inputClass}
            />
          </label>
          <label className="flex min-w-0 flex-col gap-1.5 text-xs text-muted">
            접미사
            <input
              value={naming.suffix}
              onChange={(e) => updateSettings({ naming: { ...naming, suffix: e.target.value } })}
              placeholder="예: _512"
              className={inputClass}
            />
          </label>
        </div>

        {sample && (
          <p className="m-0 truncate text-xs text-subtle" title={`${sample.name} → ${outputFileName(sample.name, naming)}`}>
            {sample.name} → <span className="text-ink">{outputFileName(sample.name, naming)}</span>
          </p>
        )}

        <label className="flex flex-col gap-1.5 text-xs text-muted">
          같은 이름의 파일이 있으면
          <select
            value={conflict}
            onChange={(e) => updateSettings({ conflict: e.target.value as ConflictPolicy })}
            className={selectClass}
          >
            <option value="number">번호 붙이기 (예: hero-1.webp)</option>
            <option value="overwrite">덮어쓰기</option>
            <option value="skip">건너뛰기</option>
          </select>
        </label>
        <p className="m-0 text-xs text-subtle">원본 파일은 수정하거나 지우지 않습니다.</p>
      </Section>

      {batchError && (
        <p role="alert" className="m-0 border-t border-line px-5 py-4 text-sm text-danger">
          {batchError}
        </p>
      )}
    </aside>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3.5 border-b border-line px-5 py-[18px]">
      <h2 className="m-0 text-sm font-semibold">{title}</h2>
      {children}
    </section>
  )
}
