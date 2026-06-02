import { useState, useEffect, useRef, createContext, useContext, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Ico } from './Icons'
import { uploadImage } from '../hooks/store'

/* ---------- Toast ---------- */
const ToastCtx = createContext(() => {})
export const useToast = () => useContext(ToastCtx)

export function ToastProvider({ children }) {
  const [msg, setMsg] = useState(null)
  const t = useRef()
  const toast = useCallback((m) => {
    setMsg(m); clearTimeout(t.current); t.current = setTimeout(() => setMsg(null), 2200)
  }, [])
  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <AnimatePresence>
        {msg && (
          <motion.div className="toast" initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 14 }}>
            {msg}
          </motion.div>
        )}
      </AnimatePresence>
    </ToastCtx.Provider>
  )
}

/* ---------- Slide-up Sheet ---------- */
export function Sheet({ open, onClose, children }) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
      document.body.classList.add('sheet-open')
    }
    return () => {
      document.body.style.overflow = ''
      document.body.classList.remove('sheet-open')
    }
  }, [open])
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="sheet-bg" onClick={onClose}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
          <motion.div className="sheet"
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 340 }}
            drag="y" dragConstraints={{ top: 0, bottom: 0 }} dragElastic={0.2}
            onDragEnd={(e, i) => { if (i.offset.y > 120) onClose() }}>
            <div className="grab" />
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

/* ---------- Image picker (uploads to Supabase) ---------- */
export function ImagePicker({ value, onChange, small }) {
  const ref = useRef()
  const [busy, setBusy] = useState(false)
  const toast = useToast()

  const pick = async (e) => {
    const file = e.target.files?.[0]; if (!file) return
    setBusy(true)
    try {
      const url = await uploadImage(file)
      onChange(url)
    } catch (err) { toast('Upload failed — check Storage bucket') }
    setBusy(false)
  }

  return (
    <div className="upl" onClick={() => ref.current?.click()}
      style={small ? { padding: 0, border: 'none', background: 'transparent' } : {}}>
      <input ref={ref} type="file" accept="image/*" hidden onChange={pick} />
      {busy ? <div className="spin" />
        : value ? (
          small
            ? <img src={value} alt="" style={{ width: 56, height: 56, borderRadius: 12, objectFit: 'cover' }} />
            : <img src={value} alt="" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <Ico.cam style={{ color: 'var(--accent)' }} />
            <span>{small ? 'Photo' : 'Tap to add a photo'}</span>
          </div>
        )}
    </div>
  )
}

/* ---------- Checkbox ---------- */
export function Check({ label, checked, onChange }) {
  return (
    <div className={'check' + (checked ? ' on' : '')} onClick={() => onChange(!checked)}>
      <span className="box">{checked && (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
          <path d="M4 12l5 5L20 6" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}</span>
      <span>{label}</span>
    </div>
  )
}

/* ---------- Number stepper ---------- */
export function Stepper({ value, onChange, max }) {
  const set = (n) => onChange(Math.max(0, max != null ? Math.min(max, n) : n))
  return (
    <div className="stepper">
      <button onClick={() => set((+value || 0) - 1)}>−</button>
      <input type="number" inputMode="numeric" value={value}
        onChange={(e) => set(parseInt(e.target.value || '0', 10))} />
      <button onClick={() => set((+value || 0) + 1)}>+</button>
    </div>
  )
}
