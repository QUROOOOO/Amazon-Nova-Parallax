import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowUpRight, 
  FileText, 
  Image as ImageIcon, 
  Presentation, 
  Link as LinkIcon, 
  PlaySquare, 
  Check, 
  Terminal,
  Search as SearchIcon
} from 'lucide-react';
import { get, post } from 'aws-amplify/api';
import { fetchAuthSession } from 'aws-amplify/auth';
import { analyzeSynergyWithGemini } from '../utils/geminiAnalysis';
import './SkillMatchmaker.css';

// TypeScript Interfaces for the API responses
interface Portfolio {
  type: 'pdf' | 'ppt' | 'image' | 'youtube' | 'github' | string;
  url: string;
  title?: string;
  thumbnail?: string;
}

interface Profile {
  userId: string;
  name: string;
  avatarUrl: string;
  industry: string;
  vibeScore: number;
  status: 'Available' | 'In a Collab' | string;
  badges: string[];
  portfolios: Portfolio[];
}

// Custom Brutalist File Icon Component
const FileIcon = ({ type, size = 24 }: { type: string, size?: number }) => {
  switch (type.toLowerCase()) {
    case 'pdf':
      return <div className="brutalist-icon bg-pdf"><FileText size={size * 0.7} color="#000" /></div>;
    case 'ppt':
    case 'pptx':
      return <div className="brutalist-icon bg-ppt"><Presentation size={size * 0.7} color="#000" /></div>;
    case 'image':
      return <div className="brutalist-icon bg-img"><ImageIcon size={size * 0.7} color="#000" /></div>;
    case 'youtube':
      return <div className="brutalist-icon bg-yt"><PlaySquare size={size * 0.7} color="#000" /></div>;
    case 'github':
      return <div className="brutalist-icon bg-git"><Terminal size={size * 0.7} color="#000" /></div>;
    default:
      return <div className="brutalist-icon bg-default"><LinkIcon size={size * 0.7} color="#000" /></div>;
  }
};

interface SynergyModalState {
  isOpen: boolean;
  profile: Profile | null;
  loading: boolean;
  score: number | null;
  reasoning: string | null;
  error: string | null;
}

const FILTERS = ['All', 'Video Editor', 'ML Engineer', 'Prompt Architect', 'UI Designer'];

