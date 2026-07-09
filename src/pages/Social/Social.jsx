import React from 'react';
import { useNavigate } from 'react-router-dom';
import { GlassCard } from '../../components/GlassCard/GlassCard';
import { socialFriends } from '../../mock/socialData';
import { UserPlus, Search, ArrowUpRight } from 'lucide-react';
import './Social.css';

export function Social() {
  const navigate = useNavigate();
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
        {socialFriends.map(friend => (
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
            <div className="fc-graph-preview" style={{ '--glow': friend.activeColor }} onClick={() => navigate('/graph')}>
              <span>查看图谱网络 <ArrowUpRight size={12} /></span>
            </div>
          </GlassCard>
        ))}
      </div>
    </div>
  );
}
