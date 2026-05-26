import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Smile, ThumbsUp, Heart, Star, Zap, X, MessageCircle, Users, Flag } from 'lucide-react';
import api from '../../api';
import toast from 'react-hot-toast';

// Quick reactions for different themes
const PLAYER_REACTIONS = ['Try', 'Fast', 'Fire', 'Strong', 'Win', 'Clap', 'Smile', 'SG'];
const PARENT_REACTIONS = ['Agree', 'Thanks', 'Smile', 'Please', 'Clap', 'Support'];
const COACH_REACTIONS = ['Agree', 'Done', 'Strong', 'Plan', 'Win', 'Star'];

const PLAYER_QUICK_MSGS = [
  { text: 'Go Seagulls!', emoji: 'SG' },
  { text: 'Great game today!', emoji: 'Game' },
  { text: 'See you at training!', emoji: 'Train' },
  { text: 'Let us go!', emoji: 'Go' },
];

const formatTime = (date) => {
  const now = new Date();
  const diff = now - date;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
};

const YJRLChat = ({ theme = 'player', roomId, roomName = 'Team Chat', teamName = 'U14 Seagulls', userName = 'You', avatar = 'SG', onlineCount = 4 }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [showReactions, setShowReactions] = useState(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const [reportingMessage, setReportingMessage] = useState(null);
  const [reportForm, setReportForm] = useState({ reason: '', description: '', severity: 'medium' });
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const reactions = theme === 'player' ? PLAYER_REACTIONS : theme === 'parent' ? PARENT_REACTIONS : COACH_REACTIONS;
  const roomReady = Boolean(roomId);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  // Load messages from API with polling
  useEffect(() => {
    if (!roomId) return;
    const fetchMessages = () => {
      api.get(`/yjrl/chat?room_id=${roomId}&limit=50`).then(res => {
        if (res.data?.messages) setMessages(res.data.messages);
      }).catch(() => {});
    };
    fetchMessages();
    const interval = setInterval(fetchMessages, 5000);
    return () => clearInterval(interval);
  }, [roomId]);

  const sendMessage = () => {
    const text = input.trim();
    if (!roomReady) {
      toast.error('Chat will be available once your team is assigned');
      return;
    }
    if (!text) return;
    api.post('/yjrl/chat', { room_id: roomId, message: text, user_avatar: avatar }).then(res => {
      setMessages(prev => [...prev, res.data]);
      setInput('');
      setShowEmoji(false);
      inputRef.current?.focus();
    }).catch(err => toast.error(err.response?.data?.error || 'Failed to send message'));
  };

  const addReaction = (msgId, emoji) => {
    setMessages(prev => prev.map(m => {
      if (m.id !== msgId) return m;
      const r = { ...m.reactions };
      r[emoji] = (r[emoji] || 0) + 1;
      return { ...m, reactions: r };
    }));
    setShowReactions(null);
  };

  const sendQuickMsg = (text) => {
    if (!roomReady) {
      toast.error('Chat will be available once your team is assigned');
      return;
    }
    api.post('/yjrl/chat', { room_id: roomId, message: text, user_avatar: avatar }).then(res => {
      setMessages(prev => [...prev, res.data]);
    }).catch(err => toast.error(err.response?.data?.error || 'Failed to send message'));
  };

  const reportMessage = (msg) => {
    setReportingMessage(msg);
    setReportForm({ reason: '', description: '', severity: 'medium' });
  };

  const submitReport = () => {
    const reason = reportForm.reason.trim();
    if (!reason) {
      toast.error('Please describe the safety concern');
      return;
    }
    api.post(`/yjrl/chat/${reportingMessage.id}/report`, {
      reason,
      severity: reportForm.severity,
      description: reportForm.description.trim() || `Reported from ${roomName}`
    }).then(() => {
      toast.success('Report sent to club administrators');
      setReportingMessage(null);
    }).catch(err => toast.error(err.response?.data?.error || 'Unable to send report'));
  };

  // Theme-specific styles
  const isPlayer = theme === 'player';
  const bubbleOwn = isPlayer
    ? { background: 'linear-gradient(135deg, #1d4ed8, #3b82f6)', color: 'white' }
    : { background: '#1d4ed8', color: 'white' };
  const bubbleOther = isPlayer
    ? { background: '#f1f5f9', color: '#1e293b' }
    : { background: '#f8fafc', color: '#1e293b', border: '1px solid #e2e8f0' };

  return (
    <>
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '600px', maxHeight: '70vh',
      background: 'white',
      borderRadius: '16px',
      border: '1px solid #e2e8f0',
      overflow: 'hidden',
      boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
    }}>
      {/* Chat Header */}
      <div style={{
        padding: '1rem 1.25rem',
        background: isPlayer ? 'linear-gradient(135deg, #1d4ed8, #2563eb)' : '#f8fafc',
        color: isPlayer ? 'white' : '#1e293b',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: isPlayer ? 'none' : '1px solid #e2e8f0',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: 40, height: 40, borderRadius: '12px',
            background: isPlayer ? 'rgba(255,255,255,0.15)' : '#e0f2fe',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.2rem'
          }}>
            {isPlayer ? 'Play' : theme === 'parent' ? 'Parents' : 'Plan'}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{roomName}</div>
            <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>{teamName}</div>
          </div>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.4rem',
          fontSize: '0.75rem', opacity: 0.8,
          background: isPlayer ? 'rgba(255,255,255,0.1)' : '#f1f5f9',
          padding: '0.3rem 0.75rem', borderRadius: '100px'
        }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#4ade80' }} />
          {onlineCount} online
        </div>
      </div>

      {/* Messages Area */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '1rem',
        display: 'flex', flexDirection: 'column', gap: '0.75rem',
        background: isPlayer ? '#fafbff' : '#ffffff'
      }}>
        {!roomReady && (
          <div style={{ margin: 'auto', textAlign: 'center', color: '#64748b', maxWidth: 320 }}>
            <MessageCircle size={32} style={{ marginBottom: '0.75rem', opacity: 0.5 }} />
            <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>Chat not ready yet</div>
            <div style={{ fontSize: '0.85rem', lineHeight: 1.5 }}>A team assignment is needed before this room can open.</div>
          </div>
        )}
        {roomReady && messages.length === 0 && (
          <div style={{ margin: 'auto', textAlign: 'center', color: '#64748b', maxWidth: 320 }}>
            <Users size={32} style={{ marginBottom: '0.75rem', opacity: 0.5 }} />
            <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>No messages yet</div>
            <div style={{ fontSize: '0.85rem', lineHeight: 1.5 }}>Start the conversation when you are ready.</div>
          </div>
        )}
        {roomReady && messages.map((msg) => (
          <div key={msg.id} style={{
            display: 'flex', flexDirection: 'column',
            alignItems: msg.isOwn ? 'flex-end' : 'flex-start',
            maxWidth: '85%', alignSelf: msg.isOwn ? 'flex-end' : 'flex-start'
          }}>
            {/* User name */}
            {!msg.isOwn && (
              <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#64748b', marginBottom: '0.2rem', paddingLeft: '0.5rem' }}>
                {isPlayer && <span style={{ marginRight: '0.3rem' }}>{msg.avatar}</span>}
                {msg.user}
              </div>
            )}
            {/* Bubble */}
            <div
              style={{
                padding: '0.65rem 1rem',
                borderRadius: msg.isOwn ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                fontSize: '0.9rem', lineHeight: 1.5,
                cursor: 'pointer',
                position: 'relative',
                ...(msg.isOwn ? bubbleOwn : bubbleOther)
              }}
              onClick={() => setShowReactions(showReactions === msg.id ? null : msg.id)}
            >
              {msg.text}
            </div>

            {/* Reactions row */}
            {Object.keys(msg.reactions).length > 0 && (
              <div style={{ display: 'flex', gap: '0.3rem', marginTop: '0.25rem', flexWrap: 'wrap' }}>
                {Object.entries(msg.reactions).map(([emoji, count]) => (
                  <button
                    key={emoji}
                    onClick={() => addReaction(msg.id, emoji)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.2rem',
                      background: '#f1f5f9', border: '1px solid #e2e8f0',
                      borderRadius: '100px', padding: '0.15rem 0.5rem',
                      fontSize: '0.75rem', cursor: 'pointer',
                      transition: 'all 0.15s'
                    }}
                  >
                    {emoji} <span style={{ fontWeight: 600, color: '#64748b' }}>{count}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Reaction picker */}
            {showReactions === msg.id && (
              <div style={{
                display: 'flex', gap: '0.25rem', marginTop: '0.3rem',
                background: 'white', border: '1px solid #e2e8f0',
                borderRadius: '100px', padding: '0.3rem 0.5rem',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                animation: 'fadeIn 0.15s ease'
              }}>
                {reactions.map(emoji => (
                  <button
                    key={emoji}
                    onClick={(e) => { e.stopPropagation(); addReaction(msg.id, emoji); }}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: '1.1rem', padding: '0.2rem',
                      borderRadius: '6px', transition: 'transform 0.15s'
                    }}
                    onMouseEnter={e => e.target.style.transform = 'scale(1.3)'}
                    onMouseLeave={e => e.target.style.transform = 'scale(1)'}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}

            {/* Timestamp */}
            <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: '0.15rem', paddingLeft: msg.isOwn ? 0 : '0.5rem', paddingRight: msg.isOwn ? '0.5rem' : 0 }}>
              {formatTime(msg.time)}
            </div>
            <button
              type="button"
              onClick={() => reportMessage(msg)}
              title="Report safety concern"
              aria-label="Report safety concern"
              style={{
                marginTop: '0.2rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                fontSize: '0.68rem',
                padding: '0.15rem 0.35rem'
              }}
            >
              <Flag size={11} /> Report
            </button>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick messages (player only) */}
      {isPlayer && (
        <div style={{
          padding: '0.5rem 1rem', borderTop: '1px solid #f1f5f9',
          display: 'flex', gap: '0.4rem', overflowX: 'auto',
          flexShrink: 0
        }}>
          {PLAYER_QUICK_MSGS.map((q, i) => (
            <button
              key={i}
              onClick={() => sendQuickMsg(q.text)}
              disabled={!roomReady}
              style={{
                whiteSpace: 'nowrap',
                background: '#f0f7ff', border: '1px solid #dbeafe',
                borderRadius: '100px', padding: '0.3rem 0.75rem',
                fontSize: '0.75rem', fontWeight: 500, color: '#1d4ed8',
                cursor: 'pointer', transition: 'all 0.15s',
                flexShrink: 0
              }}
            >
              {q.emoji} {q.text.replace(q.emoji, '').trim()}
            </button>
          ))}
        </div>
      )}

      {/* Input Area */}
      <div style={{
        padding: '0.75rem 1rem', borderTop: '1px solid #e2e8f0',
        display: 'flex', gap: '0.5rem', alignItems: 'center',
        background: '#fafbfc',
        flexShrink: 0
      }}>
        <button
          onClick={() => setShowEmoji(!showEmoji)}
          style={{
            background: showEmoji ? '#e0f2fe' : 'transparent',
            border: 'none', cursor: 'pointer', padding: '0.4rem',
            borderRadius: '8px', color: '#64748b', display: 'flex'
          }}
        >
          <Smile size={20} />
        </button>

        {showEmoji && (
          <div style={{
            position: 'absolute', bottom: '4.5rem',
            background: 'white', border: '1px solid #e2e8f0',
            borderRadius: '12px', padding: '0.5rem',
            display: 'flex', gap: '0.25rem', flexWrap: 'wrap',
            maxWidth: '200px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            zIndex: 10
          }}>
            {reactions.map(emoji => (
              <button
                key={emoji}
                onClick={() => { setInput(prev => prev + emoji); setShowEmoji(false); inputRef.current?.focus(); }}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: '1.3rem', padding: '0.3rem',
                  borderRadius: '6px'
                }}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendMessage()}
          placeholder={!roomReady ? 'Team chat opens after assignment' : isPlayer ? 'Say something to your team...' : 'Type a message...'}
          disabled={!roomReady}
          style={{
            flex: 1, padding: '0.6rem 1rem',
            border: '1px solid #e2e8f0', borderRadius: '100px',
            fontSize: '0.875rem', outline: 'none',
            background: 'white',
            transition: 'border-color 0.15s'
          }}
          onFocus={e => e.target.style.borderColor = '#93c5fd'}
          onBlur={e => e.target.style.borderColor = '#e2e8f0'}
        />

        <button
          onClick={sendMessage}
          disabled={!roomReady || !input.trim()}
          style={{
            width: 38, height: 38, borderRadius: '50%',
            background: roomReady && input.trim() ? '#1d4ed8' : '#e2e8f0',
            border: 'none', cursor: roomReady && input.trim() ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: roomReady && input.trim() ? 'white' : '#94a3b8',
            transition: 'all 0.15s',
            flexShrink: 0
          }}
        >
          <Send size={16} />
        </button>
      </div>
    </div>
    {reportingMessage && (
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="chat-report-title"
        style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', zIndex: 50 }}
      >
        <div style={{ width: 'min(520px, 100%)', background: 'white', borderRadius: 10, border: '1px solid #e2e8f0', boxShadow: '0 20px 50px rgba(15,23,42,0.25)' }}>
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
            <div>
              <h2 id="chat-report-title" style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>Report a safety concern</h2>
              <div style={{ color: '#64748b', fontSize: '0.8rem', marginTop: '0.25rem' }}>Reports go to club administrators for safeguarding review.</div>
            </div>
            <button type="button" onClick={() => setReportingMessage(null)} aria-label="Close report form" style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer' }}><X size={18} /></button>
          </div>
          <div style={{ padding: '1.25rem', display: 'grid', gap: '0.85rem' }}>
            <label style={{ display: 'grid', gap: '0.35rem', fontSize: '0.85rem', fontWeight: 700 }}>
              Concern summary
              <input
                value={reportForm.reason}
                onChange={event => setReportForm(prev => ({ ...prev, reason: event.target.value }))}
                autoFocus
                style={{ border: '1px solid #cbd5e1', borderRadius: 8, padding: '0.65rem 0.75rem', fontSize: '0.9rem' }}
                placeholder="What worried you?"
              />
            </label>
            <label style={{ display: 'grid', gap: '0.35rem', fontSize: '0.85rem', fontWeight: 700 }}>
              Details
              <textarea
                value={reportForm.description}
                onChange={event => setReportForm(prev => ({ ...prev, description: event.target.value }))}
                rows={4}
                style={{ border: '1px solid #cbd5e1', borderRadius: 8, padding: '0.65rem 0.75rem', fontSize: '0.9rem', resize: 'vertical' }}
                placeholder="Add context for the safeguarding reviewer"
              />
            </label>
            <label style={{ display: 'grid', gap: '0.35rem', fontSize: '0.85rem', fontWeight: 700 }}>
              Severity
              <select
                value={reportForm.severity}
                onChange={event => setReportForm(prev => ({ ...prev, severity: event.target.value }))}
                style={{ border: '1px solid #cbd5e1', borderRadius: 8, padding: '0.65rem 0.75rem', fontSize: '0.9rem' }}
              >
                {['low', 'medium', 'high', 'critical'].map(value => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
          </div>
          <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button type="button" onClick={() => setReportingMessage(null)} style={{ border: '1px solid #cbd5e1', background: 'white', borderRadius: 8, padding: '0.6rem 0.9rem', fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
            <button type="button" onClick={submitReport} style={{ border: '1px solid #1d4ed8', background: '#1d4ed8', color: 'white', borderRadius: 8, padding: '0.6rem 0.9rem', fontWeight: 800, cursor: 'pointer' }}>Send report</button>
          </div>
        </div>
      </div>
    )}
    </>
  );
};

export default YJRLChat;
