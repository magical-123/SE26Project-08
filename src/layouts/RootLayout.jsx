import React from 'react';
import { NavLink } from 'react-router-dom';
import { Compass, BookOpen, Search, PieChart, User, Settings } from 'lucide-react';
import { CommandPalette } from '../components/CommandPalette/CommandPalette';
import './RootLayout.css';

export function RootLayout({ children }) {
  const navItems = [
    { path: "/", icon: Compass, label: "DASHBOARD" },
    { path: "/inbox", icon: BookOpen, label: "INBOX" },
    { path: "/graph", icon: Search, label: "KNOWLEDGE" },
    { path: "/report", icon: PieChart, label: "REPORT" },
    { path: "/social", icon: User, label: "SOCIAL" },
    { path: "/settings", icon: Settings, label: "SETTINGS" },
  ];

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

        <div className="cascade-perspective">
          <nav className="cascade-nav-arc">
            {navItems.map((item, index) => {
              // Calculate fan layout variables
              // Base rotation for the arc
              const rotation = (index - totalItems / 2) * 5; 
              // Offset to create the arc shape visually
              const translateY = Math.abs(index - totalItems / 2) * 8;
              
              return (
                <NavLink 
                  key={item.path} 
                  to={item.path} 
                  className={({isActive}) => isActive ? "arc-item active" : "arc-item"}
                  style={{ 
                    '--layer-index': index,
                    '--total-items': totalItems,
                    '--rot-z': `${rotation}deg`,
                    '--trans-y': `${translateY}px`
                  }}
                >
                  <div className="arc-content">
                    <div className="arc-icon">
                      <item.icon size={20} strokeWidth={1.5} />
                    </div>
                    <span className="arc-label">{item.label}</span>
                  </div>
                </NavLink>
              );
            })}
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
        {children}
      </main>
      
      {/* Background Decor */}
      <div className="bg-decor-text">STRUCTURAL SECTION</div>
    </div>
  );
}
