import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore, db, batchMath, getState } from '../hooks/store'
import { Ico } from '../components/Icons'
import { useToast, Sheet, Stepper } from '../components/UI'

export default function Stock() {
  const toast = useToast()
  const products = useStore((s) => s.products)
  const variants = useStore((s) => s.variants)
  const sizes = useStore((s) => s.sizes)
  const batches = useStore((s) => s.batches)

  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState('deduct') // 'deduct' | 'add'
  const [step, setStep] = useState(1)
  const [pid, setPid] = useState('')
  const [vid, setVid] = useState('')
  const [zid, setZid] = useState('')
  const [deduct, setDeduct] = useState(1)
  const [note, setNote] = useState('')

  // reconcile sheet
  const [recOpen, setRecOpen] = useState(false)
  const [recBatch, setRecBatch] = useState(null)
  const [ret, setRet] = useState(0)
  const [unus, setUnus] = useState(0)

  const variantsOf = (p) => variants.filter((v) => v.product_id === p)
  const sizesOf = (v) => sizes.filter((z) => z.variant_id === v)
  const size = sizes.find((z) => z.id === zid)
  const variant = variants.find((v) => v.id === vid)

  const reset = () => { setStep(1); setPid(''); setVid(''); setZid(''); setDeduct(1); setNote('') }
  const openWizard = (m) => { setMode(m); reset(); setOpen(true) }

  const confirmDeduct = async () => {
    if (!zid) return
    if (deduct > (size?.stock || 0)) return toast('Not enough stock')
    await db.updateSize(zid, { stock: (size.stock || 0) - deduct })
    await db.addBatch({ variant_size_id: zid, deducted: deduct, returned: 0, unusable: 0, note: note.trim() || null })
    toast('Stock deducted')
    setOpen(false); reset()
  }

  const confirmAdd = async () => {
    if (!zid) return
    await db.updateSize(zid, { stock: (size.stock || 0) + deduct })
    toast(`Added ${deduct} to stock`)
    setOpen(false); reset()
  }

  const openReconcile = (b) => {
    setRecBatch(b); setRet(b.returned || 0); setUnus(b.unusable || 0); setRecOpen(true)
  }
  const saveReconcile = async () => {
    const b = recBatch
    if (ret + unus > b.deducted) return toast('Returned + unusable exceeds deducted')
    // return units go back into stock (delta vs previously returned)
    const z = getState().sizes.find((x) => x.id === b.variant_size_id)
    const delta = ret - (b.returned || 0)
    if (z && delta !== 0) await db.updateSize(z.id, { stock: Math.max(0, (z.stock || 0) + delta) })
    await db.deleteBatch(b.id)
    await db.addBatch({
      variant_size_id: b.variant_size_id, deducted: b.deducted,
      returned: ret, unusable: unus, note: b.note,
    })
    toast('Updated')
    setRecOpen(false); setRecBatch(null)
  }

  // enrich batches for display
  const rows = useMemo(() => batches.map((b) => {
    const z = sizes.find((x) => x.id === b.variant_size_id)
    const v = z && variants.find((x) => x.id === z.variant_id)
    const p = v && products.find((x) => x.id === v.product_id)
    return { b, z, v, p, m: batchMath(b, z, v, p) }
  }), [batches, sizes, variants, products])

  return (
    <>
      <header className="head">
        <div>
          <div className="eyebrow">Stock</div>
          <h1 className="display">Movements</h1>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn sm" onClick={() => openWizard('add')}>
            <Ico.plus /> Add
          </button>
          <button className="btn sm primary" onClick={() => openWizard('deduct')}>
            Take out
          </button>
        </div>
      </header>

      {rows.length === 0 ? (
        <div className="empty">
          <div className="big">No movements yet</div>
          <div>Deduct stock to start tracking sales, returns & faults.</div>
          <button className="btn primary" style={{ marginTop: 18, maxWidth: 220, marginInline: 'auto' }}
            onClick={() => openWizard('deduct')}>Deduct stock</button>
        </div>
      ) : (
        <div className="plist">
          {rows.map(({ b, z, v, p, m }) => (
            <motion.div key={b.id} className="card" whileTap={{ scale: 0.995 }}
              onClick={() => openReconcile(b)} style={{ cursor: 'pointer' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontFamily: 'Fraunces,serif', fontSize: 16, fontWeight: 600 }}>
                    {p?.name || '—'} <span className="muted" style={{ fontSize: 13 }}>· {v?.name} · {z?.size}</span>
                  </div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 3 }}>
                    {new Date(b.created_at).toLocaleDateString()} {b.note ? '· ' + b.note : ''}
                  </div>
                </div>
                <span className="badge">Out {m.deducted}</span>
              </div>
              <hr className="hr" />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, textAlign: 'center' }}>
                <Mini k="Sold" v={m.sold} c="g" />
                <Mini k="Returned" v={m.returned} />
                <Mini k="Faulty" v={m.unusable} c="r" />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, fontSize: 13.5 }}>
                <span className="muted">Revenue <b style={{ color: 'var(--text)' }}>{m.revenue.toFixed(2)}</b></span>
                <span className="muted">Profit <b style={{ color: m.profit >= 0 ? 'var(--green)' : 'var(--red)' }}>{m.profit.toFixed(2)}</b></span>
              </div>
            </motion.div>
          ))}
        </div>
      )}
      <div style={{ height: 20 }} />

      {/* ---- deduct wizard ---- */}
      <Sheet open={open} onClose={() => setOpen(false)}>
        <h2 style={{ fontSize: 22, marginBottom: 4 }}>{mode === 'add' ? 'Add stock' : 'Deduct stock'}</h2>
        <div className="muted" style={{ marginBottom: 16 }}>Step {step} of 3</div>

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div key="s1" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}>
              <label className="label">Pick product</label>
              <div className="plist">
                {products.map((p) => (
                  <div key={p.id} className={'pcard' + (pid === p.id ? '' : '')}
                    style={{ borderColor: pid === p.id ? 'var(--accent)' : 'var(--line)' }}
                    onClick={() => { setPid(p.id); setVid(''); setZid('') }}>
                    {p.image_url ? <img className="thumb" src={p.image_url} alt="" />
                      : <div className="thumb ph">{p.name?.[0]?.toUpperCase()}</div>}
                    <div className="name">{p.name}</div>
                  </div>
                ))}
              </div>
              <button className="btn primary" style={{ marginTop: 14 }} disabled={!pid}
                onClick={() => setStep(2)}>Next</button>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="s2" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}>
              <label className="label">Pick variant</label>
              <div className="chips" style={{ marginBottom: 16 }}>
                {variantsOf(pid).map((v) => (
                  <div key={v.id} className={'chip' + (vid === v.id ? ' on' : '')}
                    onClick={() => { setVid(v.id); setZid('') }}>{v.name}</div>
                ))}
              </div>
              {vid && (<>
                <label className="label">Pick size</label>
                <div className="chips">
                  {sizesOf(vid).map((z) => (
                    <div key={z.id} className={'chip' + (zid === z.id ? ' on' : '')}
                      onClick={() => setZid(z.id)}>{z.size} · {z.stock}</div>
                  ))}
                </div>
              </>)}
              <div className="row" style={{ marginTop: 18 }}>
                <button className="btn ghost" onClick={() => setStep(1)}>Back</button>
                <button className="btn primary" disabled={!zid} onClick={() => setStep(3)}>Next</button>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div key="s3" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}>
              <div className="card" style={{ marginBottom: 16 }}>
                <div className="muted" style={{ fontSize: 13 }}>{variant?.name} · {size?.size}</div>
                <div style={{ fontFamily: 'Fraunces,serif', fontSize: 18, marginTop: 4 }}>In stock: {size?.stock}</div>
              </div>
              <label className="label">{mode === 'add' ? 'Quantity to add' : 'Quantity to take out'}</label>
              <Stepper value={deduct} onChange={setDeduct} max={mode === 'add' ? undefined : size?.stock} />
              {mode === 'add' && (
                <div className="muted" style={{ fontSize: 12.5, marginTop: 8 }}>
                  New total: {(size?.stock || 0) + deduct}
                </div>
              )}
              {mode === 'deduct' && (
                <div className="field" style={{ marginTop: 16 }}>
                  <label className="label">Note (optional)</label>
                  <input className="input" placeholder="e.g. Market stall — Saturday" value={note}
                    onChange={(e) => setNote(e.target.value)} />
                </div>
              )}
              <div className="row" style={{ marginTop: mode === 'add' ? 18 : 0 }}>
                <button className="btn ghost" onClick={() => setStep(2)}>Back</button>
                <button className="btn primary" onClick={mode === 'add' ? confirmAdd : confirmDeduct}>
                  {mode === 'add' ? `Add ${deduct}` : `Deduct ${deduct}`}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Sheet>

      {/* ---- reconcile sheet ---- */}
      <Sheet open={recOpen} onClose={() => setRecOpen(false)}>
        {recBatch && (() => {
          const z = sizes.find((x) => x.id === recBatch.variant_size_id)
          const v = z && variants.find((x) => x.id === z.variant_id)
          const p = v && products.find((x) => x.id === v.product_id)
          const sold = Math.max(0, recBatch.deducted - ret - unus)
          const m = batchMath({ ...recBatch, returned: ret, unusable: unus }, z, v, p)
          return (
            <>
              <h2 style={{ fontSize: 22, marginBottom: 4 }}>Reconcile batch</h2>
              <div className="muted" style={{ marginBottom: 16 }}>
                {v?.name} · {z?.size} · {recBatch.deducted} taken out
              </div>

              <label className="label">Returned (unsold, back to stock)</label>
              <Stepper value={ret} onChange={setRet} max={recBatch.deducted - unus} />
              <label className="label" style={{ marginTop: 14 }}>Unusable / faulty</label>
              <Stepper value={unus} onChange={setUnus} max={recBatch.deducted - ret} />

              <div className="card" style={{ marginTop: 18, background: 'var(--surface)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <Calc k="Sold" v={sold} />
                  <Calc k="Revenue" v={m.revenue.toFixed(2)} />
                  <Calc k="Pay provider" v={m.providerPay.toFixed(2)} />
                  <Calc k="Profit" v={m.profit.toFixed(2)} accent={m.profit >= 0 ? 'g' : 'r'} />
                </div>
              </div>

              <div className="row" style={{ marginTop: 18 }}>
                <button className="btn danger" onClick={async () => {
                  if (!confirm('Delete this movement? Stock will be restored.')) return
                  const zz = getState().sizes.find((x) => x.id === recBatch.variant_size_id)
                  const restore = recBatch.deducted - (recBatch.returned || 0)
                  if (zz) await db.updateSize(zz.id, { stock: (zz.stock || 0) + restore })
                  await db.deleteBatch(recBatch.id); setRecOpen(false); toast('Deleted')
                }}>Delete</button>
                <button className="btn primary" onClick={saveReconcile}>Save</button>
              </div>
            </>
          )
        })()}
      </Sheet>
    </>
  )
}

const Mini = ({ k, v, c }) => (
  <div>
    <div style={{ fontFamily: 'Fraunces,serif', fontSize: 22, fontWeight: 600 }} className={c ? 'v ' + c : ''}>
      <span style={{ color: c === 'g' ? 'var(--green)' : c === 'r' ? 'var(--red)' : 'var(--text)' }}>{v}</span>
    </div>
    <div className="muted" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em' }}>{k}</div>
  </div>
)
const Calc = ({ k, v, accent }) => (
  <div>
    <div className="muted" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em' }}>{k}</div>
    <div style={{ fontFamily: 'Fraunces,serif', fontSize: 22, fontWeight: 600, marginTop: 3,
      color: accent === 'g' ? 'var(--green)' : accent === 'r' ? 'var(--red)' : 'var(--text)' }}>{v}</div>
  </div>
)
