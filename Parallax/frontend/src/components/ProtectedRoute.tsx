import { useEffect, useState, useRef } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { getCurrentUser } from 'aws-amplify/auth';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const location = useLocation();
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    getCurrentUser()
      .then(() => { if (isMounted.current) setIsAuthenticated(true); })
      .catch(() => { if (isMounted.current) setIsAuthenticated(false); });
    return () => { isMounted.current = false; };
  }, []); // Only check auth ONCE on mount — NOT on every pathname change

  // While checking auth state, show nothing to avoid flickering
  if (isAuthenticated === null) {
    return null;
  }

  if (!isAuthenticated) {
    if (location.pathname === '/auth') return null; // Prevent navigating if we're somehow already there
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}
