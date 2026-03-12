import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import ResearchVault from './pages/ResearchVault';
import SkillMatchmaker from './pages/SkillMatchmaker';
import ParallaxWorkspace from './pages/ParallaxWorkspace';
import Monetization from './pages/Monetization';
import Profile from './pages/Profile';
import Navigation from './components/Navigation';
import CustomCursor from './components/CustomCursor';
import ParticleBackground from './components/ParticleBackground';
import ProtectedRoute from './components/ProtectedRoute';
import Onboarding from './pages/Onboarding';
import './styles/App.css';
import { useState, useEffect } from 'react';

function AppRoutes() {
  const location = useLocation();
  const isAuth = location.pathname === '/auth' || location.pathname === '/onboarding' || location.pathname === '/';

  return (
    <div className="app-container">
      {!isAuth && <Navigation />}
      <main className={isAuth ? 'auth-main-wrapper' : 'main-content'}>
        <AnimatePresence mode="wait">
          <motion.div 
            key={location.pathname} 
            className="page-transition-wrapper"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            style={{ width: '100%', flex: 1, display: 'flex', flexDirection: 'column' }}
          >
            <Routes location={location} key={location.pathname}>
              <Route path="/" element={<Navigate to="/auth" />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/vault" element={<ProtectedRoute><ResearchVault /></ProtectedRoute>} />
              <Route path="/matchmaker" element={<ProtectedRoute><SkillMatchmaker /></ProtectedRoute>} />
              <Route path="/repurpose" element={<ProtectedRoute><ParallaxWorkspace /></ProtectedRoute>} />
              <Route path="/monetization" element={<ProtectedRoute><Monetization /></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

function App() {
  const [animationsDisabled, setAnimationsDisabled] = useState(() => {
    return localStorage.getItem('animationsDisabled') === 'true';
  });

  useEffect(() => {
    const handleAnimationsToggle = (event: CustomEvent) => {
      setAnimationsDisabled(event.detail.disabled);
    };

    window.addEventListener('animationsToggled', handleAnimationsToggle as EventListener);
    return () => window.removeEventListener('animationsToggled', handleAnimationsToggle as EventListener);
  }, []);

  return (
    <Router>
      <ParticleBackground isStatic={animationsDisabled} />
      <CustomCursor />
      <AppRoutes />
    </Router>
  );
}

export default App;
