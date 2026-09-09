import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { CheckCircle, ChevronDown, Upload, ClipboardList, Link as LinkIcon, Copy, X } from 'lucide-react';
import api from '../api';
import toast from 'react-hot-toast';
const labels = { gathering: 'Still coming', submitted: 'Ready for review', complete: 'Added to website' };
const errorText = e => e.response?.data?.error || 'Something went wrong. Please try again.';
function Photo({ photo, http, onRemove, onReview, canManage }) {
  const [url, setUrl] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true, objectUrl;
    http.get(`/yjrl/checklist/photos/${photo.id}`, { responseType: 'blob' }).then(({ data }) => { if (active) { objectUrl = URL.createObjectURL(data); setUrl(objectUrl); } }).catch(() => { if (active) setError('Preview unavailable. Reload to try again.'); });
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [photo.id, http]);
  const action = async fn => { setBusy(true); try { await fn(photo); } finally { setBusy(false); } };
  return <div className="checklist-photo">{url && <a href={url} target="_blank" rel="noopener noreferrer"><img src={url} alt={photo.caption} /></a>}{error && <p>{error}</p>}<p>{photo.caption}</p><div className="checklist-photo-actions">
    {canManage && (photo.inPhotoReview ? <span>In photo review</span> : <button type="button" className="yjrl-btn yjrl-btn-secondary yjrl-btn-sm" disabled={busy} onClick={() => action(onReview)}>Send to photo review</button>)}
    {!photo.inPhotoReview && <button type="button" className="yjrl-btn yjrl-btn-secondary yjrl-btn-sm" disabled={busy} onClick={() => action(onRemove)}>Remove photo</button>}
    {photo.inPhotoReview && !canManage && <small>Sent to the club’s photo review</small>}
  </div></div>;
}
function ChecklistItem({ section, http, canManage, onSaved, onPhotos }) {
  const [notes, setNotes] = useState(section.notes), [version, setVersion] = useState(section.version), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [caption, setCaption] = useState(''), [permission, setPermission] = useState(false), [file, setFile] = useState(null), [fileKey, setFileKey] = useState(0);
  const dirty = notes !== section.notes;
  useEffect(() => {
    const warn = e => { e.preventDefault(); e.returnValue = ''; };
    if (dirty || file || caption) window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, file, caption]);
  const save = async status => {
    setBusy(true); setError('');
    try { const { data } = await http.put(`/yjrl/checklist/items/${section.id}`, { notes, version, status }); setVersion(data.version); onSaved(section.id, { notes: notes.trim(), status, version: data.version }); setNotes(notes.trim()); toast.success(status === 'submitted' ? 'Ready for the club to review.' : status === 'complete' ? 'Marked added to website.' : 'Saved. Come back whenever you’re ready.'); }
    catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  };
  const reload = async () => {
    if (dirty && !window.confirm('Reloading replaces these unsaved notes. Copy anything you want to keep first.')) return;
    setBusy(true); try { const { data } = await http.get('/yjrl/checklist'); const fresh = data.sections.find(s => s.id === section.id); setNotes(fresh.notes); setVersion(fresh.version); onSaved(section.id, fresh); setError(''); } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  };
  const upload = async () => {
    if (!file || !caption.trim() || !permission) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) { setError('Choose a JPG, PNG or WebP photo up to 5 MB.'); return; }
    setBusy(true); setError('');
    try {
      const data = new FormData(); data.set('file', file); data.set('caption', caption.trim()); data.set('permissionConfirmed', 'true');
      const result = await http.post(`/yjrl/checklist/items/${section.id}/photos`, data, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 45000 });
      onPhotos(section.id, [...section.photos, result.data]); setFile(null); setFileKey(k => k + 1); setCaption(''); setPermission(false);
      // Preserve unsaved notes/version; a concurrent content edit must still cause a conflict.
      if (section.status === 'complete') { setVersion(-1); setError('Photo uploaded. Reload this item before saving further changes.'); }
      toast.success('Photo uploaded for the club.');
    } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  };
  const remove = async photo => { if (!window.confirm('Remove this photo from the checklist?')) return; try { await http.delete(`/yjrl/checklist/photos/${photo.id}`); onPhotos(section.id, section.photos.filter(p => p.id !== photo.id)); } catch (e) { setError(errorText(e)); } };
  const review = async photo => { try { await http.post(`/yjrl/checklist/photos/${photo.id}/review`); onPhotos(section.id, section.photos.map(p => p.id === photo.id ? { ...p, inPhotoReview: true } : p)); toast.success('Photo sent to Chat Safety → Upload Review.'); } catch (e) { setError(errorText(e)); } };
  return <details className="website-checklist-item">
    <summary><span className={`checklist-step ${section.status === 'complete' ? 'is-done' : ''}`}>{section.status === 'complete' ? <CheckCircle size={21} /> : section.number}</span><span className="checklist-item-title"><strong>{section.title}</strong><small>{section.hint}</small></span><span className={`checklist-status ${section.status}`}>{labels[section.status]}</span><ChevronDown className="checklist-chevron" size={18} /></summary>
    <div className="checklist-item-body"><ul>{section.prompts.map(p => <li key={p}>{p}</li>)}</ul>
      <label htmlFor={`notes-${section.id}`}>Your notes</label><textarea id={`notes-${section.id}`} className="yjrl-input" rows={5} value={notes} maxLength={10000} placeholder="Type what you know, paste a list or add a useful link…" onChange={e => setNotes(e.target.value)} />
      {error && <p role="alert" className="yjrl-form-error">{error} <button type="button" onClick={reload} disabled={busy}>Reload this item</button></p>}
      <div className="checklist-save-buttons"><button className="yjrl-btn yjrl-btn-secondary" type="button" disabled={busy || version < 0} onClick={() => save('gathering')}>Save for later</button><button className="yjrl-btn yjrl-btn-primary" type="button" disabled={busy || version < 0} onClick={() => save('submitted')}>Ready for review</button>{canManage && <button className="yjrl-btn yjrl-btn-secondary" type="button" disabled={busy || version < 0} onClick={() => save('complete')}>Mark added to website</button>}{dirty && <span>Unsaved notes</span>}{busy && <span role="status">Saving…</span>}</div>
      <div className="checklist-upload"><h3><Upload size={18} /> Add photos</h3><p>JPG, PNG or WebP, up to 5 MB each. {section.photos.length}/20 photos.</p>
        <label htmlFor={`photo-${section.id}`}>Choose photo<input key={fileKey} id={`photo-${section.id}`} type="file" accept="image/jpeg,image/png,image/webp" disabled={busy || section.photos.length >= 20} onChange={e => setFile(e.target.files?.[0] || null)} /></label>
        {file && <div className="checklist-upload-details"><label htmlFor={`caption-${section.id}`}>What is this photo for?<input id={`caption-${section.id}`} className="yjrl-input" value={caption} maxLength={500} placeholder="For example: blue training shirt, for the shop" onChange={e => setCaption(e.target.value)} /></label><label className="checklist-permission"><input type="checkbox" checked={permission} onChange={e => setPermission(e.target.checked)} /> I have permission to supply this photo to the club for review.</label><button className="yjrl-btn yjrl-btn-primary" type="button" disabled={busy || !caption.trim() || !permission} onClick={upload}>Upload photo</button></div>}
        <p className="checklist-fine-print">Photos stay private until checked. Images of children require the club’s guardian-consent checks before publication.</p>
        <div className="checklist-photos">{section.photos.map(photo => <Photo key={photo.id} photo={photo} http={http} canManage={canManage} onRemove={remove} onReview={review} />)}</div>
      </div>
    </div>
  </details>;
}
function PrivateLinks({ http }) {
  const [links, setLinks] = useState([]), [url, setUrl] = useState(''), [busy, setBusy] = useState(false);
  const load = () => http.get('/yjrl/checklist/links').then(r => setLinks(r.data)).catch(e => toast.error(errorText(e)));
  useEffect(() => { load(); }, []);
  const create = async () => { setBusy(true); try { const { data } = await http.post('/yjrl/checklist/links', { label: 'Nathan' }); setUrl(`${window.location.origin}/website-checklist#access=${data.token}`); await load(); } catch (e) { toast.error(errorText(e)); } finally { setBusy(false); } };
  const revoke = async id => { if (!window.confirm('Turn off this link? Anyone using it will need a new link.')) return; try { await http.delete(`/yjrl/checklist/links/${id}`); setUrl(''); await load(); } catch (e) { toast.error(errorText(e)); } };
  return <details className="checklist-link-settings"><summary><LinkIcon size={17} /> Nathan’s private link</summary><p>This link opens only the checklist. It expires after 90 days and can be turned off below.</p><button className="yjrl-btn yjrl-btn-secondary" type="button" disabled={busy} onClick={create}>Create private link</button>
    {url && <div className="checklist-share"><label>Copy this link for Nathan<input className="yjrl-input" readOnly value={url} onFocus={e => e.target.select()} /></label><button type="button" className="yjrl-btn yjrl-btn-primary" onClick={async () => { try { await navigator.clipboard.writeText(url); toast.success('Private link copied.'); } catch { toast.error('Select the link above and copy it.'); } }}><Copy size={16} /> Copy link</button><p>Keep this link private. It gives access to the notes and photos. Copy it now; it won’t be shown again after leaving this page.</p></div>}
    {links.map(link => <div className="checklist-link-row" key={link.id}><span>{link.label} · {link.revoked_at ? 'Turned off' : `Expires ${new Date(link.expires_at).toLocaleDateString('en-AU')}`}</span>{!link.revoked_at && <button className="yjrl-btn yjrl-btn-secondary yjrl-btn-sm" type="button" onClick={() => revoke(link.id)}><X size={14} /> Turn off link</button>}</div>)}
  </details>;
}
export default function WebsiteChecklist({ privateToken = '' }) {
  const http = useMemo(() => privateToken ? axios.create({ baseURL: api.defaults.baseURL, headers: { 'X-Checklist-Token': privateToken }, timeout: 45000 }) : api, [privateToken]);
  const [data, setData] = useState(null), [error, setError] = useState('');
  const load = async () => { try { const response = await http.get('/yjrl/checklist'); setData(response.data); setError(''); } catch (e) { setError(errorText(e)); } };
  useEffect(() => { load(); }, [http]);
  const update = (id, fields) => setData(old => ({ ...old, sections: old.sections.map(s => s.id === id ? { ...s, ...fields } : s) }));
  const count = data?.sections.filter(s => s.status !== 'gathering').length || 0;
  return <div className="website-checklist"><header className="checklist-heading"><ClipboardList size={30} /><div><h1>Nathan’s website checklist</h1><p>Let’s get the club ready for 2027.</p></div></header><p className="checklist-intro">Add what you know, upload your photos and save as you go. Anything undecided can stay <strong>Still coming</strong>. We’ll check everything before it goes onto the website.</p>
    {error && <div role="alert" className="checklist-error">{error} <button className="yjrl-btn yjrl-btn-secondary" onClick={load}>Try again</button></div>}
    {!data && !error && <p>Loading checklist…</p>}
    {data && <><div className="checklist-progress"><span>{count} of {data.sections.length} items supplied</span><progress value={count} max={data.sections.length} /></div>{data.canManage && <PrivateLinks http={http} />}
      <div className="checklist-items">{data.sections.map((s, i) => <ChecklistItem key={s.id} section={{ ...s, number: i + 1 }} http={http} canManage={data.canManage} onSaved={update} onPhotos={(id, photos) => update(id, { photos })} />)}</div>
      <p className="checklist-fine-print">Website information only. Please leave passwords, payment credentials and player medical information out of this checklist.</p>
    </>}
  </div>;
}
