import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { RootLayout } from './layouts/RootLayout';
import { Dashboard } from './pages/Dashboard/Dashboard';
import { Inbox } from './pages/Inbox/Inbox';
import { KnowledgeGraph } from './pages/KnowledgeGraph/KnowledgeGraph';
import { Report } from './pages/Report/Report';
import { Social } from './pages/Social/Social';
import { Settings } from './pages/Settings/Settings';
import { ProfilePage } from './pages/Profile/ProfilePage';
import { AuthPage } from './pages/Auth/AuthPage';
import { ToastProvider } from './components/Toast/Toast';

// ProtectedRoute component checks if the user is authenticated
const ProtectedRoute = ({ children }) => {
  const token = sessionStorage.getItem('token');
  if (!token) {
    // If no token, redirect to login page
    return <Navigate to="/login" replace />;
  }
  return children;
};

// AuthRedirectListener: listens for auth:expired events from api.js and navigates
function AuthRedirectListener() {
  const navigate = useNavigate();

  useEffect(() => {
    const handler = () => {
      navigate('/login', { replace: true });
    };
    window.addEventListener('auth:expired', handler);
    return () => window.removeEventListener('auth:expired', handler);
  }, [navigate]);

  return null;
}

function App() {
  return (
    <BrowserRouter>
      <AuthRedirectListener />
      <ToastProvider>
      <Routes>
        <Route path="/login" element={<AuthPage />} />
        <Route path="/*" element={
          <ProtectedRoute>
            <RootLayout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/inbox" element={<Inbox />} />
                <Route path="/graph" element={<KnowledgeGraph />} />
                <Route path="/report" element={<Report />} />
                <Route path="/social" element={<Social />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/profile" element={<ProfilePage />} />
              </Routes>
            </RootLayout>
          </ProtectedRoute>
        } />
      </Routes>
      </ToastProvider>
    </BrowserRouter>
  );
}

export default App;
