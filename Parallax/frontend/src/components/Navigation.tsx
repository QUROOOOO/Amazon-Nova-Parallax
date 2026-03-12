import { useState, useEffect, useRef, useCallback } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Zap, Database, Users, Repeat, DollarSign, Sun, Moon, Settings, LogOut, User } from 'lucide-react';
import { fetchUserAttributes } from 'aws-amplify/auth';
import { signOut } from 'aws-amplify/auth';
import SettingsModal from './SettingsModal';
import './Navigation.css';

export default function Navigation() {
  const navigate = useNavigate();

  const navItems = [
    { path: '/dashboard', icon: Zap, label: 'Spark' },
    { path: '/vault', icon: Database, label: 'Vault' },
    { path: '/matchmaker', icon: Users, label: 'Match' },
    { path: '/repurpose', icon: Repeat, label: 'Lab' },
    { path: '/monetization', icon: DollarSign, label: 'Earn' },
  ];

  const [theme, setTheme] = useState(
    localStorage.getItem('theme') ||
    (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
  );

  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [userName, setUserName] = useState('');
  const [userImage, setUserImage] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Fetch real user data from Cognito on mount
  useEffect(() => {
    const loadUser = async () => {
      try {
        const attrs = await fetchUserAttributes();
        setUserEmail(attrs.email || '');
        // Try to get name and image from localStorage profile data first
        const savedProfile = localStorage.getItem('vibe_user_auth');
        if (savedProfile) {
          const profile = JSON.parse(savedProfile);
          setUserName(profile.name || attrs.email?.split('@')[0] || 'Creator');
          if (profile.image) setUserImage(profile.image);
        } else {
          setUserName(attrs.email?.split('@')[0] || 'Creator');
        }
        // Also check Cognito picture attribute
        if (attrs.picture) setUserImage(attrs.picture);
      } catch {
        // Fallback for unauthenticated state
        setUserEmail('Not signed in');
        setUserName('Creator');
      }
    };
    loadUser();
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  }, []);

  const handleLogout = async () => {
    try {
      await signOut();
      localStorage.removeItem('vibe_user_auth');
      navigate('/');
    } catch (err) {
      console.error('Logout failed:', err);
      navigate('/');
    }
  };

  const handleOpenSettings = () => {
    setShowAccountMenu(false);
    setShowSettings(true);
  };

  // Close account menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowAccountMenu(false);
      }
    };
    if (showAccountMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showAccountMenu]);

  // Get user initials for avatar
  const getInitials = () => {
    if (userName && userName !== 'Creator') {
      return userName.slice(0, 2).toUpperCase();
    }
    if (userEmail && userEmail !== 'Not signed in') {
      return userEmail.slice(0, 2).toUpperCase();
    }
    return 'VC';
  };

  return (
    <>
      <nav className="n-nav">
        {/* Navigation Items — Top/Left aligned */}
        <div className="n-nav-items">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `n-nav-item ${isActive ? 'active' : ''}`}
              title={item.label}
            >
              <item.icon size={20} strokeWidth={1.5} />
              <span className="n-nav-label">{item.label}</span>
            </NavLink>
          ))}
        </div>

        {/* Account Avatar — Bottom of rail */}
        <div className="n-nav-account" ref={menuRef}>
          <button
            className="n-account-btn"
            onClick={() => setShowAccountMenu(!showAccountMenu)}
            title="Account"
          >
              {userImage ? (
              <img src={userImage} alt="Profile" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', border: '1px solid rgba(255,255,255,0.1)' }} />
            ) : (
              <span className="n-account-initials">{getInitials()}</span>
            )}
          </button>
          {showAccountMenu && (
            <div className="n-account-menu">
              <div className="n-account-info">
                <div className="n-account-avatar">
                  {userImage ? (
                    <img src={userImage} alt="Profile" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                  ) : (
                    getInitials()
                  )}
                </div>
                <div>
                  <div className="n-account-name">{userName}</div>
                  <div className="n-account-email body-small text-muted">{userEmail}</div>
                </div>
              </div>
              <div className="n-account-divider" />
              
              <button className="n-account-menu-item" onClick={toggleTheme}>
                {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />} 
                {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
              </button>
              <button className="n-account-menu-item" onClick={handleOpenSettings}>
                <Settings size={14} /> Settings
              </button>
              <button className="n-account-menu-item" onClick={() => { setShowAccountMenu(false); navigate('/profile'); }}>
                <User size={14} /> My Profile
              </button>
              
              <div className="n-account-divider" />
              <button className="n-account-menu-item n-logout" onClick={handleLogout}>
                <LogOut size={14} /> Log Out
              </button>
            </div>
          )}
        </div>
      </nav>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        userEmail={userEmail}
        userName={userName}
      />
    </>
  );
}
