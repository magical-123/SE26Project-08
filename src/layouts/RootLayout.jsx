import React, { useMemo } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Compass, BookOpen, Search, PieChart, User, Settings } from 'lucide-react';
import { CommandPalette } from '../components/CommandPalette/CommandPalette';
import { inboxItems } from '../mock/inboxData';
import './RootLayout.css';

export function RootLayout({ children }) {
  const location = useLocation();
  const navItems = [
    { path: "/", icon: Compass, label: "DASHBOARD" },
    { path: "/inbox", icon: BookOpen, label: "INBOX" },
    { path: "/graph", icon: Search, label: "KNOWLEDGE" },
    { path: "/report", icon: PieChart, label: "REPORT" },
    { path: "/social", icon: User, label: "SOCIAL" },
    { path: "/settings", icon: Settings, label: "SETTINGS" },
  ];

  // 计算是否有未读/待处理项：收藏或点赞但无笔记
  const hasInboxRedDot = useMemo(() => {
    return inboxItems.some(item => (item.isFavorite || item.isLiked) && !item.hasNote);
  }, []);

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
        <div className="user-module">
          <div className="user-avatar">U</div>
          <div className="user-details">
            <span className="user-name">User</span>
            <span className="user-hint">SYSTEM ACTIVE</span>
          </div>
        </div>
      </aside>

      {/* Main Content Glass Board */}
      <main className="main-glass-board">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>
      
      {/* Background Decor */}
      <div className="bg-decor-text">STRUCTURAL SECTION</div>
    </div>
  );
}
