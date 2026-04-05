import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Radio, Send, Trash2, Pin, LogIn, MessageCircle,
  Users, Clock, Eye, Shield, AlertCircle
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import api from '../../api';
import toast from 'react-hot-toast';
import YJRLLayout from './YJRLLayout';
import './yjrl.css';

const formatTime = (dateStr) => {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now - date;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return date.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' });
};

const YJRLLive = () => {
  const { user } = useAuth();

  // Stream state
  const [streamStatus, setStreamStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);

  // Chat state
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [sending, setSending] = useState(false);

  // Refs
  const videoRef = useRef(null);
  const pcRef = useRef(null);
  const chatEndRef = useRef(null);
  const lastMsgIdRef = useRef(0);
  const chatContainerRef = useRef(null);

  const isLive = streamStatus?.is_live === 1 && streamStatus?.session_id;
  const isMod = user && ['admin', 'dev', 'videographer'].includes(user.role);

  // Poll stream status
  useEffect(() => {
    const fetchStatus = () => {
      api.get('/livestream/status').then(res => {
        setStreamStatus(res.data);
      }).catch(() => {
        setStreamStatus(null);
      }).finally(() => setLoading(false));
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  // Subscribe to stream when live
  useEffect(() => {
    if (!isLive || connected) return;

    const subscribe = async () => {
      try {
        const pc = new RTCPeerConnection({
          iceServers: [{ urls: 'stun:stun.cloudflare.com:3478' }]
        });
        pcRef.current = pc;

        // Add recvonly transceivers for video and audio
        pc.addTransceiver('video', { direction: 'recvonly' });
        pc.addTransceiver('audio', { direction: 'recvonly' });

        // Handle incoming tracks
        pc.ontrack = (event) => {
          if (videoRef.current && event.streams?.[0]) {
            videoRef.current.srcObject = event.streams[0];
          }
        };

        // Create offer
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        // Send to server
        const res = await api.post('/livestream/calls/subscribe', {
          broadcasterSessionId: streamStatus.session_id,
          sdp: offer.sdp
        });

        const answerSdp = res.data?.sessionDescription?.sdp || res.data?.sdp;
        if (answerSdp) {
          await pc.setRemoteDescription(new RTCSessionDescription({
            type: 'answer',
            sdp: answerSdp
          }));
          setConnected(true);
        }
      } catch (err) {
        console.error('Failed to subscribe to stream:', err);
      }
    };

    subscribe();

    return () => {
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
      setConnected(false);
    };
  }, [isLive, streamStatus?.session_id]);

  // Fetch chat messages
  useEffect(() => {
    if (!isLive) return;

    // Initial load
    api.get('/livestream/chat?limit=100').then(res => {
      if (Array.isArray(res.data)) {
        setMessages(res.data);
        if (res.data.length > 0) {
          lastMsgIdRef.current = res.data[res.data.length - 1].id;
        }
      }
    }).catch(() => {});

    // Poll for new messages
    const interval = setInterval(() => {
      const afterId = lastMsgIdRef.current;
      api.get(`/livestream/chat?after=${afterId}`).then(res => {
        if (Array.isArray(res.data) && res.data.length > 0) {
          setMessages(prev => [...prev, ...res.data]);
          lastMsgIdRef.current = res.data[res.data.length - 1].id;
        }
      }).catch(() => {});
    }, 3000);

    return () => clearInterval(interval);
  }, [isLive]);

  // Auto-scroll chat
  const scrollToBottom = useCallback(() => {
    if (chatContainerRef.current) {
      const el = chatContainerRef.current;
      const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
      if (isNearBottom) {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  // Send chat message
  const sendMessage = async () => {
    const text = chatInput.trim();
    if (!text || !user) return;
    setSending(true);
    try {
      await api.post('/livestream/chat', { message: text });
      setChatInput('');
    } catch (err) {
      const errMsg = err.response?.data?.error || 'Failed to send message';
      toast.error(errMsg);
    } finally {
      setSending(false);
    }
  };

  // Mod actions
  const deleteMessage = async (id) => {
    try {
      await api.delete(`/livestream/chat/${id}`);
      setMessages(prev => prev.filter(m => m.id !== id));
    } catch {
      toast.error('Failed to delete message');
    }
  };

  const pinMessage = async (id) => {
    try {
      await api.post(`/livestream/chat/${id}/pin`);
      setMessages(prev => prev.map(m => m.id === id ? { ...m, is_pinned: m.is_pinned ? 0 : 1 } : m));
    } catch {
      toast.error('Failed to pin message');
    }
  };

  // Separate pinned messages
  const pinnedMessages = messages.filter(m => m.is_pinned === 1);

  if (loading) {
    return (
      <YJRLLayout>
        <div className="yjrl-loading" style={{ minHeight: '60vh' }}>
          <div className="yjrl-spinner" />
          <span>Checking stream status...</span>
        </div>
      </YJRLLayout>
    );
  }

  return (
    <YJRLLayout>
      {/* Pulse animation for live badge */}
      <style>{`
        @keyframes yjrl-pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.3); }
        }
      `}</style>

      {isLive ? (
        /* ═══ LIVE VIEW ═══ */
        <div style={{ background: '#0f172a', minHeight: 'calc(100vh - 68px)' }}>
          <div style={{ maxWidth: 1400, margin: '0 auto', padding: '0 1rem' }}>
            {/* Stream info bar */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '1rem',
              padding: '1rem 0', flexWrap: 'wrap'
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                background: 'rgba(220,38,38,0.15)', border: '1px solid rgba(220,38,38,0.3)',
                borderRadius: '6px', padding: '0.3rem 0.75rem'
              }}>
                <div style={{
                  width: 8, height: 8, borderRadius: '50%', background: '#ef4444',
                  animation: 'yjrl-pulse-dot 1.5s ease-in-out infinite'
                }} />
                <span style={{ color: '#ef4444', fontWeight: 800, fontSize: '0.75rem', letterSpacing: '0.1em' }}>
                  LIVE
                </span>
              </div>
              <h1 style={{ color: 'white', fontSize: '1.1rem', fontWeight: 700, margin: 0, flex: 1 }}>
                {streamStatus.title || 'Live Stream'}
              </h1>
              {streamStatus.viewer_count != null && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '0.4rem',
                  color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem'
                }}>
                  <Eye size={14} /> {streamStatus.viewer_count} watching
                </div>
              )}
            </div>

            {/* Two-column: Stream + Chat */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 340px',
              gap: '1rem',
              paddingBottom: '2rem'
            }}>

              {/* Left: Video */}
              <div>
                <div style={{
                  position: 'relative',
                  background: '#000',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  aspectRatio: '16/9'
                }}>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  />
                  {!connected && (
                    <div style={{
                      position: 'absolute', inset: 0,
                      display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'center',
                      background: 'rgba(0,0,0,0.7)', color: 'rgba(255,255,255,0.5)'
                    }}>
                      <div className="yjrl-spinner" style={{ borderTopColor: '#ef4444', marginBottom: '1rem' }} />
                      <span style={{ fontSize: '0.9rem' }}>Connecting to stream...</span>
                    </div>
                  )}
                </div>

                {/* Sponsor and message area below video */}
                <div style={{ marginTop: '1rem' }}>
                  {streamStatus.sponsor_text && (
                    <div style={{
                      color: '#ca8a04', fontWeight: 600, fontSize: '0.85rem',
                      letterSpacing: '0.04em'
                    }}>
                      {streamStatus.sponsor_text}
                    </div>
                  )}
                  {streamStatus.message && (
                    <p style={{
                      color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem',
                      lineHeight: 1.6, marginTop: '0.5rem'
                    }}>
                      {streamStatus.message}
                    </p>
                  )}
                  {streamStatus.sponsor_logo && (
                    <div style={{ marginTop: '1rem' }}>
                      <img
                        src={streamStatus.sponsor_logo}
                        alt="Stream sponsor"
                        style={{
                          maxHeight: 48, maxWidth: 200, objectFit: 'contain',
                          opacity: 0.8
                        }}
                        onError={e => { e.target.style.display = 'none'; }}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Right: Live Chat */}
              <div style={{
                display: 'flex', flexDirection: 'column',
                background: '#1e293b', borderRadius: '12px',
                border: '1px solid rgba(255,255,255,0.08)',
                overflow: 'hidden',
                maxHeight: 'calc(100vh - 180px)',
                minHeight: 400
              }}>
                {/* Chat header */}
                <div style={{
                  padding: '0.75rem 1rem',
                  borderBottom: '1px solid rgba(255,255,255,0.08)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  flexShrink: 0
                }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    color: 'white', fontWeight: 700, fontSize: '0.9rem'
                  }}>
                    <MessageCircle size={16} /> Live Chat
                  </div>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '0.3rem',
                    color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem'
                  }}>
                    <Users size={12} /> {messages.length} messages
                  </div>
                </div>

                {/* Pinned messages */}
                {pinnedMessages.length > 0 && (
                  <div style={{
                    borderBottom: '1px solid rgba(255,255,255,0.08)',
                    flexShrink: 0
                  }}>
                    {pinnedMessages.map(msg => (
                      <div key={`pin-${msg.id}`} style={{
                        padding: '0.5rem 1rem',
                        background: 'rgba(202,138,4,0.1)',
                        display: 'flex', alignItems: 'flex-start', gap: '0.5rem',
                        fontSize: '0.8rem'
                      }}>
                        <Pin size={12} color="#ca8a04" style={{ flexShrink: 0, marginTop: 2 }} />
                        <div>
                          <span style={{ color: '#fbbf24', fontWeight: 700 }}>{msg.user_name}</span>
                          <span style={{ color: 'rgba(255,255,255,0.7)', marginLeft: '0.5rem' }}>{msg.message}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Messages list */}
                <div
                  ref={chatContainerRef}
                  style={{
                    flex: 1, overflowY: 'auto', padding: '0.5rem 0',
                    display: 'flex', flexDirection: 'column'
                  }}
                >
                  {messages.map(msg => (
                    <div
                      key={msg.id}
                      style={{
                        padding: '0.4rem 1rem',
                        display: 'flex', alignItems: 'flex-start', gap: '0.5rem',
                        transition: 'background 0.15s'
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span style={{
                          fontWeight: 700, fontSize: '0.8rem',
                          color: msg.is_mod === 1 ? '#fbbf24' : 'rgba(255,255,255,0.85)'
                        }}>
                          {msg.user_name}
                        </span>
                        {msg.is_mod === 1 && (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: '0.2rem',
                            background: 'rgba(202,138,4,0.2)', border: '1px solid rgba(202,138,4,0.3)',
                            borderRadius: '3px', padding: '0 0.3rem',
                            fontSize: '0.6rem', fontWeight: 800, color: '#fbbf24',
                            letterSpacing: '0.06em', marginLeft: '0.4rem',
                            verticalAlign: 'middle'
                          }}>
                            <Shield size={8} /> MOD
                          </span>
                        )}
                        <span style={{
                          color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem',
                          marginLeft: '0.5rem', wordBreak: 'break-word'
                        }}>
                          {msg.message}
                        </span>
                        <span style={{
                          color: 'rgba(255,255,255,0.2)', fontSize: '0.65rem',
                          marginLeft: '0.5rem', whiteSpace: 'nowrap'
                        }}>
                          {formatTime(msg.created_at)}
                        </span>
                      </div>

                      {/* Mod actions */}
                      {isMod && (
                        <div style={{
                          display: 'flex', gap: '0.2rem', flexShrink: 0, opacity: 0.4,
                          transition: 'opacity 0.15s'
                        }}
                          onMouseEnter={e => { e.currentTarget.style.opacity = '1'; }}
                          onMouseLeave={e => { e.currentTarget.style.opacity = '0.4'; }}
                        >
                          <button
                            onClick={() => pinMessage(msg.id)}
                            title={msg.is_pinned ? 'Unpin' : 'Pin'}
                            style={{
                              background: 'none', border: 'none', cursor: 'pointer',
                              color: msg.is_pinned ? '#ca8a04' : 'rgba(255,255,255,0.4)',
                              padding: '0.2rem', display: 'flex'
                            }}
                          >
                            <Pin size={12} />
                          </button>
                          <button
                            onClick={() => deleteMessage(msg.id)}
                            title="Delete"
                            style={{
                              background: 'none', border: 'none', cursor: 'pointer',
                              color: 'rgba(255,255,255,0.4)', padding: '0.2rem', display: 'flex'
                            }}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>

                {/* Chat input */}
                <div style={{
                  padding: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.08)',
                  flexShrink: 0
                }}>
                  {user ? (
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <input
                        type="text"
                        value={chatInput}
                        onChange={e => setChatInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                        placeholder="Say something..."
                        disabled={sending}
                        style={{
                          flex: 1, padding: '0.55rem 0.75rem',
                          background: 'rgba(255,255,255,0.06)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: '8px', color: 'white',
                          fontSize: '0.85rem', outline: 'none',
                          fontFamily: 'inherit'
                        }}
                      />
                      <button
                        onClick={sendMessage}
                        disabled={!chatInput.trim() || sending}
                        style={{
                          width: 36, height: 36, borderRadius: '8px',
                          background: chatInput.trim() ? '#1d4ed8' : 'rgba(255,255,255,0.06)',
                          border: 'none', cursor: chatInput.trim() ? 'pointer' : 'default',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: chatInput.trim() ? 'white' : 'rgba(255,255,255,0.2)',
                          transition: 'all 0.15s', flexShrink: 0
                        }}
                      >
                        <Send size={14} />
                      </button>
                    </div>
                  ) : (
                    <Link
                      to="/login"
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        gap: '0.5rem', padding: '0.6rem', borderRadius: '8px',
                        background: 'rgba(29,78,216,0.15)', border: '1px solid rgba(29,78,216,0.25)',
                        color: '#60a5fa', textDecoration: 'none',
                        fontWeight: 600, fontSize: '0.85rem'
                      }}
                    >
                      <LogIn size={14} /> Sign in to chat
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ═══ NOT LIVE VIEW ═══ */
        <div style={{
          minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'linear-gradient(165deg, var(--yjrl-blue-deeper) 0%, var(--yjrl-blue-dark) 50%, #0f172a 100%)',
          padding: '3rem 1.5rem', textAlign: 'center'
        }}>
          <div style={{ maxWidth: 500 }}>
            <div style={{
              width: 80, height: 80, borderRadius: '20px',
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 2rem'
            }}>
              <Radio size={36} color="rgba(255,255,255,0.3)" />
            </div>
            <h1 style={{
              fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', fontWeight: 900,
              color: 'white', margin: '0 0 1rem', textTransform: 'uppercase',
              letterSpacing: '-0.01em'
            }}>
              Not Live Right Now
            </h1>
            <p style={{
              color: 'rgba(255,255,255,0.5)', fontSize: '1.05rem',
              lineHeight: 1.7, margin: '0 0 2rem'
            }}>
              Check back during game days for live coverage of Yeppoon Seagulls matches.
              Our streams are broadcast live from the sideline.
            </p>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
              background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.2)',
              borderRadius: '100px', padding: '0.5rem 1.25rem',
              color: '#fbbf24', fontSize: '0.85rem', fontWeight: 600
            }}>
              <Clock size={14} /> Streams happen on match days
            </div>
            <div style={{ marginTop: '2.5rem' }}>
              <Link to="/fixtures" className="yjrl-btn yjrl-btn-primary">
                View Upcoming Fixtures
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Responsive overrides */}
      <style>{`
        @media (max-width: 860px) {
          /* Stack video and chat on mobile */
          div[style*="gridTemplateColumns: '1fr 340px'"],
          div[style*="grid-template-columns"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </YJRLLayout>
  );
};

export default YJRLLive;
