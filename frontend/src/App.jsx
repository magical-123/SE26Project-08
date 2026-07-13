import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { RootLayout } from './layouts/RootLayout';
import { Dashboard } from './pages/Dashboard/Dashboard';
import { Inbox } from './pages/Inbox/Inbox';
import { KnowledgeGraph } from './pages/KnowledgeGraph/KnowledgeGraph';
import { Report } from './pages/Report/Report';
import { Social } from './pages/Social/Social';
import { Settings } from './pages/Settings/Settings';
import { AuthPage } from './pages/Auth/AuthPage';

// ProtectedRoute component checks if the user is authenticated
const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  if (!token) {
    // If no token, redirect to login page
    return <Navigate to="/login" replace />;
  }
  return children;
};

function App() {
  return (
    <BrowserRouter>
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
              </Routes>
            </RootLayout>
          </ProtectedRoute>
        } />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
