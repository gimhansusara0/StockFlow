import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useSearch } from '../hooks/store'

export default function Search() {
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const { collections, products, variants } = useSearch(q)
  const empty = q.trim() && !collections.length && !products.length && !variants.length

  return (
    <>
      <header className="head">
        <div>
          <div className="eyebrow">Search</div>
          <h1 className="display">Find anything</h1>
        </div>
      </header>

      <div style={{ position: 'relative', marginBottom: 18 }}>
        <input className="input" autoFocus placeholder="Products, variants, collections…"
          value={q} onChange={(e) => setQ(e.target.value)} style={{ paddingLeft: 44 }} />
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
          style={{ position: 'absolute', left: 15, top: 15, color: 'var(--text-faint)' }}>
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.6" />
          <path d="m20 20-3-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </div>

      {!q.trim() && <p className="muted" style={{ textAlign: 'center', padding: '40px 0' }}>Start typing to search.</p>}
      {empty && <div className="empty"><div className="big">No matches</div><div>Try a different term.</div></div>}

      {collections.length > 0 && <>
        <div className="muted" style={{ margin: '4px 2px 8px', fontWeight: 600 }}>Collections</div>
        <div className="plist" style={{ marginBottom: 18 }}>
          {collections.map((c) => (
            <Row key={c.id} title={c.name} sub="Collection" onClick={() => nav('/collection/' + c.id)} ph="❏" />
          ))}
        </div>
      </>}

      {products.length > 0 && <>
        <div className="muted" style={{ margin: '4px 2px 8px', fontWeight: 600 }}>Products</div>
        <div className="plist" style={{ marginBottom: 18 }}>
          {products.map((p) => (
            <Row key={p.id} title={p.name} sub="Product" img={p.image_url}
              onClick={() => nav('/product/' + p.id)} ph={p.name?.[0]?.toUpperCase()} />
          ))}
        </div>
      </>}

      {variants.length > 0 && <>
        <div className="muted" style={{ margin: '4px 2px 8px', fontWeight: 600 }}>Variants</div>
        <div className="plist">
          {variants.map((v) => (
            <Row key={v.id} title={v.name} sub={v.product?.name || 'Variant'} img={v.image_url}
              onClick={() => v.product && nav('/product/' + v.product.id)} ph={v.name?.[0]?.toUpperCase()} />
          ))}
        </div>
      </>}
      <div style={{ height: 20 }} />
    </>
  )
}

const Row = ({ title, sub, img, ph, onClick }) => (
  <motion.div className="pcard" whileTap={{ scale: 0.99 }} onClick={onClick}>
    {img ? <img className="thumb" src={img} alt="" /> : <div className="thumb ph">{ph || '?'}</div>}
    <div style={{ flex: 1 }}>
      <div className="name">{title}</div>
      <div className="meta">{sub}</div>
    </div>
  </motion.div>
)
