import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useStore, db, getState } from '../hooks/store'
import { Ico } from '../components/Icons'
import { ImagePicker, useToast, Stepper, Check } from '../components/UI'

const SIZE_PRESETS = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL']

const blankVariant = () => ({
  _key: Math.random().toString(36).slice(2),
  id: null, name: '', image_url: '',
  same_buy: false, same_sell: false,
  buying_price: '', selling_price: '',
  sizes: [], // { _key, id, size, stock, buying_price, selling_price }
})

export default function ProductForm() {
  const nav = useNavigate()
  const toast = useToast()
  const { id } = useParams()
  const editing = !!id
  const collections = useStore((s) => s.collections)

  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [image, setImage] = useState('')
  const [collectionId, setCollectionId] = useState('')
  const [gBuy, setGBuy] = useState('')   // global product prices (fallback)
  const [gSell, setGSell] = useState('')
  const [variants, setVariants] = useState([blankVariant()])
  const [saving, setSaving] = useState(false)

  // hydrate when editing
  useEffect(() => {
    if (!editing) return
    const s = getState()
    const p = s.products.find((x) => x.id === id)
    if (!p) return
    setName(p.name); setDesc(p.description || ''); setImage(p.image_url || '')
    setCollectionId(p.collection_id || '')
    setGBuy(p.buying_price ? String(p.buying_price) : '')
    setGSell(p.selling_price ? String(p.selling_price) : '')
    const vs = s.variants.filter((v) => v.product_id === id).map((v) => ({
      _key: v.id, id: v.id, name: v.name, image_url: v.image_url || '',
      same_buy: v.same_buy ?? true, same_sell: v.same_sell ?? true,
      buying_price: v.buying_price ? String(v.buying_price) : '',
      selling_price: v.selling_price ? String(v.selling_price) : '',
      sizes: s.sizes.filter((z) => z.variant_id === v.id)
        .map((z) => ({
          _key: z.id, id: z.id, size: z.size, stock: z.stock,
          buying_price: z.buying_price ? String(z.buying_price) : '',
          selling_price: z.selling_price ? String(z.selling_price) : '',
        })),
    }))
    setVariants(vs.length ? vs : [blankVariant()])
  }, [editing, id])

  const setVar = (key, patch) =>
    setVariants((vs) => vs.map((v) => (v._key === key ? { ...v, ...patch } : v)))

  const toggleSize = (vKey, size) => {
    setVariants((vs) => vs.map((v) => {
      if (v._key !== vKey) return v
      const has = v.sizes.find((z) => z.size === size)
      return {
        ...v,
        sizes: has
          ? v.sizes.filter((z) => z.size !== size)
          : [...v.sizes, { _key: Math.random().toString(36).slice(2), id: null, size, stock: 0, buying_price: '', selling_price: '' }],
      }
    }))
  }
  const setSize = (vKey, sKey, patch) =>
    setVariants((vs) => vs.map((v) => v._key !== vKey ? v : {
      ...v, sizes: v.sizes.map((z) => z._key === sKey ? { ...z, ...patch } : z),
    }))

  const save = async () => {
    if (!name.trim()) return toast('Add a product name')
    if (!variants.some((v) => v.name.trim())) return toast('Add at least one variant')
    setSaving(true)
    try {
      const payload = {
        name: name.trim(), description: desc.trim() || null,
        image_url: image || null, collection_id: collectionId || null,
        buying_price: parseFloat(gBuy) || 0, selling_price: parseFloat(gSell) || 0,
      }
      const product = editing
        ? await db.updateProduct(id, payload)
        : await db.addProduct(payload)

      const s = getState()
      const existingVarIds = editing ? s.variants.filter((v) => v.product_id === id).map((v) => v.id) : []
      const keptVarIds = []

      for (const v of variants) {
        if (!v.name.trim()) continue
        const vPayload = {
          product_id: product.id, name: v.name.trim(), image_url: v.image_url || null,
          same_buy: v.same_buy, same_sell: v.same_sell,
          buying_price: v.same_buy ? (parseFloat(v.buying_price) || 0) : 0,
          selling_price: v.same_sell ? (parseFloat(v.selling_price) || 0) : 0,
        }
        const variant = v.id
          ? await db.updateVariant(v.id, vPayload)
          : await db.addVariant(vPayload)
        keptVarIds.push(variant.id)

        const existingSizes = editing ? getState().sizes.filter((z) => z.variant_id === variant.id) : []
        const keptSizeIds = []
        for (const z of v.sizes) {
          const zPayload = {
            variant_id: variant.id, size: z.size, stock: parseInt(z.stock, 10) || 0,
            buying_price: v.same_buy ? 0 : (parseFloat(z.buying_price) || 0),
            selling_price: v.same_sell ? 0 : (parseFloat(z.selling_price) || 0),
          }
          const saved = z.id ? await db.updateSize(z.id, zPayload) : await db.addSize(zPayload)
          keptSizeIds.push(saved.id)
        }
        for (const z of existingSizes) if (!keptSizeIds.includes(z.id)) await db.deleteSize(z.id)
      }
      for (const vid of existingVarIds) if (!keptVarIds.includes(vid)) await db.deleteVariant(vid)

      toast(editing ? 'Saved' : 'Product added')
      nav('/product/' + product.id, { replace: true })
    } catch (e) {
      toast('Something went wrong')
      setSaving(false)
    }
  }

  return (
    <>
      <header className="head" style={{ alignItems: 'center' }}>
        <button className="icon-btn" onClick={() => nav(-1)}><Ico.back /></button>
        <h1 style={{ fontSize: 22 }}>{editing ? 'Edit product' : 'New product'}</h1>
        <div style={{ width: 42 }} />
      </header>

      <div className="card">
        <div className="field"><label className="label">Product photo</label>
          <ImagePicker value={image} onChange={setImage} />
        </div>
        <div className="field"><label className="label">Name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Oversized Tee" />
        </div>
        <div className="field"><label className="label">Description (optional)</label>
          <textarea className="textarea" value={desc} onChange={(e) => setDesc(e.target.value)}
            placeholder="Fabric, fit, notes…" />
        </div>
        <div className="row">
          <div><label className="label">Global buy price</label>
            <input className="input" inputMode="decimal" placeholder="0.00"
              value={gBuy} onChange={(e) => setGBuy(e.target.value)} />
          </div>
          <div><label className="label">Global sell price</label>
            <input className="input" inputMode="decimal" placeholder="0.00"
              value={gSell} onChange={(e) => setGSell(e.target.value)} />
          </div>
        </div>
        <div className="muted" style={{ fontSize: 11.5, marginTop: 8 }}>
          Used as a fallback when a variant or size has no price of its own.
        </div>
        <div className="field" style={{ marginTop: 14 }}><label className="label">Collection (optional)</label>
          <select className="select" value={collectionId} onChange={(e) => setCollectionId(e.target.value)}>
            <option value="">— None —</option>
            {collections.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '22px 2px 4px' }}>
        <div className="eyebrow">Variants</div>
        <span className="muted" style={{ fontSize: 12 }}>colour / print</span>
      </div>

      {variants.map((v) => (
        <div className="varblock" key={v._key}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <ImagePicker value={v.image_url} onChange={(url) => setVar(v._key, { image_url: url })} small />
            <div style={{ flex: 1 }}>
              <input className="input" placeholder="Variant name (e.g. Blue Dragon)"
                value={v.name} onChange={(e) => setVar(v._key, { name: e.target.value })} />
            </div>
            {variants.length > 1 && (
              <button className="icon-btn" style={{ color: 'var(--red)' }}
                onClick={() => setVariants((vs) => vs.filter((x) => x._key !== v._key))}>
                <Ico.trash />
              </button>
            )}
          </div>

          {/* pricing mode */}
          <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
            <Check label="Buy price same for all sizes" checked={v.same_buy}
              onChange={(c) => setVar(v._key, { same_buy: c })} />
            <Check label="Sell price same for all sizes" checked={v.same_sell}
              onChange={(c) => setVar(v._key, { same_sell: c })} />
          </div>

          {/* shared prices show only when "same" is on */}
          {(v.same_buy || v.same_sell) && (
            <div className="row" style={{ marginTop: 12 }}>
              {v.same_buy && (
                <div><label className="label">Buy price (all sizes)</label>
                  <input className="input" inputMode="decimal" placeholder="0.00"
                    value={v.buying_price} onChange={(e) => setVar(v._key, { buying_price: e.target.value })} />
                </div>
              )}
              {v.same_sell && (
                <div><label className="label">Sell price (all sizes)</label>
                  <input className="input" inputMode="decimal" placeholder="0.00"
                    value={v.selling_price} onChange={(e) => setVar(v._key, { selling_price: e.target.value })} />
                </div>
              )}
            </div>
          )}

          <label className="label" style={{ marginTop: 14 }}>Sizes</label>
          <div className="chips">
            {SIZE_PRESETS.map((s) => (
              <div key={s} className={'chip' + (v.sizes.find((z) => z.size === s) ? ' on' : '')}
                onClick={() => toggleSize(v._key, s)}>{s}</div>
            ))}
          </div>

          {v.sizes.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <label className="label">Per-size details</label>
              {v.sizes.map((z) => (
                <div key={z._key} className="card" style={{ background: 'var(--surface)', padding: 12, marginBottom: 10 }}>
                  <div className="size-row" style={{ marginTop: 0 }}>
                    <span className="sz badge" style={{ textAlign: 'center' }}>{z.size}</span>
                    <Stepper value={z.stock} onChange={(n) => setSize(v._key, z._key, { stock: n })} />
                  </div>
                  {(!v.same_buy || !v.same_sell) && (
                    <div className="row" style={{ marginTop: 10 }}>
                      {!v.same_buy && (
                        <div><label className="label">Buy</label>
                          <input className="input" inputMode="decimal" placeholder="0.00"
                            value={z.buying_price} onChange={(e) => setSize(v._key, z._key, { buying_price: e.target.value })} />
                        </div>
                      )}
                      {!v.same_sell && (
                        <div><label className="label">Sell</label>
                          <input className="input" inputMode="decimal" placeholder="0.00"
                            value={z.selling_price} onChange={(e) => setSize(v._key, z._key, { selling_price: e.target.value })} />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      <button className="btn ghost" style={{ marginTop: 12 }}
        onClick={() => setVariants((vs) => [...vs, blankVariant()])}>
        <Ico.plus /> Add another variant
      </button>

      <div style={{ height: 18 }} />
      <button className="btn primary" disabled={saving} onClick={save}>
        {saving ? 'Saving…' : editing ? 'Save changes' : 'Add product'}
      </button>
      <div style={{ height: 20 }} />
    </>
  )
}
