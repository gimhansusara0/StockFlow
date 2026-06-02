import { useState, useEffect, useMemo, useCallback, useSyncExternalStore } from 'react'
import { supabase, BUCKET } from '../lib/supabase'

/* ------------------------------------------------------------------
   Tiny global store.
   - In-memory cache (instant reads)
   - Persisted to localStorage (instant cold-start, offline-ish)
   - Realtime: Supabase postgres_changes keep cache live across devices
   - Refetch only happens on mount-once or after a mutation/realtime event
-------------------------------------------------------------------*/

const LS_KEY = 'stockflow.cache.v1'

let state = {
  collections: [],
  products: [],
  variants: [],
  sizes: [],
  batches: [],
  loaded: false,
}

// hydrate from localStorage for instant first paint
try {
  const cached = JSON.parse(localStorage.getItem(LS_KEY) || 'null')
  if (cached) state = { ...state, ...cached, loaded: false }
} catch {}

const listeners = new Set()
const emit = () => {
  // persist (skip the loaded flag noise)
  try { localStorage.setItem(LS_KEY, JSON.stringify({ ...state, loaded: undefined })) } catch {}
  listeners.forEach((l) => l())
}
const setState = (patch) => { state = { ...state, ...patch }; emit() }
const getState = () => state
const subscribe = (cb) => { listeners.add(cb); return () => listeners.delete(cb) }

export function useStore(selector = (s) => s) {
  return useSyncExternalStore(subscribe, () => selector(getState()), () => selector(getState()))
}

/* ---------------- fetch all ---------------- */
let inflight = null
export async function fetchAll(force = false) {
  if (state.loaded && !force) return
  if (inflight) return inflight
  inflight = (async () => {
    const [c, p, v, s, b] = await Promise.all([
      supabase.from('collections').select('*').order('created_at', { ascending: false }),
      supabase.from('products').select('*').order('created_at', { ascending: false }),
      supabase.from('variants').select('*').order('created_at', { ascending: true }),
      supabase.from('variant_sizes').select('*').order('created_at', { ascending: true }),
      supabase.from('batches').select('*').order('created_at', { ascending: false }),
    ])
    setState({
      collections: c.data || [],
      products: p.data || [],
      variants: v.data || [],
      sizes: s.data || [],
      batches: b.data || [],
      loaded: true,
    })
    inflight = null
  })()
  return inflight
}

/* ---------------- realtime ---------------- */
const TABLE_KEY = {
  collections: 'collections',
  products: 'products',
  variants: 'variants',
  variant_sizes: 'sizes',
  batches: 'batches',
}

let channel = null
export function startRealtime() {
  if (channel) return
  channel = supabase.channel('stockflow-rt')
  Object.keys(TABLE_KEY).forEach((table) => {
    channel.on('postgres_changes', { event: '*', schema: 'public', table }, (payload) => {
      const key = TABLE_KEY[table]
      const list = [...state[key]]
      const row = payload.new?.id ? payload.new : payload.old
      const i = list.findIndex((x) => x.id === row.id)
      if (payload.eventType === 'DELETE') {
        if (i > -1) list.splice(i, 1)
      } else if (payload.eventType === 'INSERT') {
        if (i === -1) list.unshift(payload.new)
      } else if (payload.eventType === 'UPDATE') {
        if (i > -1) list[i] = payload.new; else list.push(payload.new)
      }
      setState({ [key]: list })
    })
  })
  channel.subscribe()
}
export function stopRealtime() {
  if (channel) { supabase.removeChannel(channel); channel = null }
}

/* ---------------- optimistic helpers ---------------- */
// We mutate the cache immediately, then write to Supabase. Realtime echoes
// the authoritative row back (idempotent merge above), so all clients stay synced.

function localUpsert(key, row) {
  const list = [...state[key]]
  const i = list.findIndex((x) => x.id === row.id)
  if (i > -1) list[i] = { ...list[i], ...row }; else list.unshift(row)
  setState({ [key]: list })
}
function localRemove(key, id) {
  setState({ [key]: state[key].filter((x) => x.id !== id) })
}

/* ---------------- image upload ---------------- */
export async function uploadImage(file) {
  if (!file) return null
  const ext = file.name.split('.').pop()
  const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false })
  if (error) throw error
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}

