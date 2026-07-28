import React, { useState } from 'react';
import { User, Lock, Mail, ArrowRight, Loader2 } from 'lucide-react';
import './AuthPage.css';

export function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: ''
  });

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError(''); // clear error when typing
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
    const payload = isLogin 
      ? { username: formData.username, password: formData.password }
      : { username: formData.username, email: formData.email, password: formData.password };

    try {
      const response = await fetch(`${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Authentication failed');
      }

      const data = await response.json();
      
      // 先清除旧数据
      localStorage.removeItem('infodigest_inbox_cache_v2');
      sessionStorage.clear();
      
      // 再存入新 token
      sessionStorage.setItem('token', data.token);
      sessionStorage.setItem('username', data.username);
      if (data.avatarUrl) {
        sessionStorage.setItem('avatarUrl', data.avatarUrl);
      } else {
        sessionStorage.removeItem('avatarUrl');
      }
      window.dispatchEvent(new Event('avatarChanged'));
      
      // 硬刷新确保全新状态
      window.location.href = '/';
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page-container">
      {/* Branding - Top Left */}
      <div className="auth-brand-header">
        <div className="auth-logo-box">
          <div className="auth-logo-mark">ID</div>
        </div>
        <div className="auth-brand-titles">
          <h1>InfoDigest</h1>
          <span className="auth-subtitle">SYNTHESIZE INFORMATION OS</span>
        </div>
      </div>

      {/* Decor Text - Bottom Left */}
      <div className="auth-bg-decor-text">STRUCTURAL SECTION</div>

      <div className="auth-glass-card">
        <div className="auth-header">
          <h2>{isLogin ? 'Welcome Back' : 'Create Account'}</h2>
          <p>{isLogin ? 'Log in to continue to InfoDigest' : 'Start synthesizing your information'}</p>
        </div>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="input-group">
            <User size={18} className="input-icon" />
            <input 
              type="text" 
              name="username" 
              placeholder="Username" 
              value={formData.username}
              onChange={handleInputChange}
              required 
            />
          </div>

          {!isLogin && (
            <div className="input-group">
              <Mail size={18} className="input-icon" />
              <input 
                type="email" 
                name="email" 
                placeholder="Email Address" 
                value={formData.email}
                onChange={handleInputChange}
                required 
              />
            </div>
          )}

          <div className="input-group">
            <Lock size={18} className="input-icon" />
            <input 
              type="password" 
              name="password" 
              placeholder="Password" 
              value={formData.password}
              onChange={handleInputChange}
              required 
            />
          </div>

          <button type="submit" className="auth-submit-btn" disabled={loading}>
            {loading ? <Loader2 className="spinner" size={20} /> : (isLogin ? 'Login' : 'Sign Up')}
            {!loading && <ArrowRight size={18} />}
          </button>
        </form>

        <div className="auth-footer">
          <span>{isLogin ? "Don't have an account?" : "Already have an account?"}</span>
          <button 
            type="button" 
            className="toggle-mode-btn" 
            onClick={() => {
              setIsLogin(!isLogin);
              setError('');
            }}
          >
            {isLogin ? 'Sign up' : 'Log in'}
          </button>
        </div>
      </div>
    </div>
  );
}
