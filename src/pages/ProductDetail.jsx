import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useProductTree, useStore, db, resolvePrice } from '../hooks/store'
import { Ico } from '../components/Icons'
import { useToast, Sheet } from '../components/UI'

export default function ProductDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const toast = useToast()
  const { product, variants } = useProductTree(id)
  const collections = useStore((s) => s.collections)
  const [moveOpen, setMoveOpen] = useState(false)

  if (!product) return <div className="spin" />
  const collection = collections.find((c) => c.id === product.collection_id)
  const totalStock = variants.reduce((a, v) => a + v.sizes.reduce((b, z) => b + (z.stock || 0), 0), 0)

  const remove = async () => {
    if (!confirm('Delete this product and all its variants?')) return
    await db.deleteProduct(id); toast('Deleted'); nav('/')
  }
  const moveTo = async (cid) => {
    await db.updateProduct(id, { collection_id: cid })
    setMoveOpen(false)
    toast(cid ? 'Moved to collection' : 'Removed from collection')
  }

  return (
    <>
      <header className="head" style={{ alignItems: 'center' }}>
        <button className="icon-btn" onClick={() => nav(-1)}><Ico.back /></button>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="icon-btn" onClick={() => setMoveOpen(true)} aria-label="Move to collection"><Ico.move /></button>
          <button className="icon-btn" onClick={() => nav('/edit/' + id)}><Ico.edit /></button>
          <button className="icon-btn" style={{ color: 'var(--red)' }} onClick={remove}><Ico.trash /></button>
        </div>
      </header>

      {product.image_url && (
        <img src={product.image_url} alt="" style={{ width: '100%', height: 220, objectFit: 'cover', borderRadius: 18, marginBottom: 16 }} />
      )}
      {collection && (
        <div className="eyebrow" style={{ marginBottom: 6, cursor: 'pointer' }}
          onClick={() => nav('/collection/' + collection.id)}>{collection.name}</div>
      )}
      <h1 className="display" style={{ marginBottom: 8 }}>{product.name}</h1>
      {product.description && <p className="muted" style={{ marginBottom: 14 }}>{product.description}</p>}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        <span className="badge">{variants.length} variant{variants.length !== 1 ? 's' : ''}</span>
        <span className="badge">{totalStock} in stock</span>
        {(product.buying_price > 0 || product.selling_price > 0) && (
          <span className="badge">Global {Number(product.buying_price).toFixed(2)} / {Number(product.selling_price).toFixed(2)}</span>
        )}
      </div>

      {variants.map((v) => {
        const vStock = v.sizes.reduce((a, z) => a + (z.stock || 0), 0)
        const priceLabel = () => {
          if (v.same_buy && v.same_sell) {
            const { buy, sell } = resolvePrice(v.sizes[0] || {}, v, product)
            return `Buy ${buy.toFixed(2)} · Sell ${sell.toFixed(2)}`
          }
          return 'Price varies by size'
        }
        return (
          <div className="card" key={v.id}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              {v.image_url
                ? <img src={v.image_url} alt="" style={{ width: 52, height: 52, borderRadius: 12, objectFit: 'cover' }} />
                : <div className="thumb ph" style={{ width: 52, height: 52, fontSize: 18 }}>{v.name?.[0]}</div>}
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'Fraunces,serif', fontSize: 17, fontWeight: 600 }}>{v.name}</div>
                <div className="muted" style={{ fontSize: 12.5 }}>{priceLabel()}</div>
              </div>
              <span className="badge">{vStock}</span>
            </div>
            {v.sizes.length > 0 && (
              <div style={{ marginTop: 12, display: 'grid', gap: 6 }}>
                {v.sizes.map((z) => {
                  const { buy, sell } = resolvePrice(z, v, product)
                  return (
                    <div key={z.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '7px 11px', background: 'var(--bg-2)', borderRadius: 10, fontSize: 13 }}>
                      <span style={{ fontWeight: 600, width: 48 }}>{z.size}</span>
                      <span className="muted" style={{ flex: 1 }}>×{z.stock} in stock</span>
                      <span className="muted" style={{ fontSize: 12 }}>{buy.toFixed(2)} / {sell.toFixed(2)}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}

      <div style={{ height: 16 }} />
      <button className="btn" onClick={() => nav('/stock')}><Ico.scale /> Manage stock movements</button>
      <div style={{ height: 20 }} />

      {/* move to collection */}
      <Sheet open={moveOpen} onClose={() => setMoveOpen(false)}>
        <h2 style={{ fontSize: 22, marginBottom: 16 }}>Move to collection</h2>
        <div className="plist">
          <div className={'pcard' + (!product.collection_id ? '' : '')}
            style={{ borderColor: !product.collection_id ? 'var(--accent)' : 'var(--line)' }}
            onClick={() => moveTo(null)}>
            <div className="thumb ph">—</div>
            <div style={{ flex: 1 }}><div className="name">No collection</div>
              <div className="meta">Uncategorised</div></div>
          </div>
          {collections.map((c) => (
            <div key={c.id} className="pcard"
              style={{ borderColor: product.collection_id === c.id ? 'var(--accent)' : 'var(--line)' }}
              onClick={() => moveTo(c.id)}>
              <div className="thumb ph" style={{ background: 'linear-gradient(135deg,#232329,#1b1b20)' }}>❏</div>
              <div style={{ flex: 1 }}><div className="name">{c.name}</div>
                <div className="meta">Collection</div></div>
              {product.collection_id === c.id && <span className="badge">Current</span>}
            </div>
          ))}
        </div>
        {collections.length === 0 && (
          <p className="muted" style={{ padding: '16px 0', textAlign: 'center' }}>
            No collections yet — create one from the Items tab.
          </p>
        )}
      </Sheet>
    </>
  )
}