/* ---------------- mutations ---------------- */
export const db = {
  // collections
  async addCollection(payload) {
    const { data, error } = await supabase.from('collections').insert(payload).select().single()
    if (error) throw error; localUpsert('collections', data); return data
  },
  async updateCollection(id, patch) {
    const { data, error } = await supabase.from('collections').update(patch).eq('id', id).select().single()
    if (error) throw error; localUpsert('collections', data); return data
  },
  async deleteCollection(id) {
    localRemove('collections', id)
    const { error } = await supabase.from('collections').delete().eq('id', id)
    if (error) throw error
  },

  // products
  async addProduct(payload) {
    const { data, error } = await supabase.from('products').insert(payload).select().single()
    if (error) throw error; localUpsert('products', data); return data
  },
  async updateProduct(id, patch) {
    const { data, error } = await supabase.from('products').update(patch).eq('id', id).select().single()
    if (error) throw error; localUpsert('products', data); return data
  },
  async deleteProduct(id) {
    localRemove('products', id)
    const { error } = await supabase.from('products').delete().eq('id', id)
    if (error) throw error
  },

  // variants
  async addVariant(payload) {
    const { data, error } = await supabase.from('variants').insert(payload).select().single()
    if (error) throw error; localUpsert('variants', data); return data
  },
  async updateVariant(id, patch) {
    const { data, error } = await supabase.from('variants').update(patch).eq('id', id).select().single()
    if (error) throw error; localUpsert('variants', data); return data
  },
  async deleteVariant(id) {
    localRemove('variants', id)
    const { error } = await supabase.from('variants').delete().eq('id', id)
    if (error) throw error
  },

  // sizes
  async addSize(payload) {
    const { data, error } = await supabase.from('variant_sizes').insert(payload).select().single()
    if (error) throw error; localUpsert('sizes', data); return data
  },
  async updateSize(id, patch) {
    const { data, error } = await supabase.from('variant_sizes').update(patch).eq('id', id).select().single()
    if (error) throw error; localUpsert('sizes', data); return data
  },
  async deleteSize(id) {
    localRemove('sizes', id)
    const { error } = await supabase.from('variant_sizes').delete().eq('id', id)
    if (error) throw error
  },

  // batches (stock movements)
  async addBatch(payload) {
    const { data, error } = await supabase.from('batches').insert(payload).select().single()
    if (error) throw error; localUpsert('batches', data); return data
  },
  async deleteBatch(id) {
    localRemove('batches', id)
    const { error } = await supabase.from('batches').delete().eq('id', id)
    if (error) throw error
  },
}

/* ---------------- selectors / derived ---------------- */
export function useProductTree(productId) {
  const products = useStore((s) => s.products)
  const allVariants = useStore((s) => s.variants)
  const allSizes = useStore((s) => s.sizes)
  return useMemo(() => {
    const product = products.find((p) => p.id === productId)
    const variants = allVariants
      .filter((v) => v.product_id === productId)
      .map((v) => ({ ...v, sizes: allSizes.filter((z) => z.variant_id === v.id) }))
    return { product, variants }
  }, [products, allVariants, allSizes, productId])
}

// Resolve effective buy/sell price for a size, walking size -> variant -> product.
// same_buy/same_sell true  => use variant.buying/selling (shared)
// variant price is 0 and product has one => fall back to product (global)
export function resolvePrice(size, variant, product) {
  const num = (x) => (x == null ? 0 : Number(x))
  let buy, sell
  if (variant?.same_buy) buy = num(variant.buying_price)
  else buy = num(size?.buying_price)
  if (variant?.same_sell) sell = num(variant.selling_price)
  else sell = num(size?.selling_price)
  // global fallback when the resolved price is 0
  if (!buy && product) buy = num(product.buying_price)
  if (!sell && product) sell = num(product.selling_price)
  return { buy, sell }
}

// money + qty math for a single batch row given its size/variant/product pricing
export function batchMath(batch, size, variant, product) {
  const deducted = batch.deducted || 0
  const returned = batch.returned || 0
  const unusable = batch.unusable || 0
  const sold = Math.max(0, deducted - returned - unusable)
  const { buy, sell } = resolvePrice(size, variant, product)
  const revenue = sold * sell
  const cost = sold * buy
  const providerPay = cost // amount owed to the item provider for sold units
  const profit = revenue - cost
  return { deducted, returned, unusable, sold, revenue, cost, providerPay, profit, buy, sell }
}

/* ---------------- global search ---------------- */
const EMPTY_SEARCH = { collections: [], products: [], variants: [] }

export function useSearch(query) {
  const collectionsAll = useStore((s) => s.collections)
  const productsAll = useStore((s) => s.products)
  const variantsAll = useStore((s) => s.variants)
  return useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return EMPTY_SEARCH
    const match = (t) => (t || '').toLowerCase().includes(q)
    const collections = collectionsAll.filter((c) => match(c.name) || match(c.description))
    const variants = variantsAll
      .filter((v) => match(v.name))
      .map((v) => ({ ...v, product: productsAll.find((p) => p.id === v.product_id) }))
    const products = productsAll.filter((p) => match(p.name) || match(p.description))
    return { collections, products, variants }
  }, [query, collectionsAll, productsAll, variantsAll])
}

/* hook: ensure data loaded + realtime running */
export function useBootstrap() {
  const loaded = useStore((s) => s.loaded)
  useEffect(() => {
    fetchAll()
    startRealtime()
    return () => {} // keep realtime alive for app lifetime
  }, [])
  return loaded
}

export { getState }
