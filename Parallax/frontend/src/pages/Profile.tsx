import { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, Edit3, Save, X, Plus, Trash2, Youtube, Globe, Image as ImageIcon, Video } from 'lucide-react';
import { fetchUserAttributes } from 'aws-amplify/auth';
import { motion, AnimatePresence } from 'framer-motion';
import './Profile.css';

const CREATOR_NICHES = [
  { id: 'youtuber', label: 'YouTuber', emoji: '🎬' },
  { id: 'podcaster', label: 'Podcaster', emoji: '🎙️' },
  { id: 'streamer', label: 'Streamer', emoji: '🎮' },
  { id: 'blogger', label: 'Blogger / Writer', emoji: '✍️' },
  { id: 'shortform', label: 'Short-form (Reels/TikTok)', emoji: '📱' },
  { id: 'educator', label: 'Educator / Courses', emoji: '📚' },
];

const CREATOR_TOOLS = [
  'Premiere Pro', 'Final Cut Pro', 'DaVinci Resolve',
  'CapCut', 'After Effects', 'Canva',
  'OBS Studio', 'Photoshop', 'Lightroom',
  'Figma', 'Notion', 'ChatGPT / AI',
];

const STATUS_OPTIONS = [
  { value: 'collab', label: '🤝 Available for Collab' },
  { value: 'gigs', label: '💼 Open to Gigs' },
  { value: 'busy', label: '🔨 Busy Building' },
];

interface MediaItem {
  id: string;
  type: 'image' | 'video';
  url: string;
  name: string;
}

