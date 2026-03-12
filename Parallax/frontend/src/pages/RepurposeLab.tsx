import { useState, useRef, useEffect, useCallback } from 'react';
import { Scissors, Upload, X, CheckCircle2, ChevronRight, Download, Sparkles, Clock, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import './RepurposeLab.css';

/**
 * Repurpose Lab — Demo Mode
 * 
 * Shows a "Coming Soon" banner explaining API quota limits.
 * An "Experience Demo" button reveals the demo interface.
 * In demo mode: user uploads any video → first 10s are trimmed + cropped to 1:1 square
 * → previewed inline → downloadable as MP4.
 */

export default function RepurposeLab() {
  // Demo gate state
  const [demoMode, setDemoMode] = useState(false);
  const [bannerDismissing, setBannerDismissing] = useState(false);

  // Upload state
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [processingStage, setProcessingStage] = useState('');

  // Output state
  const [isComplete, setIsComplete] = useState(false);
  const [outputBlobUrl, setOutputBlobUrl] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const sourceVideoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      if (outputBlobUrl) URL.revokeObjectURL(outputBlobUrl);
    };
  }, [previewUrl, outputBlobUrl]);

  // ── DEMO GATE ──────────────────────────────
  const handleEnterDemo = () => {
    setBannerDismissing(true);
    setTimeout(() => setDemoMode(true), 600);
  };

  // ── FILE HANDLING ──────────────────────────
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('video/')) acceptFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('video/')) acceptFile(file);
  };

  const acceptFile = (file: File) => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setUploadedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setIsComplete(false);
    setOutputBlobUrl(null);
  };

  const removeFile = () => {
    setUploadedFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setIsComplete(false);
    if (outputBlobUrl) URL.revokeObjectURL(outputBlobUrl);
    setOutputBlobUrl(null);
    setIsProcessing(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ── CLIENT-SIDE TRIM + SQUARE CROP ─────────
  const TRIM_DURATION = 10; // seconds

  const processVideo = useCallback(async () => {
    if (!uploadedFile || !sourceVideoRef.current || !canvasRef.current) return;

    setIsProcessing(true);
    setProcessingProgress(0);
    setProcessingStage('Loading video...');

    const video = sourceVideoRef.current;
    const canvas = canvasRef.current;

    // Wait for video to be fully ready and dimensions parsed
    await new Promise<void>((resolve) => {
      if (video.readyState >= 1 && video.videoWidth > 0 && video.videoHeight > 0) {
        return resolve();
      }
      const checkReady = () => {
        if (video.videoWidth > 0 && video.videoHeight > 0) {
          video.removeEventListener('loadedmetadata', checkReady);
          video.removeEventListener('canplay', checkReady);
          resolve();
        }
      };
      video.addEventListener('loadedmetadata', checkReady);
      video.addEventListener('canplay', checkReady);
      // Ensure the browser fetches the metadata
      video.load();
    });

    const actualDuration = Math.min(video.duration, TRIM_DURATION);
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    // Center-crop: take the largest centered square from the original video
    const cropSize = Math.min(vw, vh);
    const cropX = Math.floor((vw - cropSize) / 2);
    const cropY = Math.floor((vh - cropSize) / 2);

    // Output canvas = 720x720 perfect square
    const OUTPUT_SIZE = 720;
    canvas.width = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;
    const ctx = canvas.getContext('2d')!;

    // Use captureStream at 0 fps — we push frames manually via track.requestFrame()
    const stream = canvas.captureStream(0);
    const videoTrack = stream.getVideoTracks()[0];

    // --- Audio Capture via Web Audio API ---
    // This routes the audio into our stream WITHOUT playing it on the speakers!
    try {
      let audioCtx: AudioContext;
      let destNode: MediaStreamAudioDestinationNode;
      
      // @ts-ignore - store on element to prevent Re-routing errors on same DOM node
      if (!video.audioRouted) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        audioCtx = new AudioContextClass();
        const sourceNode = audioCtx.createMediaElementSource(video);
        destNode = audioCtx.createMediaStreamDestination();
        sourceNode.connect(destNode);
        // @ts-ignore
        video.audioRouted = { audioCtx, destNode };
      } else {
        // @ts-ignore
        const routed = video.audioRouted;
        audioCtx = routed.audioCtx;
        destNode = routed.destNode;
      }
      
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
      
      const audioTracks = destNode.stream.getAudioTracks();
      if (audioTracks.length > 0) {
        stream.addTrack(audioTracks[0]);
      }
    } catch (err) {
      console.warn('Audio routing failed:', err);
    }
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : MediaRecorder.isTypeSupported('video/webm;codecs=vp8')
        ? 'video/webm;codecs=vp8'
        : 'video/webm';
        
    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8_000_000 });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

    setProcessingStage('Trimming & cropping...');

    return new Promise<void>((resolve) => {
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType });
        const url = URL.createObjectURL(blob);
        setOutputBlobUrl(url);
        setIsProcessing(false);
        setIsComplete(true);
        setProcessingProgress(100);
        resolve();
      };

      video.currentTime = 0;
      video.muted = false; // MUST be false to route audio to AudioContext!

      const drawFrame = () => {
        if (video.paused || video.ended || video.currentTime >= actualDuration) {
          video.pause();
          // Give recorder a tiny delay to flush the final frames
          setTimeout(() => recorder.stop(), 150);
          return;
        }

        // Fill black background first to break any Chrome hardware passthrough optimizations
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
        
        // Draw center-cropped square frame
        ctx.drawImage(video, cropX, cropY, cropSize, cropSize, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

        // Request a new frame from the captureStream track
        // @ts-ignore — requestFrame is a valid method on CanvasCaptureMediaStreamTrack
        if (videoTrack && videoTrack.requestFrame) videoTrack.requestFrame();

        // Update progress
        const pct = Math.min((video.currentTime / actualDuration) * 100, 100);
        setProcessingProgress(Math.round(pct));
        setProcessingStage(
          pct < 30 ? 'Extracting frames...' :
          pct < 60 ? 'Applying center square crop...' :
          pct < 90 ? 'Encoding output...' :
          'Finalizing...'
        );

        requestAnimationFrame(drawFrame);
      };

      video.onseeked = () => {
        recorder.start();
        video.play();
        requestAnimationFrame(drawFrame);
      };

      // Seek to start
      video.currentTime = 0.001;
    });
  }, [uploadedFile]);

  const handleDownload = () => {
    if (!outputBlobUrl) return;
    const a = document.createElement('a');
    a.href = outputBlobUrl;
    a.download = `vibe-collab-clip-${Date.now()}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const resetAll = () => {
    removeFile();
  };

  // ── RENDER ─────────────────────────────────
  return (
    <div className="lab-page">
      {/* ═══ STICKY HEADER ═══ */}
      <div className="lab-sticky-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 className="lab-title dot-display" style={{ margin: 0 }}>
            <span className="typography-reveal"><span>Repurpose Lab</span></span>
          </h1>
          {demoMode && (
            <motion.span
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="lab-demo-badge"
            >
              <Sparkles size={14} /> DEMO MODE
            </motion.span>
          )}
        </div>
        <p className="body-medium text-muted" style={{ margin: 0 }}>
          1-to-many content engine. One video → 10+ native formats.
        </p>
      </div>

      {/* ═══ COMING SOON BANNER ═══ */}
      <AnimatePresence>
        {!demoMode && (
          <motion.div
            className="lab-coming-soon-section"
            initial={{ opacity: 1 }}
            animate={bannerDismissing ? { opacity: 0, y: -40, scale: 0.95 } : { opacity: 1 }}
            exit={{ opacity: 0, y: -40, scale: 0.95 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* Pill Banner */}
            <motion.div
              className="coming-soon-pill"
              animate={bannerDismissing ? { scale: 0.7, opacity: 0 } : {}}
              transition={{ duration: 0.4 }}
            >
              <Clock size={18} className="coming-soon-icon" />
              <span>COMING SOON...</span>
            </motion.div>

            {/* Explanation */}
            <motion.div
              className="coming-soon-explanation"
              animate={bannerDismissing ? { opacity: 0, y: 20 } : {}}
              transition={{ duration: 0.3, delay: 0.1 }}
            >
              <h2 className="coming-soon-title">Full AI Pipeline Launching Soon</h2>
              <p className="coming-soon-text">
                Our AI video engine (Gemini 2.0 + Cloudinary) is paused due to <strong>API quota limits</strong> during beta. 
                Try the demo below to experience the core trim & crop engine!
              </p>

              <div className="coming-soon-features">
                <div className="feature-chip">
                  <Scissors size={16} />
                  <span>Smart Trim (First 10s)</span>
                </div>
                <div className="feature-chip">
                  <Zap size={16} />
                  <span>1:1 Square Crop</span>
                </div>
                <div className="feature-chip">
                  <Download size={16} />
                  <span>Instant Download</span>
                </div>
              </div>
            </motion.div>

            {/* CTA Button */}
            <motion.button
              className="lab-demo-cta"
              onClick={handleEnterDemo}
              whileHover={{ y: -3, boxShadow: '0 12px 40px rgba(215,25,33,0.4)' }}
              whileTap={{ scale: 0.97 }}
              animate={bannerDismissing ? { opacity: 0, scale: 0.9 } : {}}
            >
              <Sparkles size={20} />
              Experience Demo
              <ChevronRight size={18} />
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ DEMO INTERFACE ═══ */}
      <AnimatePresence>
        {demoMode && (
          <motion.div
            className="lab-demo-workspace"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* Hidden elements for processing */}
            <video
              ref={sourceVideoRef}
              src={previewUrl || undefined}
              style={{ display: 'none' }}
              playsInline
              muted
              preload="auto"
            />
            <canvas ref={canvasRef} style={{ display: 'none' }} />

            <div className="lab-demo-container">
              <AnimatePresence mode="wait">
                {/* ── STATE 1: Upload Zone ── */}
                {!uploadedFile && !isProcessing && !isComplete && (
                  <motion.div
                    key="upload"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.4 }}
                    className="lab-demo-upload-area"
                  >
                    <div
                      className={`lab-dropzone ${isDragActive ? 'drag-active' : ''}`}
                      onClick={() => fileInputRef.current?.click()}
                      onDrop={handleDrop}
                      onDragOver={(e) => { e.preventDefault(); setIsDragActive(true); }}
                      onDragLeave={() => setIsDragActive(false)}
                    >
                      <input ref={fileInputRef} type="file" accept="video/*" hidden onChange={handleFileSelect} />
                      <Upload size={48} className="text-primary" />
                      <h3 className="title-large" style={{ margin: '16px 0 4px' }}>Upload your raw video</h3>
                      <p className="body-medium text-muted">Drag & drop or click to browse</p>
                      <p className="body-small text-muted" style={{ marginTop: '4px' }}>MP4, MOV, WebM • Any length (first 10s will be extracted)</p>
                    </div>
                  </motion.div>
                )}

                {/* ── STATE 2: Preview + Process Button ── */}
                {uploadedFile && !isProcessing && !isComplete && previewUrl && (
                  <motion.div
                    key="preview"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.4 }}
                    className="lab-demo-preview-area"
                  >
                    <div className="lab-preview-card">
                      <div className="lab-preview-video-wrap">
                        <video
                          src={previewUrl}
                          controls
                          playsInline
                          style={{ width: '100%', borderRadius: '16px', maxHeight: '300px', objectFit: 'cover' }}
                        />
                      </div>
                      <div className="lab-preview-info">
                        <div>
                          <h4 className="title-small" style={{ margin: 0 }}>{uploadedFile.name}</h4>
                          <span className="body-small text-muted">
                            {(uploadedFile.size / (1024 * 1024)).toFixed(1)} MB
                          </span>
                        </div>
                        <button className="lab-remove-btn" onClick={removeFile} title="Remove">
                          <X size={16} />
                        </button>
                      </div>
                    </div>

                    <motion.button
                      className="lab-generate-btn"
                      onClick={processVideo}
                      whileHover={{ y: -2, boxShadow: '4px 4px 0px 0px #FFFFFF' }}
                      whileTap={{ scale: 0.97 }}
                    >
                      <Scissors size={22} />
                      <span>TRIM & CROP TO SQUARE</span>
                    </motion.button>
                  </motion.div>
                )}

                {/* ── STATE 3: Processing Animation ── */}
                {isProcessing && (
                  <motion.div
                    key="processing"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.4 }}
                    className="lab-demo-processing"
                  >
                    <motion.div
                      className="lab-processing-ring"
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                    >
                      <Scissors size={40} />
                    </motion.div>

                    <h3 className="title-large" style={{ marginTop: '24px' }}>{processingStage}</h3>

                    <div className="lab-processing-bar-container">
                      <div className="lab-processing-bar">
                        <motion.div
                          className="lab-processing-bar-fill"
                          animate={{ width: `${processingProgress}%` }}
                          transition={{ duration: 0.3 }}
                        />
                      </div>
                      <span className="mono" style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--n-accent)' }}>
                        {processingProgress}%
                      </span>
                    </div>
                  </motion.div>
                )}

                {/* ── STATE 4: Output ── */}
                {isComplete && outputBlobUrl && (
                  <motion.div
                    key="output"
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                    className="lab-demo-output"
                  >
                    <div className="lab-success-badge" style={{ justifyContent: 'center', marginBottom: '24px' }}>
                      <CheckCircle2 size={24} />
                      <span className="title-medium">🎬 Square Clip Ready!</span>
                    </div>

                    <div className="lab-output-content">
                      <div className="lab-output-video-wrap">
                        <video
                          src={outputBlobUrl}
                          controls
                          autoPlay
                          loop
                          muted
                          playsInline
                          style={{
                            width: '100%',
                            aspectRatio: '1 / 1',
                            objectFit: 'cover',
                            borderRadius: '20px',
                            border: '2px solid rgba(215, 25, 33, 0.3)',
                            boxShadow: '0 12px 40px rgba(215, 25, 33, 0.2), 0 4px 16px rgba(0,0,0,0.3)',
                            background: '#000',
                          }}
                        />
                      </div>

                      <div className="lab-output-details">
                        <h4 className="title-large" style={{ fontSize: '1.5rem', marginBottom: '8px' }}>AI-Trimmed Square Clip</h4>
                        <span className="lab-tag" style={{ fontSize: '0.85rem', padding: '6px 14px', background: 'var(--n-accent)', color: '#fff', border: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: '16px' }}>
                          <Scissors size={14} /> 0s → 10s • 1:1 Square
                        </span>

                        <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '16px', padding: '20px', border: '1px solid var(--n-outline)', marginBottom: '20px' }}>
                          <p className="body-medium text-muted" style={{ margin: 0, lineHeight: 1.7 }}>
                            The first 10 seconds of your video have been extracted and intelligently cropped to a 
                            perfect 1:1 square format — optimized for Instagram Reels, YouTube Shorts, and TikTok. 
                            The center-crop algorithm ensures the most important visual content is preserved.
                          </p>
                        </div>

                        <div className="lab-output-tags" style={{ marginBottom: '20px', gap: '8px', display: 'flex', flexWrap: 'wrap' }}>
                          <span className="lab-tag">#Shorts</span>
                          <span className="lab-tag">#Reels</span>
                          <span className="lab-tag">#SquareCrop</span>
                          <span className="lab-tag">#VibeCollab</span>
                        </div>

                        <button
                          onClick={handleDownload}
                          className="lab-download-btn"
                        >
                          <Download size={20} />
                          Download Square Clip
                        </button>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'center', marginTop: '32px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '24px' }}>
                      <button className="lab-reset-btn" onClick={resetAll}>
                        Convert Another Video <ChevronRight size={16} />
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
