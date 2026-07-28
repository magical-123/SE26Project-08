import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GlassCard } from '../../components/GlassCard/GlassCard';
import { FriendGraphView } from '../../components/FriendGraphView/FriendGraphView';
import { FriendTrendView } from '../../components/FriendTrendView/FriendTrendView';
import { UserPlus, Search, X, Check, Loader2, Eye, ChevronDown, TrendingUp } from 'lucide-react';
import './Social.css';

const API_BASE = '';

function getAuthHeaders() {
  const token = sessionStorage.getItem('token');
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

/* ------------------------------------------------------------------ */
/*  AddFriendModal                                                    */
/* ------------------------------------------------------------------ */
function AddFriendModal({ onClose, onSuccess }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [sending, setSending] = useState(null); // userId being sent to
  const [message, setMessage] = useState('');
  const timerRef = useRef(null);

  const doSearch = useCallback(async (q) => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(`${API_BASE}/api/social/users/search?q=${encodeURIComponent(q)}`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setResults(data);
      }
    } catch {
      // ignore
    } finally {
      setSearching(false);
    }
  }, []);

  const handleQueryChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => doSearch(val), 300);
  };

  const sendRequest = async (receiverId) => {
    setSending(receiverId);
    setMessage('');
    try {
      const res = await fetch(`${API_BASE}/api/social/request`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ receiverId }),
      });
      if (res.ok) {
        setMessage('好友请求已发送');
        onSuccess();
      } else {
        const text = await res.text();
        setMessage(text || '发送失败');
      }
    } catch {
      setMessage('网络错误');
    } finally {
      setSending(null);
    }
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="af-modal" onClick={e => e.stopPropagation()}>
        <div className="af-modal-header">
          <h2>添加好友</h2>
          <button className="af-close-btn" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="af-search-box">
          <Search size={16} />
          <input
            type="text"
            placeholder="搜索用户名..."
            value={query}
            onChange={handleQueryChange}
            autoFocus
          />
          {searching && <Loader2 size={16} className="af-spin" />}
        </div>
        <div className="af-results">
          {results.length === 0 && query.trim() && !searching && (
            <p className="af-empty">未找到匹配的用户</p>
          )}
          {results.map(user => (
            <div key={user.id} className="af-result-item">
              <div className="af-result-avatar">{user.username.charAt(0).toUpperCase()}</div>
              <span className="af-result-name">{user.username}</span>
              <button
                className="af-add-btn"
                onClick={() => sendRequest(user.id)}
                disabled={sending === user.id}
              >
                {sending === user.id ? <Loader2 size={14} className="af-spin" /> : <UserPlus size={14} />}
                添加
              </button>
            </div>
          ))}
        </div>
        {message && <p className="af-message">{message}</p>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Social Page                                                       */
/* ------------------------------------------------------------------ */
export function Social() {
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [viewGraph, setViewGraph] = useState(null); // { id, name }
  const [viewTrend, setViewTrend] = useState(null); // { id, name }
  const [receivedCollapsed, setReceivedCollapsed] = useState(false);
  const [sentCollapsed, setSentCollapsed] = useState(false);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = () => {
    setLoading(true);
    const token = sessionStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };
    Promise.all([
      fetch(`${API_BASE}/api/social/friends`, { headers }).then(r => r.ok ? r.json() : []),
      fetch(`${API_BASE}/api/social/requests`, { headers }).then(r => r.ok ? r.json() : []),
    ])
      .then(([friendsData, requestsData]) => {
        setFriends(friendsData);
        setRequests(requestsData);
      })
      .catch(() => {
        setFriends([]);
        setRequests([]);
      })
      .finally(() => setLoading(false));
  };

  const handleAddSuccess = () => {
    fetchAll();
  };

  const handleAccept = async (id) => {
    try {
      await fetch(`${API_BASE}/api/social/requests/${id}/accept`, {
        method: 'PUT',
        headers: getAuthHeaders(),
      });
      fetchAll();
    } catch {}
  };

  const handleReject = async (id) => {
    try {
      await fetch(`${API_BASE}/api/social/requests/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      fetchAll();
    } catch {}
  };

  const handleWithdraw = async (id) => {
    try {
      await fetch(`${API_BASE}/api/social/requests/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      fetchAll();
    } catch {}
  };

  const receivedRequests = requests.filter(r => r.direction === 'received');
  const sentRequests = requests.filter(r => r.direction === 'sent');

  if (loading) {
    return (
      <div className="social-page">
        <header className="social-header">
          <h1>社交发现</h1>
          <div className="social-actions">
            <div className="search-box">
              <Search size={16} />
              <input type="text" placeholder="搜索知识好友..." />
            </div>
            <button className="add-friend-btn" onClick={() => setShowAddModal(true)}>
              <UserPlus size={16} />
              添加好友
            </button>
          </div>
        </header>
        <div className="friends-grid" style={{ textAlign: 'center', padding: '40px 0' }}>
          加载中...
        </div>
      </div>
    );
  }

  return (
    <div className="social-page">
      <header className="social-header">
        <h1>社交发现</h1>
        <div className="social-actions">
          <div className="search-box">
            <Search size={16} />
            <input type="text" placeholder="搜索知识好友..." />
          </div>
          <button className="add-friend-btn" onClick={() => setShowAddModal(true)}>
            <UserPlus size={16} />
            添加好友
          </button>
        </div>
      </header>

      {/* 好友请求（可收起/展开） */}
      {receivedRequests.length > 0 && (
        <div className="requests-section">
          <div className="requests-title-row" onClick={() => setReceivedCollapsed(!receivedCollapsed)}>
            <h2 className="requests-title">好友请求 ({receivedRequests.length})</h2>
            <ChevronDown size={16} className={`requests-collapse-icon ${receivedCollapsed ? 'collapsed' : ''}`} />
          </div>
          {!receivedCollapsed && (
            <div className="requests-list">
              {receivedRequests.map(req => (
                <div key={req.id} className="request-item">
                  <div className="request-avatar">{req.username.charAt(0).toUpperCase()}</div>
                  <span className="request-name">{req.username}</span>
                  <div className="request-actions">
                    <button className="request-accept-btn" onClick={() => handleAccept(req.id)}>
                      <Check size={14} /> 接受
                    </button>
                    <button className="request-reject-btn" onClick={() => handleReject(req.id)}>
                      <X size={14} /> 拒绝
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 已发送的请求（可收起/展开） */}
      {sentRequests.length > 0 && (
        <div className="requests-section">
          <div className="requests-title-row" onClick={() => setSentCollapsed(!sentCollapsed)}>
            <h2 className="requests-title">已发送的请求 ({sentRequests.length})</h2>
            <ChevronDown size={16} className={`requests-collapse-icon ${sentCollapsed ? 'collapsed' : ''}`} />
          </div>
          {!sentCollapsed && (
            <div className="requests-list">
              {sentRequests.map(req => (
                <div key={req.id} className="request-item">
                  <div className="request-avatar">{req.username.charAt(0).toUpperCase()}</div>
                  <span className="request-name">{req.username}</span>
                  <span className="request-pending-label">等待对方确认</span>
                  <button className="request-withdraw-btn" onClick={() => handleWithdraw(req.id)}>
                    <X size={14} /> 撤回
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 好友列表 */}
      <div className="friends-grid">
        {friends.map(friend => (
          <GlassCard key={friend.id} className="friend-card">
            <div className="fc-header">
              <div className="fc-avatar-wrapper">
                <div className="fc-avatar" style={{ background: friend.activeColor }}>
                  {friend.initial}
                </div>
                <span className={`fc-online-dot ${friend.isOnline ? 'online' : 'offline'}`} />
              </div>
              <div className="fc-info">
                <h3>{friend.name}</h3>
                <p>{friend.status}</p>
              </div>
            </div>
            <div className="fc-body">
              <p className="fc-label">Ta 最近在刷：</p>
              <div className="fc-tags">
                {friend.tags.map(tag => (
                  <span key={tag} className="fc-tag">{tag}</span>
                ))}
              </div>
            </div>
            <div className="fc-graph-preview" style={{ '--glow': friend.activeColor }} onClick={() => setViewGraph({ id: friend.id, name: friend.name })}>
              <Eye size={14} />
              <span>查看知识图谱</span>
            </div>
            <button className="fc-trend-btn" style={{ '--glow': friend.activeColor }} onClick={() => setViewTrend({ id: friend.id, name: friend.name })}>
              <TrendingUp size={14} />
              <span>查看浏览趋势</span>
            </button>
          </GlassCard>
        ))}
      </div>

      {showAddModal && (
        <AddFriendModal
          onClose={() => setShowAddModal(false)}
          onSuccess={handleAddSuccess}
        />
      )}

      {viewGraph && (
        <FriendGraphView
          friendId={viewGraph.id}
          friendName={viewGraph.name}
          onClose={() => setViewGraph(null)}
        />
      )}
      {viewTrend && (
        <FriendTrendView
          friendId={viewTrend.id}
          friendName={viewTrend.name}
          onClose={() => setViewTrend(null)}
        />
      )}
    </div>
  );
}
