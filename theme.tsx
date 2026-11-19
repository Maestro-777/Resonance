import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { Check, RotateCcw, SlidersHorizontal, X } from 'lucide-react'

/* ------------------------------------------------------------------ */
/*  Типы и пресеты                                                     */
/* ------------------------------------------------------------------ */

export type ThemeId = 'night' | 'amethyst' | 'graphite' | 'oled'
export type DensityId = 'comfortable' | 'compact'

export type Appearance = {
  theme: ThemeId
  accent: string
  radius: number
  blur: number
  glow: boolean
  density: DensityId
  scale: number
  cols: number
  animations: boolean
  labels: boolean
}

export const ACCENTS: { id: string; name: string; value: string }[] = [
  { id: 'violet', name: 'Фиолетовый', value: '#8b5cf6' },
  { id: 'indigo', name: 'Индиго', value: '#6366f1' },
  { id: 'magenta', name: 'Маджента', value: '#d946ef' },
  { id: 'pink', name: 'Розовый', value: '#ec4899' },
  { id: 'cyan', name: 'Циан', value: '#06b6d4' },
  { id: 'lime', name: 'Лайм', value: '#84cc16' },
  { id: 'amber', name: 'Янтарь', value: '#f59e0b' },
]

export const THEMES: { id: ThemeId; name: string; hint: string; swatch: string }[] = [
  { id: 'night', name: 'Ночная', hint: 'Синий графит', swatch: '#0f1020' },
  { id: 'amethyst', name: 'Аметист', hint: 'Тёплый фиолет', swatch: '#1b1030' },
  { id: 'graphite', name: 'Графит', hint: 'Нейтральный', swatch: '#1a1c1f' },
  { id: 'oled', name: 'Полночь', hint: 'Чистый чёрный', swatch: '#000000' },
]

export const DEFAULT_APPEARANCE: Appearance = {
  theme: 'night',
  accent: '#8b5cf6',
  radius: 18,
  blur: 18,
  glow: true,
  density: 'comfortable',
  scale: 1,
  cols: 5,
  animations: true,
  labels: true,
}

const STORAGE_KEY = 'resonance.appearance.v1'

/* ------------------------------------------------------------------ */
/*  Цветовые утилиты                                                   */
/* ------------------------------------------------------------------ */

export function hexToRgbTuple(hex: string): [number, number, number] {
  const clean = hex.replace('#', '').trim()
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean.padEnd(6, '0').slice(0, 6)
  const num = Number.parseInt(full, 16)
  if (Number.isNaN(num)) return [139, 92, 246]
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255]
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rr = r / 255
  const gg = g / 255
  const bb = b / 255
  const max = Math.max(rr, gg, bb)
  const min = Math.min(rr, gg, bb)
  const l = (max + min) / 2
  let h = 0
  let s = 0
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === rr) h = ((gg - bb) / d + (gg < bb ? 6 : 0)) / 6
    else if (max === gg) h = ((bb - rr) / d + 2) / 6
    else h = ((rr - gg) / d + 4) / 6
  }
  return [h * 360, s * 100, l * 100]
}

function hslToHex(h: number, s: number, l: number): string {
  const hh = ((h % 360) + 360) % 360
  const ss = Math.max(0, Math.min(100, s)) / 100
  const ll = Math.max(0, Math.min(100, l)) / 100
  const c = (1 - Math.abs(2 * ll - 1)) * ss
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1))
  const m = ll - c / 2
  let rgb: [number, number, number] = [0, 0, 0]
  if (hh < 60) rgb = [c, x, 0]
  else if (hh < 120) rgb = [x, c, 0]
  else if (hh < 180) rgb = [0, c, x]
  else if (hh < 240) rgb = [0, x, c]
  else if (hh < 300) rgb = [x, 0, c]
  else rgb = [c, 0, x]
  return `#${rgb
    .map((v) => Math.round((v + m) * 255).toString(16).padStart(2, '0'))
    .join('')}`
}

/** Второй цвет акцентного градиента: сдвиг тона и мягкое осветление. */
export function deriveAccent2(hex: string): string {
  const [r, g, b] = hexToRgbTuple(hex)
  const [h, s, l] = rgbToHsl(r, g, b)
  return hslToHex(h + 42, Math.min(100, s * 1.02), Math.min(72, l + 9))
}

/* ------------------------------------------------------------------ */
/*  Контекст оформления                                                */
/* ------------------------------------------------------------------ */

type Ctx = {
  appearance: Appearance
  update: <K extends keyof Appearance>(key: K, value: Appearance[K]) => void
  reset: () => void
  panelOpen: boolean
  setPanelOpen: (open: boolean) => void
  cssTokens: string
}

