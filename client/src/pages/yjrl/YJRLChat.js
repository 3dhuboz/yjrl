import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Smile, ThumbsUp, Heart, Star, Zap, X, MessageCircle, Users } from 'lucide-react';

// Quick reactions for different themes
const PLAYER_REACTIONS = ['🏉', '⚡', '🔥', '💪', '🎉', '👏', '😂', '🦅'];
const PARENT_REACTIONS = ['👍', '❤️', '😊', '🙏', '👏', '💛'];
const COACH_REACTIONS = ['👍', '✅', '💪', '📋', '🏆', '⭐'];

const PLAYER_QUICK_MSGS = [
  { text: 'Go Seagulls! 🦅', emoji: '🦅' },
  { text: 'Great game today!', emoji: '🏉' },
  { text: 'See you at training!', emoji: '💪' },
  { text: 'Let\'s gooo! ⚡', emoji: '⚡' },
];

// Demo chat messages for each portal type
const DEMO_MESSAGES = {
  player: [
    { id: 1, user: 'Jordan S.', avatar: '🏉', text: 'Who\'s pumped for Saturday?! 🔥', time: new Date(Date.now() - 3600000 * 3), reactions: { '🔥': 4, '💪': 2 } },
    { id: 2, user: 'Lachlan B.', avatar: '⚡', text: 'Can\'t wait! We\'re gonna smash it', time: new Date(Date.now() - 3600000 * 2.5), reactions: { '🏉': 3 } },
    { id: 3, user: 'Ethan W.', avatar: '🛡️', text: 'Coach said we\'re working on our defensive line at training tomorrow', time: new Date(Date.now() - 3600000 * 2), reactions: { '👍': 5 } },
    { id: 4, user: 'Tyler J.', avatar: '🎯', text: 'Go Seagulls! 🦅', time: new Date(Date.now() - 3600000 * 1.5), reactions: { '🦅': 6, '🎉': 2 } },
    { id: 5, user: 'Noah D.', avatar: '🌟', text: 'Anyone bringing extra water bottles? It\'s gonna be hot 🌞', time: new Date(Date.now() - 3600000), reactions: { '👏': 1 } },
    { id: 6, user: 'Riley W.', avatar: '🚀', text: 'My mum\'s doing oranges for halftime!', time: new Date(Date.now() - 1800000), reactions: {} },
  ],
  parent: [
    { id: 1, user: 'Sarah M.', text: 'Hi everyone! Just confirming — training is still on tomorrow despite the weather forecast?', time: new Date(Date.now() - 7200000), reactions: {} },
    { id: 2, user: 'Mike T. (Coach)', text: 'Yes training is on! We\'ll move under cover if it rains. Please have the kids there by 4:45.', time: new Date(Date.now() - 6800000), reactions: { '👍': 6 } },
    { id: 3, user: 'Lisa B.', text: 'Can someone do the canteen roster this Saturday? I\'m away.', time: new Date(Date.now() - 5400000), reactions: {} },
    { id: 4, user: 'Jenny K.', text: 'I can cover! Put me down 🙋‍♀️', time: new Date(Date.now() - 5000000), reactions: { '❤️': 3, '🙏': 2 } },
    { id: 5, user: 'David S.', text: 'Photo day reminder — full uniform including socks. Does anyone have a spare pair of size 2 boots?', time: new Date(Date.now() - 3600000), reactions: {} },
  ],
  coach: [
    { id: 1, user: 'Mike Thompson', text: 'Heads up — next Saturday\'s game has been moved to 11am', time: new Date(Date.now() - 86400000), reactions: { '✅': 3 } },
    { id: 2, user: 'Sarah Johnson', text: 'U10s had a great training session. Working on passing drills paid off last weekend.', time: new Date(Date.now() - 43200000), reactions: { '⭐': 2, '👍': 4 } },
    { id: 3, user: 'Dave Williams', text: 'Anyone have spare cones? The U16 set has gone walkabout again 😅', time: new Date(Date.now() - 21600000), reactions: { '😅': 3 } },
    { id: 4, user: 'Mike Thompson', text: 'Club has ordered new tackle bags — arriving next week. I\'ll store them in the shed.', time: new Date(Date.now() - 10800000), reactions: { '👍': 5 } },
  ]
};

const formatTime = (date) => {
  const now = new Date();
  const diff = now - date;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
};

const YJRLChat = ({ theme = 'player', roomName = 'Team Chat', teamName = 'U14 Seagulls', userName = 'You', onlineCount = 4 }) => {
  const [messages, setMessages] = useState(DEMO_MESSAGES[theme] || DEMO_MESSAGES.player);
  const [input, setInput] = useState('');
  const [showReactions, setShowReactions] = useState(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const reactions = theme === 'player' ? PLAYER_REACTIONS : theme === 'parent' ? PARENT_REACTIONS : COACH_REACTIONS;

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  const sendMessage = () => {
    const text = input.trim();
    if (!text) return;
    setMessages(prev => [...prev, {
      id: Date.now(),
      user: userName,
      avatar: '🦅',
      text,
      time: new Date(),
      reactions: {},
      isOwn: true
    }]);
    setInput('');
    setShowEmoji(false);
    inputRef.current?.focus();
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
    setMessages(prev => [...prev, {
      id: Date.now(), user: userName, avatar: '🦅', text, time: new Date(), reactions: {}, isOwn: true
    }]);
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
            {isPlayer ? '🏉' : theme === 'parent' ? '👨‍👩‍👧‍👦' : '📋'}
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
        {messages.map((msg) => (
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
          placeholder={isPlayer ? 'Say something to your team...' : 'Type a message...'}
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
          disabled={!input.trim()}
          style={{
            width: 38, height: 38, borderRadius: '50%',
            background: input.trim() ? '#1d4ed8' : '#e2e8f0',
            border: 'none', cursor: input.trim() ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: input.trim() ? 'white' : '#94a3b8',
            transition: 'all 0.15s',
            flexShrink: 0
          }}
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
};

export default YJRLChat;