export default function Profile() {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Profile data
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [fullName, setFullName] = useState('');
  const [nickname, setNickname] = useState('');
  const [tagline, setTagline] = useState('');
  const [email, setEmail] = useState('');
  const [selectedNiches, setSelectedNiches] = useState<string[]>([]);
  const [tools, setTools] = useState<string[]>([]);
  const [portfolio, setPortfolio] = useState('');
  const [social, setSocial] = useState('');
  const [status, setStatus] = useState('');
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);

  // Other inputs state
  const [showOtherNiche, setShowOtherNiche] = useState(false);
  const [otherNiche, setOtherNiche] = useState('');
  const [showOtherTool, setShowOtherTool] = useState(false);
  const [otherTool, setOtherTool] = useState('');

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);

  // Load profile from localStorage + Cognito
  useEffect(() => {
    const loadProfile = async () => {
      try {
        const attrs = await fetchUserAttributes();
        setEmail(attrs.email || '');
      } catch { /* not signed in */ }

      const saved = localStorage.getItem('parallax_onboarding_data');
      if (saved) {
        try {
          const data = JSON.parse(saved);
          setFullName(data.fullName || '');
          setNickname(data.nickname || '');
          setTagline(data.tagline || '');
          setSelectedNiches(data.niches || []);
          setTools(data.tools || []);
          setPortfolio(data.portfolio || '');
          setSocial(data.social || '');
          setStatus(data.status || '');
          if (data.avatarPreview) setAvatarPreview(data.avatarPreview);
        } catch { /* bad data */ }
      }

      const savedMedia = localStorage.getItem('parallax_profile_media');
      if (savedMedia) {
        try { setMediaItems(JSON.parse(savedMedia)); } catch { /* */ }
      }
    };
    loadProfile();
  }, []);

  const saveProfile = useCallback(() => {
    setIsSaving(true);
    const profileData = {
      fullName, nickname, tagline, niches: selectedNiches,
      tools, portfolio, social, status, avatarPreview
    };
    localStorage.setItem('parallax_onboarding_data', JSON.stringify(profileData));
    // Also update parallax_user_auth for Navigation avatar
    const authData = { name: fullName || nickname, image: avatarPreview };
    localStorage.setItem('parallax_user_auth', JSON.stringify(authData));
    localStorage.setItem('parallax_profile_media', JSON.stringify(mediaItems));
    setTimeout(() => {
      setIsSaving(false);
      setIsEditing(false);
    }, 400);
  }, [fullName, nickname, tagline, selectedNiches, tools, portfolio, social, status, avatarPreview, mediaItems]);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setAvatarPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleMediaUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        const newItem: MediaItem = {
          id: Date.now().toString() + Math.random().toString(36).slice(2),
          type: file.type.startsWith('video/') ? 'video' : 'image',
          url: reader.result as string,
          name: file.name,
        };
        setMediaItems(prev => [...prev, newItem]);
      };
      reader.readAsDataURL(file);
    });
    if (mediaInputRef.current) mediaInputRef.current.value = '';
  };

  const removeMedia = (id: string) => {
    setMediaItems(prev => prev.filter(m => m.id !== id));
  };

  const toggleNiche = (id: string) => {
    setSelectedNiches(prev =>
      prev.includes(id) ? prev.filter(n => n !== id) : [...prev, id]
    );
  };

  const toggleTool = (tool: string) => {
    setTools(prev =>
      prev.includes(tool) ? prev.filter(t => t !== tool) : [...prev, tool]
    );
  };

  return (
    <div className="profile-page">
      <div className="profile-sticky-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 className="dot-display" style={{ fontSize: 'clamp(1.8rem, 4vw, 2.5rem)', margin: 0 }}>
            <span className="typography-reveal"><span>My Profile</span></span>
          </h1>
          {!isEditing ? (
            <button className="profile-edit-btn" onClick={() => setIsEditing(true)}>
              <Edit3 size={16} /> Edit Profile
            </button>
          ) : (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="profile-cancel-btn" onClick={() => setIsEditing(false)}>
                <X size={16} /> Cancel
              </button>
              <button className="profile-save-btn" onClick={saveProfile} disabled={isSaving}>
                <Save size={16} /> {isSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="profile-content">
        {/* ===== HERO SECTION: Avatar + Core Info ===== */}
        <section className="profile-hero">
          <div className="profile-avatar-section">
            <div className="profile-avatar-large" onClick={() => isEditing && avatarInputRef.current?.click()}>
              {avatarPreview ? (
                <img src={avatarPreview} alt="Avatar" className="profile-avatar-img" />
              ) : (
                <Camera size={32} />
              )}
              {isEditing && <div className="profile-avatar-overlay"><Camera size={20} /></div>}
            </div>
            <input ref={avatarInputRef} type="file" accept="image/*" hidden onChange={handleAvatarChange} />

            <div className="profile-identity">
              {isEditing ? (
                <>
                  <input className="profile-input profile-name-input" placeholder="Full Name" value={fullName} onChange={e => setFullName(e.target.value)} />
                  <input className="profile-input" placeholder="Nickname / Handle" value={nickname} onChange={e => setNickname(e.target.value)} />
                  <input className="profile-input" placeholder="Your tagline..." value={tagline} onChange={e => setTagline(e.target.value)} />
                </>
              ) : (
                <>
                  <h2 className="profile-display-name">{fullName || nickname || 'Your Name'}</h2>
                  {nickname && fullName && <span className="profile-handle">@{nickname}</span>}
                  <p className="profile-tagline">{tagline || 'Add a tagline to describe yourself'}</p>
                </>
              )}
              <span className="profile-email">{email}</span>
            </div>
          </div>

          {/* Status Badge */}
          <div className="profile-status-row">
            {isEditing ? (
              <div className="profile-status-pills">
                {STATUS_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    className={`profile-pill ${status === opt.value ? 'active' : ''}`}
                    onClick={() => setStatus(opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            ) : (
              status && (
                <span className="profile-status-badge">
                  {STATUS_OPTIONS.find(o => o.value === status)?.label || status}
                </span>
              )
            )}
          </div>
        </section>

        {/* ===== NICHES SECTION ===== */}
        <section className="profile-section">
          <h3 className="profile-section-title">Creator Niches</h3>
          <div className="profile-niche-grid">
            {CREATOR_NICHES.map(niche => {
              const isSelected = selectedNiches.includes(niche.id);
              return (
                <button
                  key={niche.id}
                  className={`profile-niche-card ${isSelected ? 'active' : ''} ${!isEditing && !isSelected ? 'hidden-niche' : ''}`}
                  onClick={() => isEditing && toggleNiche(niche.id)}
                  disabled={!isEditing}
                >
                  <span className="niche-emoji">{niche.emoji}</span>
                  <span className="niche-label">{niche.label}</span>
                </button>
              );
            })}
            {selectedNiches.filter(id => !CREATOR_NICHES.some(n => n.id === id)).map(customNiche => (
                <button
                  key={customNiche}
                  className={`profile-niche-card active`}
                  onClick={() => isEditing && toggleNiche(customNiche)}
                  disabled={!isEditing}
                >
                  <span className="niche-emoji">✨</span>
                  <span className="niche-label">{customNiche}</span>
                </button>
            ))}
            {isEditing && (
              <button
                className={`profile-niche-card ${showOtherNiche ? 'active' : ''}`}
                onClick={() => setShowOtherNiche(!showOtherNiche)}
              >
                <span className="niche-emoji">➕</span>
                <span className="niche-label">Other</span>
              </button>
            )}
            {showOtherNiche && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                style={{ gridColumn: '1 / -1', marginTop: '8px' }}
              >
                <input
                  type="text"
                  className="profile-other-input"
                  placeholder="Enter custom niche..."
                  value={otherNiche}
                  onChange={(e) => setOtherNiche(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && otherNiche.trim()) {
                      if (!selectedNiches.includes(otherNiche.trim())) {
                        setSelectedNiches([...selectedNiches, otherNiche.trim()]);
                      }
                      setOtherNiche('');
                      setShowOtherNiche(false);
                    }
                  }}
                />
              </motion.div>
            )}
          </div>
          {!isEditing && selectedNiches.length === 0 && (
            <p className="profile-placeholder">No niches selected yet. Click Edit to add.</p>
          )}
        </section>

        {/* ===== TOOLS SECTION ===== */}
        <section className="profile-section">
          <h3 className="profile-section-title">Tool Stack</h3>
          <div className="profile-tools-grid">
            {CREATOR_TOOLS.map(tool => {
              const isSelected = tools.includes(tool);
              return (
                <button
                  key={tool}
                  className={`profile-tool-pill ${isSelected ? 'active' : ''} ${!isEditing && !isSelected ? 'hidden-niche' : ''}`}
                  onClick={() => isEditing && toggleTool(tool)}
                  disabled={!isEditing}
                >
                  {tool}
                </button>
              );
            })}
            {tools.filter(t => !CREATOR_TOOLS.includes(t)).map(customTool => (
                <button
                  key={customTool}
                  className={`profile-tool-pill active`}
                  onClick={() => isEditing && toggleTool(customTool)}
                  disabled={!isEditing}
                >
                  {customTool}
                </button>
            ))}
            {isEditing && (
              <button
                className={`profile-tool-pill ${showOtherTool ? 'active' : ''}`}
                onClick={() => setShowOtherTool(!showOtherTool)}
              >
                ➕ Other
              </button>
            )}
            {showOtherTool && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                style={{ gridColumn: '1 / -1', marginTop: '8px' }}
              >
                <input
                  type="text"
                  className="profile-other-input"
                  placeholder="Enter custom tool..."
                  value={otherTool}
                  onChange={(e) => setOtherTool(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && otherTool.trim()) {
                      if (!tools.includes(otherTool.trim())) {
                        setTools([...tools, otherTool.trim()]);
                      }
                      setOtherTool('');
                      setShowOtherTool(false);
                    }
                  }}
                />
              </motion.div>
            )}
          </div>
          {!isEditing && tools.length === 0 && (
            <p className="profile-placeholder">No tools selected yet.</p>
          )}
        </section>

        {/* ===== LINKS SECTION ===== */}
        <section className="profile-section">
          <h3 className="profile-section-title">Links & Socials</h3>
          {isEditing ? (
            <div className="profile-links-edit">
              <div className="profile-link-row">
                <Globe size={16} />
                <input className="profile-input" placeholder="Portfolio URL" value={portfolio} onChange={e => setPortfolio(e.target.value)} />
              </div>
              <div className="profile-link-row">
                <Youtube size={16} />
                <input className="profile-input" placeholder="YouTube / Social link" value={social} onChange={e => setSocial(e.target.value)} />
              </div>
            </div>
          ) : (
            <div className="profile-links-display">
              {portfolio && (
                <a href={portfolio} target="_blank" rel="noreferrer" className="profile-link-item">
                  <Globe size={16} /> {portfolio}
                </a>
              )}
              {social && (
                <a href={social} target="_blank" rel="noreferrer" className="profile-link-item">
                  <Youtube size={16} /> {social}
                </a>
              )}
              {!portfolio && !social && (
                <p className="profile-placeholder">No links added yet.</p>
              )}
            </div>
          )}
        </section>

        {/* ===== MEDIA SECTION ===== */}
        <section className="profile-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 className="profile-section-title" style={{ margin: 0 }}>Portfolio & Media</h3>
            {isEditing && (
              <button className="profile-add-media-btn" onClick={() => mediaInputRef.current?.click()}>
                <Plus size={16} /> Add Media
              </button>
            )}
          </div>
          <input ref={mediaInputRef} type="file" accept="image/*,video/*" multiple hidden onChange={handleMediaUpload} />

          {mediaItems.length > 0 ? (
            <div className="profile-media-grid">
              <AnimatePresence>
                {mediaItems.map(item => (
                  <motion.div
                    key={item.id}
                    className="profile-media-item"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                  >
                    {item.type === 'image' ? (
                      <img src={item.url} alt={item.name} className="profile-media-thumb" />
                    ) : (
                      <video src={item.url} className="profile-media-thumb" controls muted />
                    )}
                    <div className="profile-media-info">
                      <span className="profile-media-type">
                        {item.type === 'image' ? <ImageIcon size={12} /> : <Video size={12} />}
                        {item.type}
                      </span>
                      <span className="profile-media-name">{item.name}</span>
                    </div>
                    {isEditing && (
                      <button className="profile-media-remove" onClick={() => removeMedia(item.id)}>
                        <Trash2 size={14} />
                      </button>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          ) : (
            <div className="profile-media-empty">
              <ImageIcon size={24} />
              <p>Upload images or videos to showcase your work</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

