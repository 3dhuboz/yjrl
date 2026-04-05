import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Video, VideoOff, Mic, MicOff, Radio, Square, Eye,
  AlertTriangle, Camera, Wifi, WifiOff, Type, Image
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
  const [sponsorText, setSponsorText] = useState('');
  const [sponsorLogo, setSponsorLogo] = useState('');
  const [message, setMessage] = useState('');

  // Stream state
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);

  // Refs
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const rawStreamRef = useRef(null);
  const canvasStreamRef = useRef(null);
  const pcRef = useRef(null);
  const sessionIdRef = useRef(null);
  const animFrameRef = useRef(null);

  // Role check
  const hasAccess = user && ALLOWED_ROLES.includes(user.role);

  // Draw watermarked frames from hidden video to visible canvas
  const drawFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) {
      animFrameRef.current = requestAnimationFrame(drawFrame);
      return;
    }

    const ctx = canvas.getContext('2d');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    // Draw the raw video frame
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Watermark settings
    const fontSize = Math.max(12, canvas.width * 0.03);
    ctx.font = `bold ${fontSize}px Inter, sans-serif`;
    ctx.globalAlpha = 0.55;

    // Top-left: club name
    ctx.fillStyle = 'white';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 4;
    ctx.fillText('YEPPOON SEAGULLS', fontSize * 0.5, fontSize * 0.5);

    // Bottom-right: sponsor text
    if (sponsorText) {
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillText(sponsorText, canvas.width - fontSize * 0.5, canvas.height - fontSize * 0.5);
    }

    // Reset
    ctx.globalAlpha = 1.0;
    ctx.shadowBlur = 0;

    animFrameRef.current = requestAnimationFrame(drawFrame);
  }, [sponsorText]);

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

      // Start drawing watermarked frames
      animFrameRef.current = requestAnimationFrame(drawFrame);

      // Capture canvas stream at 30fps
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
      toast.error('Enable camera first');
      return;
    }
    if (!title.trim()) {
      toast.error('Enter a stream title');
      return;
    }

    setConnecting(true);
    try {
      // 1. Create peer connection
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.cloudflare.com:3478' }]
      });
      pcRef.current = pc;

      // 2. Add video track from canvas stream (watermarked) + audio from raw stream
      const videoTrack = canvasStreamRef.current.getVideoTracks()[0];
      const audioTrack = rawStreamRef.current.getAudioTracks()[0];
      if (videoTrack) pc.addTrack(videoTrack, canvasStreamRef.current);
      if (audioTrack) pc.addTrack(audioTrack, rawStreamRef.current);

      // 3. Create offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // 4. Send offer to server — create new session
      const sessionRes = await api.post('/livestream/calls/sessions/new', {
        sessionDescription: { type: 'offer', sdp: offer.sdp }
      });

      const { sessionId, sessionDescription: answer } = sessionRes.data;
      sessionIdRef.current = sessionId;

      // 5. Set remote description
      await pc.setRemoteDescription(new RTCSessionDescription(answer));

      // 6. Publish tracks
      const tracks = pc.getSenders().map(s => ({
        location: 'local',
        mid: s.track?.kind === 'video' ? '0' : '1',
        trackName: s.track?.kind || 'unknown'
      }));

      await api.post(`/livestream/calls/sessions/${sessionId}/tracks/new`, { tracks });

      // 7. Notify server we are live
      await api.post('/livestream/go-live', {
        title: title.trim(),
        message: message.trim(),
        session_id: sessionId,
        sponsor_text: sponsorText.trim(),
        sponsor_logo: sponsorLogo.trim()
      });

      setIsLive(true);
      toast.success('You are LIVE!');
    } catch (err) {
      toast.error('Failed to go live: ' + (err.response?.data?.error || err.message));
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
    } finally {
      setConnecting(false);
    }
  };

  // End stream
  const endStream = async () => {
    try {
      // Close peer connection
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }

      // Stop all media tracks
      if (rawStreamRef.current) {
        rawStreamRef.current.getTracks().forEach(t => t.stop());
        rawStreamRef.current = null;
      }
      if (canvasStreamRef.current) {
        canvasStreamRef.current = null;
      }

      // Cancel animation frame
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }

      // Notify server
      await api.post('/livestream/go-offline');

      setIsLive(false);
      setCameraEnabled(false);
      sessionIdRef.current = null;
      toast.success('Stream ended');
    } catch (err) {
      toast.error('Error ending stream');
    }
  };

  // Toggle mic
  const toggleMic = () => {
    if (rawStreamRef.current) {
      const audioTrack = rawStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  // Poll viewer count when live
  useEffect(() => {
    if (!isLive) return;
    const poll = setInterval(() => {
      api.get('/livestream/status').then(res => {
        if (res.data?.viewer_count != null) setViewerCount(res.data.viewer_count);
      }).catch(() => {});
    }, 15000);
    return () => clearInterval(poll);
  }, [isLive]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (rawStreamRef.current) rawStreamRef.current.getTracks().forEach(t => t.stop());
      if (pcRef.current) pcRef.current.close();
    };
  }, []);

  // Access denied
  if (!hasAccess) {
    return (
      <YJRLLayout>
        <div style={{
          minHeight: '60vh', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', padding: '3rem 1.5rem',
          textAlign: 'center'
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: '16px',
            background: 'rgba(220,38,38,0.08)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem'
          }}>
            <AlertTriangle size={28} color="#dc2626" />
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.75rem', color: 'var(--yjrl-text)' }}>
            Access Denied
          </h2>
          <p style={{ color: 'var(--yjrl-muted)', maxWidth: 400, lineHeight: 1.7 }}>
            The broadcast studio is only available to club administrators and videographers.
            Contact a club admin if you need access.
          </p>
        </div>
      </YJRLLayout>
    );
  }

  return (
    <YJRLLayout>
      {/* Page Header */}
      <div style={{
        background: 'linear-gradient(135deg, var(--yjrl-blue-deeper) 0%, var(--yjrl-blue-dark) 100%)',
        padding: '2.5rem 1.5rem 2rem',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(ellipse at 70% 30%, rgba(14,165,233,0.2) 0%, transparent 60%)',
          pointerEvents: 'none'
        }} />
        <div style={{ maxWidth: 1280, margin: '0 auto', position: 'relative', zIndex: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{
              width: 48, height: 48, borderRadius: '12px',
              background: isLive ? 'rgba(220,38,38,0.2)' : 'rgba(255,255,255,0.1)',
              border: `1px solid ${isLive ? 'rgba(220,38,38,0.4)' : 'rgba(255,255,255,0.15)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Radio size={22} color={isLive ? '#ef4444' : 'white'} />
            </div>
            <div>
              <h1 style={{
                fontSize: 'clamp(1.5rem, 3vw, 2rem)', fontWeight: 900,
                color: 'white', margin: 0, textTransform: 'uppercase', letterSpacing: '-0.01em'
              }}>
                Go Live
              </h1>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem', margin: '0.2rem 0 0' }}>
                Broadcast Studio
              </p>
            </div>
            {isLive && (
              <div style={{
                marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.75rem'
              }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  background: 'rgba(220,38,38,0.15)', border: '1px solid rgba(220,38,38,0.4)',
                  borderRadius: '100px', padding: '0.4rem 1rem',
                  animation: 'yjrl-pulse-live 2s ease-in-out infinite'
                }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%', background: '#ef4444',
                    boxShadow: '0 0 8px rgba(239,68,68,0.6)'
                  }} />
                  <span style={{ color: '#ef4444', fontWeight: 800, fontSize: '0.8rem', letterSpacing: '0.1em' }}>
                    LIVE NOW
                  </span>
                </div>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '0.4rem',
                  color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem'
                }}>
                  <Eye size={14} /> {viewerCount} viewers
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Pulse animation */}
      <style>{`
        @keyframes yjrl-pulse-live {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
      `}</style>

      {/* Main Content */}
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '2rem 1.5rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '2rem', alignItems: 'start' }}>

          {/* Left: Camera Preview */}
          <div>
            <div className="yjrl-card" style={{ overflow: 'hidden' }}>
              <div style={{
                position: 'relative',
                background: '#0f172a',
                aspectRatio: '16/9',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                {/* Hidden video element for raw camera stream */}
                <video
                  ref={videoRef}
                  style={{ display: 'none' }}
                  muted
                  playsInline
                />

                {/* Visible canvas with watermark */}
                <canvas
                  ref={canvasRef}
                  style={{
                    width: '100%', height: '100%', objectFit: 'contain',
                    display: cameraEnabled ? 'block' : 'none'
                  }}
                />

                {/* Placeholder when camera is off */}
                {!cameraEnabled && (
                  <div style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    gap: '1rem', color: 'rgba(255,255,255,0.4)'
                  }}>
                    <Camera size={48} />
                    <span style={{ fontSize: '0.9rem' }}>Camera Preview</span>
                  </div>
                )}

                {/* Live overlay badge */}
                {isLive && (
                  <div style={{
                    position: 'absolute', top: 16, left: 16,
                    display: 'flex', alignItems: 'center', gap: '0.4rem',
                    background: 'rgba(220,38,38,0.9)', borderRadius: '6px',
                    padding: '0.3rem 0.75rem'
                  }}>
                    <div style={{
                      width: 6, height: 6, borderRadius: '50%', background: 'white',
                      animation: 'yjrl-pulse-live 1.5s ease-in-out infinite'
                    }} />
                    <span style={{ color: 'white', fontWeight: 800, fontSize: '0.75rem', letterSpacing: '0.1em' }}>
                      LIVE
                    </span>
                  </div>
                )}
              </div>

              {/* Controls below preview */}
              <div style={{
                padding: '1rem 1.5rem', display: 'flex', gap: '0.75rem',
                alignItems: 'center', borderTop: '1px solid var(--yjrl-border)'
              }}>
                {!cameraEnabled ? (
                  <button
                    className="yjrl-btn yjrl-btn-primary"
                    onClick={enableCamera}
                    style={{ flex: 1, justifyContent: 'center' }}
                  >
                    <Camera size={16} /> Enable Camera
                  </button>
                ) : !isLive ? (
                  <>
                    <button
                      className="yjrl-btn"
                      onClick={goLive}
                      disabled={connecting}
                      style={{
                        flex: 1, justifyContent: 'center',
                        background: '#dc2626', color: 'white',
                        opacity: connecting ? 0.6 : 1
                      }}
                    >
                      <Radio size={16} /> {connecting ? 'Connecting...' : 'Go Live Now'}
                    </button>
                    <button
                      className="yjrl-btn yjrl-btn-secondary"
                      onClick={toggleMic}
                      title={isMuted ? 'Unmute' : 'Mute'}
                    >
                      {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      className="yjrl-btn yjrl-btn-danger"
                      onClick={endStream}
                      style={{ flex: 1, justifyContent: 'center' }}
                    >
                      <Square size={16} /> End Stream
                    </button>
                    <button
                      className="yjrl-btn yjrl-btn-secondary"
                      onClick={toggleMic}
                      title={isMuted ? 'Unmute' : 'Mute'}
                    >
                      {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Connection status */}
            {cameraEnabled && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                marginTop: '1rem', fontSize: '0.8rem', color: 'var(--yjrl-muted)'
              }}>
                {isLive ? (
                  <><Wifi size={14} color="#16a34a" /> Connected &mdash; streaming to Cloudflare</>
                ) : (
                  <><WifiOff size={14} /> Camera ready &mdash; not broadcasting</>
                )}
              </div>
            )}
          </div>

          {/* Right: Stream Settings */}
          <div className="yjrl-card">
            <div className="yjrl-card-header">
              <div className="yjrl-card-title">
                <Type size={16} /> Stream Settings
              </div>
            </div>
            <div className="yjrl-card-body">
              <div className="yjrl-form-group">
                <label className="yjrl-label">Stream Title</label>
                <input
                  type="text"
                  className="yjrl-input"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Live from Yeppoon Seagulls"
                  disabled={isLive}
                />
              </div>

              <div className="yjrl-form-group">
                <label className="yjrl-label">Sponsor Text (Watermark)</label>
                <input
                  type="text"
                  className="yjrl-input"
                  value={sponsorText}
                  onChange={e => setSponsorText(e.target.value)}
                  placeholder="e.g. Sponsored by Local Business"
                />
                <div style={{ fontSize: '0.7rem', color: 'var(--yjrl-muted)', marginTop: '0.3rem' }}>
                  Burned into the video stream as a watermark
                </div>
              </div>

              <div className="yjrl-form-group">
                <label className="yjrl-label">
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <Image size={12} /> Sponsor Logo URL
                  </span>
                </label>
                <input
                  type="text"
                  className="yjrl-input"
                  value={sponsorLogo}
                  onChange={e => setSponsorLogo(e.target.value)}
                  placeholder="https://example.com/logo.png"
                  disabled={isLive}
                />
                <div style={{ fontSize: '0.7rem', color: 'var(--yjrl-muted)', marginTop: '0.3rem' }}>
                  Displayed below the video on the viewer page
                </div>
              </div>

              <div className="yjrl-form-group">
                <label className="yjrl-label">Message to Viewers</label>
                <textarea
                  className="yjrl-input"
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder="Welcome to today's stream!"
                  rows={3}
                  disabled={isLive}
                  style={{ resize: 'vertical' }}
                />
              </div>

              {/* Preview of sponsor logo */}
              {sponsorLogo && (
                <div style={{
                  marginTop: '0.5rem', padding: '1rem',
                  background: 'var(--yjrl-bg)', borderRadius: '8px',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--yjrl-muted)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
                    Logo Preview
                  </div>
                  <img
                    src={sponsorLogo}
                    alt="Sponsor logo"
                    style={{ maxHeight: 60, maxWidth: '100%', objectFit: 'contain' }}
                    onError={e => { e.target.style.display = 'none'; }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </YJRLLayout>
  );
};

export default YJRLBroadcast;
