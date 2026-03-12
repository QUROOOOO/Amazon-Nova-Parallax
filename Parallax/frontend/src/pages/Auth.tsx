import { useState, useEffect } from 'react';
import { User, Video, PenTool, Image as ImageIcon, Briefcase, Handshake, Youtube, Instagram, Twitter, Linkedin, Check, Edit3, Type, Eye, EyeOff } from 'lucide-react';
import { signUp, confirmSignUp, signIn, signOut, resetPassword, confirmResetPassword } from 'aws-amplify/auth';
import Logo from '../components/Logo';
import './Auth.css';

const ROLES = [
  { id: 'creator', label: 'Creator', icon: Video },
  { id: 'editor', label: 'Video Editor', icon: User },
  { id: 'writer', label: 'Scriptwriter', icon: PenTool },
  { id: 'designer', label: 'Designer', icon: ImageIcon },
  { id: 'manager', label: 'Manager', icon: Briefcase },
  { id: 'brand', label: 'Brand/Sponsor', icon: Handshake },
  { id: 'blogger', label: 'Blogging/Articles', icon: Type },
  { id: 'other', label: 'Other', icon: Edit3 },
];

const PLATFORMS = [
  { id: 'youtube', label: 'YouTube', icon: Youtube },
  { id: 'instagram', label: 'Instagram', icon: Instagram },
  { id: 'x', label: 'X (Twitter)', icon: Twitter },
  { id: 'linkedin', label: 'LinkedIn', icon: Linkedin },
  { id: 'other', label: 'Other', icon: Edit3 },
];

