/**
 * HeySalad QC - Quality Control System
 * 
 * Copyright (C) 2025 SALADHR TECHNOLOGY LTD
 * Company No. 14979493
 * Plexal, C/O Blockdojo, Here East
 * Queen Elizabeth Olympic Park
 * London, England, E20 3BS
 * 
 * HeySalad® is a registered trademark (UK00004063403)
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * 
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

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
