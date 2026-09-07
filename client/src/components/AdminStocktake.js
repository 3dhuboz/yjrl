import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api';

export default function AdminStocktake({ productId = '', onShop }) {
  const [rows, setRows] = useState([]), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [search, setSearch] = useState(''), [filter, setFilter] = useState('all'), [product, setProduct] = useState(productId);
  const [form, setForm] = useState(null), [busy, setBusy] = useState(false);
  const load = async () => {
    setLoading(true); setError('');
    try { const res = await api.get('/yjrl/stock'); setRows(res.data.rows); }
    catch { setError('Could not load stock. Refresh to try again.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  const low = row => row.onHand !== null && row.onHand - row.awaiting <= row.lowStockAt;
  const visible = rows.filter(row => (!product || row.productId === product) && `${row.name} ${row.option}`.toLowerCase().includes(search.toLowerCase()) && (filter === 'all' || (filter === 'low' ? low(row) : row.onHand === null))).sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true }) || a.option.localeCompare(b.option, 'en', { numeric: true }));
  const save = async event => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      await api.put(`/yjrl/stock/${form.productId}`, { option: form.option, version: form.version, onHand: Number(form.onHand), lowStockAt: Number(form.lowStockAt), note: form.note });
      setForm(null); toast.success('Stock count saved'); await load();
    } catch (e) { setError(e.response?.data?.error || 'Could not save the stock count.'); }
    finally { setBusy(false); }
  };
  return <div>
    <div className="admin-toolbar" style={{ justifyContent: 'space-between' }}><h2>Stocktake</h2><div className="admin-toolbar"><button className="yjrl-btn yjrl-btn-secondary" onClick={onShop}>Manage Products</button><button className="yjrl-btn yjrl-btn-primary" onClick={load} disabled={loading}>Refresh Stock</button></div></div>
    <p>Count stock by product and size, including items put aside for collection. Marking a paid order collected deducts its stock once. Orders awaiting collection include unpaid orders.</p>
    <p>Stock counts help plan orders. Use a product’s availability in Shop to stop new orders.</p>
    <div className="admin-toolbar" style={{ margin: '1rem 0' }}>
      <input aria-label="Search stock" className="yjrl-input" placeholder="Search product or size" value={search} onChange={e => setSearch(e.target.value)} />
      <select aria-label="Filter stock" className="yjrl-input" style={{ width: 'auto' }} value={filter} onChange={e => setFilter(e.target.value)}><option value="all">All stock</option><option value="low">Low stock / shortfall</option><option value="uncounted">Not counted</option></select>
      {product && <button className="yjrl-btn yjrl-btn-secondary" onClick={() => setProduct('')}>Show All Products</button>}
    </div>
    {error && !form && <p role="alert" className="yjrl-form-error">{error}</p>}
    {loading ? <p role="status">Loading stock…</p> : <>
      <p>{visible.length} sizes/options · {visible.filter(low).length} low stock · {visible.filter(row => row.onHand === null).length} not counted</p>
      <div className="stocktake-list">{visible.map(row => <article className="yjrl-card stocktake-row" key={`${row.productId}:${row.option}`}>
        <div><strong>{row.name}</strong><div>{row.option}</div>{(!row.active || !row.listed) && <small>Removed from catalogue · stock retained</small>}</div>
        <dl><div><dt>On hand</dt><dd>{row.onHand ?? 'Not counted'}</dd></div><div><dt>Awaiting collection</dt><dd>{row.awaiting} <small>({row.paidAwaiting} paid)</small></dd></div><div><dt>After these orders</dt><dd>{row.onHand === null ? '—' : row.onHand - row.awaiting}{low(row) && <small className="stocktake-low">{row.onHand < row.awaiting ? 'Shortfall' : 'Low stock'}</small>}</dd></div></dl>
        <button className="yjrl-btn yjrl-btn-secondary" aria-label={`Count ${row.name}, ${row.option}`} onClick={() => { setError(''); setForm({ ...row, onHand: row.onHand ?? '', lowStockAt: row.lowStockAt ?? 2, note: '' }); }}>Record Count</button>
      </article>)}</div>
      {!visible.length && <p>{rows.length ? 'No stock matches these filters.' : 'Add a product and select its sizes in Shop. Each size will appear here for its first count.'}</p>}
    </>}
    {form && <div className="yjrl-modal-overlay"><form className="yjrl-modal" onSubmit={save}>
      <div className="yjrl-modal-header"><h2 className="yjrl-modal-title">Record stock count</h2><button type="button" className="yjrl-btn yjrl-btn-secondary" aria-label="Close stock count" onClick={() => setForm(null)}><X size={18} /></button></div>
      <div className="yjrl-modal-body"><h3>{form.name} · {form.option}</h3>{error && <p role="alert" className="yjrl-form-error">{error}</p>}
        <p>Enter the total physically on hand, including any items set aside for the {form.awaiting} awaiting collection.</p>
        <label>Stock on hand<input aria-label="Stock on hand" required type="number" min="0" max="100000" step="1" className="yjrl-input" value={form.onHand} onChange={e => setForm({ ...form, onHand: e.target.value })} /></label>
        <label>Low-stock alert at<input aria-label="Low-stock alert at" required type="number" min="0" max="100000" step="1" className="yjrl-input" value={form.lowStockAt} onChange={e => setForm({ ...form, lowStockAt: e.target.value })} /></label>
        <label>Reason / notes<input aria-label="Stock count reason" required minLength={3} maxLength={300} className="yjrl-input" placeholder="e.g. Opening stocktake or new delivery counted" value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} /></label>
      </div><div className="yjrl-modal-footer"><button type="button" className="yjrl-btn yjrl-btn-secondary" onClick={() => setForm(null)}>Cancel</button><button className="yjrl-btn yjrl-btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save Stock Count'}</button></div>
    </form></div>}
  </div>;
}
