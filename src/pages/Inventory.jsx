import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useStore, db } from '../hooks/store'
import { Ico } from '../components/Icons'
import { Sheet, useToast } from '../components/UI'

export default function Inventory() {
  const nav = useNavigate()
  const toast = useToast()
  const loaded = useStore((s) => s.loaded)
  const collections = useStore((s) => s.collections)
  const products = useStore((s) => s.products)
  const variants = useStore((s) => s.variants)
  const sizes = useStore((s) => s.sizes)

  const [menu, setMenu] = useState(false)
  const [collOpen, setCollOpen] = useState(false)
  const [collName, setCollName] = useState('')

  const looseProducts = products.filter((p) => !p.collection_id)

  const stockOf = (pid) => {
    const vIds = variants.filter((v) => v.product_id === pid).map((v) => v.id)
    return sizes.filter((z) => vIds.includes(z.variant_id)).reduce((a, z) => a + (z.stock || 0), 0)
  }
  const variantCount = (pid) => variants.filter((v) => v.product_id === pid).length
  const collCount = (cid) => products.filter((p) => p.collection_id === cid).length

  const createCollection = async () => {
    if (!collName.trim()) return
    await db.addCollection({ name: collName.trim() })
    setCollName(''); setCollOpen(false); toast('Collection created')
  }

  return (
    <>
      <header className="head">
        <div>
          <div className="eyebrow">Inventory</div>
          <h1 className="display">Your items</h1>
        </div>
        <button className="icon-btn" onClick={() => setMenu(true)} aria-label="Add">
          <Ico.plus style={{ color: 'var(--accent)' }} />
        </button>
      </header>

      {!loaded && products.length === 0 ? (
        <div className="spin" />
      ) : (
        <>
          {collections.length > 0 && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '4px 2px 10px' }}>
                <span className="muted" style={{ fontWeight: 600 }}>Collections</span>
                <button className="btn sm ghost" onClick={() => setCollOpen(true)}>
                  <Ico.plus /> New
                </button>
              </div>
              <div className="plist" style={{ marginBottom: 22 }}>
                {collections.map((c) => (
                  <motion.div key={c.id} className="pcard" whileTap={{ scale: 0.99 }}
                    onClick={() => nav('/collection/' + c.id)}>
                    <div className="thumb ph" style={{ background: 'linear-gradient(135deg,#232329,#1b1b20)' }}>❏</div>
                    <div style={{ flex: 1 }}>
                      <div className="name">{c.name}</div>
                      <div className="meta">{collCount(c.id)} item{collCount(c.id) !== 1 ? 's' : ''}</div>
                    </div>
                    <span className="badge">Collection</span>
                  </motion.div>
                ))}
              </div>
            </>
          )}

          <div className="muted" style={{ margin: '4px 2px 10px', fontWeight: 600 }}>Items</div>
          {looseProducts.length === 0 && collections.length === 0 ? (
            <div className="empty">
              <div className="big">Nothing here yet</div>
              <div>Add your first product to get started.</div>
              <button className="btn primary" style={{ marginTop: 18, maxWidth: 220, marginInline: 'auto' }}
                onClick={() => nav('/new')}>Add product</button>
            </div>
          ) : (
            <div className="plist">
              {looseProducts.map((p) => (
                <motion.div key={p.id} className="pcard" whileTap={{ scale: 0.99 }}
                  onClick={() => nav('/product/' + p.id)}>
                  {p.image_url
                    ? <img className="thumb" src={p.image_url} alt="" />
                    : <div className="thumb ph">{p.name?.[0]?.toUpperCase() || '?'}</div>}
                  <div style={{ flex: 1 }}>
                    <div className="name">{p.name}</div>
                    <div className="meta">{variantCount(p.id)} variant{variantCount(p.id) !== 1 ? 's' : ''} · {stockOf(p.id)} in stock</div>
                  </div>
                  <Ico.back style={{ transform: 'rotate(180deg)', color: 'var(--text-faint)' }} />
                </motion.div>
              ))}
            </div>
          )}
        </>
      )}

      {/* add menu */}
      <Sheet open={menu} onClose={() => setMenu(false)}>
        <h2 style={{ fontSize: 22, marginBottom: 16 }}>Add new</h2>
        <button className="btn primary" onClick={() => { setMenu(false); nav('/new') }}>
          <Ico.box /> New product
        </button>
        <div style={{ height: 10 }} />
        <button className="btn" onClick={() => { setMenu(false); setCollOpen(true) }}>
          ❏ New collection
        </button>
      </Sheet>

      {/* new collection */}
      <Sheet open={collOpen} onClose={() => setCollOpen(false)}>
        <h2 style={{ fontSize: 22, marginBottom: 16 }}>New collection</h2>
        <div className="field">
          <label className="label">Collection name</label>
          <input className="input" placeholder="e.g. Summer 2026" value={collName}
            onChange={(e) => setCollName(e.target.value)} autoFocus />
        </div>
        <button className="btn primary" onClick={createCollection}>Create</button>
      </Sheet>
    </>
  )
}
