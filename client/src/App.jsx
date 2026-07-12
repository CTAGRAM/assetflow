import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import Placeholder from './components/Placeholder.jsx';

// My screens (Parth):
import Explore from './pages/Explore.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Assets from './pages/Assets.jsx';
import AssetDetail from './pages/AssetDetail.jsx';
import Allocation from './pages/Allocation.jsx';
import Booking from './pages/Booking.jsx';

// Clean route paths the shell links to. The prototype used *.dc.html file
// links; the app maps those to the routes below.
export default function App() {
  return (
    <Routes>
      {/* Standalone screens (no app chrome) */}
      <Route path="/" element={<Explore />} />
      <Route path="/login" element={<Login />} />

      {/* App shell: topbar + routed page */}
      <Route element={<Layout />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/assets" element={<Assets />} />
        <Route path="/assets/:tag" element={<AssetDetail />} />
        <Route path="/allocation" element={<Allocation />} />
        <Route path="/booking" element={<Booking />} />

        {/* Screens owned by Tanishq — placeholders so the shell never
            white-screens before his routes land. He replaces these. */}
        <Route path="/organization" element={<Placeholder title="Organization" owner="Tanishq" />} />
        <Route path="/maintenance" element={<Placeholder title="Maintenance" owner="Tanishq" />} />
        <Route path="/audits" element={<Placeholder title="Audits" owner="Tanishq" />} />
        <Route path="/reports" element={<Placeholder title="Reports" owner="Tanishq" />} />
        <Route path="/notifications" element={<Placeholder title="Notifications" owner="Tanishq" />} />
      </Route>

      {/* Contact is a standalone marketing-style page (Tanishq) */}
      <Route path="/contact" element={<Placeholder title="Contact IT" owner="Tanishq" bare />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