export default function SkillMatchmaker() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [syncStatus, setSyncStatus] = useState<Record<string, 'IDLE' | 'LOADING' | 'REQUESTED' | 'ERROR'>>({});
  
  const [synergyModal, setSynergyModal] = useState<SynergyModalState>({
    isOpen: false, profile: null, loading: false, score: null, reasoning: null, error: null
  });

  const [publicProfileModal, setPublicProfileModal] = useState(false);

  useEffect(() => {
    fetchProfiles(activeFilter);
  }, [activeFilter]);

  const fetchProfiles = async (industry: string) => {
    setLoading(true);
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString() || '';
      
      const query = industry === 'All' ? '' : `?industry=${encodeURIComponent(industry)}`;
      
      const response = await get({
        apiName: 'VibeCollabApi',
        path: `/profiles${query}`,
        options: { headers: { Authorization: token } }
      }).response;

      const data = JSON.parse(await (await response).body.text()) as Profile[];
      setProfiles(data);
    } catch (err) {
      console.error(err);
      // Fallback or error state could be handled here
    } finally {
      setLoading(false);
    }
  };

  const handleSyncRequest = async (targetUserId: string, status: string) => {
    if (status === 'In a Collab') return; // Prevent clicking if busy
    
    // Optimistic UI Update immediately
    setSyncStatus(prev => ({ ...prev, [targetUserId]: 'LOADING' }));

    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString() || '';

      const response = await post({
        apiName: 'VibeCollabApi',
        path: '/sync',
        options: {
          headers: { Authorization: token },
          body: { targetUserId }
        }
      }).response;

      const data = JSON.parse(await (await response).body.text());
      if (data.error) throw new Error(data.error);

      // Success -> Update to requested
      setSyncStatus(prev => ({ ...prev, [targetUserId]: 'REQUESTED' }));
    } catch (error) {
      console.error(error);
      // Revert optimistic update on error
      setSyncStatus(prev => ({ ...prev, [targetUserId]: 'ERROR' }));
      setTimeout(() => setSyncStatus(prev => ({ ...prev, [targetUserId]: 'IDLE' })), 3000);
    }
  };

  const handleViewSynergy = async (targetProfile: Profile) => {
    setSynergyModal({ isOpen: true, profile: targetProfile, loading: true, score: null, reasoning: null, error: null });
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString() || '';
      
      // Fetch User's Spark Notes to give Gemini context about their ideas
      const restOp = get({
        apiName: 'VibeCollabApi',
        path: '/spark',
        options: { headers: { Authorization: token } }
      });
      const response = await restOp.response;
      const json = await response.body.json() as any;
      const userNotes = json.data || [];

      // Analyze Synergy Score via Gemini 2.0 Flash
      const synergy = await analyzeSynergyWithGemini(targetProfile, userNotes);

      setSynergyModal(prev => ({ ...prev, loading: false, score: synergy.score, reasoning: synergy.reasoning }));
    } catch (err: any) {
      console.error(err);
      setSynergyModal(prev => ({ 
        ...prev, 
        loading: false, 
        error: err.message || 'Gemini analysis failed. Ensure API key is set.' 
      }));
    }
  };

  return (
    <div className="match-container">
      <header className="match-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <div>
            <h1 className="font-heading font-bold tracking-tight uppercase">Talent Sync</h1>
            <p className="text-muted body-large">Semantic Connections & Portfolios</p>
          </div>
          <button 
            className="public-profile-btn"
            onClick={() => setPublicProfileModal(true)}
          >
            View My Public Profile
          </button>
        </div>
      </header>

      {/* FILTER BAR WITH SEARCH */}
      <div className="filter-bar-container" style={{ position: 'relative' }}>
        <div className="filter-bar">
          {FILTERS.map(f => (
            <button 
              key={f}
              onClick={() => setActiveFilter(f)}
              className={`filter-btn ${activeFilter === f ? 'active' : ''}`}
              style={{ transitionDelay: showSearch ? '0ms' : '0ms' }}
            >
              {f}
            </button>
          ))}
          
          {/* Search Button and Expandable Input */}
          <div style={{ position: 'relative', marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: showSearch ? '256px' : '0px', opacity: showSearch ? 1 : 0 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              style={{ position: 'absolute', right: '48px', overflow: 'hidden' }}
            >
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search profiles..."
                className="search-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setShowSearch(false);
                    setSearchQuery('');
                  }
                }}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--n-outline)',
                  background: 'var(--n-surface)',
                  color: 'var(--n-on-surface)',
                  fontSize: '0.875rem',
                  fontFamily: 'var(--font-body)',
                  outline: 'none',
                  transition: 'border-color 0.2s ease',
                }}
                onFocus={(e) => (e.target.style.borderColor = 'var(--n-accent)')}
                onBlur={(e) => (e.target.style.borderColor = 'var(--n-outline)')}
              />
            </motion.div>
            
            <button
              onClick={() => {
                setShowSearch(!showSearch);
                if (showSearch) setSearchQuery('');
              }}
              className="search-toggle-btn"
              title="Toggle search"
              style={{
                background: 'white',
                border: '2px solid #D71921',
                borderRadius: '9999px',
                width: '40px',
                height: '40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                zIndex: 20,
                transition: 'all 0.2s ease',
                color: 'black',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#D71921';
                e.currentTarget.style.color = 'white';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'white';
                e.currentTarget.style.color = 'black';
              }}
            >
              <SearchIcon size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* MASONRY GRID */}
      <div className="match-grid">
        <AnimatePresence mode="popLayout">
          {loading ? (
            <motion.div className="loading-state" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Terminal className="blink" size={32} color="#D71921" />
              <p>SCANNING NETWORK...</p>
            </motion.div>
          ) : profiles.length === 0 ? (
            <motion.div className="empty-state" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <p>NO TALENT FOUND FOR THIS SECTOR.</p>
            </motion.div>
          ) : (
            profiles.map(p => (
              <motion.div 
                key={p.userId} 
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                className="profile-card"
              >
                {/* IDENTITY SEGMENT */}
                <div className="profile-header">
                  <div className="avatar-block">
                    <img src={p.avatarUrl} alt={p.name} />
                  </div>
                  <div className="identity-block">
                    <h2>{p.name}</h2>
                    <div className="metrics-row">
                      <span className="industry-tag">{p.industry}</span>
                      <span className="vibe-score">VIBE {p.vibeScore}</span>
                    </div>
                  </div>
                  <div className={`status-badge ${p.status === 'Available' ? 'status-green' : 'status-red'}`}>
                    {p.status}
                  </div>
                </div>

                {/* BADGES */}
                <div className="badges-container">
                  {p.badges.map(b => (
                    <span key={b} className="skill-badge"><Check size={12} /> {b}</span>
                  ))}
                </div>

                {/* SHOWCASE GALLERY (HORIZONTAL SCROLL) */}
                <div className="portfolio-gallery">
                  {p.portfolios.map((port, idx) => (
                    <a 
                      key={idx} 
                      href={port.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="portfolio-item"
                    >
                      {port.thumbnail ? (
                        <div className="port-thumb" style={{ backgroundImage: `url(${port.thumbnail})`}}>
                          <div className="port-overlay">
                            <FileIcon type={port.type} />
                          </div>
                        </div>
                      ) : (
                        <div className="port-card-bare">
                          <FileIcon type={port.type} size={40} />
                          <span className="port-title">{port.title || port.type}</span>
                        </div>
                      )}
                    </a>
                  ))}
                </div>

                {/* CTA ACTIONS */}
                <div className="card-actions">
                  <button 
                    disabled={p.status === 'In a Collab' || syncStatus[p.userId] === 'REQUESTED' || syncStatus[p.userId] === 'LOADING'}
                    className={`sync-btn ${syncStatus[p.userId] || 'IDLE'} ${p.status === 'In a Collab' ? 'disabled' : ''}`}
                    onClick={() => handleSyncRequest(p.userId, p.status)}
                  >
                    {syncStatus[p.userId] === 'LOADING' && 'SYNCING...'}
                    {syncStatus[p.userId] === 'REQUESTED' && <><Check size={18} /> REQUESTED</>}
                    {syncStatus[p.userId] === 'ERROR' && 'SYNC FAILED'}
                    {(!syncStatus[p.userId] || syncStatus[p.userId] === 'IDLE') && (
                      p.status === 'In a Collab' ? 'UNAVAILABLE' : 'SYNC NOW'
                    )}
                  </button>
                  <button className="view-btn" onClick={() => handleViewSynergy(p)}>
                    <ArrowUpRight size={24} />
                  </button>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>

      {/* SYNERGY MODAL */}
      <AnimatePresence>
        {synergyModal.isOpen && synergyModal.profile && (
          <motion.div 
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSynergyModal(prev => ({ ...prev, isOpen: false }))}
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <motion.div 
              className="synergy-modal bg-white dark:bg-[#121212] rounded-3xl p-8 shadow-2xl max-w-2xl w-full mx-4 border border-gray-200 dark:border-white/10"
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold dark:text-white">AI Matchmaker Analysis</h2>
                <button onClick={() => setSynergyModal(prev => ({...prev, isOpen: false}))} className="text-gray-500 hover:text-black dark:hover:text-white pb-1 w-8 h-8 rounded-full bg-gray-100 dark:bg-white/10 flex items-center justify-center">✕</button>
              </div>

              <div className="flex items-center gap-4 mb-8 p-4 bg-gray-50 dark:bg-white/5 rounded-2xl">
                <img src={synergyModal.profile.avatarUrl} alt="" className="w-16 h-16 rounded-full" />
                <div>
                  <h3 className="text-xl font-bold dark:text-white">{synergyModal.profile.name}</h3>
                  <p className="text-gray-500 dark:text-gray-400">{synergyModal.profile.industry}</p>
                </div>
              </div>

              {synergyModal.loading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Terminal className="animate-pulse mb-4" size={40} color="#D71921" />
                  <p className="text-gray-500 font-mono tracking-wider">GEMINI 2.0 FLASH ANALYZING SPARKS...</p>
                </div>
              ) : synergyModal.error ? (
                <div className="p-4 bg-red-50 text-red-600 rounded-xl">
                  {synergyModal.error}
                </div>
              ) : (
                <div className="synergy-result text-center">
                  <div className="mb-6">
                    <span className="text-sm font-bold tracking-widest text-gray-400 uppercase">Semantic Synergy Score</span>
                    <div className="text-6xl font-black mt-2 text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-500">
                      {synergyModal.score}%
                    </div>
                  </div>
                  <div className="text-lg leading-relaxed dark:text-gray-300 bg-gray-50 dark:bg-black/40 p-6 rounded-2xl border border-gray-100 dark:border-white/5 text-left font-serif">
                    {synergyModal.reasoning}
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* PUBLIC PROFILE MODAL */}
      <AnimatePresence>
        {publicProfileModal && (
          <motion.div 
            className="fixed inset-0 z-50 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            onClick={() => setPublicProfileModal(false)}
            style={{
              background: 'rgba(5, 5, 10, 0.7)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
            }}
          >
            <motion.div 
              className="relative w-[90%] max-w-[900px] max-h-[90vh] overflow-y-auto"
              initial={{ scale: 0.94, y: 30, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.94, y: 30, opacity: 0 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              onClick={e => e.stopPropagation()}
              style={{
                background: 'linear-gradient(180deg, rgba(30, 32, 40, 0.75) 0%, rgba(15, 16, 20, 0.9) 100%)',
                borderRadius: '24px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                boxShadow: '0 32px 64px -16px rgba(0, 0, 0, 0.8), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                scrollbarWidth: 'none', // Firefox
                msOverflowStyle: 'none',  // IE and Edge
              }}
            >
              {/* Close Button top right */}
              <button
                onClick={() => setPublicProfileModal(false)}
                className="absolute top-6 right-6 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 z-10"
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: 'rgba(255, 255, 255, 0.6)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                  e.currentTarget.style.color = '#fff';
                  e.currentTarget.style.transform = 'scale(1.05) rotate(90deg)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                  e.currentTarget.style.color = 'rgba(255, 255, 255, 0.6)';
                  e.currentTarget.style.transform = 'scale(1) rotate(0deg)';
                }}
              >
                ✕
              </button>

              {/* Header Section */}
              <div 
                className="flex flex-col items-center text-center relative overflow-hidden"
                style={{
                  padding: '56px 32px 40px',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                }}
              >
                {/* Subtle top glow */}
                <div style={{
                  position: 'absolute',
                  top: '-150px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: '300px',
                  height: '300px',
                  background: 'radial-gradient(circle, rgba(215, 25, 33, 0.2) 0%, rgba(0,0,0,0) 70%)',
                  borderRadius: '50%',
                  pointerEvents: 'none',
                }} />

                {/* Avatar */}
                <motion.div 
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.1, duration: 0.5, ease: 'easeOut' }}
                  className="flex items-center justify-center font-bold text-white relative z-10"
                  style={{
                    width: '110px',
                    height: '110px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #FF3B30 0%, #FF9500 100%)',
                    fontSize: '42px',
                    marginBottom: '24px',
                    boxShadow: '0 12px 24px -8px rgba(255, 59, 48, 0.5), inset 0 2px 4px rgba(255,255,255,0.3)',
                    border: '3px solid rgba(255, 255, 255, 0.1)',
                    letterSpacing: '-1px'
                  }}
                >
                  DC
                </motion.div>

                {/* Name & Title */}
                <motion.h2 
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.2, duration: 0.4 }}
                  className="font-heading tracking-tight text-white mb-2 relative z-10"
                  style={{ fontSize: '36px', fontWeight: '800', lineHeight: '1.2' }}
                >
                  Your Creator Name
                </motion.h2>
                <motion.p 
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.3, duration: 0.4 }}
                  className="mb-8 relative z-10 font-body"
                  style={{ fontSize: '16px', color: 'rgba(255, 255, 255, 0.6)', fontWeight: '500' }}
                >
                  Digital Content Creator <span style={{ color: 'rgba(255,255,255,0.3)', margin: '0 8px' }}>•</span> Video Editor
                </motion.p>

                {/* Niche Badges */}
                <motion.div 
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.4, duration: 0.4 }}
                  className="flex flex-wrap gap-3 justify-center relative z-10"
                >
                  {['YouTuber', 'Short-form', 'Video Editing'].map((niche) => (
                    <span 
                      key={niche} 
                      className="font-body tracking-wide"
                      style={{
                        padding: '8px 18px',
                        borderRadius: '100px',
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        color: 'rgba(255, 255, 255, 0.9)',
                        fontSize: '13px',
                        fontWeight: '600',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                        backdropFilter: 'blur(8px)',
                      }}
                    >
                      {niche}
                    </span>
                  ))}
                </motion.div>
              </div>

              {/* Portfolio Grid Section */}
              <div style={{ padding: '40px 32px 56px' }}>
                <motion.h3 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="font-heading tracking-wider uppercase mb-6"
                  style={{
                    fontSize: '16px',
                    fontWeight: '700',
                    color: 'rgba(255, 255, 255, 0.5)',
                  }}
                >
                  Portfolio Showcase
                </motion.h3>

                {/* Masonry Skeleton Grid */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                  gap: '20px',
                  gridAutoRows: '200px',
                }}>
                  {[
                    { type: 'video', col: 'span 1', row: 'span 1' },
                    { type: 'doc', col: 'span 1', row: 'span 2' },
                    { type: 'image', col: 'span 1', row: 'span 1' },
                    { type: 'video', col: 'span 2', row: 'span 1' },
                    { type: 'image', col: 'span 1', row: 'span 1' },
                    { type: 'doc', col: 'span 1', row: 'span 1' },
                  ].map((item, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 + idx * 0.1, duration: 0.5, ease: 'easeOut' }}
                      whileHover={{ 
                        scale: 0.98,
                        boxShadow: '0 20px 40px -10px rgba(0,0,0,0.5)',
                        borderColor: 'rgba(255, 255, 255, 0.2)'
                      }}
                      className="group relative cursor-pointer overflow-hidden flex items-center justify-center flex-col"
                      style={{
                        background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)',
                        border: '1px solid rgba(255, 255, 255, 0.05)',
                        borderRadius: '20px',
                        gridColumn: item.col,
                        gridRow: item.row,
                        transition: 'all 0.4s cubic-bezier(0.25, 1, 0.5, 1)',
                      }}
                    >
                      {/* Placeholder Icon */}
                      <motion.div 
                        className="transition-transform duration-500 ease-out group-hover:scale-110 group-hover:-translate-y-2"
                        style={{ color: 'rgba(255, 255, 255, 0.15)' }}
                      >
                        {item.type === 'video' && <PlaySquare strokeWidth={1.5} size={56} />}
                        {item.type === 'doc' && <FileText strokeWidth={1.5} size={56} />}
                        {item.type === 'image' && <ImageIcon strokeWidth={1.5} size={56} />}
                      </motion.div>

                      {/* Hover Info (Subtle text that fades in) */}
                      <div className="absolute bottom-6 left-0 right-0 text-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <span className="font-body text-xs font-semibold tracking-widest uppercase text-[rgba(255,255,255,0.5)]">
                          View Project
                        </span>
                      </div>

                      {/* Subtle inner glow on hover */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-[20px]" />
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
