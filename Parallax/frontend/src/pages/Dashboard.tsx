import { useState, useRef, useCallback, useMemo, memo, useEffect, Component, type ErrorInfo, type ReactNode, type MouseEvent as ReactMouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles, Search, Share2, Trash2, Pin } from 'lucide-react';
import { get, post, del } from 'aws-amplify/api';
import { fetchAuthSession } from 'aws-amplify/auth';
import { motion, AnimatePresence } from 'framer-motion';
import RichNoteEditor from '../components/RichNoteEditor';
import './Dashboard.css';

// Error Boundary to catch React crashes and display a message instead of white screen
class DashboardErrorBoundary extends Component<{children: ReactNode}, {hasError: boolean; error: string}> {
  constructor(props: {children: ReactNode}) {
    super(props);
    this.state = { hasError: false, error: '' };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Dashboard crashed:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '40px', textAlign: 'center' }}>
          <h2>Something went wrong. Please refresh.</h2>
          <p style={{ color: '#888', marginTop: '8px' }}>{this.state.error}</p>
          <button onClick={() => window.location.reload()} style={{ marginTop: '16px', padding: '8px 24px', cursor: 'pointer' }}>Reload</button>
        </div>
      );
    }
    return this.props.children;
  }
}

interface IdeaNote {
  title: string;
  content: string;
  id: number | string;
  contentId?: string; // from backend
  pinned: boolean;
  createdAt: number;
}

const NoteCard = memo(function NoteCard({
  idea,
  onPin,
  onShare,
  onRemove,
  onClick
}: {
  idea: IdeaNote;
  onPin: (id: number | string) => void;
  onShare: (idea: IdeaNote) => void;
  onRemove: (id: number | string) => void;
  onClick: (id: number | string) => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [tiltStyle, setTiltStyle] = useState<React.CSSProperties>({});

  const handleMouseMove = useCallback((e: ReactMouseEvent<HTMLDivElement>) => {
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    // Normalize to -1..1
    const normX = (x - centerX) / centerX;
    const normY = (y - centerY) / centerY;
    // Tilt angles (max ~8deg)
    const rotateX = -normY * 8;
    const rotateY = normX * 8;
    // Shadow shifts opposite to tilt
    const shadowX = -normX * 12;
    const shadowY = -normY * 12;
    setTiltStyle({
      transform: `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`,
      boxShadow: `${shadowX}px ${shadowY}px 30px rgba(0,0,0,0.18), 0 0 12px rgba(215,25,33,0.12)`,
      transition: 'transform 0.1s ease-out, box-shadow 0.1s ease-out',
    });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setTiltStyle({
      transform: 'perspective(800px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)',
      boxShadow: 'none',
      transition: 'transform 0.35s ease-out, box-shadow 0.35s ease-out',
    });
  }, []);

  const timeAgo = useMemo(() => {
    if (!idea || !idea.createdAt) return 'Just now';
    const createdAt = new Date(idea.createdAt).getTime();
    if (!createdAt || isNaN(createdAt)) return 'Just now';
    
    const diff = new Date().getTime() - createdAt;
    if (!Number.isFinite(diff) || diff < 0) return 'Just now';
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }, [idea?.createdAt]);

  return (
    <motion.div 
      ref={cardRef}
      layout="position"
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
      className={`idea-card ${idea?.pinned ? 'pinned' : ''}`}
      onClick={() => onClick(idea?.id)}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ ...tiltStyle, cursor: 'pointer' }}
    >
      <div className="idea-card-header">
        <h3>{idea?.title || 'Untitled Spark'}</h3>
        <div className="header-actions">
          <button className={`icon-btn ${idea?.pinned ? 'pin-active' : ''}`} onClick={(e) => { e.stopPropagation(); onPin(idea?.id); }} title="Pin Note">
            <Pin size={14} />
          </button>
          <button className="icon-btn" onClick={(e) => { e.stopPropagation(); onShare(idea); }} title="Share">
            <Share2 size={14} />
          </button>
          <button className="icon-btn delete-btn" onClick={(e) => { e.stopPropagation(); onRemove(idea?.id); }} title="Delete">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <div className="idea-html-content body-medium" dangerouslySetInnerHTML={{ __html: idea?.content || 'No content...' }} />

      <div className="idea-footer">
        <span className="idea-time body-small text-muted">
          {idea?.createdAt ? (() => { try { const d = new Date(idea.createdAt).toLocaleDateString('en-US'); return d !== 'Invalid Date' ? timeAgo : 'Just now'; } catch { return 'Just now'; } })() : 'Just now'}
        </span>
        <span className="badge">DRAFT</span>
      </div>
    </motion.div>
  );
});

