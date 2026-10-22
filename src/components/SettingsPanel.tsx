import type { ReactNode } from 'react'
import type { BackgroundMode, BackgroundSettings } from '../lib/background.ts'
import { RATIO_PRESETS, type Anchor, type CropSettings, type RatioPreset } from '../lib/crop.ts'
import { OUTPUT_DIR } from '../lib/imageFiles.ts'
import { outputFileName, type ConflictPolicy, type NameCase } from '../lib/outputNames.ts'
import { SIZE_PRESETS, targetSize, type FitMode, type ResizeSettings, type SizePreset } from '../lib/resize.ts'
import type { PaddingUnit, TrimSettings } from '../lib/trim.ts'
import { useAppStore } from '../store.ts'

/** 품질 프리셋 (F6-5). value가 null이면 무손실 */
const QUALITY_PRESETS: { label: string; value: number | null }[] = [
  { label: '고화질 90', value: 90 },
  { label: '균형 80', value: 80 },
  { label: '최소 60', value: 60 },
  { label: '무손실', value: null },
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
  const { quality, lossless, alphaQuality, effort, naming, conflict } = settings

  return (
    <aside className="flex grow basis-[320px] flex-col border-line bg-panel lg:overflow-y-auto lg:border-l">
      <BackgroundSection />
      <TrimSection />
      <CropSection />
      <ResizeSection />

      <Section
        title="WebP 압축"
        action={
          <label className="flex items-center gap-1.5 text-xs text-muted">
            <input
              type="checkbox"
              checked={lossless}
              onChange={(e) => updateSettings({ lossless: e.target.checked })}
              className="size-[15px] accent-accent"
            />
            무손실
          </label>
        }
      >
        <label className={`flex flex-col gap-1.5 text-xs text-muted ${lossless ? 'opacity-50' : ''}`}>
          <span className="flex justify-between">
            품질 <span className="font-mono text-ink">{quality}</span>
          </span>
          <input
            type="range"
            min={0}
            max={100}
            value={quality}
            disabled={lossless}
            onChange={(e) => updateSettings({ quality: Number(e.target.value) })}
            className="accent-accent"
          />
        </label>
        <div className="grid grid-cols-4 gap-1.5">
          {QUALITY_PRESETS.map((preset) => {
            const selected = preset.value === null ? lossless : !lossless && quality === preset.value
            return (
              <button
                key={preset.label}
                type="button"
                aria-pressed={selected}
                onClick={() =>
                  updateSettings(preset.value === null ? { lossless: true } : { lossless: false, quality: preset.value })
                }
                className={`h-[30px] rounded-lg border text-xs ${
                  selected
                    ? 'border-accent bg-[#1d2414] font-semibold text-accent'
                    : 'border-line-strong text-muted hover:text-ink'
                }`}
              >
                {preset.label}
              </button>
            )
          })}
        </div>
        <p className="m-0 text-xs text-subtle">
          {lossless
            ? '화질 손실 없이 저장합니다. 파일이 커질 수 있습니다.'
            : '값이 높을수록 화질이 좋고 파일이 커집니다.'}
        </p>
        <div className="grid grid-cols-2 gap-4">
          <label className={`flex flex-col gap-1.5 text-xs text-muted ${lossless ? 'opacity-50' : ''}`}>
            <span className="flex justify-between">
              알파 품질 <span className="font-mono text-ink">{alphaQuality}</span>
            </span>
            <input
              type="range"
              min={0}
              max={100}
              value={alphaQuality}
              disabled={lossless}
              onChange={(e) => updateSettings({ alphaQuality: Number(e.target.value) })}
              className="accent-accent"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-xs text-muted">
            <span className="flex justify-between">
              압축 노력도 <span className="font-mono text-ink">{effort}</span>
            </span>
            <input
              type="range"
              min={0}
              max={6}
              value={effort}
              onChange={(e) => updateSettings({ effort: Number(e.target.value) })}
              className="accent-accent"
            />
          </label>
        </div>
        <p className="m-0 text-xs text-subtle">
          알파 품질은 투명한 경계의 품질입니다. 노력도가 높을수록 파일이 작아지지만 느려집니다.
        </p>
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

const BACKGROUND_MODES: { value: BackgroundMode; label: string; hint: string }[] = [
  {
    value: 'auto',
    label: '자동',
    hint: '단색이나 체커보드 배경은 색으로 빠르게 지우고, 복잡한 배경은 AI로 지웁니다.',
  },
  { value: 'solid', label: '단색', hint: '가장자리에서 가장 많이 보이는 색 하나를 지웁니다.' },
  { value: 'checker', label: '체커보드', hint: '"투명 배경"으로 생성했을 때 그려진 회색·흰색 체크무늬를 지웁니다.' },
  {
    value: 'ai',
    label: 'AI',
    hint: 'AI 모델로 피사체를 찾아 배경을 지웁니다. 처음 한 번 모델(약 80MB)을 내려받고, 장당 몇 초가 걸립니다.',
  },
]

function BackgroundSection() {
  const background = useAppStore((s) => s.settings.background)
  const { updateSettings } = useAppStore.getState()
  const setBackground = (patch: Partial<BackgroundSettings>) =>
    updateSettings({ background: { ...background, ...patch } })
  const { enabled } = background
  // 허용 오차와 경계 다듬기는 색으로 지울 때만 쓴다.
  const colorOptions = enabled && background.mode !== 'ai'

  return (
    <Section
      title="배경 제거"
      action={
        <label className="flex items-center gap-1.5 text-xs text-muted">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setBackground({ enabled: e.target.checked })}
            className="size-[15px] accent-accent"
          />
          사용
        </label>
      }
    >
      <div className={`flex flex-col gap-3.5 ${enabled ? '' : 'opacity-50'}`}>
        <div
          className="grid grid-cols-4 rounded-[10px] border border-line-strong bg-surface p-[3px]"
          role="group"
          aria-label="배경 제거 방식"
        >
          {BACKGROUND_MODES.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              aria-pressed={background.mode === value}
              disabled={!enabled}
              onClick={() => setBackground({ mode: value })}
              className={`h-8 rounded-[7px] text-xs ${
                background.mode === value ? 'bg-[#2b3140] font-medium text-ink' : 'text-muted hover:text-ink'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="m-0 text-xs text-subtle">{BACKGROUND_MODES.find((m) => m.value === background.mode)?.hint}</p>

        <label className={`flex flex-col gap-1.5 text-xs text-muted ${colorOptions || !enabled ? '' : 'opacity-50'}`}>
          <span className="flex justify-between">
            허용 오차 <span className="font-mono text-ink">{background.tolerance}</span>
          </span>
          <input
            type="range"
            min={0}
            max={60}
            value={background.tolerance}
            disabled={!colorOptions}
            onChange={(e) => setBackground({ tolerance: Number(e.target.value) })}
            className="accent-accent"
          />
          <span className="text-subtle">높이면 배경과 조금 다른 색까지 지웁니다.</span>
        </label>

        <label className={`flex flex-col gap-1.5 text-xs text-muted ${colorOptions || !enabled ? '' : 'opacity-50'}`}>
          <span className="flex justify-between">
            경계 다듬기 <span className="font-mono text-ink">{background.feather}px</span>
          </span>
          <input
            type="range"
            min={0}
            max={3}
            value={background.feather}
            disabled={!colorOptions}
            onChange={(e) => setBackground({ feather: Number(e.target.value) })}
            className="accent-accent"
          />
          <span className="text-subtle">경계에 남은 배경색 테두리를 지우고 부드럽게 만듭니다.</span>
        </label>

        <label className="flex items-center gap-2 text-xs text-muted">
          <input
            type="checkbox"
            checked={background.applyToJpg}
            disabled={!enabled}
            onChange={(e) => setBackground({ applyToJpg: e.target.checked })}
            className="size-[15px] accent-accent"
          />
          JPG 파일에도 적용
        </label>
      </div>
    </Section>
  )
}

function TrimSection() {
  const trim = useAppStore((s) => s.settings.trim)
  const { updateSettings } = useAppStore.getState()
  const setTrim = (patch: Partial<TrimSettings>) => updateSettings({ trim: { ...trim, ...patch } })

  return (
    <Section
      title="여백 다듬기"
      action={
        <label className="flex items-center gap-1.5 text-xs text-muted">
          <input
            type="checkbox"
            checked={trim.enabled}
            onChange={(e) => setTrim({ enabled: e.target.checked })}
            className="size-[15px] accent-accent"
          />
          사용
        </label>
      }
    >
      <p className="m-0 text-xs text-subtle">투명한 가장자리를 잘라 피사체에 딱 맞춘 뒤, 사방에 여백을 더합니다.</p>
      <div className={`flex items-end gap-2 ${trim.enabled ? '' : 'opacity-50'}`}>
        <label className="flex min-w-0 flex-1 flex-col gap-1.5 text-xs text-muted">
          여백
          <input
            type="number"
            min={0}
            value={trim.padding}
            disabled={!trim.enabled}
            onChange={(e) => setTrim({ padding: Math.max(0, Number(e.target.value)) })}
            className={inputClass}
          />
        </label>
        <select
          value={trim.unit}
          disabled={!trim.enabled}
          aria-label="여백 단위"
          onChange={(e) => setTrim({ unit: e.target.value as PaddingUnit })}
          className={selectClass.replace('w-full', 'w-[150px] shrink-0')}
        >
          <option value="px">px</option>
          <option value="%">% (긴 변 기준)</option>
        </select>
      </div>
    </Section>
  )
}

const RATIO_LABELS: Record<RatioPreset, string> = {
  original: '원본',
  '16:9': '16:9',
  '9:16': '9:16',
  '4:3': '4:3',
  '3:4': '3:4',
  '1:1': '1:1',
  custom: '사용자 지정',
}

const ANCHORS: { anchor: Anchor; label: string }[] = [
  { anchor: { x: 0, y: 0 }, label: '왼쪽 위' },
  { anchor: { x: 0.5, y: 0 }, label: '위' },
  { anchor: { x: 1, y: 0 }, label: '오른쪽 위' },
  { anchor: { x: 0, y: 0.5 }, label: '왼쪽' },
  { anchor: { x: 0.5, y: 0.5 }, label: '가운데' },
  { anchor: { x: 1, y: 0.5 }, label: '오른쪽' },
  { anchor: { x: 0, y: 1 }, label: '왼쪽 아래' },
  { anchor: { x: 0.5, y: 1 }, label: '아래' },
  { anchor: { x: 1, y: 1 }, label: '오른쪽 아래' },
]

function CropSection() {
  const crop = useAppStore((s) => s.settings.crop)
  const { updateSettings } = useAppStore.getState()
  const setCrop = (patch: Partial<CropSettings>) => updateSettings({ crop: { ...crop, ...patch } })
  const active = crop.ratio !== 'original'
  const current = ANCHORS.find(({ anchor }) => anchor.x === crop.anchor.x && anchor.y === crop.anchor.y)

  return (
    <Section title="자르기">
      <div className="grid grid-cols-4 gap-1.5" role="group" aria-label="자를 비율">
        {RATIO_PRESETS.map((ratio) => (
          <button
            key={ratio}
            type="button"
            aria-pressed={crop.ratio === ratio}
            onClick={() => setCrop({ ratio })}
            className={`h-8 rounded-lg border text-xs ${ratio === 'custom' ? 'col-span-2' : ''} ${
              crop.ratio === ratio
                ? 'border-accent bg-[#1d2414] font-semibold text-accent'
                : 'border-line-strong text-muted hover:text-ink'
            }`}
          >
            {RATIO_LABELS[ratio]}
          </button>
        ))}
      </div>

      {crop.ratio === 'custom' && (
        <div className="flex items-end gap-2">
          <label className="flex min-w-0 flex-1 flex-col gap-1.5 text-xs text-muted">
            가로
            <input
              type="number"
              min={1}
              value={crop.custom.width}
              onChange={(e) => setCrop({ custom: { ...crop.custom, width: Number(e.target.value) } })}
              className={inputClass}
            />
          </label>
          <span className="pb-2 text-muted">:</span>
          <label className="flex min-w-0 flex-1 flex-col gap-1.5 text-xs text-muted">
            세로
            <input
              type="number"
              min={1}
              value={crop.custom.height}
              onChange={(e) => setCrop({ custom: { ...crop.custom, height: Number(e.target.value) } })}
              className={inputClass}
            />
          </label>
        </div>
      )}

      <div className={`flex items-center gap-3.5 ${active ? '' : 'opacity-50'}`}>
        <div className="grid w-[84px] grid-cols-3 gap-1" role="group" aria-label="자르기 위치">
          {ANCHORS.map(({ anchor, label }) => {
            const selected = anchor === current?.anchor
            return (
              <button
                key={label}
                type="button"
                aria-label={label}
                aria-pressed={selected}
                disabled={!active}
                onClick={() => setCrop({ anchor })}
                className={`h-6 rounded ${selected ? 'bg-accent' : 'bg-line hover:bg-line-strong'}`}
              />
            )
          })}
        </div>
        <div className="flex flex-col gap-0.5 text-xs text-muted">
          <span>자르기 위치</span>
          <span className="text-[13px] text-ink">{current?.label}</span>
          {!active && <span>비율을 고르면 정할 수 있습니다</span>}
        </div>
      </div>
    </Section>
  )
}

const FITS: { value: FitMode; label: string }[] = [
  { value: 'contain', label: 'Contain' },
  { value: 'cover', label: 'Cover' },
  { value: 'stretch', label: 'Stretch' },
  { value: 'long', label: '긴 변' },
]

function fitHint(fit: FitMode, longEdge: number | null): string {
  if (fit === 'contain') return '비율을 지키며 안에 맞추고, 남는 공간은 투명하게 채웁니다.'
  if (fit === 'cover') return '비율을 지키며 꽉 채우고, 넘치는 부분은 가운데를 기준으로 잘라 냅니다.'
  if (fit === 'stretch') return '비율을 무시하고 목표 크기에 맞춰 늘리거나 줄입니다.'
  return `긴 변을 ${longEdge ?? '목표'}px에 맞추고 비율을 유지합니다.`
}

function ResizeSection() {
  const resize = useAppStore((s) => s.settings.resize)
  const { updateSettings } = useAppStore.getState()
  const setResize = (patch: Partial<ResizeSettings>) => updateSettings({ resize: { ...resize, ...patch } })
  const target = targetSize(resize)
  const { multi } = resize
  const active = multi ? resize.sizes.length > 0 : resize.size !== 'original'
  const isSelected = (size: SizePreset) => (multi ? resize.sizes.includes(size) : resize.size === size)

  function handleSize(size: SizePreset) {
    if (!multi) setResize({ size })
    else if (resize.sizes.includes(size)) setResize({ sizes: resize.sizes.filter((s) => s !== size) })
    else setResize({ sizes: [...resize.sizes, size] })
  }

  function handleMulti(on: boolean) {
    // 켤 때는 지금 고른 크기에서 시작한다.
    if (on) setResize({ multi: true, sizes: resize.size === 'original' ? [] : [resize.size] })
    else setResize({ multi: false })
  }

  return (
    <Section title="크기 조절">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="목표 크기">
        {SIZE_PRESETS.map((size) => (
          <button
            key={size}
            type="button"
            aria-pressed={isSelected(size)}
            // 여러 크기로 출력할 때 원본 크기는 고를 수 없다.
            disabled={multi && size === 'original'}
            onClick={() => handleSize(size)}
            className={`h-8 rounded-lg border px-2.5 text-xs disabled:opacity-40 ${size.includes('x') ? 'font-mono' : ''} ${
              isSelected(size)
                ? 'border-accent bg-[#1d2414] font-semibold text-accent'
                : 'border-line-strong text-muted hover:text-ink'
            }`}
          >
            {size === 'original' ? '원본' : size === 'custom' ? '사용자 지정' : size.replace('x', '×')}
          </button>
        ))}
      </div>
      <label className="flex items-center gap-2 text-xs text-muted">
        <input
          type="checkbox"
          checked={multi}
          onChange={(e) => handleMulti(e.target.checked)}
          className="size-[15px] accent-accent"
        />
        여러 크기로 출력 (예: hero_512.webp, hero_256.webp)
      </label>
      {multi && resize.sizes.length === 0 && (
        <p className="m-0 text-xs text-danger">출력할 크기를 하나 이상 고르세요. 고르지 않으면 원본 크기로 저장합니다.</p>
      )}

      {isSelected('custom') && (
        <div className="flex items-end gap-2">
          <label className="flex min-w-0 flex-1 flex-col gap-1.5 text-xs text-muted">
            가로 (px)
            <input
              type="number"
              min={1}
              value={resize.custom.width}
              onChange={(e) => setResize({ custom: { ...resize.custom, width: Number(e.target.value) } })}
              className={inputClass}
            />
          </label>
          <span className="pb-2 text-muted">×</span>
          <label className="flex min-w-0 flex-1 flex-col gap-1.5 text-xs text-muted">
            세로 (px)
            <input
              type="number"
              min={1}
              value={resize.custom.height}
              onChange={(e) => setResize({ custom: { ...resize.custom, height: Number(e.target.value) } })}
              className={inputClass}
            />
          </label>
        </div>
      )}

      <div className={`flex flex-col gap-2 ${active ? '' : 'opacity-50'}`}>
        <div
          className="grid grid-cols-4 rounded-[10px] border border-line-strong bg-surface p-[3px]"
          role="group"
          aria-label="맞춤 방식"
        >
          {FITS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              aria-pressed={resize.fit === value}
              disabled={!active}
              onClick={() => setResize({ fit: value })}
              className={`h-8 rounded-[7px] text-xs ${
                resize.fit === value ? 'bg-[#2b3140] font-medium text-ink' : 'text-muted hover:text-ink'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="m-0 text-xs text-subtle">
          {active ? fitHint(resize.fit, !multi && target ? Math.max(target.width, target.height) : null) : '크기를 고르면 맞춤 방식을 정할 수 있습니다.'}
        </p>
        <label className="flex items-center gap-2 text-xs text-muted">
          <input
            type="checkbox"
            checked={resize.noUpscale}
            disabled={!active}
            onChange={(e) => setResize({ noUpscale: e.target.checked })}
            className="size-[15px] accent-accent"
          />
          확대 금지 (목표보다 작은 원본은 원래 크기로 둡니다)
        </label>
      </div>
    </Section>
  )
}

function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3.5 border-b border-line px-5 py-[18px]">
      <div className="flex items-center justify-between">
        <h2 className="m-0 text-sm font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}
