import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { GlassCard } from '../../components/GlassCard/GlassCard';
import { User, Mail, LogOut, Loader2, CheckCircle, AlertCircle, Camera, UserCircle } from 'lucide-react';
import { useToast } from '../../components/Toast/Toast';
import { cacheData, getCachedData } from '../../utils/cache';
import { useTour } from '../../components/Tour/TourContext';
import './ProfilePage.css';

const API_BASE = '';

export function ProfilePage() {
  const navigate = useNavigate();
  const toast = useToast();
  const fileInputRef = useRef(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [savingPortrait, setSavingPortrait] = useState(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [selfPortrait, setSelfPortrait] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });
  const { tourStep, updateStep, runTourStep } = useTour();

  // Tour logic
  useEffect(() => {
    if (tourStep === 4 && !loading) {
      runTourStep({
        steps: [
          {
            element: '#tour-persona',
            popover: {
              title: '配置 AI 自画像',
              description: 'AI 会根据您的身份、兴趣等定制化地为您筛选信息。一时间不想写也没关系，可以留空以后再来补上。填完之后，让我们回到设置页面。',
              side: "top", align: 'start'
            }
          },
          {
            element: '#nav-settings',
            popover: {
              title: '返回设置并接入平台',
              description: '点击这里返回设置，接入数据源平台以进行您的第一次捕获。',
              side: "right", align: 'start',
              onNextClick: (element, step, options) => {
                options.driver.destroy();
                updateStep(6);
                navigate('/settings');
              }
            }
          }
        ]
      });
    }
  }, [tourStep, loading, runTourStep, navigate, updateStep]);

  useEffect(() => {
    fetchProfile();
  }, []);

  const getAuthHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${sessionStorage.getItem('token')}`
  });

  const fetchProfile = async () => {
    // 1. 立即展示缓存
    const cached = getCachedData('profile');
    if (cached) {
      setUsername(cached.username || '');
      setEmail(cached.email || '');
      setSelfPortrait(cached.selfPortrait || '');
      setUser(cached);
      setLoading(false);
    }

    // 2. 后台请求最新数据
    try {
      const res = await fetch(`${API_BASE}/api/user/profile`, {
        headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error('Failed to load profile');
      const data = await res.json();
      setUser(data);
      setUsername(data.username || '');
      setEmail(data.email || '');
      setSelfPortrait(data.selfPortrait || '');
      if (data.avatarUrl) {
        sessionStorage.setItem('avatarUrl', data.avatarUrl);
      } else {
        sessionStorage.removeItem('avatarUrl');
      }
      window.dispatchEvent(new Event('avatarChanged'));
      cacheData('profile', { username: data.username, email: data.email, selfPortrait: data.selfPortrait, avatarUrl: data.avatarUrl });
    } catch (err) {
      if (!cached) {
        setMessage({ type: 'error', text: err.message });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage({ type: '', text: '' });
    try {
      const res = await fetch(`${API_BASE}/api/user/profile`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ username, email, selfPortrait })
      });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(err);
      }
      const data = await res.json();
      setUser(data);
      sessionStorage.setItem('username', data.username);
      setMessage({ type: 'success', text: 'Profile updated successfully' });
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleSavePortrait = async () => {
    setSavingPortrait(true);
    try {
      const res = await fetch(`${API_BASE}/api/user/profile`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ selfPortrait })
      });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(err);
      }
      const data = await res.json();
      toast.success('自画像已保存');
    } catch (err) {
      toast.error('保存失败：' + err.message);
    } finally {
      setSavingPortrait(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('username');
    sessionStorage.removeItem('avatarUrl');
    window.dispatchEvent(new Event('avatarChanged'));
    navigate('/login');
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setMessage({ type: 'error', text: 'Please select an image file' });
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'Image size must be less than 2MB' });
      return;
    }

    setUploading(true);
    setMessage({ type: '', text: '' });

    try {
      // Read file as base64 data URL
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64Url = event.target.result;

        const res = await fetch(`${API_BASE}/api/user/avatar`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionStorage.getItem('token')}`
          },
          body: JSON.stringify({ avatarUrl: base64Url })
        });

        if (!res.ok) {
          const err = await res.text();
          throw new Error(err);
        }

        const data = await res.json();
        setUser(prev => ({ ...prev, avatarUrl: data.avatarUrl }));
        sessionStorage.setItem('avatarUrl', data.avatarUrl);
        window.dispatchEvent(new Event('avatarChanged'));
        setMessage({ type: 'success', text: 'Avatar updated!' });
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="profile-page">
        <div className="profile-loading">
          <Loader2 className="spinner" size={24} />
          <span>Loading profile...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-page">
      <header className="profile-header">
        <h1>Profile</h1>
      </header>

      <div className="profile-content">
        {/* Avatar & Username Section */}
        <GlassCard className="profile-avatar-section">
          <div className="profile-avatar-wrap" onClick={handleAvatarClick}>
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt="avatar" className="profile-avatar-img" />
            ) : (
              <div className="profile-avatar-letter">
                {user?.username?.charAt(0).toUpperCase() || 'U'}
              </div>
            )}
            <div className="profile-avatar-overlay">
              {uploading ? <Loader2 className="spinner" size={20} /> : <Camera size={20} />}
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleAvatarChange}
            style={{ display: 'none' }}
          />
          <div className="profile-username">{user?.username || 'User'}</div>
          <div className="profile-joined">
            Joined {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
          </div>
        </GlassCard>

        {/* Edit Info Section */}
        <GlassCard className="profile-info-section">
          <h2>Account Information</h2>

          {message.text && (
            <div className={`profile-message ${message.type}`}>
              {message.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
              {message.text}
            </div>
          )}

          <div className="profile-field">
            <label>
              <User size={16} />
              <span>Username</span>
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
            />
          </div>

          <div className="profile-field">
            <label>
              <Mail size={16} />
              <span>Email</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
            />
          </div>

          <button
            className="profile-save-btn"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? <Loader2 className="spinner" size={18} /> : null}
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </GlassCard>

        {/* Self-Portrait Section */}
        <GlassCard className="profile-portrait-section" id="tour-persona">
          <h2>
            <UserCircle size={18} />
            用户自画像
          </h2>
          <p className="portrait-hint">
            用你自己的话描述你的身份、兴趣领域、工作和学习目标。
            AI 将利用这些信息对你捕获的内容进行个性化价值评估。
          </p>
          <textarea
            className="portrait-textarea"
            rows={8}
            value={selfPortrait}
            onChange={(e) => setSelfPortrait(e.target.value)}
            placeholder={`尝试写一些类似这样的描述：

我是一名全栈开发者，对 React、Spring Boot 和 AI 应用开发感兴趣。目前在学习系统设计和微服务架构。平时关注技术前沿动态，偶尔需要放松解压。

也可以写更通用的内容，只要是真实的自我描述即可。`}
          />
          <div className="portrait-footer">
            <span className="portrait-char-count">{selfPortrait.length} 字</span>
            <button
              className="portrait-save-btn"
              onClick={handleSavePortrait}
              disabled={savingPortrait}
            >
              {savingPortrait ? <Loader2 className="spinner" size={16} /> : null}
              {savingPortrait ? '保存中...' : '保存自画像'}
            </button>
          </div>
        </GlassCard>

        {/* Logout Section */}
        <GlassCard className="profile-danger-section">
          <h2>Session</h2>
          <button className="profile-logout-btn" onClick={handleLogout}>
            <LogOut size={18} />
            Log Out
          </button>
        </GlassCard>
      </div>
    </div>
  );
}