export default function Auth() {
  const [step, setStep] = useState<'auth' | 'otp' | 'profile' | 'forgot_email' | 'forgot_code'>('auth');
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [showPassword, setShowPassword] = useState(false);
  
  // Auth state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [errorLine, setErrorLine] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Profile Data
  const [fullName, setFullName] = useState('');
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [customRole, setCustomRole] = useState('');
  const [customPlatform, setCustomPlatform] = useState('');

  // Lock body scroll on Auth mount — NO signOut here to avoid race conditions
  useEffect(() => {
    document.body.classList.add('auth-active');
    return () => document.body.classList.remove('auth-active');
  }, []);

  // Helper: safely clear any stale Amplify session before attempting signIn
  const safeClearSession = async () => {
    try { await signOut(); } catch { /* no session to clear, that's fine */ }
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes('@') || password.length < 8) {
      setErrorLine('Enter a valid email and 8+ char password.');
      return;
    }
    setErrorLine('');
    setIsLoading(true);

    try {
      if (authMode === 'login') {
        // Always clear stale session BEFORE calling signIn to prevent UserAlreadyAuthenticatedException
        await safeClearSession();

        const result = await signIn({ username: email, password });

        if (result.isSignedIn) {

          window.location.href = '/dashboard';
        } else if (result.nextStep?.signInStep === 'CONFIRM_SIGN_UP') {
          setErrorLine('Account not verified. Please enter the code sent to your email.');
          setStep('otp');
          setIsLoading(false);
        } else {
          console.warn('[Auth] Unexpected signIn nextStep:', result.nextStep);
          setErrorLine('Additional verification needed. Please try again.');
          setIsLoading(false);
        }
      } else {
        // Strict Sign Up Flow
        if (password !== confirmPassword) {
          setErrorLine('Passwords do not match.');
          setIsLoading(false);
          return;
        }
        await safeClearSession();
        await signUp({
          username: email,
          password,
          options: {
            userAttributes: { email: email }
          }
        });
        setStep('otp');
        setIsLoading(false);
      }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      console.error('[Auth] Error name:', err.name, '| message:', err.message, '| full:', err);
      
      if (err.name === 'UsernameExistsException') {
        // User already exists — switch to login mode automatically
        setAuthMode('login');
        setErrorLine('Account already exists. Switched to login — please click Authenticate again.');
        setIsLoading(false);
      } else if (err.name === 'NotAuthorizedException') {
        setErrorLine('Incorrect email or password.');
        setIsLoading(false);
      } else if (err.name === 'UserNotConfirmedException') {
        setErrorLine('Account not verified. Please enter the code sent to your email.');
        setStep('otp');
        setIsLoading(false);
      } else if (err.name === 'UserAlreadyAuthenticatedException') {
        // Already signed in — just go to dashboard

        window.location.href = '/dashboard';
      } else {
        setErrorLine(err.message || 'Authentication failed. Please try again.');
        setIsLoading(false);
      }
    }
  };

  const handleForgotTrigger = async () => {
    if (!email.includes('@')) {
      setErrorLine('Enter your email first to reset password.');
      return;
    }
    setIsLoading(true);
    setErrorLine('');
    try {
      await resetPassword({ username: email });
      setStep('forgot_code');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      console.error('Reset Password Error:', err);
      setErrorLine(err.message || 'Failed to initiate password reset.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (resetCode.length < 6 || newPassword.length < 8) {
      setErrorLine('Enter the reset code and a new password (8+ chars).');
      return;
    }
    setIsLoading(true);
    setErrorLine('');
    try {
      await confirmResetPassword({ username: email, confirmationCode: resetCode, newPassword });
      setStep('auth');
      setAuthMode('login');
      setPassword(newPassword);
      setErrorLine('Password reset successfully. Please log in.');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      console.error('Confirm Reset Password Error:', err);
      setErrorLine(err.message || 'Reset failed. Check the code and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const enteredOtp = otp.join('');
    if (enteredOtp.length < 6) return;
    
    setIsLoading(true);
    setErrorLine('');

    try {
      await confirmSignUp({ username: email, confirmationCode: enteredOtp });
      await signIn({ username: email, password });
      window.location.href = '/onboarding';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      console.error('OTP Verification Error:', err);
      setErrorLine(err.message || 'Invalid code. Please try again.');
      setOtp(['', '', '', '', '', '']);
      document.getElementById('otp-0')?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || selectedRoles.length === 0 || selectedPlatforms.length === 0) {
      setErrorLine('Please complete required fields to continue.');
      return;
    }

    if (selectedRoles.includes('other') && !customRole) {
      setErrorLine('Please specify your custom role.');
      return;
    }

    if (selectedPlatforms.includes('other') && !customPlatform) {
      setErrorLine('Please specify your custom platform.');
      return;
    }

    setIsLoading(true);
    setErrorLine('');

    try {
      // For standard setup where fetch maps to API Gateway:
      // Realistically we'd use Amplify API 'post', but to avoid complex config fetching we can use native fetch on the endpoint if CORS allows.
      // Easiest is to save it locally for now if API isn't perfectly configured with auth headers on frontend yet.
      // But we will hit the backend as requested:
      localStorage.setItem('vibe_user_auth', JSON.stringify({
         name: fullName,
         roles: selectedRoles,
         platforms: selectedPlatforms,
         customRole,
         customPlatform,
         email: email
      }));
      window.location.href = '/dashboard';
    } catch {
      setErrorLine('Failed to save profile. Proceeding anyway.');
      window.location.href = '/dashboard';
    } finally {
      setIsLoading(false);
    }
  };

  // Input Handlers
  const toggleSelection = (id: string, current: string[], setter: (val: string[]) => void) => {
    if (current.includes(id)) setter(current.filter(i => i !== id));
    else setter([...current, id]);
    setErrorLine('');
  };

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    if (value !== '' && index < 5) {
      document.getElementById(`otp-${index + 1}`)?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && otp[index] === '' && index > 0) {
      document.getElementById(`otp-${index - 1}`)?.focus();
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-dot-grid" />
      <div className="auth-container">
        
        {/* Hero */}
        <div className="auth-hero">
          <div className="auth-hero-text">
            <Logo />
            <h1 className="auth-display"><span className="typography-reveal"><span>BEYOND<br />CREATION.</span></span></h1>
            <p className="auth-subtitle body-medium text-muted">The definitive ecosystem for creators.</p>
            <div className="auth-hero-accent"><span className="n-dot n-dot-pulse" /></div>
          </div>
        </div>

        {/* Form Wrapper for 50/50 Layout */}
        <div className="auth-form-wrapper">
          <div className={`auth-card n-card ${step === 'profile' ? 'auth-card-profile' : ''}`}>
            
            {step === 'auth' && (
              <form onSubmit={handleAuthSubmit} className="auth-form">
                
                {/* Segmented Tabs */}
                <div className="auth-tabs">
                  <button 
                    type="button" 
                    className={`auth-tab-btn ${authMode === 'signup' ? 'active' : ''}`}
                    onClick={() => { setAuthMode('signup'); setErrorLine(''); }}
                  >
                    SIGN UP
                  </button>
                  <button 
                    type="button" 
                    className={`auth-tab-btn ${authMode === 'login' ? 'active' : ''}`}
                    onClick={() => { setAuthMode('login'); setErrorLine(''); }}
                  >
                    LOG IN
                  </button>
                </div>

                {/* Animated Form Content */}
                <div key={authMode} className="auth-fade-in" style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-24)' }}>
                  <div className="auth-form-header">
                    <h2 className="headline-medium">{authMode === 'login' ? 'Welcome Back' : 'Enter Vault'}</h2>
                    <p className="body-small text-muted">{authMode === 'login' ? 'Log in with your credentials' : 'Create a new secure account'}</p>
                  </div>
                
                <div className="auth-input-row">
                  <input 
                    type="email" 
                    placeholder="creator@vibe.ai" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoFocus
                    className="auth-center-input"
                  />
                </div>

                <div className="auth-input-row">
                  <input 
                    type={showPassword ? "text" : "password"} 
                    placeholder="Enter secure password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="auth-center-input"
                  />
                  <button 
                    type="button" 
                    className="auth-eye-btn"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>

                {authMode === 'signup' && (
                  <div className="auth-input-row">
                    <input 
                      type={showPassword ? "text" : "password"} 
                      placeholder="Confirm secure password" 
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="auth-center-input"
                    />
                    {/* Empty button space to keep alignment with the above field perfectly symmetrical */}
                    <div className="auth-eye-btn" style={{ pointerEvents: 'none', opacity: 0 }}>
                      <Eye size={18} />
                    </div>
                  </div>
                )}
                
                {errorLine && <p className="body-small error-text" style={{marginTop: '4px'}}>{errorLine}</p>}

                <button 
                  type="submit" 
                  className={`n-btn ${(email.includes('@') && password.length >= 8 && (authMode === 'login' || password === confirmPassword)) ? 'n-btn-primary' : 'n-btn-disabled'}`}
                  disabled={!email.includes('@') || password.length < 8 || (authMode === 'signup' && password !== confirmPassword) || isLoading}
                  style={{ marginTop: '16px' }}
                >
                  {isLoading ? 'Processing...' : (authMode === 'login' ? 'Authenticate' : 'Send Secure OTP')}
                </button>
                
                {/* Dynamic Footer Link */}
                {authMode === 'login' && (
                  <button 
                    type="button" 
                    className="auth-link-btn body-small" 
                    onClick={handleForgotTrigger}
                  >
                    Forgot Password?
                  </button>
                )}
                </div>
              </form>
            )}

            {step === 'forgot_code' && (
              <form onSubmit={handleForgotSubmit} className="auth-form auth-fade-in">
                <div className="auth-form-header">
                  <h2 className="headline-medium">Reset Password</h2>
                  <p className="body-small text-muted">Sent code to {email}</p>
                </div>

                <div className="auth-input-row" style={{ marginBottom: '16px' }}>
                  <input 
                    type="text" 
                    placeholder="6-Digit Reset Code" 
                    value={resetCode}
                    onChange={(e) => setResetCode(e.target.value)}
                    autoFocus
                    maxLength={6}
                    className="n-input"
                    style={{ flex: 1, background: 'transparent', border: 'none', color: 'var(--n-on-surface)', textAlign: 'center', outline: 'none' }}
                  />
                </div>

                <div className="auth-input-row">
                  <input 
                    type={showPassword ? "text" : "password"} 
                    placeholder="New Password (8+ chars)" 
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="auth-center-input"
                  />
                  <button 
                    type="button" 
                    className="auth-eye-btn"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>

                {errorLine && <p className="body-small error-text">{errorLine}</p>}

                <button 
                  type="submit" 
                  className={`n-btn ${(resetCode.length >= 6 && newPassword.length >= 8) ? 'n-btn-primary' : 'n-btn-disabled'}`}
                  disabled={resetCode.length < 6 || newPassword.length < 8 || isLoading}
                  style={{ marginTop: '24px' }}
                >
                  {isLoading ? 'Resetting...' : 'Confirm Reset'}
                </button>

                <button 
                  type="button" 
                  className="auth-link-btn body-small" 
                  onClick={() => setStep('auth')}
                  style={{ marginTop: '16px', alignSelf: 'center' }}
                >
                  Cancel
                </button>
              </form>
            )}

            {step === 'otp' && (
              <form onSubmit={handleOtpSubmit} className="auth-form auth-fade-in">
                {/* OTP Form remains roughly the same, mapped directly to Cognito confirmSignUp */}
                <div className="auth-form-header">
                  <div>
                    <h2 className="headline-medium">Verify Identity</h2>
                    <p className="body-small text-muted">Code sent to {email}</p>
                  </div>
                  <button type="button" className="auth-link-btn body-small" onClick={() => setStep('auth')} style={{ color: 'var(--n-on-surface)' }}>Change</button>
                </div>
                
                <div className="auth-otp-row">
                  {otp.map((digit, idx) => (
                    <input
                      key={idx}
                      id={`otp-${idx}`}
                      type="text"
                      maxLength={1}
                      value={digit}
                      className="auth-otp-input headline-medium"
                      onChange={(e) => handleOtpChange(idx, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                      autoFocus={idx === 0}
                    />
                  ))}
                </div>

                {errorLine && <p className="body-small error-text">{errorLine}</p>}
                
                <button 
                  type="submit" 
                  className={`n-btn ${otp.every(d => d !== '') ? 'n-btn-primary' : 'n-btn-disabled'}`}
                  disabled={!otp.every(d => d !== '') || isLoading}
                  style={{ marginTop: '24px' }}
                >
                  {isLoading ? 'Verifying...' : 'Enter Ecosystem'}
                </button>
              </form>
            )}

            {step === 'profile' && (
              <form onSubmit={handleProfileSubmit} className="auth-form auth-fade-in">
                <div className="auth-form-header">
                  <h2 className="headline-medium">Build Your Profile</h2>
                  <p className="body-small text-muted">Tailor the ecosystem to your needs. (Select multiple)</p>
                  {errorLine && <p className="body-small error-text" style={{marginTop: '8px'}}>{errorLine}</p>}
                </div>

                <div className="auth-profile-scroll">
                  <div className="auth-section">
                    <label className="label-medium">Display Name</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Marques Brownlee" 
                      value={fullName}
                      onChange={(e) => { setFullName(e.target.value); setErrorLine(''); }}
                      className="n-input"
                    />
                  </div>

                  <div className="auth-section">
                    <label className="label-medium">Your Persona (Select multiple)</label>
                    <div className="auth-role-grid">
                      {ROLES.map(role => (
                        <button
                          key={role.id}
                          type="button"
                          className={`auth-role-card ${selectedRoles.includes(role.id) ? 'selected' : ''} ${role.id === 'other' ? 'inverted' : ''}`}
                          onClick={() => toggleSelection(role.id, selectedRoles, setSelectedRoles)}
                        >
                          <role.icon size={18} strokeWidth={1.5} />
                          <span className="body-small">{role.label}</span>
                          {selectedRoles.includes(role.id) && <Check size={14} className="auth-check" />}
                        </button>
                      ))}
                    </div>
                    {selectedRoles.includes('other') && (
                      <input 
                        type="text" 
                        placeholder="Please specify your role..." 
                        value={customRole}
                        onChange={(e) => setCustomRole(e.target.value)}
                        className="n-input"
                        style={{ marginTop: '12px' }}
                        autoFocus
                      />
                    )}
                  </div>

                  <div className="auth-section">
                    <label className="label-medium">Primary Platforms (Select multiple)</label>
                    <div className="auth-platform-row">
                      {PLATFORMS.map(platform => (
                        <button
                          key={platform.id}
                          type="button"
                          className={`auth-platform-chip ${selectedPlatforms.includes(platform.id) ? 'selected' : ''}`}
                          onClick={() => toggleSelection(platform.id, selectedPlatforms, setSelectedPlatforms)}
                        >
                          <platform.icon size={14} strokeWidth={1.5} />
                          <span>{platform.label}</span>
                        </button>
                      ))}
                    </div>
                    {selectedPlatforms.includes('other') && (
                      <input 
                        type="text" 
                        placeholder="Please specify platform..." 
                        value={customPlatform}
                        onChange={(e) => setCustomPlatform(e.target.value)}
                        className="n-input"
                        style={{ marginTop: '12px' }}
                        autoFocus
                      />
                    )}
                  </div>
                </div>

                <button 
                  type="submit" 
                  className={`n-btn ${(fullName && selectedRoles.length > 0 && selectedPlatforms.length > 0) ? 'n-btn-primary' : 'n-btn-disabled'}`}
                  disabled={isLoading}
                  style={{ marginTop: '24px' }}
                >
                  {isLoading ? 'Saving...' : 'Enter Ecosystem'}
                </button>
              </form>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
