import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/layout/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Users from './pages/Users';
import Routers from './pages/Routers';
import Hotspot from './pages/Hotspot';
import DhcpLeases from './pages/DhcpLeases';
import PortalLogin from './pages/Portal/Login';
import './index.css';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<PortalLogin />} />
        <Route path="/admin/login" element={<Login />} />
        <Route path="/admin" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="users" element={<Users />} />
          <Route path="routers" element={<Routers />} />
          <Route path="hotspot" element={<Hotspot />} />
          <Route path="dhcp" element={<DhcpLeases />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
