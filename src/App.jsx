// src/App.jsx
import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/layout/Layout';
import Home from './pages/Home';
import MatchCutTool from './pages/MatchCutTool';
import Projects from './pages/Projects';
import Account from './pages/Account';
import Tools from './pages/Tools';
import VideoEffectTool from './pages/VideoEffectTool';
import LegalPage from './pages/LegalPage';
import NotFound from './pages/NotFound';
import Pricing from './pages/Pricing';
import NoConnection from './components/layout/NoConnection';

function App() {
  return (
    <BrowserRouter>
      <NoConnection />
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="tools" element={<Tools />} />
          <Route path="effects/:type" element={<VideoEffectTool />} />
          <Route path="match-cut" element={<MatchCutTool />} />
          <Route path="projects" element={<Projects />} />
          <Route path="account" element={<Account />} />
          <Route path="pricing" element={<Pricing />} />
          <Route path="terms" element={<LegalPage title="Terms of Service" />} />
          <Route path="privacy" element={<LegalPage title="Privacy Policy" />} />
          <Route path="cookies" element={<LegalPage title="Cookie Policy" />} />
          <Route path="refund" element={<LegalPage title="Refund Policy" />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;