import React, { useState } from 'react';
import api from '../api';
import MediaReviewPreview from './MediaReviewPreview';

export default function ArticlePhotoUpload({ players, onApproved, onRecords, onBusy, purpose = 'article' }) {
  const [record, setRecord] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [viewed, setViewed] = useState('');
  const [classification, setClassification] = useState('');
  const [ids, setIds] = useState([]);
  const [confirmed, setConfirmed] = useState(false);
  const [notes, setNotes] = useState('');
  const upload = async file => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setError('Choose a JPG, PNG or WebP photo smaller than 5 MB.'); return; }
    setBusy(true); onBusy(true); setError('');
    try {
      const data = new FormData(); data.set('file', file); data.set('category', 'general');
      const result = await api.post('/upload', data, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 30000 });
      const list = await api.get('/yjrl/safety/uploads'); onRecords(list.data);
      const saved = list.data.find(item => item.key === result.data.key);
      if (!saved) throw new Error('The photo was saved. Open Upload Review to review it.');
      setRecord(saved); setViewed(''); setClassification(''); setIds([]); setConfirmed(false); setNotes('');
    } catch (e) { setError(e.response?.data?.error || e.message || 'The photo could not be uploaded.'); }
    finally { setBusy(false); onBusy(false); }
  };
  const approve = async () => {
    setBusy(true); onBusy(true); setError('');
    try {
      const result = await api.put('/yjrl/safety/uploads/review', { key: record.key, status: 'approved', reviewVersion: record.reviewVersion, expectedSha256: record.sha256, reviewNotes: notes, containsChildren: classification === 'children', playerIds: ids, allChildrenIdentified: confirmed });
      onApproved(result.data); setRecord(null);
    } catch (e) { setError(e.response?.data?.error || 'Could not approve photo.'); }
    finally { setBusy(false); onBusy(false); }
  };
  return <div className="article-photo-upload">
    <label className="yjrl-label" htmlFor="article-photo-file">Upload {purpose} photo</label>
    <input id="article-photo-file" type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; upload(file); }} />
    <p>JPG, PNG or WebP, up to 5 MB. Upload, preview and approve the photo here before adding it to your {purpose}.</p>
    {busy && <p role="status">Saving photo…</p>}
    {error && <p role="alert" className="yjrl-form-error">{error}</p>}
    {record && <div>
      <MediaReviewPreview record={record} onViewed={(_, hash) => setViewed(hash)} />
      <label className="yjrl-label" htmlFor="article-photo-subjects">Who is shown?</label>
      <select id="article-photo-subjects" className="yjrl-input" value={classification} onChange={e => { setClassification(e.target.value); setIds([]); setConfirmed(false); }}><option value="">Select…</option><option value="none">No children shown</option><option value="children">Children shown</option></select>
      {classification === 'children' && <div><p>Select every child shown. Current media consent is required.</p>
        {players.length ? <div style={{ maxHeight: 180, overflow: 'auto' }}>{players.map(player => <label className="admin-check" key={player._id}><input type="checkbox" checked={ids.includes(player._id)} onChange={e => setIds(prev => e.target.checked ? [...prev, player._id] : prev.filter(id => id !== player._id))} />{player.firstName} {player.lastName} ({player.ageGroup})</label>)}</div> : <p>Add player records and record guardian consent before using photos of children.</p>}
        <label className="admin-check"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} /> I have identified every child shown.</label></div>}
      <label className="yjrl-label" htmlFor="article-photo-notes">Photo description / review notes</label><input id="article-photo-notes" className="yjrl-input" value={notes} maxLength={2000} placeholder="Describe the photo and confirm it is suitable to publish" onChange={e => setNotes(e.target.value)} />
      <button type="button" className="yjrl-btn yjrl-btn-primary" style={{ marginTop: 12 }} disabled={busy || viewed !== record.sha256 || !classification || notes.trim().length < 10 || (classification === 'children' && (!confirmed || !ids.length))} onClick={approve}>Approve & use photo</button>
      <p>The uploaded photo stays private until approved. It remains available in Upload Review if you close this {purpose}.</p>
    </div>}
  </div>;
}
