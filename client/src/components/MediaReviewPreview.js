import React, { useEffect, useState } from 'react';
import api from '../api';

export default function MediaReviewPreview({ record, onViewed }) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [request, setRequest] = useState(0);
  useEffect(() => {
    setUrl('');
    if (!request || record.status === 'rejected' || record.processingVersion !== 'webp-v1') return;
    const controller = new AbortController();
    let objectUrl = '';
    setLoading(true); setError('');
    api.get('/media/preview', { params: { key: record.key }, responseType: 'blob', signal: controller.signal })
      .then(response => {
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(response.data);
        setUrl(objectUrl);
      })
      .catch(() => { if (!controller.signal.aborted) setError('Preview unavailable. Refresh the list or re-upload this image.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [request, record.key, record.sha256, record.status, record.processingVersion]);

  if (record.processingVersion !== 'webp-v1') return <p>Re-upload this image before review.</p>;
  if (record.status === 'rejected') return null;
  return <div>
    <button className="yjrl-btn yjrl-btn-secondary yjrl-btn-sm" disabled={loading} onClick={() => setRequest(value => value + 1)}>{loading ? 'Loading…' : 'Preview privately'}</button>
    {error && <p role="alert">{error}</p>}
    {url && <img src={url} alt="Image submitted for club review" onLoad={() => onViewed(record.key, record.sha256)} onError={() => setError('This image could not be displayed. Re-upload it before approval.')} style={{ display: 'block', maxWidth: '100%', maxHeight: 260, marginTop: 8 }} />}
  </div>;
}
