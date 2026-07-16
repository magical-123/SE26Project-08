import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { GlassCard } from '../../components/GlassCard/GlassCard';
import { User, Mail, LogOut, Loader2, CheckCircle, AlertCircle, Camera } from 'lucide-react';
import './ProfilePage.css';

const API_BASE = 'http://localhost:8080';

export function ProfilePage() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    fetchProfile();
  }, []);

  const getAuthHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('token')}`
  });

  const fetchProfile = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/user/profile`, {
        headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error('Failed to load profile');
      const data = await res.json();
      setUser(data);
      setUsername(data.username || '');
      setEmail(data.email || '');
      if (data.avatarUrl) {
        localStorage.setItem('avatarUrl', data.avatarUrl);
      } else {
        localStorage.removeItem('avatarUrl');
      }
      window.dispatchEvent(new Event('avatarChanged'));
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
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
        body: JSON.stringify({ username, email })
      });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(err);
      }
      const data = await res.json();
      setUser(data);
      localStorage.setItem('username', data.username);
      setMessage({ type: 'success', text: 'Profile updated successfully' });
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    localStorage.removeItem('avatarUrl');
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
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({ avatarUrl: base64Url })
        });

        if (!res.ok) {
          const err = await res.text();
          throw new Error(err);
        }

        const data = await res.json();
        setUser(prev => ({ ...prev, avatarUrl: data.avatarUrl }));
        localStorage.setItem('avatarUrl', data.avatarUrl);
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