import React, { useState, useEffect } from 'react';
import { GlassCard } from '../../components/GlassCard/GlassCard';
import { UserPlus, Search } from 'lucide-react';
import './Social.css';

const API_BASE = 'http://localhost:8080';

export function Social() {
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch(`${API_BASE}/api/social/friends`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch friends');
        return res.json();
      })
      .then(data => setFriends(data))
      .catch(() => setFriends([]))
      .finally(() => setLoading(false));
  }, []);

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
            <button className="add-friend-btn">
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
          <button className="add-friend-btn">
            <UserPlus size={16} />
            添加好友
          </button>
        </div>
      </header>

      <div className="friends-grid">
        {friends.map(friend => (
          <GlassCard key={friend.id} className="friend-card">
            <div className="fc-header">
              <div className="fc-avatar" style={{ background: friend.activeColor }}>
                {friend.initial}
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
            <div className="fc-graph-preview" style={{ '--glow': friend.activeColor }}>
              <span>点击查看图谱网络</span>
            </div>
          </GlassCard>
        ))}
      </div>
    </div>
  );
}
