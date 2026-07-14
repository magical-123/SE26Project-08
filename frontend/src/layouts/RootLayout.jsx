import React, { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Compass, BookOpen, Search, PieChart, User, Settings, UserCircle } from 'lucide-react';
import { CommandPalette } from '../components/CommandPalette/CommandPalette';
import { useInboxItems } from '../hooks/useInboxItems';
import './RootLayout.css';

export function RootLayout({ children }) {
  const navigate = useNavigate();
  const navItems = [
    { path: "/", icon: Compass, label: "DASHBOARD" },
    { path: "/inbox", icon: BookOpen, label: "INBOX" },
    { path: "/graph", icon: Search, label: "KNOWLEDGE" },
    { path: "/report", icon: PieChart, label: "REPORT" },
    { path: "/social", icon: User, label: "SOCIAL" },
    { path: "/settings", icon: Settings, label: "SETTINGS" },
    { path: "/profile", icon: UserCircle, label: "PROFILE" },
  ];

  // 计算是否有未读/待处理项：收藏或点赞但未打开看过
  const { items } = useInboxItems();
  const hasInboxRedDot = items.some(item => (item.isFavorite || item.isLiked) && !item.opened);

  const totalItems = navItems.length;

  return (
    <div className="root-layout">
      <CommandPalette />
      
      {/* Structural Decor Lines */}
      <div className="decor-vertical-line"></div>
      
      {/* 3D Arc Cascading Navigation */}
      <aside className="cascade-nav-container">
        
        {/* Branding */}
        <div className="brand-header">
          <div className="logo-box">
            <div className="logo-mark">ID</div>
          </div>
          <div className="brand-titles">
            <h1>InfoDigest</h1>
            <span className="subtitle">SYNTHESIZE INFORMATION OS</span>
          </div>
        </div>

        <div className="nav-container-inner">
          <nav className="plain-nav-stack">
            {navItems.map((item) => (
              <NavLink 
                key={item.path} 
                to={item.path} 
                className={({isActive}) => isActive ? "nav-item active" : "nav-item"}
              >
                <div className="nav-content">
                  <item.icon size={20} strokeWidth={1.5} className="nav-icon" />
                  <span className="nav-label">{item.label}</span>
                  {item.path === "/inbox" && hasInboxRedDot && (
                    <span className="nav-red-dot" />
                  )}
                </div>
              </NavLink>
            ))}
          </nav>
        </div>

        {/* User Profile */}
        <div className="user-module" onClick={() => navigate('/profile')} style={{ cursor: 'pointer' }}>
          <div className="user-avatar">{localStorage.getItem('username')?.charAt(0).toUpperCase() || 'U'}</div>
          <div className="user-details">
            <span className="user-name">{localStorage.getItem('username') || 'User'}</span>
            <span className="user-hint">SYSTEM ACTIVE</span>
          </div>
        </div>
      </aside>

      {/* Main Content Glass Board */}
      <main className="main-glass-board">
        {children}
      </main>
      
      {/* Background Decor */}
      <div className="bg-decor-text">STRUCTURAL SECTION</div>
    </div>
  );
}
