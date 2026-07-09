import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { RootLayout } from './layouts/RootLayout';
import { Dashboard } from './pages/Dashboard/Dashboard';
import { Inbox } from './pages/Inbox/Inbox';
import { KnowledgeGraph } from './pages/KnowledgeGraph/KnowledgeGraph';
import { Report } from './pages/Report/Report';
import { Social } from './pages/Social/Social';
import { Settings } from './pages/Settings/Settings';

function App() {
  return (
    <BrowserRouter>
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
    </BrowserRouter>
  );
}

export default App;
