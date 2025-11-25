/**
 * HeySalad QC - Main Application
 * 
 * Root component with navigation and page routing.
 * Requirements: 3.1, 6.1
 */

import { Routes, Route, Navigate } from 'react-router-dom';
import { AdminPage, GeneratePage, StationDashboardPage, ConfigurePage } from './pages';
import { Layout } from './components/Layout';

function App() {
  return (
    <Layout>
      <Routes>
        {/* Redirect root to admin */}
        <Route path="/" element={<Navigate to="/admin" replace />} />
        
        {/* Admin - Station Management */}
        <Route path="/admin" element={<AdminPage />} />
        
        {/* Generate - Mat Generator */}
        <Route path="/generate" element={<GeneratePage />} />
        
        {/* Station Dashboard */}
        <Route path="/station/:id" element={<StationDashboardPage />} />
        
        {/* Station Configure */}
        <Route path="/station/:id/configure" element={<ConfigurePage />} />
        
        {/* Fallback - redirect unknown routes to admin */}
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </Layout>
  );
}

export default App;
