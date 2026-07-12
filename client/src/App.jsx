import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout.jsx';

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
import Audits from './pages/Audits.jsx';
import Reports from './pages/Reports.jsx';
import Notifications from './pages/Notifications.jsx';
import Contact from './pages/Contact.jsx';

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

        {/* Screens owned by Tanishq, recreated from their *.dc.html prototypes. */}
        <Route path="/organization" element={<Organization />} />
        <Route path="/maintenance" element={<Maintenance />} />
        <Route path="/audits" element={<Audits />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/notifications" element={<Notifications />} />
      </Route>

      {/* Contact is a standalone marketing-style page (Tanishq) */}
      <Route path="/contact" element={<Contact />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
