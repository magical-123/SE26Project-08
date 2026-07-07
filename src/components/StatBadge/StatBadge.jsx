import React from 'react';
import './StatBadge.css';

export function StatBadge({ label, value, unit, icon, onClick }) {
  return (
    <div className="stat-badge" onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default' }}>
      <div className="sb-icon">{icon}</div>
      <div className="sb-content">
        <div className="sb-value">
          {value}
          {unit && <span className="sb-unit">{unit}</span>}
        </div>
        <div className="sb-label">{label}</div>
      </div>
    </div>
  );
}
