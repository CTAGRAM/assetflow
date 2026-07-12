import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import Placeholder from './components/Placeholder.jsx';

// My screens (Parth):
import Explore from './pages/Explore.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Assets from './pages/Assets.jsx';
import Allocation from './pages/Allocation.jsx';
import Booking from './pages/Booking.jsx';

// My screens (Tanishq):
import Organization from './pages/Organization.jsx';
import Maintenance from './pages/Maintenance.jsx';

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
        {/* The registry shows asset detail inline (as in the prototype); the
            :tag form deep-links to a pre-selected asset. */}
        <Route path="/assets" element={<Assets />} />
        <Route path="/assets/:tag" element={<Assets />} />
        <Route path="/allocation" element={<Allocation />} />
        <Route path="/booking" element={<Booking />} />

        {/* Screens owned by Tanishq — placeholders so the shell never
            white-screens before his routes land. He replaces these. */}
        <Route path="/organization" element={<Organization />} />
        <Route path="/maintenance" element={<Maintenance />} />
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
