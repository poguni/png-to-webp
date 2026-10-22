import { useState, type FormEvent } from 'react'
import { BUILTIN_PRESETS, sameSettings } from '../lib/presets.ts'
import { useAppStore } from '../store.ts'

const CUSTOM = ''

/** 헤더의 프리셋 선택과 저장 (F9) */
export default function PresetControls() {
  const settings = useAppStore((s) => s.settings)
  const userPresets = useAppStore((s) => s.userPresets)
  const { updateSettings, savePreset, deletePreset } = useAppStore.getState()
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

  // 지금 설정과 값이 모두 같은 프리셋을 선택된 것으로 보여 준다. 하나라도 바꾸면 "직접 설정"이 된다.
  const options = [
    ...BUILTIN_PRESETS.map((preset) => ({ key: `builtin:${preset.name}`, preset })),
    ...userPresets.map((preset) => ({ key: `user:${preset.name}`, preset })),
  ]
  const current = options.find(({ preset }) => sameSettings(preset.settings, settings))
  const currentUser = current?.key.startsWith('user:') ? current.preset.name : null

  function handleSelect(key: string) {
    const option = options.find((o) => o.key === key)
    if (option) updateSettings(option.preset.settings)
  }

  function openSave() {
    setName(currentUser ?? '')
    setError(null)
    setSaving(true)
  }

  function handleSave(e: FormEvent) {
    e.preventDefault()
    const failure = savePreset(name)
    if (failure) setError(failure)
    else setSaving(false)
  }

  function handleDelete() {
    if (currentUser && window.confirm(`"${currentUser}" 프리셋을 삭제할까요?`)) deletePreset(currentUser)
  }

  const overwriting = userPresets.some((p) => p.name === name.trim())

  return (
    <div className="relative flex items-center gap-2">
      <label className="flex items-center gap-2 text-xs text-muted">
        프리셋
        <select
          value={current?.key ?? CUSTOM}
          onChange={(e) => handleSelect(e.target.value)}
          className="h-9 max-w-[200px] rounded-lg border border-line-strong bg-surface px-2.5 text-[13px] font-medium text-ink focus:border-accent focus:outline-none"
        >
          {!current && <option value={CUSTOM}>직접 설정</option>}
          <optgroup label="기본 프리셋">
            {BUILTIN_PRESETS.map((preset) => (
              <option key={preset.name} value={`builtin:${preset.name}`}>
                {preset.name}
              </option>
            ))}
          </optgroup>
          {userPresets.length > 0 && (
            <optgroup label="내 프리셋">
              {userPresets.map((preset) => (
                <option key={preset.name} value={`user:${preset.name}`}>
                  {preset.name}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </label>
      {currentUser && (
        <button
          type="button"
          onClick={handleDelete}
          className="h-9 rounded-lg px-2 text-xs text-muted hover:text-danger"
        >
          삭제
        </button>
      )}
      <button
        type="button"
        onClick={openSave}
        aria-expanded={saving}
        className="h-9 rounded-lg border border-line-strong bg-surface px-3 text-[13px] font-medium hover:border-[#3a404b]"
      >
        프리셋 저장
      </button>

      {saving && (
        <form
          onSubmit={handleSave}
          onKeyDown={(e) => e.key === 'Escape' && setSaving(false)}
          className="absolute top-full left-0 z-20 sm:right-0 sm:left-auto mt-2 flex w-[300px] flex-col gap-2.5 rounded-xl border border-line-strong bg-panel p-4 shadow-[0_12px_32px_rgba(0,0,0,0.5)]"
        >
          <label className="flex flex-col gap-1.5 text-xs text-muted">
            지금 설정을 프리셋으로 저장
            <input
              autoFocus
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                setError(null)
              }}
              placeholder="예: 블로그 썸네일"
              maxLength={40}
              className="h-9 w-full rounded-lg border border-line-strong bg-surface px-2.5 text-[13px] text-ink placeholder:text-subtle focus:border-accent focus:outline-none"
            />
          </label>
          {error ? (
            <p role="alert" className="m-0 text-xs text-danger">
              {error}
            </p>
          ) : (
            <p className="m-0 text-xs text-subtle">
              {overwriting ? '같은 이름의 프리셋을 지금 설정으로 바꿉니다.' : '이 브라우저에 저장됩니다.'}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setSaving(false)} className="h-8 rounded-lg px-3 text-xs text-muted hover:text-ink">
              취소
            </button>
            <button type="submit" className="h-8 rounded-lg bg-accent px-3.5 text-xs font-bold text-ground">
              {overwriting ? '덮어쓰기' : '저장'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
