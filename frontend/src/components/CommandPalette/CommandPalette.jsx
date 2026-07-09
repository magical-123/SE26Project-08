import React, { useEffect, useState } from 'react';
import { Command } from 'cmdk';
import { useNavigate } from 'react-router-dom';
import { Search, Compass, BookOpen, User, Settings, PieChart } from 'lucide-react';
import './CommandPalette.css';

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const down = (e) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const runCommand = (command) => {
    setOpen(false);
    command();
  };

  if (!open) return null;

  return (
    <div className="cmdk-overlay" onClick={() => setOpen(false)}>
      <div className="cmdk-dialog" onClick={(e) => e.stopPropagation()}>
        <Command>
          <Command.Input placeholder="Search anything... (Type a command)" />
          <Command.List>
            <Command.Empty>No results found.</Command.Empty>

            <Command.Group heading="Navigation">
              <Command.Item onSelect={() => runCommand(() => navigate('/'))}>
                <Compass size={16} /> 仪表盘 (Dashboard)
              </Command.Item>
              <Command.Item onSelect={() => runCommand(() => navigate('/inbox'))}>
                <BookOpen size={16} /> 捕获箱 (Inbox)
              </Command.Item>
              <Command.Item onSelect={() => runCommand(() => navigate('/graph'))}>
                <Search size={16} /> 知识图谱 (Knowledge Graph)
              </Command.Item>
              <Command.Item onSelect={() => runCommand(() => navigate('/report'))}>
                <PieChart size={16} /> 数字报告 (Report)
              </Command.Item>
              <Command.Item onSelect={() => runCommand(() => navigate('/social'))}>
                <User size={16} /> 社交发现 (Social)
              </Command.Item>
            </Command.Group>

            <Command.Group heading="Settings">
              <Command.Item onSelect={() => runCommand(() => navigate('/settings'))}>
                <Settings size={16} /> 设置 (Settings)
              </Command.Item>
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