const AppearanceContext = createContext<Ctx | null>(null)

function loadAppearance(): Appearance {
  if (typeof window === 'undefined') return DEFAULT_APPEARANCE
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_APPEARANCE
    const parsed = JSON.parse(raw) as Partial<Appearance>
    return { ...DEFAULT_APPEARANCE, ...parsed }
  } catch {
    return DEFAULT_APPEARANCE
  }
}

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [appearance, setAppearance] = useState<Appearance>(loadAppearance)
  const [panelOpen, setPanelOpen] = useState(false)

  const update = <K extends keyof Appearance>(key: K, value: Appearance[K]) => {
    setAppearance((prev) => ({ ...prev, [key]: value }))
  }

  const reset = () => setAppearance(DEFAULT_APPEARANCE)

  useEffect(() => {
    const root = document.documentElement
    const accent2 = deriveAccent2(appearance.accent)
    const [r, g, b] = hexToRgbTuple(appearance.accent)
    const [r2, g2, b2] = hexToRgbTuple(accent2)
    root.dataset.theme = appearance.theme
    root.dataset.density = appearance.density
    root.style.colorScheme = 'dark'
    root.style.setProperty('--r-accent', appearance.accent)
    root.style.setProperty('--r-accent-rgb', `${r} ${g} ${b}`)
    root.style.setProperty('--r-accent-2', accent2)
    root.style.setProperty('--r-accent-2-rgb', `${r2} ${g2} ${b2}`)
    root.style.setProperty('--r-radius', `${appearance.radius}px`)
    root.style.setProperty('--r-blur', `${appearance.blur}px`)
    root.style.setProperty('--r-glow', appearance.glow ? '1' : '0')
    root.style.setProperty('--r-scale', String(appearance.scale))
    root.style.setProperty('--r-cols', String(appearance.cols))
    root.classList.toggle('reduce-motion', !appearance.animations)
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(appearance))
    } catch {
      /* приватный режим: настройки просто не сохранятся */
    }
  }, [appearance])

  const cssTokens = useMemo(() => {
    const accent2 = deriveAccent2(appearance.accent)
    return [
      `:root[data-theme="${appearance.theme}"] {`,
      `  --r-accent: ${appearance.accent};`,
      `  --r-accent-2: ${accent2};`,
      `  --r-radius: ${appearance.radius}px;`,
      `  --r-blur: ${appearance.blur}px;`,
      `  --r-glow: ${appearance.glow ? 1 : 0};`,
      `  --r-scale: ${appearance.scale};`,
      `  --r-cols: ${appearance.cols};`,
      `}`,
    ].join('\n')
  }, [appearance])

  const value: Ctx = { appearance, update, reset, panelOpen, setPanelOpen, cssTokens }

  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>
}

export function useAppearance(): Ctx {
  const ctx = useContext(AppearanceContext)
  if (!ctx) throw new Error('useAppearance должен использоваться внутри AppearanceProvider')
  return ctx
}

/* ------------------------------------------------------------------ */
/*  Элементы управления оформлением                                    */
/* ------------------------------------------------------------------ */

function FieldLabel({ label, value }: { label: string; value?: string }) {
  return (
    <div className="mb-2 flex items-baseline justify-between gap-3">
      <span className="text-[0.82rem] font-medium text-[var(--r-text-dim)]">{label}</span>
      {value ? (
        <span className="text-[0.78rem] font-semibold tabular-nums text-[var(--r-text)]">
          {value}
        </span>
      ) : null}
    </div>
  )
}

function RangeField({
  label,
  value,
  min,
  max,
  step = 1,
  suffix = '',
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  suffix?: string
  onChange: (value: number) => void
}) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <div>
      <FieldLabel label={label} value={`${value}${suffix}`} />
      <input
        type="range"
        className="r-range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        style={{ '--_p': `${pct}%` } as CSSProperties}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  )
}

function SwitchField({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string
  hint?: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      aria-pressed={checked}
      className="accent-ring flex w-full items-center justify-between gap-4 rounded-[calc(var(--r-radius)*0.7)] px-3 py-2.5 text-left transition-colors hover:bg-[var(--r-panel)]"
    >
      <span className="min-w-0">
        <span className="block text-[0.86rem] font-medium">{label}</span>
        {hint ? <span className="t-mute block text-[0.72rem]">{hint}</span> : null}
      </span>
      <span className="r-switch" data-on={checked} aria-hidden="true" />
    </button>
  )
}

