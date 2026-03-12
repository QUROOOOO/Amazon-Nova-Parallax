import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, User, Sparkles, Link as LinkIcon, ArrowRight, ArrowLeft, ChevronDown } from 'lucide-react';
import './Onboarding.css';

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
  { value: '', label: 'Select your status…' },
  { value: 'collab', label: '🤝 Available for Collab' },
  { value: 'gigs', label: '💼 Open to Gigs' },
  { value: 'busy', label: '🔨 Busy Building' },
];

export default function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);

  // Step 1 — Core Identity
  const [fullName, setFullName] = useState('');
  const [nickname, setNickname] = useState('');
  const [tagline, setTagline] = useState('');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 2 — Alignment
  const [selectedNiches, setSelectedNiches] = useState<string[]>([]);
  const [tools, setTools] = useState<string[]>([]);

  // Step 3 — Showcase
  const [portfolio, setPortfolio] = useState('');
  const [social, setSocial] = useState('');
  const [status, setStatus] = useState('');

  const [isSaving, setIsSaving] = useState(false);

  const toggleTool = (tool: string) => {
    setTools(prev =>
      prev.includes(tool) ? prev.filter(t => t !== tool) : [...prev, tool]
    );
  };

  const toggleNiche = (id: string) => {
    setSelectedNiches(prev =>
      prev.includes(id) ? prev.filter(n => n !== id) : [...prev, id]
    );
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSkip = () => navigate('/vault');

  const handleNext = () => {
    if (step < 3) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleComplete = async () => {
    setIsSaving(true);
    try {
      const payload = {
        name: fullName,
        nickname,
        tagline,
        avatar: avatarPreview,
        niches: selectedNiches,
        tools,
        portfolio,
        social,
        status,
      };
      localStorage.setItem('vibe_user_profile', JSON.stringify(payload));
      // Also update the auth display name
      const existingAuth = localStorage.getItem('vibe_user_auth');
      if (existingAuth) {
        const authData = JSON.parse(existingAuth);
        authData.name = fullName || authData.name;
        localStorage.setItem('vibe_user_auth', JSON.stringify(authData));
      }
      setTimeout(() => navigate('/vault'), 400);
    } catch {
      navigate('/vault');
    }
  };

  const canAdvanceStep1 = fullName.trim().length > 0;
  const canAdvanceStep2 = selectedNiches.length > 0;

  const progressSegs = [1, 2, 3];

  return (
    <div className="onboarding-page">
      <div className="onboarding-card">
        {/* Progress Bar */}
        <div className="onboarding-progress">
          {progressSegs.map(seg => (
            <div
              key={seg}
              className={`progress-seg ${seg === step ? 'active' : ''} ${seg < step ? 'done' : ''}`}
            />
          ))}
        </div>

        {/* ===== STEP 1: Core Identity ===== */}
        {step === 1 && (
          <div className="step-content" key="step1">
            <div className="step-header">
              <span className="step-label">Step 1 of 3</span>
              <h2 className="step-title">Core Identity 👤</h2>
              <p className="step-subtitle">Tell us who you are.</p>
            </div>

            <div className="avatar-upload" onClick={handleAvatarClick}>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                style={{ display: 'none' }}
              />
              <div className="avatar-circle">
                {avatarPreview ? (
                  <img src={avatarPreview} alt="Avatar" className="avatar-preview-img" />
                ) : (
                  <Camera size={36} />
                )}
              </div>
              <span className="onb-label" style={{ textTransform: 'none', letterSpacing: 0 }}>
                {avatarPreview ? 'Change Avatar' : 'Upload Avatar'}
              </span>
            </div>

            <div className="onb-field">
              <label className="onb-label">Full Name *</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  className="onb-input"
                  placeholder="e.g. Archak Aryan"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  style={{ paddingLeft: 40, width: '100%', boxSizing: 'border-box' }}
                />
                <User size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)' }} />
              </div>
            </div>

            <div className="onb-field">
              <label className="onb-label">Nickname</label>
              <input
                type="text"
                className="onb-input"
                placeholder="How should we address you?"
                value={nickname}
                onChange={e => setNickname(e.target.value)}
                style={{ width: '100%', boxSizing: 'border-box' }}
              />
            </div>

            <div className="onb-field">
              <label className="onb-label">Tagline</label>
              <input
                type="text"
                className="onb-input"
                placeholder="e.g. Building the future of UI/UX"
                value={tagline}
                onChange={e => setTagline(e.target.value)}
                style={{ width: '100%', boxSizing: 'border-box' }}
              />
            </div>

            <div className="onb-actions">
              <button
                className="onb-primary-btn"
                onClick={handleNext}
                disabled={!canAdvanceStep1}
              >
                Continue <ArrowRight size={16} style={{ verticalAlign: 'middle', marginLeft: 6 }} />
              </button>
              <button className="onb-skip-btn" onClick={handleSkip}>
                Skip for now
              </button>
            </div>
          </div>
        )}

        {/* ===== STEP 2: The Alignment ===== */}
        {step === 2 && (
          <div className="step-content" key="step2">
            <div className="step-header">
              <span className="step-label">Step 2 of 3</span>
              <h2 className="step-title">Your Niche ⚙️</h2>
              <p className="step-subtitle">What kind of content do you create?</p>
            </div>

            <div className="onb-field">
              <label className="onb-label">Creator Niche * (pick all that apply)</label>
              <div className="niche-grid">
                {CREATOR_NICHES.map(niche => (
                  <button
                    key={niche.id}
                    type="button"
                    className={`role-btn ${selectedNiches.includes(niche.id) ? 'selected' : ''}`}
                    onClick={() => toggleNiche(niche.id)}
                  >
                    <span className="role-emoji">{niche.emoji}</span>
                    {niche.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="onb-field">
              <label className="onb-label">Creator Tools</label>
              <div className="pill-grid">
                {CREATOR_TOOLS.map(tool => (
                  <button
                    key={tool}
                    type="button"
                    className={`onb-pill ${tools.includes(tool) ? 'selected' : ''}`}
                    onClick={() => toggleTool(tool)}
                  >
                    <Sparkles size={12} />
                    {tool}
                  </button>
                ))}
              </div>
            </div>

            <div className="onb-actions">
              <button
                className="onb-primary-btn"
                onClick={handleNext}
                disabled={!canAdvanceStep2}
              >
                Continue <ArrowRight size={16} style={{ verticalAlign: 'middle', marginLeft: 6 }} />
              </button>
              <button className="onb-back-btn" onClick={handleBack}>
                <ArrowLeft size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Back
              </button>
              <button className="onb-skip-btn" onClick={handleSkip}>
                Skip for now
              </button>
            </div>
          </div>
        )}

        {/* ===== STEP 3: The Showcase ===== */}
        {step === 3 && (
          <div className="step-content" key="step3">
            <div className="step-header">
              <span className="step-label">Step 3 of 3</span>
              <h2 className="step-title">The Showcase 🔗</h2>
              <p className="step-subtitle">Prove your work. Link your portfolio.</p>
            </div>

            <div className="onb-field">
              <label className="onb-label">Portfolio Link</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="url"
                  className="onb-input"
                  placeholder="GitHub, Behance, or personal site"
                  value={portfolio}
                  onChange={e => setPortfolio(e.target.value)}
                  style={{ paddingLeft: 40, width: '100%', boxSizing: 'border-box' }}
                />
                <LinkIcon size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)' }} />
              </div>
            </div>

            <div className="onb-field">
              <label className="onb-label">Social / Channel Link</label>
              <input
                type="url"
                className="onb-input"
                placeholder="YouTube, X, or similar"
                value={social}
                onChange={e => setSocial(e.target.value)}
                style={{ width: '100%', boxSizing: 'border-box' }}
              />
            </div>

            <div className="onb-field">
              <label className="onb-label">Current Status</label>
              <div style={{ position: 'relative' }}>
                <select
                  className="onb-select"
                  value={status}
                  onChange={e => setStatus(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', paddingRight: 36 }}
                >
                  {STATUS_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <ChevronDown size={16} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)', pointerEvents: 'none' }} />
              </div>
            </div>

            <div className="onb-actions">
              <button
                className="onb-primary-btn"
                onClick={handleComplete}
                disabled={isSaving}
              >
                {isSaving ? 'Saving…' : 'Complete Profile ✓'}
              </button>
              <button className="onb-back-btn" onClick={handleBack}>
                <ArrowLeft size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Back
              </button>
              <button className="onb-skip-btn" onClick={handleSkip}>
                Skip for now
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
