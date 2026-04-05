import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Video, VideoOff, Mic, MicOff, Radio, Square, Eye,
  AlertTriangle, Camera, Wifi, WifiOff, Type, Image,
  Plus, Trash2, Upload, X, GripVertical
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import api from '../../api';
import toast from 'react-hot-toast';
import YJRLLayout from './YJRLLayout';
import './yjrl.css';

const ALLOWED_ROLES = ['admin', 'dev', 'videographer'];

const YJRLBroadcast = () => {
  const { user } = useAuth();

  // Stream config
  const [title, setTitle] = useState('Live from Yeppoon Seagulls');
  const [message, setMessage] = useState('');

  // Multi-sponsor system
  const [sponsors, setSponsors] = useState([
    { id: '1', text: '', logoUrl: '', logoImg: null }
  ]);

  // Stream state
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);
  const [uploading, setUploading] = useState(null); // sponsor id being uploaded

  // Refs
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const rawStreamRef = useRef(null);
  const canvasStreamRef = useRef(null);
  const pcRef = useRef(null);
  const sessionIdRef = useRef(null);
  const animFrameRef = useRef(null);
  const scrollXRef = useRef(0);
  const sponsorImagesRef = useRef({});
  const fileInputRef = useRef(null);
  const uploadTargetRef = useRef(null);

  const hasAccess = user && ALLOWED_ROLES.includes(user.role);

  // Load sponsor logos as Image objects for canvas drawing
  const loadSponsorImage = useCallback((id, url) => {
    if (!url) { delete sponsorImagesRef.current[id]; return; }
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => { sponsorImagesRef.current[id] = img; };
    img.onerror = () => { delete sponsorImagesRef.current[id]; };
    img.src = url;
  }, []);

  // When sponsors change, reload images
  useEffect(() => {
    sponsors.forEach(s => {
      if (s.logoUrl && (!sponsorImagesRef.current[s.id] || sponsorImagesRef.current[s.id].src !== s.logoUrl)) {
        loadSponsorImage(s.id, s.logoUrl);
      }
    });
  }, [sponsors, loadSponsorImage]);

  // Add sponsor
  const addSponsor = () => {
    setSponsors(prev => [...prev, { id: Date.now().toString(), text: '', logoUrl: '', logoImg: null }]);
  };

  // Remove sponsor
  const removeSponsor = (id) => {
    setSponsors(prev => prev.filter(s => s.id !== id));
    delete sponsorImagesRef.current[id];
  };

  // Update sponsor field
  const updateSponsor = (id, field, value) => {
    setSponsors(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
    if (field === 'logoUrl') loadSponsorImage(id, value);
  };

  // Upload logo via R2
  const handleLogoUpload = async (sponsorId) => {
    uploadTargetRef.current = sponsorId;
    fileInputRef.current?.click();
  };

  const onFileSelected = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const sponsorId = uploadTargetRef.current;
    if (!sponsorId) return;

    setUploading(sponsorId);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('category', 'sponsors');
      const res = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      updateSponsor(sponsorId, 'logoUrl', res.data.url);
      toast.success('Logo uploaded');
    } catch (err) {
      toast.error('Upload failed: ' + (err.response?.data?.error || err.message));
    } finally {
      setUploading(null);
      e.target.value = '';
    }
  };

  // Build scrolling ticker content
  const getTickerItems = useCallback(() => {
    const items = [];
    sponsors.forEach(s => {
      if (s.text) items.push({ type: 'text', value: s.text, id: s.id });
      if (s.logoUrl && sponsorImagesRef.current[s.id]) items.push({ type: 'logo', img: sponsorImagesRef.current[s.id], id: s.id });
    });
    return items;
  }, [sponsors]);

  // Draw watermarked frames with scrolling sponsor ticker
  const drawFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) {
      animFrameRef.current = requestAnimationFrame(drawFrame);
      return;
    }

    const ctx = canvas.getContext('2d');
    const w = video.videoWidth || 640;
    const h = video.videoHeight || 480;
    canvas.width = w;
    canvas.height = h;

    // Draw raw video frame
    ctx.drawImage(video, 0, 0, w, h);

    const fontSize = Math.max(12, w * 0.025);

    // ── Top-left: Club name (static) ──
    ctx.save();
    ctx.globalAlpha = 0.6;
    ctx.font = `bold ${fontSize * 1.2}px Inter, sans-serif`;
    ctx.fillStyle = 'white';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 4;
    ctx.fillText('YEPPOON SEAGULLS', fontSize * 0.6, fontSize * 0.5);
    ctx.restore();

    // ── Bottom: Scrolling sponsor ticker bar ──
    const tickerItems = getTickerItems();
    if (tickerItems.length > 0) {
      const barHeight = fontSize * 2.2;
      const barY = h - barHeight;

      // Semi-transparent dark bar
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.fillRect(0, barY, w, barHeight);

      // Thin gold accent line at top of bar
      ctx.fillStyle = 'rgba(251, 191, 36, 0.6)';
      ctx.fillRect(0, barY, w, 2);

      ctx.globalAlpha = 0.9;
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 2;

      // Calculate total ticker width
      const logoH = barHeight * 0.6;
      const spacing = fontSize * 2;
      const separator = '  ·  ';
      ctx.font = `bold ${fontSize}px Inter, sans-serif`;

      let totalWidth = 0;
      const measured = tickerItems.map(item => {
        if (item.type === 'text') {
          const tw = ctx.measureText(item.value).width;
          totalWidth += tw + spacing;
          return { ...item, width: tw };
        } else {
          const aspect = item.img.naturalWidth / item.img.naturalHeight;
          const logoW = logoH * aspect;
          totalWidth += logoW + spacing;
          return { ...item, width: logoW, logoW, logoH };
        }
      });

      // Add separators between items
      const sepWidth = ctx.measureText(separator).width;
      totalWidth += (measured.length - 1) * sepWidth;

      // Scroll speed: 1px per frame at 30fps
      scrollXRef.current -= 1.2;
      if (scrollXRef.current < -totalWidth) scrollXRef.current = w;

      // Draw ticker items
      let x = scrollXRef.current;
      const centerY = barY + barHeight / 2;

      // Draw twice for seamless loop
      for (let pass = 0; pass < 2; pass++) {
        let drawX = x + pass * (totalWidth + w * 0.5);
        for (let i = 0; i < measured.length; i++) {
          const item = measured[i];
          if (item.type === 'text') {
            ctx.fillStyle = 'white';
            ctx.font = `bold ${fontSize}px Inter, sans-serif`;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(item.value, drawX, centerY);
            drawX += item.width;
          } else {
            const iy = centerY - item.logoH / 2;
            ctx.drawImage(item.img, drawX, iy, item.logoW, item.logoH);
            drawX += item.logoW;
          }
          // Separator dot
          if (i < measured.length - 1) {
            ctx.fillStyle = 'rgba(251, 191, 36, 0.7)';
            ctx.font = `bold ${fontSize}px Inter, sans-serif`;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(separator, drawX, centerY);
            drawX += sepWidth;
          }
          drawX += spacing;
        }
      }

      ctx.restore();
    }

    animFrameRef.current = requestAnimationFrame(drawFrame);
  }, [getTickerItems]);

  // Re-bind drawFrame when sponsors change
  useEffect(() => {
    if (cameraEnabled && animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = requestAnimationFrame(drawFrame);
    }
  }, [drawFrame, cameraEnabled]);

  // Enable camera
  const enableCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      rawStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setCameraEnabled(true);
      toast.success('Camera enabled');
      animFrameRef.current = requestAnimationFrame(drawFrame);
      if (canvasRef.current) {
        canvasStreamRef.current = canvasRef.current.captureStream(30);
      }
    } catch (err) {
      toast.error('Failed to access camera: ' + (err.message || 'Permission denied'));
    }
  };

  // Go live
  const goLive = async () => {
    if (!cameraEnabled || !canvasStreamRef.current || !rawStreamRef.current) {
      toast.error('Enable camera first'); return;
    }
    if (!title.trim()) { toast.error('Enter a stream title'); return; }

    setConnecting(true);
    try {
      const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.cloudflare.com:3478' }] });
      pcRef.current = pc;
      const videoTrack = canvasStreamRef.current.getVideoTracks()[0];
      const audioTrack = rawStreamRef.current.getAudioTracks()[0];
      if (videoTrack) pc.addTrack(videoTrack, canvasStreamRef.current);
      if (audioTrack) pc.addTrack(audioTrack, rawStreamRef.current);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const sessionRes = await api.post('/livestream/calls/sessions/new', {
        sessionDescription: { type: 'offer', sdp: offer.sdp }
      });
      const { sessionId, sessionDescription: answer } = sessionRes.data;
      sessionIdRef.current = sessionId;
      await pc.setRemoteDescription(new RTCSessionDescription(answer));

      const tracks = pc.getSenders().map(s => ({
        location: 'local', mid: s.track?.kind === 'video' ? '0' : '1',
        trackName: s.track?.kind || 'unknown'
      }));
      await api.post(`/livestream/calls/sessions/${sessionId}/tracks/new`, { tracks });

      // Build combined sponsor text for the DB record
      const sponsorTextCombined = sponsors.filter(s => s.text).map(s => s.text).join(' · ');
      const firstLogo = sponsors.find(s => s.logoUrl)?.logoUrl || '';

      await api.post('/livestream/go-live', {
        title: title.trim(), message: message.trim(),
        session_id: sessionId, sponsor_text: sponsorTextCombined,
        sponsor_logo: firstLogo
      });

      setIsLive(true);
      toast.success('You are LIVE!');
    } catch (err) {
      toast.error('Failed to go live: ' + (err.response?.data?.error || err.message));
      if (pcRef.current) { pcRef.current.close(); pcRef.current = null; }
    } finally {
      setConnecting(false);
    }
  };

  // End stream
  const endStream = async () => {
    try {
      if (pcRef.current) { pcRef.current.close(); pcRef.current = null; }
      if (rawStreamRef.current) { rawStreamRef.current.getTracks().forEach(t => t.stop()); rawStreamRef.current = null; }
      canvasStreamRef.current = null;
      if (animFrameRef.current) { cancelAnimationFrame(animFrameRef.current); animFrameRef.current = null; }
      await api.post('/livestream/go-offline');
      setIsLive(false); setCameraEnabled(false); sessionIdRef.current = null;
      toast.success('Stream ended');
    } catch { toast.error('Error ending stream'); }
  };

  // Toggle mic
  const toggleMic = () => {
    if (rawStreamRef.current) {
      const t = rawStreamRef.current.getAudioTracks()[0];
      if (t) { t.enabled = !t.enabled; setIsMuted(!t.enabled); }
    }
  };

  // Poll viewer count
  useEffect(() => {
    if (!isLive) return;
    const poll = setInterval(() => {
      api.get('/livestream/status').then(r => {
        if (r.data?.viewer_count != null) setViewerCount(r.data.viewer_count);
      }).catch(() => {});
    }, 15000);
    return () => clearInterval(poll);
  }, [isLive]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (rawStreamRef.current) rawStreamRef.current.getTracks().forEach(t => t.stop());
      if (pcRef.current) pcRef.current.close();
    };
  }, []);

  // Load existing sponsors from DB on mount
  useEffect(() => {
    api.get('/yjrl/club/sponsors').then(r => {
      if (Array.isArray(r.data) && r.data.length > 0) {
        setSponsors(r.data.map(s => ({
          id: s.id, text: s.name || '', logoUrl: s.logo || '', logoImg: null
        })));
      }
    }).catch(() => {});
  }, []);

  // Access denied
  if (!hasAccess) {
    return (
      <YJRLLayout>
        <div style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem 1.5rem', textAlign: 'center' }}>
          <div style={{ width: 64, height: 64, borderRadius: '16px', background: 'rgba(220,38,38,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem' }}>
            <AlertTriangle size={28} color="#dc2626" />
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.75rem' }}>Access Denied</h2>
          <p style={{ color: 'var(--yjrl-muted)', maxWidth: 400, lineHeight: 1.7 }}>
            The broadcast studio is only available to club administrators and videographers.
          </p>
        </div>
      </YJRLLayout>
    );
  }

  return (
    <YJRLLayout>
      {/* Hidden file input for logo upload */}
      <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={onFileSelected} />

      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, var(--yjrl-blue-deeper), var(--yjrl-blue-dark))', padding: '2.5rem 1.5rem 2rem', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 70% 30%, rgba(14,165,233,0.2), transparent 60%)', pointerEvents: 'none' }} />
        <div style={{ maxWidth: 1280, margin: '0 auto', position: 'relative', zIndex: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ width: 48, height: 48, borderRadius: '12px', background: isLive ? 'rgba(220,38,38,0.2)' : 'rgba(255,255,255,0.1)', border: `1px solid ${isLive ? 'rgba(220,38,38,0.4)' : 'rgba(255,255,255,0.15)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Radio size={22} color={isLive ? '#ef4444' : 'white'} />
            </div>
            <div>
              <h1 style={{ fontSize: 'clamp(1.5rem, 3vw, 2rem)', fontWeight: 900, color: 'white', margin: 0, textTransform: 'uppercase' }}>Go Live</h1>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem', margin: '0.2rem 0 0' }}>Broadcast Studio</p>
            </div>
            {isLive && (
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(220,38,38,0.15)', border: '1px solid rgba(220,38,38,0.4)', borderRadius: '100px', padding: '0.4rem 1rem', animation: 'yjrl-pulse-live 2s ease-in-out infinite' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', boxShadow: '0 0 8px rgba(239,68,68,0.6)' }} />
                  <span style={{ color: '#ef4444', fontWeight: 800, fontSize: '0.8rem', letterSpacing: '0.1em' }}>LIVE NOW</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem' }}><Eye size={14} /> {viewerCount} viewers</div>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`@keyframes yjrl-pulse-live { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }`}</style>

      {/* Main Content */}
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '2rem 1.5rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: '2rem', alignItems: 'start' }}>

          {/* Left: Camera Preview */}
          <div>
            <div className="yjrl-card" style={{ overflow: 'hidden' }}>
              <div style={{ position: 'relative', background: '#0f172a', aspectRatio: '16/9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <video ref={videoRef} style={{ display: 'none' }} muted playsInline />
                <canvas ref={canvasRef} style={{ width: '100%', height: '100%', objectFit: 'contain', display: cameraEnabled ? 'block' : 'none' }} />
                {!cameraEnabled && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', color: 'rgba(255,255,255,0.4)' }}>
                    <Camera size={48} /><span style={{ fontSize: '0.9rem' }}>Camera Preview</span>
                  </div>
                )}
                {isLive && (
                  <div style={{ position: 'absolute', top: 16, left: 16, display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(220,38,38,0.9)', borderRadius: '6px', padding: '0.3rem 0.75rem' }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'white', animation: 'yjrl-pulse-live 1.5s ease-in-out infinite' }} />
                    <span style={{ color: 'white', fontWeight: 800, fontSize: '0.75rem', letterSpacing: '0.1em' }}>LIVE</span>
                  </div>
                )}
              </div>

              {/* Controls */}
              <div style={{ padding: '1rem 1.5rem', display: 'flex', gap: '0.75rem', alignItems: 'center', borderTop: '1px solid var(--yjrl-border)' }}>
                {!cameraEnabled ? (
                  <button className="yjrl-btn yjrl-btn-primary" onClick={enableCamera} style={{ flex: 1, justifyContent: 'center' }}>
                    <Camera size={16} /> Enable Camera
                  </button>
                ) : !isLive ? (
                  <>
                    <button className="yjrl-btn" onClick={goLive} disabled={connecting}
                      style={{ flex: 1, justifyContent: 'center', background: '#dc2626', color: 'white', opacity: connecting ? 0.6 : 1 }}>
                      <Radio size={16} /> {connecting ? 'Connecting...' : 'Go Live Now'}
                    </button>
                    <button className="yjrl-btn yjrl-btn-secondary" onClick={toggleMic} title={isMuted ? 'Unmute' : 'Mute'}>
                      {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
                    </button>
                  </>
                ) : (
                  <>
                    <button className="yjrl-btn yjrl-btn-danger" onClick={endStream} style={{ flex: 1, justifyContent: 'center' }}>
                      <Square size={16} /> End Stream
                    </button>
                    <button className="yjrl-btn yjrl-btn-secondary" onClick={toggleMic} title={isMuted ? 'Unmute' : 'Mute'}>
                      {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
                    </button>
                  </>
                )}
              </div>
            </div>

            {cameraEnabled && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1rem', fontSize: '0.8rem', color: 'var(--yjrl-muted)' }}>
                {isLive ? <><Wifi size={14} color="#16a34a" /> Connected — streaming to Cloudflare</> : <><WifiOff size={14} /> Camera ready — not broadcasting</>}
              </div>
            )}
          </div>

          {/* Right: Settings */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Stream Settings */}
            <div className="yjrl-card">
              <div className="yjrl-card-header"><div className="yjrl-card-title"><Type size={16} /> Stream Settings</div></div>
              <div className="yjrl-card-body">
                <div className="yjrl-form-group">
                  <label className="yjrl-label">Stream Title</label>
                  <input className="yjrl-input" value={title} onChange={e => setTitle(e.target.value)} placeholder="Live from Yeppoon Seagulls" disabled={isLive} />
                </div>
                <div className="yjrl-form-group">
                  <label className="yjrl-label">Message to Viewers</label>
                  <textarea className="yjrl-input" value={message} onChange={e => setMessage(e.target.value)} placeholder="Welcome to today's stream!" rows={2} disabled={isLive} style={{ resize: 'vertical' }} />
                </div>
              </div>
            </div>

            {/* Sponsor Ticker */}
            <div className="yjrl-card">
              <div className="yjrl-card-header">
                <div className="yjrl-card-title"><Image size={16} /> Sponsor Ticker</div>
                <button className="yjrl-btn yjrl-btn-primary yjrl-btn-sm" onClick={addSponsor}>
                  <Plus size={12} /> Add
                </button>
              </div>
              <div className="yjrl-card-body" style={{ padding: '0.75rem 1.25rem' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--yjrl-muted)', marginBottom: '0.75rem' }}>
                  Logos and text scroll across the bottom of the stream. Add multiple sponsors — they'll rotate in a ticker.
                </div>

                {sponsors.map((sponsor, idx) => (
                  <div key={sponsor.id} style={{
                    padding: '0.75rem', background: 'var(--yjrl-bg)', borderRadius: '10px',
                    marginBottom: '0.75rem', border: '1px solid var(--yjrl-border)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--yjrl-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        Sponsor {idx + 1}
                      </span>
                      {sponsors.length > 1 && (
                        <button onClick={() => removeSponsor(sponsor.id)} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', padding: '0.15rem' }}>
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>

                    <div className="yjrl-form-group" style={{ margin: '0 0 0.5rem' }}>
                      <label className="yjrl-label" style={{ fontSize: '0.7rem' }}>Name / Text</label>
                      <input className="yjrl-input" style={{ fontSize: '0.85rem' }} value={sponsor.text}
                        onChange={e => updateSponsor(sponsor.id, 'text', e.target.value)}
                        placeholder="e.g. Capricorn Coast Plumbing" />
                    </div>

                    <div className="yjrl-form-group" style={{ margin: 0 }}>
                      <label className="yjrl-label" style={{ fontSize: '0.7rem' }}>Logo</label>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <input className="yjrl-input" style={{ fontSize: '0.8rem', flex: 1 }} value={sponsor.logoUrl}
                          onChange={e => updateSponsor(sponsor.id, 'logoUrl', e.target.value)}
                          placeholder="URL or upload →" />
                        <button className="yjrl-btn yjrl-btn-secondary yjrl-btn-sm"
                          onClick={() => handleLogoUpload(sponsor.id)}
                          disabled={uploading === sponsor.id}
                          title="Upload logo">
                          {uploading === sponsor.id ? '...' : <Upload size={13} />}
                        </button>
                      </div>
                    </div>

                    {/* Logo preview */}
                    {sponsor.logoUrl && (
                      <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem', background: 'white', borderRadius: '6px' }}>
                        <img src={sponsor.logoUrl} alt="" style={{ height: 32, maxWidth: 120, objectFit: 'contain' }}
                          onError={e => { e.target.style.display = 'none'; }} />
                        <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Preview</span>
                      </div>
                    )}
                  </div>
                ))}

                {sponsors.length === 0 && (
                  <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--yjrl-muted)', fontSize: '0.85rem' }}>
                    No sponsors added. Click "Add" to include sponsor branding in the stream.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </YJRLLayout>
  );
};

export default YJRLBroadcast;
