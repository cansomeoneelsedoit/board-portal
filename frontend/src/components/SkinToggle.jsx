import { Check, Palette } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { SKINS, useSkin } from '../theme/SkinProvider'

/**
 * Lets Boyd flip between the Mason-View skin and the original design at any
 * time. Hidden when the app is embedded in a host vertical — there the host
 * owns the look.
 */
export default function SkinToggle() {
  const { skin, setSkin, embedded } = useSkin()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (embedded) return null

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="bp-btn bp-btn-secondary"
        title="Switch design"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Palette size={16} />
        <span className="hidden sm:inline">{SKINS[skin].label}</span>
      </button>

      {open && (
        <div
          role="menu"
          className="bp-card absolute right-0 mt-2 w-60 p-1 z-50"
          style={{ boxShadow: '0 10px 30px rgb(0 0 0 / 0.12)' }}
        >
          {Object.values(SKINS).map((s) => (
            <button
              key={s.id}
              role="menuitem"
              onClick={() => { setSkin(s.id); setOpen(false) }}
              className="w-full text-left px-3 py-2 rounded-md flex items-start gap-2 hover:bg-[var(--bp-neutral-bg)] transition-colors"
            >
              <Check
                size={15}
                className="mt-0.5 shrink-0"
                style={{ opacity: skin === s.id ? 1 : 0 }}
              />
              <span>
                <span className="block text-sm font-medium">{s.label}</span>
                <span className="block text-xs bp-muted">{s.hint}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
