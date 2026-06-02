import { useMemo } from 'react'
import * as XLSX from 'xlsx'
import { useStore, batchMath, resolvePrice } from '../hooks/store'
import { Ico } from '../components/Icons'
import { useToast } from '../components/UI'

export default function Analytics() {
  const toast = useToast()
  const products = useStore((s) => s.products)
  const variants = useStore((s) => s.variants)
  const sizes = useStore((s) => s.sizes)
  const batches = useStore((s) => s.batches)

  const data = useMemo(() => {
    let revenue = 0, cost = 0, sold = 0, returned = 0, unusable = 0, deducted = 0
    const rows = batches.map((b) => {
      const z = sizes.find((x) => x.id === b.variant_size_id)
      const v = z && variants.find((x) => x.id === z.variant_id)
      const p = v && products.find((x) => x.id === v.product_id)
      const m = batchMath(b, z, v, p)
      revenue += m.revenue; cost += m.cost; sold += m.sold
      returned += m.returned; unusable += m.unusable; deducted += m.deducted
      return { b, z, v, p, m }
    })
    const profit = revenue - cost
    const stockValue = sizes.reduce((a, z) => {
      const v = variants.find((x) => x.id === z.variant_id)
      const p = v && products.find((x) => x.id === v.product_id)
      const { buy } = resolvePrice(z, v, p)
      return a + (z.stock || 0) * buy
    }, 0)
    const sellThrough = deducted ? Math.round((sold / deducted) * 100) : 0
    const totalStock = sizes.reduce((a, z) => a + (z.stock || 0), 0)
    return { rows, revenue, cost, profit, sold, returned, unusable, deducted, stockValue, sellThrough, totalStock }
  }, [batches, sizes, variants, products])

  const exportXlsx = () => {
    // sheet 1: movements
    const moves = data.rows.map(({ b, p, v, z, m }) => ({
      Date: new Date(b.created_at).toLocaleString(),
      Product: p?.name || '', Variant: v?.name || '', Size: z?.size || '',
      Deducted: m.deducted, Sold: m.sold, Returned: m.returned, Unusable: m.unusable,
      'Buy price': +(m.buy || 0).toFixed(2), 'Sell price': +(m.sell || 0).toFixed(2),
      Revenue: +m.revenue.toFixed(2), 'Pay provider': +m.providerPay.toFixed(2),
      Profit: +m.profit.toFixed(2), Note: b.note || '',
    }))
    // sheet 2: current stock
    const stock = []
    products.forEach((p) => variants.filter((v) => v.product_id === p.id).forEach((v) =>
      sizes.filter((z) => z.variant_id === v.id).forEach((z) => {
        const { buy, sell } = resolvePrice(z, v, p)
        stock.push({
          Product: p.name, Variant: v.name, Size: z.size, Stock: z.stock,
          'Buy price': +buy.toFixed(2), 'Sell price': +sell.toFixed(2),
          'Stock value': +(z.stock * buy).toFixed(2),
        })
      })))
    // sheet 3: summary
    const summary = [
      { Metric: 'Total revenue', Value: +data.revenue.toFixed(2) },
      { Metric: 'Total cost', Value: +data.cost.toFixed(2) },
      { Metric: 'Total profit', Value: +data.profit.toFixed(2) },
      { Metric: 'Units sold', Value: data.sold },
      { Metric: 'Units returned', Value: data.returned },
      { Metric: 'Units unusable', Value: data.unusable },
      { Metric: 'Sell-through %', Value: data.sellThrough },
      { Metric: 'Stock on hand (units)', Value: data.totalStock },
      { Metric: 'Stock value (at cost)', Value: +data.stockValue.toFixed(2) },
    ]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary), 'Summary')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(moves), 'Movements')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(stock), 'Stock')
    XLSX.writeFile(wb, `stockflow-${new Date().toISOString().slice(0, 10)}.xlsx`)
    toast('Excel exported')
  }

  // top sellers
  const topSellers = useMemo(() => {
    const map = {}
    data.rows.forEach(({ v, p, m }) => {
      if (!v) return
      const key = v.id
      map[key] = map[key] || { name: `${p?.name} · ${v.name}`, sold: 0, profit: 0 }
      map[key].sold += m.sold; map[key].profit += m.profit
    })
    return Object.values(map).sort((a, b) => b.sold - a.sold).slice(0, 5)
  }, [data])

  return (
    <>
      <header className="head">
        <div>
          <div className="eyebrow">Insights</div>
          <h1 className="display">Analytics</h1>
        </div>
        <button className="btn sm" onClick={exportXlsx}><Ico.excel /> Excel</button>
      </header>

      <div className="stat-grid" style={{ marginBottom: 12 }}>
        <Stat k="Revenue" v={money(data.revenue)} cls="b" />
        <Stat k="Profit" v={money(data.profit)} cls={data.profit >= 0 ? 'g' : 'r'} />
        <Stat k="Pay providers" v={money(data.cost)} />
        <Stat k="Stock value" v={money(data.stockValue)} />
      </div>

      <div className="card">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, textAlign: 'center' }}>
          <MiniStat k="Sold" v={data.sold} c="g" />
          <MiniStat k="Returned" v={data.returned} />
          <MiniStat k="Unusable" v={data.unusable} c="r" />
        </div>
        <hr className="hr" />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="muted">Sell-through rate</span>
          <span style={{ fontFamily: 'Fraunces,serif', fontSize: 20, fontWeight: 600 }}>{data.sellThrough}%</span>
        </div>
        <div style={{ height: 8, background: 'var(--bg-2)', borderRadius: 99, marginTop: 10, overflow: 'hidden' }}>
          <div style={{ width: data.sellThrough + '%', height: '100%', background: 'linear-gradient(90deg,var(--accent),var(--accent-2))' }} />
        </div>
      </div>

      <div className="card">
        <h3 style={{ fontSize: 17, marginBottom: 12 }}>Top performers</h3>
        {topSellers.length === 0 ? <p className="muted">No sales recorded yet.</p> : (
          topSellers.map((t, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0',
              borderBottom: i < topSellers.length - 1 ? '1px solid var(--line)' : 'none' }}>
              <span style={{ fontFamily: 'Fraunces,serif', fontSize: 18, color: 'var(--text-faint)', width: 22 }}>{i + 1}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{t.name}</div>
                <div className="muted" style={{ fontSize: 12 }}>{t.sold} sold</div>
              </div>
              <span style={{ color: t.profit >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 600, fontSize: 14 }}>
                {money(t.profit)}
              </span>
            </div>
          ))
        )}
      </div>
      <div style={{ height: 20 }} />
    </>
  )
}

const money = (n) => (n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const Stat = ({ k, v, cls }) => (
  <div className="stat"><div className="k">{k}</div><div className={'v ' + (cls || '')}>{v}</div></div>
)
const MiniStat = ({ k, v, c }) => (
  <div>
    <div style={{ fontFamily: 'Fraunces,serif', fontSize: 24, fontWeight: 600,
      color: c === 'g' ? 'var(--green)' : c === 'r' ? 'var(--red)' : 'var(--text)' }}>{v}</div>
    <div className="muted" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em' }}>{k}</div>
  </div>
)
