import React from 'react';
import { NavLink } from 'react-router-dom';
import { Compass, BookOpen, Search, PieChart, User, Settings } from 'lucide-react';
import { CommandPalette } from '../components/CommandPalette/CommandPalette';
import './RootLayout.css';

export function RootLayout({ children }) {
  return (
    <div className="root-layout">
      <CommandPalette />
      
      <aside className="sidebar-glass">
        <div className="sidebar-brand">
          <div className="brand-logo">🧠</div>
          <h1>InfoDigest</h1>
        </div>

        <nav className="sidebar-nav">
          <NavLink to="/" className={({isActive}) => isActive ? "nav-item active" : "nav-item"}>
            <Compass size={18} />
            <span>仪表盘</span>
          </NavLink>
          <NavLink to="/inbox" className={({isActive}) => isActive ? "nav-item active" : "nav-item"}>
            <BookOpen size={18} />
            <span>捕获箱</span>
          </NavLink>
          <NavLink to="/graph" className={({isActive}) => isActive ? "nav-item active" : "nav-item"}>
            <Search size={18} />
            <span>知识图谱</span>
          </NavLink>
          <NavLink to="/report" className={({isActive}) => isActive ? "nav-item active" : "nav-item"}>
            <PieChart size={18} />
            <span>数字报告</span>
          </NavLink>
          <NavLink to="/social" className={({isActive}) => isActive ? "nav-item active" : "nav-item"}>
            <User size={18} />
            <span>社交发现</span>
          </NavLink>
          <NavLink to="/settings" className={({isActive}) => isActive ? "nav-item active" : "nav-item"}>
            <Settings size={18} />
            <span>设置</span>
          </NavLink>
        </nav>

        <div className="sidebar-footer">
          <div className="user-profile">
            <div className="avatar">U</div>
            <div className="user-info">
              <span className="name">User</span>
              <span className="hint">⌘K to search</span>
            </div>
          </div>
        </div>
      </aside>

      <main className="main-glass-area">
        {children}
      </main>
    </div>
  );
}
