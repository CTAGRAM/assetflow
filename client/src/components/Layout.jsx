import { Navigate, Outlet } from 'react-router-dom';
import Topbar from './Topbar.jsx';
import api from '../api.js';

// App shell: the shared topbar over the routed page. Tanishq's screens render
// through the same shell (they are children of this route in App.jsx).
// No session, no app: unauthenticated visits land on the login screen.
export default function Layout() {
  if (!api.getToken()) return <Navigate to="/login" replace />;
  return (
    <div>
      <Topbar />
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
