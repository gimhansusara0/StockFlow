import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useStore, db } from '../hooks/store'
import { Ico } from '../components/Icons'
import { useToast, Sheet } from '../components/UI'

export default function CollectionDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const toast = useToast()
  const collection = useStore((s) => s.collections.find((c) => c.id === id))
  const products = useStore((s) => s.products)
  const variants = useStore((s) => s.variants)
  const sizes = useStore((s) => s.sizes)

  const [pickOpen, setPickOpen] = useState(false)

  if (!collection) return <div className="spin" />
  const inColl = products.filter((p) => p.collection_id === id)
  const loose = products.filter((p) => !p.collection_id)

  const stockOf = (pid) => {
    const vIds = variants.filter((v) => v.product_id === pid).map((v) => v.id)
    return sizes.filter((z) => vIds.includes(z.variant_id)).reduce((a, z) => a + (z.stock || 0), 0)
  }

  const addToColl = async (pid) => { await db.updateProduct(pid, { collection_id: id }); toast('Added') }
  const removeFromColl = async (pid) => { await db.updateProduct(pid, { collection_id: null }); toast('Removed') }
  const deleteColl = async () => {
    if (!confirm('Delete collection? Items inside will be kept (uncategorised).')) return
    await db.deleteCollection(id); nav('/')
  }

  return (
    <>
      <header className="head" style={{ alignItems: 'center' }}>
        <button className="icon-btn" onClick={() => nav(-1)}><Ico.back /></button>
        <button className="icon-btn" style={{ color: 'var(--red)' }} onClick={deleteColl}><Ico.trash /></button>
      </header>

      <div className="eyebrow">Collection</div>
      <h1 className="display" style={{ marginBottom: 6 }}>{collection.name}</h1>
      <div className="muted" style={{ marginBottom: 20 }}>{inColl.length} item{inColl.length !== 1 ? 's' : ''}</div>

      {inColl.length === 0 ? (
        <div className="empty"><div className="big">Empty collection</div><div>Add items below.</div></div>
      ) : (
        <div className="plist">
          {inColl.map((p) => (
            <motion.div key={p.id} className="pcard" whileTap={{ scale: 0.99 }}>
              {p.image_url ? <img className="thumb" src={p.image_url} alt="" />
                : <div className="thumb ph">{p.name?.[0]?.toUpperCase()}</div>}
              <div style={{ flex: 1 }} onClick={() => nav('/product/' + p.id)}>
                <div className="name">{p.name}</div>
                <div className="meta">{stockOf(p.id)} in stock</div>
              </div>
              <button className="btn sm ghost" onClick={() => removeFromColl(p.id)}>Remove</button>
            </motion.div>
          ))}
        </div>
      )}

      <div style={{ height: 16 }} />
      <button className="btn" onClick={() => setPickOpen(true)}><Ico.plus /> Add items to collection</button>
      <div style={{ height: 20 }} />

      <Sheet open={pickOpen} onClose={() => setPickOpen(false)}>
        <h2 style={{ fontSize: 22, marginBottom: 16 }}>Add items</h2>
        {loose.length === 0 ? (
          <p className="muted" style={{ padding: '20px 0' }}>All items are already in collections.</p>
        ) : (
          <div className="plist">
            {loose.map((p) => (
              <div key={p.id} className="pcard">
                {p.image_url ? <img className="thumb" src={p.image_url} alt="" />
                  : <div className="thumb ph">{p.name?.[0]?.toUpperCase()}</div>}
                <div style={{ flex: 1 }}>
                  <div className="name">{p.name}</div>
                  <div className="meta">{stockOf(p.id)} in stock</div>
                </div>
                <button className="btn sm primary" onClick={() => addToColl(p.id)}>Add</button>
              </div>
            ))}
          </div>
        )}
      </Sheet>
    </>
  )
}
