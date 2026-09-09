import React, { useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api';
import ArticlePhotoUpload from './ArticlePhotoUpload';
import ProductSizeFields from './ProductSizeFields';

const money = cents => (cents / 100).toLocaleString('en-AU', { style: 'currency', currency: 'AUD' });
export default function AdminShop({ players, onStocktake }) {
  const [data, setData] = useState(null), [form, setForm] = useState(null), [error, setError] = useState(''), [busy, setBusy] = useState(false), [photoBusy, setPhotoBusy] = useState(false);
  const load = () => api.get('/yjrl/shop/admin').then(res => setData(res.data)).catch(() => setError('Could not load the shop. Please reload to try again.'));
  useEffect(() => { load(); }, []);
  const saveSettings = async event => {
    event.preventDefault(); setBusy(true); setError('');
    try { const res = await api.put('/yjrl/shop/settings', data.settings); setData(prev => ({ ...prev, settings: res.data })); toast.success(res.data.ordersOpen ? 'Shop orders are open' : 'Shop settings saved — orders closed'); }
    catch (e) { setError(e.response?.data?.error || 'Could not save shop settings'); }
    finally { setBusy(false); }
  };
  const saveProduct = async event => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      if (!/^\d+(\.\d{1,2})?$/.test(form.price)) throw new Error('Enter a price with no more than two decimal places.');
      const payload = { ...form, priceCents: Math.round(Number(form.price) * 100), options: form.optionText.split('\n').map(value => value.trim()).filter(Boolean) };
      if (!payload.options.length) throw new Error('Select at least one size, or add a custom option.');
      payload.stockCounts = [...new Set(payload.options)].flatMap(option => {
        const original = form.stock?.find(item => item.option === option), value = form.counts[option];
        if (value === undefined || (value === '' && original?.onHand == null) || (value !== '' && Number(value) === original?.onHand)) return [];
        if (!/^\d+$/.test(value)) throw new Error(`Enter a whole stock quantity for ${option}.`);
        return [{ option, onHand: Number(value), version: original?.version || 0, lowStockAt: original?.lowStockAt ?? 2, note: 'Count recorded in product editor' }];
      });
      const res = await api.put(`/yjrl/shop/products/${form.id}`, payload);
      setData(prev => ({ ...prev, products: [...prev.products.filter(item => item.id !== res.data.id), res.data] })); setForm(null); toast.success(res.data.published ? 'Product published' : 'Product draft saved');
    } catch (e) { setError(e.response?.data?.error || e.message || 'Could not save product'); }
    finally { setBusy(false); }
  };
  const action = async (id, value) => {
    if (value === 'collection_paid' && !window.confirm('Confirm the club has received the full payment for this order?')) return;
    if (value === 'cancel' && !window.confirm('Cancel this unpaid collection order?')) return;
    setBusy(true); setError('');
    try { const res = await api.put(`/yjrl/shop/orders/${id}`, { action: value }); setData(prev => ({ ...prev, orders: prev.orders.map(item => item.id === id ? res.data : item) })); toast.success('Order updated'); }
    catch (e) { setError(e.response?.data?.error || 'Could not update order'); }
    finally { setBusy(false); }
  };
  const edit = product => { setError(''); setForm({ ...product, counts: {}, price: (product.priceCents / 100).toFixed(2), optionText: product.options.join('\n') }); };
  if (!data) return <p role="status">{error || 'Loading shop…'}</p>;
  return <div>
    <div className="admin-toolbar" style={{ justifyContent: 'space-between' }}><h2>Uniforms & merchandise</h2><button className="yjrl-btn yjrl-btn-primary" onClick={() => edit({ id: crypto.randomUUID(), name: '', category: 'uniform', description: '', priceCents: 0, options: [], image: '', available: false, published: false })}><Plus size={16} /> Add Product</button></div>
    {error && !form && <p role="alert" className="yjrl-form-error">{error}</p>}
    <form className="yjrl-card" style={{ padding: 20, margin: '20px 0' }} onSubmit={saveSettings}>
      <h3>Shop setup</h3><button type="button" className="yjrl-btn yjrl-btn-secondary" onClick={() => onStocktake()}>Open Stocktake</button><p>Add Nathan’s catalogue, collection details and policies before opening orders. Availability is managed by the club for each product.</p>
      <div className="admin-form-grid"><label>Collection details<textarea aria-label="Collection details" className="yjrl-input" rows={3} maxLength={2000} placeholder="Where, when and who to contact for collection" value={data.settings.collectionDetails} onChange={e => setData({ ...data, settings: { ...data.settings, collectionDetails: e.target.value } })} /></label><label>Shop policies<textarea aria-label="Shop policies" className="yjrl-input" rows={3} maxLength={2000} placeholder="Club-approved ordering, lead time and exchange/refund information" value={data.settings.policies} onChange={e => setData({ ...data, settings: { ...data.settings, policies: e.target.value } })} /></label></div>
      {[['Pay on collection', 'collectionEnabled'], ['Online payment (PayPal)', 'onlineEnabled'], ['Open shop orders', 'ordersOpen']].map(([label, key]) => <label key={key} className="admin-check"><input type="checkbox" checked={data.settings[key]} onChange={e => setData({ ...data, settings: { ...data.settings, [key]: e.target.checked } })} />{label}</label>)}
      <p>Online payment: {data.settings.onlineReady ? 'provider configured — complete the agreed payment test before opening' : 'awaiting provider setup; customers cannot select online payment yet'}.</p>
      <button className="yjrl-btn yjrl-btn-primary" disabled={busy}>Save Shop Settings</button>
    </form>
    <div className="yjrl-grid-3">{data.products.map(product => <div key={product.id} className="yjrl-card" style={{ padding: 20 }}>{product.image && <img src={product.image} alt={product.name} style={{ width: '100%', height: 150, objectFit: 'contain' }} />}<h3>{product.name}</h3><p>{money(product.priceCents)} · {product.published ? 'Published' : 'Draft'} · {product.available ? 'Available to order' : 'Unavailable'}</p><p>{product.options.join(', ')}</p><div className="admin-toolbar"><button className="yjrl-btn yjrl-btn-secondary" onClick={() => edit(product)}>Edit Product</button><button className="yjrl-btn yjrl-btn-secondary" onClick={() => onStocktake(product.id)}>View Stock</button><button className="yjrl-btn yjrl-btn-danger" onClick={async () => { if (!window.confirm(`Remove ${product.name} from the shop?`)) return; try { await api.delete(`/yjrl/shop/products/${product.id}`); setData(prev => ({ ...prev, products: prev.products.filter(item => item.id !== product.id) })); } catch { setError('Could not remove product'); } }}>Remove</button></div></div>)}</div>
    {!data.products.length && <p>No products yet. Add uniforms and merchandise as drafts while details are being confirmed.</p>}
    <h3 style={{ marginTop: 28 }}>Orders (latest 100)</h3><button className="yjrl-btn yjrl-btn-secondary" onClick={load}>Refresh Orders</button>
    {!data.orders.length && <p>No shop orders yet.</p>}
    {data.orders.map(order => <div className="yjrl-card" key={order.id} style={{ padding: 20, marginTop: 14 }}><strong>{order.contactName} · {money(order.totalCents)}</strong><p>{order.contactEmail} · {order.contactPhone}</p><p>Reference: {order.id}</p><p>{order.paymentMethod === 'collection' ? 'Pay on collection' : 'PayPal'} · {order.paymentStatus === 'paid' ? 'Paid' : 'Payment outstanding'} · {order.status}</p><ul>{order.items.map(item => <li key={`${item.productId}-${item.option}`}>{item.quantity} × {item.name} — {item.option}</li>)}</ul><div className="admin-toolbar">{order.status === 'placed' && order.paymentStatus === 'unpaid' && order.paymentMethod === 'collection' && <><button className="yjrl-btn yjrl-btn-primary" disabled={busy} onClick={() => action(order.id, 'collection_paid')}>Record Collection Payment</button><button className="yjrl-btn yjrl-btn-secondary" disabled={busy} onClick={() => action(order.id, 'cancel')}>Cancel Order</button></>}{order.status === 'placed' && order.paymentStatus === 'paid' && <button className="yjrl-btn yjrl-btn-primary" disabled={busy} onClick={() => action(order.id, 'fulfilled')}>Mark Collected</button>}</div></div>)}
    {form && <div className="yjrl-modal-overlay"><form className="yjrl-modal" onSubmit={saveProduct}>
      <div className="yjrl-modal-header"><h2 className="yjrl-modal-title">Product details</h2><button type="button" className="yjrl-btn yjrl-btn-secondary" aria-label="Close product form" onClick={() => setForm(null)}><X size={18} /></button></div>
      <div className="yjrl-modal-body">{error && <p role="alert" className="yjrl-form-error">{error}</p>}
        <label>Product name<input aria-label="Product name" required maxLength={150} className="yjrl-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label>
        <div className="admin-form-grid"><label>Category<select aria-label="Product category" className="yjrl-input" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}><option value="uniform">Uniform</option><option value="merchandise">Merchandise</option></select></label><label>Price (AUD)<input aria-label="Price (AUD)" required type="number" min="0" step="0.01" className="yjrl-input" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} /></label></div>
        <label>Description<textarea aria-label="Product description" className="yjrl-input" rows={3} maxLength={2000} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></label>
        <ProductSizeFields value={form.optionText} onChange={optionText => setForm(prev => ({ ...prev, optionText }))} stock={form.stock} counts={form.counts} onCountChange={(size, value) => setForm(prev => ({ ...prev, counts: { ...prev.counts, [size]: value } }))} />
        {form.image && <><img src={form.image} alt={form.name || 'Product'} style={{ maxWidth: '100%', maxHeight: 180 }} /><button type="button" className="yjrl-btn yjrl-btn-secondary" onClick={() => setForm({ ...form, image: '' })}>Remove Photo</button></>}
        <ArticlePhotoUpload purpose="product" players={players} onRecords={() => {}} onBusy={setPhotoBusy} onApproved={record => setForm(prev => ({ ...prev, image: record.url }))} />
        <label className="admin-check"><input type="checkbox" checked={form.available} onChange={e => setForm({ ...form, available: e.target.checked })} /> Available to order</label><label className="admin-check"><input type="checkbox" checked={form.published} onChange={e => setForm({ ...form, published: e.target.checked })} /> Publish product on the website</label>
      </div><div className="yjrl-modal-footer"><button type="button" className="yjrl-btn yjrl-btn-secondary" onClick={() => setForm(null)}>Cancel</button><button className="yjrl-btn yjrl-btn-primary" disabled={busy || photoBusy}>{busy ? 'Saving…' : 'Save Product'}</button></div>
    </form></div>}
  </div>;
}
