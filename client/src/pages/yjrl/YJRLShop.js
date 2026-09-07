import React, { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ShoppingBag, Trash2 } from 'lucide-react';
import api from '../../api';
import { useAuth } from '../../context/AuthContext';
import YJRLLayout from './YJRLLayout';

const money = cents => (cents / 100).toLocaleString('en-AU', { style: 'currency', currency: 'AUD' });
function savedCart() { try { const value = JSON.parse(localStorage.getItem('yjrl_shop_cart') || '[]'); return Array.isArray(value) ? value.filter(item => item && typeof item.productId === 'string' && typeof item.option === 'string' && Number.isInteger(item.quantity) && item.quantity >= 1 && item.quantity <= 20).slice(0, 20) : []; } catch { return []; } }
export default function YJRLShop() {
  const { user } = useAuth(); const [params, setParams] = useSearchParams();
  const [data, setData] = useState(null), [error, setError] = useState(''), [cart, setCart] = useState(savedCart), [options, setOptions] = useState({}), [receipt, setReceipt] = useState(null), [busy, setBusy] = useState(false);
  const [method, setMethod] = useState('collection'), [name, setName] = useState(''), [phone, setPhone] = useState(''), [accepted, setAccepted] = useState(false);
  const requestId = useRef(localStorage.getItem('yjrl_shop_request') || crypto.randomUUID());
  const orderId = params.get('order'), paymentReturn = params.get('payment') === 'return';
  useEffect(() => { api.get('/yjrl/shop').then(res => { setData(res.data); if (!res.data.settings.collectionEnabled) setMethod('paypal'); }).catch(() => setError('The shop could not be loaded. Please try again shortly.')); }, []);
  useEffect(() => { if (user) setName(`${user.firstName || ''} ${user.lastName || ''}`.trim()); }, [user]);
  useEffect(() => { localStorage.setItem('yjrl_shop_cart', JSON.stringify(cart)); }, [cart]);
  useEffect(() => {
    if (!orderId || !user) return;
    let alive = true; setBusy(true); setError('');
    const load = async () => {
      try {
        const result = paymentReturn ? await api.post(`/yjrl/shop/orders/${orderId}/capture`) : await api.get(`/yjrl/shop/orders/${orderId}`);
        if (alive) setReceipt(result.data);
      } catch (e) {
        if (alive) setError(e.response?.data?.error || 'Could not load the order. Sign in with the account that placed it.');
        if (paymentReturn) { try { const res = await api.get(`/yjrl/shop/orders/${orderId}`); if (alive) setReceipt(res.data); } catch { /* Keep the useful confirmation error. */ } }
      } finally { if (alive) setBusy(false); }
    }; load(); return () => { alive = false; };
  }, [orderId, paymentReturn, user]);
  const changeCart = next => { setCart(next); requestId.current = crypto.randomUUID(); localStorage.setItem('yjrl_shop_request', requestId.current); };
  const rows = cart.map(item => ({ ...item, product: data?.products.find(product => product.id === item.productId) }));
  const total = rows.reduce((sum, item) => sum + (item.product?.priceCents || 0) * item.quantity, 0);
  const unavailable = rows.some(item => !item.product?.available || !item.product.options.includes(item.option));
  const pay = async id => {
    setBusy(true); setError('');
    try {
      const res = await api.post(`/yjrl/shop/orders/${id}/pay`);
      if (res.data.approvalUrl) { window.location.assign(res.data.approvalUrl); return; }
      if (res.data.captureRequired) { const captured = await api.post(`/yjrl/shop/orders/${id}/capture`); setReceipt(captured.data); }
      else if (res.data.paid) setReceipt((await api.get(`/yjrl/shop/orders/${id}`)).data);
    } catch (e) { setError(e.response?.data?.error || 'Payment could not be started. Your order is saved.'); }
    finally { setBusy(false); }
  };
  const checkout = async e => {
    e.preventDefault(); setBusy(true); setError(''); localStorage.setItem('yjrl_shop_request', requestId.current);
    try {
      const result = await api.post('/yjrl/shop/orders', { requestId: requestId.current, items: cart, expectedTotalCents: total, paymentMethod: method, name, phone, acceptPolicies: accepted });
      setReceipt(result.data); setParams({ order: result.data.id }); changeCart([]);
      if (result.data.paymentMethod === 'paypal' && result.data.paymentStatus !== 'paid') await pay(result.data.id);
    } catch (e) { setError(e.response?.data?.error || 'Your order could not be confirmed. Please retry with this basket.'); }
    finally { setBusy(false); }
  };
  return <YJRLLayout>
    <div style={{ background: 'linear-gradient(135deg, #172554, #1d4ed8)', padding: '3.5rem 1.5rem 2rem', color: 'white' }}><div style={{ maxWidth: 1280, margin: 'auto' }}><p style={{ color: '#fbbf24', fontWeight: 700, textTransform: 'uppercase' }}>Club shop</p><h1 style={{ color: 'white', fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 900 }}>UNIFORMS & MERCHANDISE</h1><p>Wear the Seagulls colours on game day and beyond.</p></div></div>
    <div style={{ maxWidth: 1280, margin: 'auto', padding: '2rem 1.5rem' }}>
      {error && <p role="alert" className="yjrl-form-error">{error}</p>}
      {!data && !error && <p>Loading shop…</p>}
      {orderId && !user && <p>Sign in with the account used for this order to view its receipt. <Link to="/login" state={{ shopReturn: `/shop?order=${encodeURIComponent(orderId)}${paymentReturn ? '&payment=return' : ''}` }}>Sign in</Link></p>}
      {receipt && <div className="yjrl-card" style={{ padding: 24, marginBottom: 24 }}><h2>{receipt.paymentStatus === 'paid' ? 'Payment confirmed' : 'Your order is saved'}</h2><p>Order reference: <strong style={{ overflowWrap: 'anywhere' }}>{receipt.id}</strong></p><p>{money(receipt.totalCents)} · {receipt.paymentMethod === 'collection' ? 'Pay on collection' : 'Online payment'} · {receipt.paymentStatus === 'paid' ? 'Paid' : 'Payment outstanding'}{receipt.status !== 'placed' ? ` · ${receipt.status}` : ''}</p><ul>{receipt.items.map(item => <li key={`${item.productId}-${item.option}`}>{item.quantity} × {item.name} — {item.option}</li>)}</ul><p style={{ whiteSpace: 'pre-wrap' }}>{receipt.collectionDetails}</p><p>Keep this reference for collection and enquiries.</p>{receipt.paymentMethod === 'paypal' && receipt.paymentStatus !== 'paid' && receipt.status === 'placed' && <button className="yjrl-btn yjrl-btn-primary" disabled={busy} onClick={() => pay(receipt.id)}>{busy ? 'Checking payment…' : 'Continue to PayPal'}</button>}</div>}
      {data && !data.settings.ordersOpen && <div className="yjrl-card" style={{ padding: 24, marginBottom: 24 }}><ShoppingBag size={32} /><h2>Our club shop is being prepared</h2><p>Uniforms, merchandise, prices and collection details will be published here when confirmed.</p></div>}
      {data && <div className="yjrl-grid-3">{data.products.map(product => <article className="yjrl-card" style={{ padding: 20 }} key={product.id}>{product.image ? <img src={product.image} alt={product.name} style={{ width: '100%', height: 220, objectFit: 'contain' }} /> : <div style={{ background: '#f1f5f9', borderRadius: 10, padding: 45, textAlign: 'center', color: '#64748b' }}><ShoppingBag size={48} /></div>}<p style={{ color: 'var(--yjrl-muted)', textTransform: 'capitalize' }}>{product.category}</p><h2>{product.name}</h2><p>{product.description}</p><strong>{money(product.priceCents)}</strong><label style={{ display: 'block', margin: '12px 0' }}>Size / colour<select aria-label={`Size / colour for ${product.name}`} className="yjrl-input" value={options[product.id] || product.options[0]} onChange={e => setOptions({ ...options, [product.id]: e.target.value })}>{product.options.map(option => <option key={option}>{option}</option>)}</select></label><button className="yjrl-btn yjrl-btn-primary" disabled={!data.settings.ordersOpen || !product.available || busy} onClick={() => {
        const option = options[product.id] || product.options[0], index = cart.findIndex(item => item.productId === product.id && item.option === option);
        changeCart(index < 0 ? [...cart, { productId: product.id, option, quantity: 1 }] : cart.map((item, i) => i === index ? { ...item, quantity: Math.min(20, item.quantity + 1) } : item));
      }}>{!product.available ? 'Currently unavailable' : data.settings.ordersOpen ? 'Add to Basket' : 'Orders opening soon'}</button></article>)}</div>}
      {data?.settings.ordersOpen && !data.products.length && <p>No products are available yet.</p>}
      {data && cart.length > 0 && <form className="yjrl-card" onSubmit={checkout} style={{ padding: 24, marginTop: 24 }}><h2>Your basket</h2>
        {rows.map((item, index) => <div className="admin-toolbar" style={{ justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #dbe4ef' }} key={`${item.productId}-${item.option}`}><span>{item.product?.name || 'Unavailable product'} — {item.option}</span><div className="admin-toolbar"><input aria-label={`Quantity for ${item.product?.name || 'item'}`} type="number" min="1" max="20" disabled={busy} style={{ width: 75 }} className="yjrl-input" value={item.quantity} onChange={e => changeCart(cart.map((row, i) => i === index ? { ...row, quantity: Number(e.target.value) } : row))} /><span>{money((item.product?.priceCents || 0) * item.quantity)}</span><button type="button" aria-label={`Remove ${item.product?.name || 'item'}`} className="yjrl-btn yjrl-btn-secondary" disabled={busy} onClick={() => changeCart(cart.filter((_, i) => i !== index))}><Trash2 size={16} /></button></div></div>)}
        <h3>Total: {money(total)} AUD</h3>{unavailable && <p role="alert">Remove unavailable items or sizes before placing your order.</p>}
        <p style={{ whiteSpace: 'pre-wrap' }}>{data.settings.collectionDetails}</p><details><summary>Shop policies</summary><p style={{ whiteSpace: 'pre-wrap' }}>{data.settings.policies}</p></details>
        {!user ? <p><Link to="/login" state={{ shopReturn: '/shop' }}>Sign in with your adult account</Link> to place an order.</p> : <><div className="admin-form-grid"><label>Your name<input aria-label="Order contact name" required maxLength={150} className="yjrl-input" value={name} onChange={e => setName(e.target.value)} /></label><label>Phone<input aria-label="Order contact phone" required type="tel" maxLength={40} className="yjrl-input" value={phone} onChange={e => setPhone(e.target.value)} /></label></div><p>Account email: {user.email}</p><label>Payment<select aria-label="Shop payment method" className="yjrl-input" value={method} onChange={e => setMethod(e.target.value)}>{data.settings.collectionEnabled && <option value="collection">Pay on collection</option>}{data.settings.onlineEnabled && data.settings.onlineReady && <option value="paypal">Pay online with PayPal</option>}</select></label><label className="admin-check"><input type="checkbox" required checked={accepted} onChange={e => setAccepted(e.target.checked)} />I agree to the shop policies and collection arrangements.</label><button className="yjrl-btn yjrl-btn-primary" disabled={busy || unavailable || !data.settings.ordersOpen || !accepted}>{busy ? 'Saving order…' : method === 'paypal' ? 'Order & Pay Online' : 'Place Order — Pay on Collection'}</button></>}
      </form>}
    </div>
  </YJRLLayout>;
}
