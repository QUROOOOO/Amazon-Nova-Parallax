import { useState, useEffect, useCallback } from 'react';
import { Bell, Shield, Wallet, Link as LinkIcon, X, Check, Loader2 } from 'lucide-react';
import { get, put } from 'aws-amplify/api';
import { updatePassword, fetchAuthSession } from 'aws-amplify/auth';
import './SettingsModal.css';



interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail: string;
  userName: string;
}

export default function SettingsModal({ isOpen, onClose, userEmail, userName }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<'account' | 'notifications' | 'billing' | 'integrations'>('account');
  
  // Profile state
  // Display name and bio are not currently edited here
  const [upiId, setUpiId] = useState('');
  const [upiEditing, setUpiEditing] = useState(false);
  
  // Notifications state
  const [notifCollabRequests, setNotifCollabRequests] = useState(true);
  const [notifBrandDeals, setNotifBrandDeals] = useState(true);
  const [notifProductUpdates, setNotifProductUpdates] = useState(false);
  
  // Animation state
  const [animationsDisabled, setAnimationsDisabled] = useState(() => {
    return localStorage.getItem('animationsDisabled') === 'true';
  });
  
  // Password change state
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPasswordVal, setNewPasswordVal] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  
  // UI state
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [passwordStatus, setPasswordStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Load profile from backend on mount
  const loadProfile = useCallback(async () => {
    setLoading(true);
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString() || '';

      const restOp = get({
        apiName: 'ParallaxApi',
        path: '/users',
        options: {
          headers: {
            Authorization: token
          }
        }
      });
      const response = await restOp.response;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const json: any = await response.body.json();
      
      if (json.user) {
        setUpiId(json.user.upiId || '');
        if (json.user.notifications) {
          setNotifCollabRequests(json.user.notifications.collabRequests ?? true);
          setNotifBrandDeals(json.user.notifications.brandDeals ?? true);
          setNotifProductUpdates(json.user.notifications.productUpdates ?? false);
        }
      }
    } catch (err) {
      console.error('Failed to load profile:', err);
    } finally {
      setLoading(false);
    }
  }, [userName]);

  useEffect(() => {
    if (isOpen) {
      loadProfile();
    }
  }, [isOpen, loadProfile, userName]);

  // Save notifications
  const handleSaveNotifications = async (field: string, value: boolean) => {
    // Update local state immediately
    if (field === 'collabRequests') setNotifCollabRequests(value);
    if (field === 'brandDeals') setNotifBrandDeals(value);
    if (field === 'productUpdates') setNotifProductUpdates(value);
    
    const updatedNotifs = {
      collabRequests: field === 'collabRequests' ? value : notifCollabRequests,
      brandDeals: field === 'brandDeals' ? value : notifBrandDeals,
      productUpdates: field === 'productUpdates' ? value : notifProductUpdates,
    };
    
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString() || '';

      await put({
        apiName: 'ParallaxApi',
        path: '/users',
        options: {
          headers: { Authorization: token },
          body: { notifications: updatedNotifs }
        }
      }).response;
    } catch (err) {
      console.error('Failed to save notifications:', err);
    }
  };

  // Toggle animations
  const handleToggleAnimations = (disabled: boolean) => {
    setAnimationsDisabled(disabled);
    localStorage.setItem('animationsDisabled', disabled.toString());
    
    // Dispatch custom event to notify other components
    window.dispatchEvent(new CustomEvent('animationsToggled', { detail: { disabled } }));
  };

  // Save UPI ID
  const handleSaveUpi = async () => {
    setSaving(true);
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString() || '';

      await put({
        apiName: 'ParallaxApi',
        path: '/users',
        options: {
          headers: { Authorization: token },
          body: { upiId: upiId }
        }
      }).response;
      setUpiEditing(false);
      setSaveStatus('UPI ID saved!');
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err) {
      console.error('Failed to save UPI:', err);
      setSaveStatus('Failed to save UPI ID.');
    } finally {
      setSaving(false);
    }
  };

  // Change password
  const handleChangePassword = async () => {
    if (newPasswordVal.length < 8) {
      setPasswordStatus('New password must be at least 8 characters.');
      return;
    }
    if (newPasswordVal !== confirmNewPassword) {
      setPasswordStatus('New passwords do not match.');
      return;
    }
    setSaving(true);
    setPasswordStatus(null);
    try {
      await updatePassword({ oldPassword, newPassword: newPasswordVal });
      setPasswordStatus('Password changed successfully!');
      setShowPasswordForm(false);
      setOldPassword('');
      setNewPasswordVal('');
      setConfirmNewPassword('');
      setTimeout(() => setPasswordStatus(null), 3000);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setPasswordStatus(err.message || 'Failed to change password.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="settings-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="settings-modal">
        <div className="settings-header">
          <h2 className="headline-medium">Settings</h2>
          <button className="n-icon-btn" onClick={onClose}><X size={20} /></button>
        </div>
        
        <div className="settings-content">
          <div className="settings-sidebar">
            <button className={`settings-tab ${activeTab === 'account' ? 'active' : ''}`} onClick={() => setActiveTab('account')}>
              <Shield size={16} /> Account Security
            </button>
            <button className={`settings-tab ${activeTab === 'notifications' ? 'active' : ''}`} onClick={() => setActiveTab('notifications')}>
              <Bell size={16} /> Notifications
            </button>
            <button className={`settings-tab ${activeTab === 'billing' ? 'active' : ''}`} onClick={() => setActiveTab('billing')}>
              <Wallet size={16} /> Billing & Payouts
            </button>
            <button className={`settings-tab ${activeTab === 'integrations' ? 'active' : ''}`} onClick={() => setActiveTab('integrations')}>
              <LinkIcon size={16} /> Integrations
            </button>
          </div>

          <div className="settings-pane">
            {loading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--n-on-surface-muted)' }}>
                <Loader2 size={24} className="spin-animation" /> <span style={{ marginLeft: '12px' }}>Loading...</span>
              </div>
            ) : (
              <>
                {activeTab === 'account' && (
                  <div className="settings-section">
                    <h3 className="title-large">Account Security</h3>
                    <p className="body-medium text-muted" style={{marginBottom: '24px'}}>Update your email, password, and secure your account.</p>
                    
                    <div className="form-group">
                      <label className="label-medium">Email Address</label>
                      <input type="email" className="n-input" value={userEmail} disabled />
                      <p className="body-small text-muted" style={{marginTop: '4px'}}>Verified <Check size={12} style={{display: 'inline', color: 'var(--n-accent-yellow)'}} /></p>
                    </div>

                    <div className="settings-action-row">
                      <div>
                        <h4 className="title-medium">Password</h4>
                        <p className="body-small text-muted">A secure password helps protect your account.</p>
                      </div>
                      <button 
                        className="n-btn n-btn-outline"
                        onClick={() => setShowPasswordForm(!showPasswordForm)}
                      >
                        {showPasswordForm ? 'Cancel' : 'Change Password'}
                      </button>
                    </div>

                    {showPasswordForm && (
                      <div className="password-change-form" style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <input 
                          type="password" 
                          className="n-input" 
                          placeholder="Current password"
                          value={oldPassword}
                          onChange={(e) => setOldPassword(e.target.value)}
                        />
                        <input 
                          type="password" 
                          className="n-input" 
                          placeholder="New password (8+ characters)"
                          value={newPasswordVal}
                          onChange={(e) => setNewPasswordVal(e.target.value)}
                        />
                        <input 
                          type="password" 
                          className="n-input" 
                          placeholder="Confirm new password"
                          value={confirmNewPassword}
                          onChange={(e) => setConfirmNewPassword(e.target.value)}
                        />
                        {passwordStatus && (
                          <p className={`body-small ${passwordStatus.includes('success') ? 'text-success' : 'text-accent'}`}>
                            {passwordStatus}
                          </p>
                        )}
                        <button 
                          className="n-btn n-btn-primary" 
                          onClick={handleChangePassword}
                          disabled={saving || !oldPassword || !newPasswordVal}
                          style={{ alignSelf: 'flex-start' }}
                        >
                          {saving ? 'Changing...' : 'Update Password'}
                        </button>
                      </div>
                    )}

                    <div className="settings-action-row" style={{ marginTop: '16px' }}>
                      <div>
                        <h4 className="title-medium">Two-Factor Authentication</h4>
                        <p className="body-small text-muted">Add an extra layer of security using an authenticator app.</p>
                      </div>
                      <span className="body-small text-muted" style={{ padding: '8px 16px', border: '1px dashed var(--n-outline)', borderRadius: 'var(--radius-pill)' }}>Coming Soon</span>
                    </div>
                  </div>
                )}

                {activeTab === 'notifications' && (
                  <div className="settings-section">
                    <h3 className="title-large">Notifications</h3>
                    <p className="body-medium text-muted" style={{marginBottom: '24px'}}>Choose what we email you about. Changes save automatically.</p>

                    <div className="toggle-row">
                      <div>
                        <h4 className="title-medium">Collab Requests</h4>
                        <p className="body-small text-muted">When someone wants to connect in Matchmaker.</p>
                      </div>
                      <input 
                        type="checkbox" 
                        className="n-toggle" 
                        checked={notifCollabRequests}
                        onChange={(e) => handleSaveNotifications('collabRequests', e.target.checked)}
                      />
                    </div>

                    <div className="toggle-row">
                      <div>
                        <h4 className="title-medium">Brand Deals</h4>
                        <p className="body-small text-muted">Alerts for new UPI-integrated brand opportunities.</p>
                      </div>
                      <input 
                        type="checkbox" 
                        className="n-toggle" 
                        checked={notifBrandDeals}
                        onChange={(e) => handleSaveNotifications('brandDeals', e.target.checked)}
                      />
                    </div>

                    <div className="toggle-row">
                      <div>
                        <h4 className="title-medium">Product Updates</h4>
                        <p className="body-small text-muted">New feature announcements and platform changes.</p>
                      </div>
                      <input 
                        type="checkbox" 
                        className="n-toggle" 
                        checked={notifProductUpdates}
                        onChange={(e) => handleSaveNotifications('productUpdates', e.target.checked)}
                      />
                    </div>

                    <div className="toggle-row">
                      <div>
                        <h4 className="title-medium">Disable Background Animations</h4>
                        <p className="body-small text-muted">Turn off particle effects and background animations for better performance.</p>
                      </div>
                      <input 
                        type="checkbox" 
                        className="n-toggle" 
                        checked={animationsDisabled}
                        onChange={(e) => handleToggleAnimations(e.target.checked)}
                      />
                    </div>
                  </div>
                )}

                {activeTab === 'billing' && (
                  <div className="settings-section">
                    <h3 className="title-large">Billing & Payouts</h3>
                    <p className="body-medium text-muted" style={{marginBottom: '24px'}}>Manage how you get paid for collaborations and brand deals.</p>

                    <div className="payout-method-card">
                      <div style={{display: 'flex', alignItems: 'center', gap: '12px', flex: 1}}>
                        <div className="upi-icon">UPI</div>
                        <div style={{ flex: 1 }}>
                          <h4 className="title-medium">Unified Payments Interface</h4>
                          {upiEditing ? (
                            <div style={{ display: 'flex', gap: '8px', marginTop: '8px', alignItems: 'center' }}>
                              <input 
                                type="text"
                                className="n-input"
                                placeholder="yourname@upi"
                                value={upiId}
                                onChange={(e) => setUpiId(e.target.value)}
                                style={{ flex: 1, fontSize: '0.875rem' }}
                                autoFocus
                              />
                              <button className="n-btn n-btn-primary" style={{ padding: '6px 16px' }} onClick={handleSaveUpi} disabled={saving}>
                                {saving ? '...' : 'Save'}
                              </button>
                              <button className="n-btn n-btn-outline" style={{ padding: '6px 16px' }} onClick={() => setUpiEditing(false)}>
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <p className="body-small text-muted">{upiId ? `Connected: ${upiId}` : 'Not connected'}</p>
                          )}
                        </div>
                      </div>
                      {!upiEditing && (
                        <button className="n-btn n-btn-outline" onClick={() => setUpiEditing(true)}>
                          {upiId ? 'Edit UPI ID' : 'Connect UPI ID'}
                        </button>
                      )}
                    </div>

                    {saveStatus && (
                      <p className={`body-small ${saveStatus.includes('success') || saveStatus.includes('saved') ? 'text-success' : 'text-accent'}`} style={{marginTop: '12px'}}>
                        {saveStatus}
                      </p>
                    )}

                    <div style={{marginTop: '32px'}}>
                      <h4 className="title-medium" style={{marginBottom: '12px'}}>Payout History</h4>
                      <div className="empty-state-small">
                        <p className="body-small text-muted">No payouts yet. Complete a gig to see history here.</p>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'integrations' && (
                  <div className="settings-section">
                    <h3 className="title-large">Integrations</h3>
                    <p className="body-medium text-muted" style={{marginBottom: '24px'}}>Connect your accounts for automated importing and analytics.</p>

                    <div className="settings-action-row">
                      <div>
                        <h4 className="title-medium">YouTube Data API</h4>
                        <p className="body-small text-muted">Sync your latest videos for the Parallax Workspace.</p>
                      </div>
                      <span className="body-small text-muted" style={{ padding: '8px 16px', border: '1px dashed var(--n-outline)', borderRadius: 'var(--radius-pill)' }}>Coming Soon</span>
                    </div>

                    <div className="settings-action-row">
                      <div>
                        <h4 className="title-medium">Google Drive</h4>
                        <p className="body-small text-muted">Import raw footage directly from your drive.</p>
                      </div>
                      <span className="body-small text-muted" style={{ padding: '8px 16px', border: '1px dashed var(--n-outline)', borderRadius: 'var(--radius-pill)' }}>Coming Soon</span>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