export default function Dashboard() {
  const [activeIdeas, setActiveIdeas] = useState<IdeaNote[]>([]);
  const [deletedIdea, setDeletedIdea] = useState<IdeaNote | null>(null);
  const [selectedNoteId, setSelectedNoteId] = useState<number | string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const undoTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedQuery, setDebouncedQuery] = useState('');

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => setDebouncedQuery(value), 200);
  }, []);
  
  const fetchNotes = useCallback(async () => {
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString() || '';
      
      const restOp = get({
        apiName: 'VibeCollabApi',
        path: '/spark',
        options: {
          headers: { Authorization: token }
        }
      });
      const response = await restOp.response;
      const json = await response.body.json() as any;
      
      if (json.data && Array.isArray(json.data)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mapped: IdeaNote[] = json.data
          .filter((item: any) => item != null)
          .map((item: any) => {
            let parsedDate = Date.now();
            try {
              if (item.createdAt) {
                const d = new Date(item.createdAt).getTime();
                if (Number.isFinite(d)) parsedDate = d;
              }
            } catch { /* safe fallback */ }
            return {
              title: typeof item.title === 'string' ? item.title : 'Untitled Spark',
              content: typeof item.content === 'string' ? item.content : '',
              id: parseInt(item.id) || item.contentId || crypto.randomUUID(),
              contentId: item.contentId || undefined,
              pinned: item.pinned === true,
              createdAt: parsedDate,
            };
          });
        setActiveIdeas(mapped.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)));
      }
    } catch (err) {
      // Silent fallback — backend may be down or notes empty
      void err;
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchNotes();
  }, [fetchNotes]);

  const extractTitle = (html: string) => {
    // Very simple tag stripper to get first few words
    const root = document.createElement('div');
    root.innerHTML = html;
    const text = root.textContent || root.innerText || '';
    const words = text.trim().split(/\s+/);
    if (words.length > 5) return words.slice(0, 5).join(' ') + '...';
    return text || 'Untitled Note';
  };

  const createNewNote = useCallback(() => {
    const now = Date.now();
    const newNote: IdeaNote = {
      title: '',
      content: '',
      id: now,
      pinned: false,
      createdAt: now,
    };
    setActiveIdeas(prev => [newNote, ...prev]);
    setSelectedNoteId(now);
  }, []);

  const closeNote = useCallback(() => {
    if (selectedNoteId) {
       // if the note has no title and no content, remove it locally 
       // (it likely wasn't saved backend-side either because of our rules)
       setActiveIdeas(prev => {
         const current = prev.find(i => i.id === selectedNoteId);
         if (current && !(current.title || '').trim() && !extractTitle(current.content || '')) {
            return prev.filter(i => i.id !== selectedNoteId);
         }
         return prev;
       });
    }
    setSelectedNoteId(null);
    // Re-fetch from backend to sync contentIds and data
    fetchNotes();
  }, [selectedNoteId, fetchNotes]);

  const removeIdea = useCallback((id: number | string) => {
    setActiveIdeas(prev => {
      const ideaToRemove = prev.find(i => i.id === id);
      if (ideaToRemove) {
        setDeletedIdea(ideaToRemove);
        if (undoTimeout.current) clearTimeout(undoTimeout.current);
        undoTimeout.current = setTimeout(async () => {
          setDeletedIdea(null);
          // Backend delete logic
          if (ideaToRemove.contentId) {
            try {
              const session = await fetchAuthSession();
              const token = session.tokens?.idToken?.toString() || '';
              
              await del({
                apiName: 'VibeCollabApi',
                path: '/spark',
                options: {
                  headers: { Authorization: token },
                  body: { contentId: ideaToRemove.contentId }
                }
              }).response;
            } catch (err) {
              console.error('Failed to permanently delete note', err);
            }
          }
        }, 7000);
      }
      return prev.filter(idea => idea.id !== id);
    });
  }, []);

  const handleUndo = useCallback(() => {
    if (deletedIdea) {
      setActiveIdeas(prev => [deletedIdea, ...prev]);
      setDeletedIdea(null);
      if (undoTimeout.current) clearTimeout(undoTimeout.current);
    }
  }, [deletedIdea]);

  const togglePin = useCallback((id: number | string) => {
    setActiveIdeas(prev => prev.map(idea =>
      idea.id === id ? { ...idea, pinned: !idea.pinned } : idea
    ));
  }, []);

  const handleShare = useCallback((idea: IdeaNote) => {
    if (navigator.share) {
      navigator.share({
        title: idea.title,
        text: 'Check out this idea from Vibe Collab AI',
        url: window.location.href,
      }).catch(() => {});
    }
  }, []);

  const sortedAndFiltered = useMemo(() => {
    const query = (debouncedQuery || '').toLowerCase();
    const filtered = activeIdeas.filter(idea => {
      if (!idea) return false;
      const title = (idea.title || '').toLowerCase();
      const content = (idea.content || '').toLowerCase();
      return title.includes(query) || content.includes(query);
    });
    return [...filtered].sort((a, b) => {
      if ((a?.pinned || false) !== (b?.pinned || false)) return a?.pinned ? -1 : 1;
      return (b?.createdAt || 0) - (a?.createdAt || 0);
    });
  }, [activeIdeas, debouncedQuery]);

  const hasNotes = activeIdeas.length > 0;
  const selectedNote = activeIdeas.find(i => i.id === selectedNoteId);

  return (
    <DashboardErrorBoundary>
    <div className={`dashboard-container ${!hasNotes && !selectedNoteId ? 'no-scroll' : ''}`}>
      {/* === STICKY HEADER: Title + Search only === */}
      <div className="spark-sticky-header">
        <div>
          <h1 className="page-title dot-display">
            <span className="typography-reveal"><span>The Spark <Sparkles className="inline-icon" size={28} /></span></span>
          </h1>
        </div>
        {hasNotes && <p className="body-medium text-muted" style={{ margin: 0 }}>Your ideas, captured.</p>}
        
        {!selectedNoteId && hasNotes && (
          <div className="search-container">
            <Search size={16} className="search-icon text-muted" />
            <input
              type="text"
              className="search-input body-medium"
              placeholder="Search notes..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
            />
            <span className="note-count body-small text-muted">{activeIdeas.length}</span>
          </div>
        )}
      </div>

      <div className="ideas-feed">
        {/* Empty States & Grid */}
        {!hasNotes ? (
          <div className="empty-state">
            <div className="empty-icon-wrap">
              <Sparkles size={28} className="text-muted" />
            </div>
            <h3 className="headline-medium">The void awaits.</h3>
            <p className="body-medium text-muted">Tap + to capture your first idea.</p>
          </div>
        ) : Array.isArray(sortedAndFiltered) && sortedAndFiltered.length === 0 ? (
          <div className="empty-state" style={{ marginTop: '40px' }}>
            <h3 className="headline-medium">No matches.</h3>
            <p className="body-medium text-muted">Try a different search term.</p>
          </div>
        ) : Array.isArray(sortedAndFiltered) && sortedAndFiltered.length > 0 ? (
          <motion.div 
            layout 
            className="idea-list"
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
              {sortedAndFiltered.map((idea, index) => {
                if (!idea) return null;
                const safeKey = idea?.id != null ? String(idea.id) : `note-fallback-${index}-${crypto.randomUUID()}`;
                return (
                  <NoteCard
                    key={safeKey}
                    idea={idea}
                    onPin={togglePin}
                    onShare={handleShare}
                    onRemove={removeIdea}
                    onClick={(id) => setSelectedNoteId(id)}
                  />
                );
              })}
            </AnimatePresence>
          </motion.div>
        ) : null}
      </div>

      {/* UI Elements Portaled outside of Framer Motion's transform context to fix 'position: fixed' bugs */}
      {typeof document !== 'undefined' && createPortal(
        <>
          {/* Undo Toast */}
          <AnimatePresence>
            {deletedIdea && (
              <motion.div 
                initial={{ opacity: 0, y: 50, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 50, scale: 0.9 }}
                className="undo-toast"
              >
                <span>Note deleted.</span>
                <button onClick={handleUndo} className="undo-btn">UNDO</button>
                <motion.div 
                  className="undo-progress" 
                  initial={{ width: '100%' }}
                  animate={{ width: '0%' }}
                  transition={{ duration: 7, ease: 'linear' }}
                />
              </motion.div>
            )}
          </AnimatePresence>

          <button
            className={`fab ${!hasNotes ? 'fab-intro-pulse' : ''}`}
            onClick={createNewNote}
            title="New Note"
          >
            <span style={{ fontSize: '1.5rem', fontWeight: 400, lineHeight: 1, marginBottom: '2px' }}>+</span>
            <span>New Spark</span>
          </button>

          {/* Isolated Modal */}
          <AnimatePresence>
            {selectedNote && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="note-modal-overlay" 
                onClick={closeNote}
              >
                <div className="note-modal-content" onClick={e => e.stopPropagation()}>
                   <div className="note-modal-header">
                     <h2 className="headline-medium">View Entry</h2>
                     <button className="n-icon-btn" style={{ background: 'transparent', border: 'none', color: 'var(--n-on-surface)', fontSize: '1.5rem', cursor: 'pointer' }} onClick={closeNote}>×</button>
                  </div>
                  <RichNoteEditor 
                    initialTitle={selectedNote?.title || ''}
                    initialContent={selectedNote?.content || ''} 
                    onSave={async (title, newContent) => {
                       const currentNote = selectedNote;
                       if (currentNote) {
                         const rawTitle = title || extractTitle(newContent);
                         // Optimistic update
                         setActiveIdeas(prev => prev.map(idea => 
                           idea.id === selectedNoteId ? { ...idea, title: rawTitle, content: newContent } : idea
                         ));
                         // Persist logic
                         try {
                           const session = await fetchAuthSession();
                           const token = session.tokens?.idToken?.toString() || '';
                           const hasContentId = !!currentNote.contentId;
                           const resp = await post({
                             apiName: 'VibeCollabApi',
                             path: '/spark',
                             options: {
                               headers: { Authorization: token },
                               body: (hasContentId ? { 
                                 idea: newContent, 
                                 title: rawTitle,
                                 contentId: currentNote.contentId,
                                 createdAt: new Date(currentNote.createdAt).toISOString()
                               } : {
                                 idea: newContent, 
                                 title: rawTitle,
                               }) as any
                             }
                           }).response;
                           // Capture contentId from backend so subsequent saves update, not duplicate
                           const respJson = await resp.body.json() as any;
                           if (respJson?.data?.contentId && !currentNote.contentId) {
                             setActiveIdeas(prev => prev.map(idea =>
                               idea.id === selectedNoteId ? { ...idea, contentId: respJson.data.contentId } : idea
                             ));
                           }
                         } catch (err) {
                           console.error('Failed to update note', err);
                         }
                       }
                    }}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>,
        document.body
      )}
    </div>
    </DashboardErrorBoundary>
  );
}