function SegmentedField<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
}) {
  return (
    <div>
      <FieldLabel label={label} />
      <div className="flex flex-wrap gap-1.5 rounded-[calc(var(--r-radius)*0.7)] border border-[var(--r-line)] bg-[var(--r-panel)] p-1.5">
        {options.map((option) => {
          const active = option.value === value
          return (
            <button
              key={String(option.value)}
              type="button"
              onClick={() => onChange(option.value)}
              aria-pressed={active}
              className={`accent-ring flex-1 whitespace-nowrap rounded-[calc(var(--r-radius)*0.5)] px-3 py-1.5 text-[0.78rem] font-medium transition-colors ${
                active
                  ? 'accent-shadow bg-[var(--r-accent)] text-white'
                  : 'text-[var(--r-text-dim)] hover:text-[var(--r-text)]'
              }`}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-[var(--r-text-mute)]">
        {title}
      </h3>
      {children}
    </section>
  )
}

/* ------------------------------------------------------------------ */
/*  Полный набор настроек (панель и страница настроек)                 */
/* ------------------------------------------------------------------ */

export function AppearanceControls({ onDone }: { onDone?: () => void }) {
  const { appearance, update, reset, cssTokens } = useAppearance()

  return (
    <div className="space-y-6">
      <Section title="Акцентный цвет">
        <div className="flex flex-wrap items-center gap-2">
          {ACCENTS.map((accent) => {
            const active = accent.value.toLowerCase() === appearance.accent.toLowerCase()
            return (
              <button
                key={accent.id}
                type="button"
                title={accent.name}
                aria-label={accent.name}
                aria-pressed={active}
                onClick={() => update('accent', accent.value)}
                className="grid h-9 w-9 place-items-center rounded-full border transition-transform hover:scale-110"
                style={{
                  background: `linear-gradient(135deg, ${accent.value}, ${deriveAccent2(accent.value)})`,
                  borderColor: active ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.16)',
                  boxShadow: active
                    ? `0 0 0 3px ${accent.value}55, 0 8px 20px -10px ${accent.value}`
                    : 'none',
                }}
              >
                {active ? <Check size={15} strokeWidth={3} className="text-white" /> : null}
              </button>
            )
          })}
          <label className="t-dim ml-1 flex cursor-pointer items-center gap-2 rounded-full border border-[var(--r-line)] bg-[var(--r-panel)] px-2.5 py-1.5 text-[0.75rem] transition-colors hover:text-[var(--r-text)]">
            <span
              className="h-4 w-4 rounded-full"
              style={{ background: appearance.accent }}
              aria-hidden="true"
            />
            <span className="font-mono uppercase">{appearance.accent}</span>
            <input
              type="color"
              value={appearance.accent}
              aria-label="Свой акцентный цвет"
              onChange={(event) => update('accent', event.target.value)}
              className="sr-only"
            />
          </label>
        </div>
      </Section>

      <Section title="Фон приложения">
        <div className="grid grid-cols-2 gap-2">
          {THEMES.map((theme) => {
            const active = theme.id === appearance.theme
            return (
              <button
                key={theme.id}
                type="button"
                onClick={() => update('theme', theme.id)}
                aria-pressed={active}
                className={`accent-ring flex items-center gap-2.5 rounded-[calc(var(--r-radius)*0.7)] border p-2.5 text-left transition-colors ${
                  active
                    ? 'border-[color:rgb(var(--r-accent-rgb)/0.6)] bg-[var(--r-panel-2)]'
                    : 'border-[var(--r-line)] bg-[var(--r-panel)] hover:bg-[var(--r-panel-2)]'
                }`}
              >
                <span
                  className="h-8 w-8 flex-none rounded-lg border border-white/10"
                  style={{ background: theme.swatch }}
                  aria-hidden="true"
                />
                <span className="min-w-0">
                  <span className="block truncate text-[0.82rem] font-medium">{theme.name}</span>
                  <span className="t-mute block truncate text-[0.7rem]">{theme.hint}</span>
                </span>
              </button>
            )
          })}
        </div>
      </Section>

      <Section title="Геометрия и свет">
        <div className="space-y-4">
          <RangeField
            label="Скругление углов"
            value={appearance.radius}
            min={6}
            max={32}
            suffix=" px"
            onChange={(value) => update('radius', value)}
          />
          <RangeField
            label="Размытие стекла"
            value={appearance.blur}
            min={0}
            max={30}
            suffix=" px"
            onChange={(value) => update('blur', value)}
          />
          <SwitchField
            label="Свечение акцента"
            hint="Мягкие тени у кнопок и карточек"
            checked={appearance.glow}
            onChange={(value) => update('glow', value)}
          />
        </div>
      </Section>

      <Section title="Сетка и плотность">
        <div className="space-y-4">
          <SegmentedField
            label="Колонок в сетке обложек"
            value={appearance.cols}
            options={[3, 4, 5, 6].map((n) => ({ value: n, label: String(n) }))}
            onChange={(value) => update('cols', value)}
          />
          <SegmentedField
            label="Плотность интерфейса"
            value={appearance.density}
            options={[
              { value: 'comfortable', label: 'Комфортная' },
              { value: 'compact', label: 'Компактная' },
            ]}
            onChange={(value) => update('density', value)}
          />
          <RangeField
            label="Масштаб интерфейса"
            value={appearance.scale}
            min={0.9}
            max={1.15}
            step={0.01}
            suffix="×"
            onChange={(value) => update('scale', value)}
          />
        </div>
      </Section>

      <Section title="Поведение">
        <div className="space-y-1">
          <SwitchField
            label="Анимации"
            hint="Появление карточек и подсветка элементов"
            checked={appearance.animations}
            onChange={(value) => update('animations', value)}
          />
          <SwitchField
            label="Подписи в боковом меню"
            hint="Отключите, чтобы оставить только иконки"
            checked={appearance.labels}
            onChange={(value) => update('labels', value)}
          />
        </div>
      </Section>

      <Section title="Токены темы">
        <pre className="no-scrollbar overflow-x-auto rounded-[calc(var(--r-radius)*0.7)] border border-[var(--r-line)] bg-black/35 p-3 text-[0.68rem] leading-relaxed text-[var(--r-text-dim)]">
          <code>{cssTokens}</code>
        </pre>
      </Section>

      <div className="flex flex-wrap gap-2 pt-1">
        <button
          type="button"
          onClick={reset}
          className="accent-ring inline-flex items-center gap-2 rounded-full border border-[var(--r-line)] bg-[var(--r-panel)] px-4 py-2 text-[0.82rem] font-medium transition-colors hover:bg-[var(--r-panel-2)]"
        >
          <RotateCcw size={15} />
          Сбросить
        </button>
        {onDone ? (
          <button
            type="button"
            onClick={onDone}
            className="accent-btn accent-ring inline-flex items-center gap-2 rounded-full px-4 py-2 text-[0.82rem] font-semibold"
          >
            Готово
          </button>
        ) : null}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Выдвижная панель настроек                                          */
/* ------------------------------------------------------------------ */

export function AppearancePanel() {
  const { panelOpen, setPanelOpen } = useAppearance()

  useEffect(() => {
    if (!panelOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPanelOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [panelOpen, setPanelOpen])

  return createPortal(
    <div
      className={`fixed inset-0 z-[80] ${panelOpen ? '' : 'pointer-events-none'}`}
      aria-hidden={!panelOpen}
    >
      <div
        onClick={() => setPanelOpen(false)}
        className={`absolute inset-0 bg-black/65 backdrop-blur-[3px] transition-opacity duration-300 ${
          panelOpen ? 'opacity-100' : 'opacity-0'
        }`}
      />
      <aside
        role="dialog"
        aria-label="Настройки внешнего вида"
        className={`absolute right-0 top-0 flex h-full w-[min(430px,94vw)] flex-col border-l border-[var(--r-line)] bg-[var(--r-app)] shadow-[-30px_0_80px_-40px_rgba(0,0,0,0.9)] transition-transform duration-300 ease-out ${
          panelOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <header className="flex items-start justify-between gap-3 border-b border-[var(--r-line)] px-5 py-4">
          <div className="flex items-start gap-3">
            <span className="accent-grad accent-shadow mt-0.5 grid h-9 w-9 place-items-center rounded-xl text-white">
              <SlidersHorizontal size={17} />
            </span>
            <div>
              <h2 className="text-[0.98rem] font-semibold">Настройки внешнего вида</h2>
              <p className="t-mute text-[0.74rem]">Изменения применяются сразу</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setPanelOpen(false)}
            aria-label="Закрыть настройки"
            className="accent-ring grid h-8 w-8 place-items-center rounded-full border border-[var(--r-line)] text-[var(--r-text-dim)] transition-colors hover:bg-[var(--r-panel-2)] hover:text-[var(--r-text)]"
          >
            <X size={16} />
          </button>
        </header>
        <div className="scroll-y flex-1 px-5 py-5">
          <AppearanceControls onDone={() => setPanelOpen(false)} />
        </div>
      </aside>
    </div>,
    document.body,
  )
}
