import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Search, TrendingUp, Sparkles, Filter, RefreshCw, Music, Gamepad2, Copy, Check, Info, Zap, ArrowUpRight } from 'lucide-react';
import DataPulseLoader from '../components/DataPulseLoader';
import { motion, AnimatePresence, useScroll, useSpring, useTransform } from 'framer-motion';
import { get } from 'aws-amplify/api';
import { fetchAuthSession } from 'aws-amplify/auth';
import { ALL_YOUTUBE_LANGUAGES, getUserLocationLanguages } from '../utils/geoLanguages';
import './ResearchVault.css';

function CopyHookButton({ text }: { text: string }) {
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
      }).catch(err => console.error('Failed to copy', err));
    }
  };

  return (
    <button 
      onClick={handleCopy}
      className={`copy-hook-btn ${isCopied ? 'copied' : ''}`}
      title="Copy Hook text"
    >
      {isCopied ? <Check size={14} /> : <Copy size={14} />}
    </button>
  );
}

export default function ResearchVault() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");
  const [activeContentType, setActiveContentType] = useState("All");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [trendsData, setTrendsData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showInfo, setShowInfo] = useState(false);

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  const [availableFilters, setAvailableFilters] = useState<string[]>(["English", "Hindi", "Tamil", "Telugu", "Kannada", "Malayalam"]);
  const [isLangModalOpen, setIsLangModalOpen] = useState(false);
  const [langSearchQuery, setLangSearchQuery] = useState("");

  const contentTypes = ["All", "Shorts", "Music", "Gaming", "Live"];

  useEffect(() => {
    // Initial load: Fetch languages based on IP
    getUserLocationLanguages().then(langs => {
      setAvailableFilters(langs);
      // Auto-set the first one (English) on first load if we just found it
      if (langs.length > 0 && activeFilter === 'All') {
         setActiveFilter(langs[0]);
      }
    });
  }, []);

  useEffect(() => {
    if (activeFilter !== 'All' || activeContentType) {
      fetchTrends(activeFilter, searchQuery, activeContentType);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFilter, activeContentType]); // Fetches immediately on filter change

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      fetchTrends(activeFilter, val, activeContentType);
    }, 500); // Debounce search
  };
  
  const { scrollY } = useScroll();
  const smoothScrollY = useSpring(scrollY, { stiffness: 300, damping: 30 });
  const headerScale = useTransform(smoothScrollY, [0, 100], [1, 0.75]);

  // --- Input sanitization ---
  const sanitizeInput = (input: string): string => {
    return input.replace(/[{}$\\]/g, '').trim().slice(0, 100);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fetchTrends = useCallback(async (langFilter: string, textQuery: string, contentType: string = "All") => {
    setIsLoading(true);
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString() || '';

      const restOp = get({
        apiName: 'VibeCollabApi',
        path: '/trends',
        options: {
          headers: { Authorization: token },
          queryParams: {
            lang: sanitizeInput(langFilter),
            q: sanitizeInput(textQuery),
            type: sanitizeInput(contentType)
          }
        }
      });
      const response = await restOp.response;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const json: any = await response.body.json();
      
      if (json.data && Array.isArray(json.data)) {
        setTrendsData(json.data);
      }
    } catch (err) {
      console.error('Failed to load trends from backend', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /* ===== Mobile horizontal tabs (unchanged) ===== */
  const renderMobileTabs = () => (
    <div className="content-type-tabs mobile-tabs">
      {contentTypes.map((type) => (
        <motion.button
          layout
          key={type}
          className={`type-tab ${activeContentType === type ? 'active' : ''}`}
          onClick={() => setActiveContentType(type)}
        >
          {activeContentType === type && (
            <motion.div
              layoutId="active-mobile-tab"
              className="active-tab-bg"
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
            />
          )}
          <span className="tab-text">{type}</span>
        </motion.button>
      ))}
    </div>
  );

  /* ===== Desktop morphing sidebar (compact) — rendered via portal to bypass framer-motion transform ===== */
  const renderMorphingSidebar = () => createPortal(
    <div className="morphing-sidebar">
      {contentTypes.map((type) => {
        const isActive = activeContentType === type;
        return (
          <motion.button
            key={type}
            layout
            onClick={() => setActiveContentType(type)}
            style={{
              width: 80,
              height: isActive ? 80 : 40,
              borderRadius: 20,
              border: isActive ? '2px solid var(--n-accent)' : '1px solid var(--n-outline)',
              background: isActive ? '#D71921' : '#333333',
              color: isActive ? '#FFFFFF' : 'rgba(255,255,255,0.5)',
              fontFamily: 'var(--font-family-body)',
              fontWeight: isActive ? 700 : 500,
              fontSize: isActive ? '0.8rem' : '0.7rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              outline: 'none',
              padding: 0,
              letterSpacing: '-0.01em',
            }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          >
            {type}
          </motion.button>
        );
      })}
    </div>,
    document.body
  );

  const filteredLanguages = ALL_YOUTUBE_LANGUAGES.filter(lang => 
    lang.toLowerCase().includes(langSearchQuery.toLowerCase())
  );

  return (
    <div className="vault-page">
      {/* ===== STICKY HEADER: Title + Refresh + Search only ===== */}
      <div className="vault-sticky-header">
        <div className="vault-main-wrap">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <motion.div style={{ scale: headerScale, transformOrigin: 'top left' }}>
              <h1 className="dot-display" style={{ fontSize: 'clamp(1.8rem, 4vw, 2.5rem)', margin: 0 }}>
                <span className="typography-reveal"><span>Smart Vault</span></span>
              </h1>
            </motion.div>
            <button 
              className={`refresh-btn ${isLoading ? 'is-refreshing' : ''}`}
              onClick={() => fetchTrends(activeFilter, searchQuery, activeContentType)}
              disabled={isLoading}
              title="Refresh Live Data"
            >
              <RefreshCw size={16} className="icon" />
              <span>Refresh</span>
            </button>
          </div>
          
          <div style={{ marginTop: '16px' }}>
            <div className="search-bar">
              <Search size={20} className="text-muted" />
              <input 
                type="text" 
                placeholder="Search trends, niches..." 
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="search-input title-large"
              />
            </div>
            {renderMobileTabs()}
          </div>
        </div>
      </div>

      {/* Floating morphing sidebar (desktop only) */}
      {renderMorphingSidebar()}

      {/* ===== SCROLLABLE: Language chips + Live Radar + Grid ===== */}
      <div className="vault-main-wrap">
        <div className="filter-chips">
          {availableFilters.slice(0, 9).map(filter => (
             <button 
               key={filter}
               className={`chip ${activeFilter === filter ? 'active' : ''}`}
               onClick={() => setActiveFilter(filter)}
             >
               {filter}
             </button>
          ))}
          <button className={`chip filter-btn ${isLangModalOpen ? 'active' : ''}`} onClick={() => setIsLangModalOpen(true)}>
             <Filter size={22} />
          </button>
        </div>

        {/* Language Modal */}
        <AnimatePresence>
          {isLangModalOpen && (
            <motion.div 
              className="lang-modal-overlay" 
              onClick={() => setIsLangModalOpen(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div 
                className="lang-modal-content" 
                onClick={e => e.stopPropagation()}
                initial={{ scale: 0.95, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 20 }}
              >
                <div className="lang-modal-header">
                  <div className="lang-modal-header-top">
                    <h3>All Languages</h3>
                    <button className="icon-btn text-muted" onClick={() => setIsLangModalOpen(false)}>✕</button>
                  </div>
                  <div className="search-bar" style={{ maxWidth: '100%', marginTop: '8px' }}>
                    <Search size={16} className="text-muted" />
                    <input 
                      type="text" 
                      placeholder="Search languages..." 
                      value={langSearchQuery}
                      onChange={(e) => setLangSearchQuery(e.target.value)}
                      className="search-input body-medium"
                      autoFocus
                    />
                  </div>
                </div>
                <div className="lang-list">
                  {filteredLanguages.length === 0 ? (
                    <div className="p-4 text-center text-muted">No languages found.</div>
                  ) : (
                    filteredLanguages.map(lang => (
                      <button 
                        key={lang}
                        className={`lang-item ${activeFilter === lang ? 'active' : ''}`}
                        onClick={() => {
                          setActiveFilter(lang);
                          setIsLangModalOpen(false);
                        }}
                      >
                        {lang}
                      </button>
                    ))
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div 
          className="trends-feed"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ staggerChildren: 0.1 }}
        >
          <div className="section-title">
            <div className="title-content" style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'relative' }}>
              <h2 className="headline-medium" style={{ fontFamily: 'var(--font-family-display)', fontWeight: 700, margin: 0 }}>Live Radar</h2>
              <TrendingUp size={24} className="text-primary" />
              <button 
                className="text-gray-400 hover:text-white cursor-pointer transition-colors" 
                onClick={() => setShowInfo(!showInfo)}
                style={{ background: 'none', border: 'none', display: 'flex', alignItems: 'center' }}
                title="Algorithm Info"
              >
                <Info size={18} />
              </button>
              <AnimatePresence>
                {showInfo && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 5 }}
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: '0',
                      marginTop: '8px',
                      background: 'rgba(20, 20, 20, 0.85)',
                      backdropFilter: 'blur(16px)',
                      WebkitBackdropFilter: 'blur(16px)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      padding: '16px',
                      borderRadius: '12px',
                      boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                      zIndex: 50,
                      width: '320px',
                      color: 'rgba(255,255,255,0.9)',
                      fontSize: '0.85rem',
                      lineHeight: '1.5'
                    }}
                  >
                    <p style={{ fontWeight: 700, color: '#fff', marginBottom: '12px', fontSize: '0.95rem' }}>VVRA Scoring Engine:</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <p>
                        <strong style={{ color: 'var(--n-accent-yellow)' }}>⚡ VVRA Baseline:</strong> We compute <code style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 4px', borderRadius: '4px', fontSize: '0.75rem' }}>(views / hours) × ((likes + comments×1.5) / views)</code>. This combines velocity with engagement density — rewarding videos that are both fast-growing AND deeply engaging.
                      </p>
                      <p>
                        <strong style={{ color: 'var(--n-accent-yellow)' }}>🧠 Gemini γ Multiplier:</strong> We batch the top 50 results through Gemini 2.0 Flash, which assigns a reproducibility score (0.5× to 2.0×). Solo-creator-friendly formats (commentary, tutorials) get 2.0×, while studio productions get 0.5×.
                      </p>
                      <p>
                        <strong style={{ color: '#ff6b6b' }}>🎯 Final VVRA = Baseline × γ</strong> — The higher the score, the more viral AND reproducible the trend is for YOU.
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              {isLoading && <DataPulseLoader />}
            </div>
          </div>

          {(() => {
            const filteredData = trendsData.filter(trend => {
              if (activeContentType === 'All') return true;
              if (activeContentType === 'Music') return trend.genre === 'Music';
              if (activeContentType === 'Gaming') return trend.genre === 'Gaming';
              const titleLower = trend.title.toLowerCase();
              if (activeContentType === 'Shorts') return titleLower.includes('#shorts') || titleLower.includes('short');
              if (activeContentType === 'Live') return titleLower.includes('live') || titleLower.includes('stream');
              return true;
            });

            return filteredData.length === 0 && !isLoading ? (
              <AnimatePresence mode="popLayout">
              <motion.div 
                key="empty"
                className="empty-radar-container"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
              >
                <div style={{ marginBottom: 'var(--space-16)' }}>
                  <TrendingUp size={32} opacity={0.5} />
                </div>
                <h3 className="headline-medium">Radar is quiet</h3>
                <p className="body-medium">No trends matching your profile currently. Check back later.</p>
              </motion.div>
            </AnimatePresence>
          ) : (
            <motion.div 
              className="trends-list"
              initial="hidden"
              animate="visible"
              variants={{
                hidden: { opacity: 0 },
                visible: {
                  opacity: 1,
                  transition: { staggerChildren: 0.08 }
                }
              }}
            >
              <AnimatePresence mode="popLayout">
                {filteredData.map(trend => (
                  <motion.div 
                    key={trend.id}
                    layout // keep layout physics but change enter/exit
                    variants={{
                      hidden: { opacity: 0, y: 30, rotateX: -5 },
                      visible: { 
                        opacity: 1, 
                        y: 0, 
                        rotateX: 0,
                        transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] }
                      },
                      exit: { opacity: 0, scale: 0.95, transition: { duration: 0.4 } }
                    }}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    className="trend-card tilt-hover-card"
                  >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div className="trend-header" style={{ marginBottom: 0 }}>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', minWidth: 0, flex: 1, height: '28px' }}>
                        <span className="badge category-badge" style={{ height: '100%', display: 'flex', alignItems: 'center' }}>
                          <span className="truncate block w-full">{trend.category}</span>
                        </span>
                      </div>
                      {trend.genre && (
                        <span className={`icon-badge flex-shrink-0 ${trend.genre === 'Music' ? 'music-badge' : 'gaming-badge'}`} title={trend.genre}>
                          {trend.genre === 'Music' ? <Music size={14} /> : <Gamepad2 size={14} />}
                        </span>
                      )}
                      <a href={trend.url || `https://youtube.com/results?search_query=${encodeURIComponent(trend.title)}`} target="_blank" rel="noopener noreferrer" className="external-link-btn" title="View Source">
                        <ArrowUpRight size={16} />
                      </a>
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                      {/* VVRA Score Badge — Glowing Variant */}
                      {trend.vvra_score !== undefined && (
                        <div className="vvra-badge">
                          <span className="vvra-value">{typeof trend.vvra_score === 'number' ? (trend.vvra_score > 1000 ? formatNumber(trend.vvra_score) : trend.vvra_score.toFixed(1)) : trend.vvra_score}<Zap size={14} strokeWidth={3} className="vvra-icon" /></span>
                          <span className="vvra-label">VVRA</span>
                        </div>
                      )}
                      
                      {/* Engagement Score */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center' }}>
                        <span className="match-score high" style={{ fontSize: '1.2rem', lineHeight: 1, marginBottom: '4px', fontWeight: 900, color: '#D71921', letterSpacing: '-0.02em' }}>
                          {activeContentType === 'Shorts' ? '12s' : `${trend.engagementRate}%`}
                        </span>
                        <span className="text-muted title-small" style={{ fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.05em', color: 'rgba(255, 255, 255, 0.4)' }}>
                          {activeContentType === 'Shorts' ? 'AVD' : 'ENG'}
                        </span>
                      </div>
                    </div>

                    <h3 className="text-base font-semibold" style={{ margin: 0, width: '100%', lineHeight: 1.4, letterSpacing: '-0.01em', wordWrap: 'break-word', overflowWrap: 'break-word' }}>
                      {trend.title}
                    </h3>
                    
                    {activeContentType === 'Shorts' && (
                       <div style={{ display: 'flex', gap: '6px', marginTop: '2px', flexWrap: 'wrap' }}>
                          <div style={{ background: 'var(--md-sys-color-surface-variant)', padding: '2px 6px', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                             <Music size={10} className="text-primary"/> 
                             <span style={{ fontSize: '0.65rem', fontWeight: 600 }}>Trending Audio</span>
                          </div>
                          <div style={{ background: 'var(--md-sys-color-surface-variant)', padding: '2px 6px', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                             <span style={{ fontSize: '0.65rem', fontWeight: 600 }}>Swipe: 14%</span>
                          </div>
                       </div>
                    )}
                  </div>
                  
                  <div className="hooks-container relative group">
                    <div className="hooks-header">
                      <span className="hooks-title" style={{ fontWeight: 800, letterSpacing: '0.08em', color: 'rgba(255, 255, 255, 0.4)' }}>
                        {activeContentType === 'Shorts' ? 'Visual Hook Text' : 'Suggested Hook'}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="ai-indicator" style={{ fontWeight: 800, letterSpacing: '0.05em', color: '#EAB308' }}>
                          <Sparkles size={12} strokeWidth={3} /> VIRAL
                        </span>
                        <CopyHookButton text={activeContentType === 'Shorts' ? trend.hook.split(' ').slice(0, 8).join(' ') + '!' : trend.hook} />
                      </div>
                    </div>
                    
                    <div className="hooks-body">
                      {/* Decorative colored line on the left */}
                      <div className="hooks-accent-line"></div>
                      <p className="hook-text">
                        "{activeContentType === 'Shorts' ? trend.hook.split(' ').slice(0, 8).join(' ') + '!' : trend.hook}"
                      </p>
                    </div>
                  </div>

                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          );
          })()}
        </motion.div>
      </div>
    </div>
  );
}
