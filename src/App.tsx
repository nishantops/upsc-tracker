import { useAuth } from './context/AuthContext';
import { AuthGate } from './components/AuthGate';
import { Layout } from './components/Layout';

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <p>Loading…</p>
      </div>
    );
  }

  return user ? <Layout /> : <AuthGate />;
}
