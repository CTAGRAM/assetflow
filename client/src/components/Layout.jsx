import { Outlet } from 'react-router-dom';
import Topbar from './Topbar.jsx';

// App shell: the shared topbar over the routed page. Tanishq's screens render
// through the same shell (they are children of this route in App.jsx).
export default function Layout() {
  return (
    <div>
      <Topbar />
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
