import { useState, useRef, useEffect, useCallback } from 'react';
import { Scissors, Upload, X, CheckCircle2, ChevronRight, Download, Sparkles, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import './ParallaxLab.css';

/**
 * Parallax Lab — Demo Mode
 * 
 * Shows a "Coming Soon" banner explaining API quota limits.
 * An "Experience Demo" button reveals the demo interface.
 * In demo mode: user uploads any video → first 10s are trimmed + cropped to 1:1 square
 * → previewed inline → downloadable as MP4.
 */

export default function ParallaxLab() {

  // Upload state
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [processingStage, setProcessingStage] = useState('');

  // Output state
  const [isComplete, setIsComplete] = useState(false);
  const [outputBlobUrl, setOutputBlobUrl] = useState<string | null>(null);
  const [clipMeta, setClipMeta] = useState<{
    startSeconds: number;
    endSeconds: number;
    durationSeconds: number;
    hookDescription: string;
    croppedToSquare: boolean;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [orientation, setOrientation] = useState<'horizontal' | 'vertical'>('horizontal');
  const [videoDuration, setVideoDuration] = useState<number | null>(null);

  // FFmpeg state
  const [ffmpegLoaded, setFfmpegLoaded] = useState(false);
  const [ffmpegError, setFfmpegError] = useState<string | null>(null);
  const ffmpegRef = useRef(new FFmpeg());
  const ffmpegLoadPromiseRef = useRef<Promise<void> | null>(null);



  const fileInputRef = useRef<HTMLInputElement>(null);
  const sourceVideoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Load FFmpeg
  useEffect(() => {
    loadFFmpeg();
  }, []);

  const loadFFmpeg = async () => {
    if (ffmpegLoaded) return;
    if (ffmpegLoadPromiseRef.current) return ffmpegLoadPromiseRef.current;

    setFfmpegError(null);

    const loadPromise = (async () => {
      try {
        console.log('Loading FFmpeg... crossOriginIsolated:', crossOriginIsolated);
        if (!crossOriginIsolated) {
          throw new Error('CROSS_ORIGIN_ISOLATION_MISSING');
        }
        const baseURL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd';
        const ffmpeg = ffmpegRef.current;

        ffmpeg.on('log', ({ message }) => {
          console.log('FFmpeg Log:', message);
        });

        const coreURL = await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript');
        const wasmURL = await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm');
        const workerURL = await toBlobURL(`${baseURL}/ffmpeg-core.worker.js`, 'text/javascript');

        const loadWithTimeout = (promise: Promise<void>, ms: number) => {
          return Promise.race([
            promise,
            new Promise<void>((_, reject) => {
              setTimeout(() => reject(new Error('FFMPEG_LOAD_TIMEOUT')), ms);
            }),
          ]);
        };

        await loadWithTimeout(
          ffmpeg.load({ coreURL, wasmURL, workerURL }),
          20000
        );

        console.log('FFmpeg Loaded successfully');
        setFfmpegLoaded(true);
        setFfmpegError(null);
      } catch (err: any) {
        console.error('FFmpeg Load Error:', err);
        if (err?.message === 'CROSS_ORIGIN_ISOLATION_MISSING') {
          setFfmpegError('cross-origin-isolation');
        } else if (err?.message === 'FFMPEG_LOAD_TIMEOUT') {
          setFfmpegError('Video engine timed out while loading. Please retry.');
        } else {
          setFfmpegError(err?.message || 'Failed to load video engine.');
        }
        throw err;
      } finally {
        ffmpegLoadPromiseRef.current = null;
      }
    })();

    ffmpegLoadPromiseRef.current = loadPromise;
    return loadPromise;
  };

  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      if (outputBlobUrl) URL.revokeObjectURL(outputBlobUrl);
    };
  }, [previewUrl, outputBlobUrl]);

  // ── DEMO GATE ──────────────────────────────

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

  const acceptFile = async (file: File) => {
    if (isInitializing) return;
    setError(null);
    setIsInitializing(true);

    // TASK 1: STRICT LIMITS
    // 50MB Size Limit
    if (file.size > 50 * 1024 * 1024) {
      setError("File too large. Maximum size is 50MB.");
      setIsInitializing(false);
      return;
    }

    // Duration limit check (needs metadata)
    const video = document.createElement('video');
    video.preload = 'metadata';

    const timeout = setTimeout(() => {
      setError("Timed out while probing video. Try another format (MP4/WebM).");
      setIsInitializing(false);
      video.onloadedmetadata = null;
      video.onerror = null;
    }, 10000);

    video.onloadedmetadata = () => {
      clearTimeout(timeout);
      window.URL.revokeObjectURL(video.src);
      
      // TASK 5: ORIENTATION DETECTION
      const isHorizontal = video.videoWidth > video.videoHeight;
      console.log('Video Probed:', { duration: video.duration, width: video.videoWidth, height: video.videoHeight, isHorizontal });
      setOrientation(isHorizontal ? 'horizontal' : 'vertical');

      if (video.duration > 180) {
        setError("Video too long. Maximum duration is 180 seconds.");
        setUploadedFile(null);
        setVideoDuration(null);
      } else {
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setUploadedFile(file);
        setPreviewUrl(URL.createObjectURL(file));
        setIsComplete(false);
        setOutputBlobUrl(null);
        setVideoDuration(video.duration);
      }
      setIsInitializing(false);
    };

    video.onerror = () => {
      clearTimeout(timeout);
      setError("Failed to probe video. This format may not be supported by your browser.");
      setIsInitializing(false);
    };

    video.src = URL.createObjectURL(file);
  };

  const removeFile = () => {
    setUploadedFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setIsComplete(false);
    if (outputBlobUrl) URL.revokeObjectURL(outputBlobUrl);
    setOutputBlobUrl(null);
    setClipMeta(null);
    setError(null);
    setIsProcessing(false);
    setProcessingProgress(0);
    setProcessingStage('');
    setVideoDuration(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ── CLIENT-SIDE TRIM + SQUARE CROP ─────────

  const processVideo = useCallback(async () => {
    console.log('Process Video Clicked', { uploadedFile: !!uploadedFile, ffmpegLoaded });
    if (!uploadedFile || !ffmpegLoaded) {
      if (!ffmpegLoaded) setError('Still initializing video engine...');
      return;
    }

    const functionUrl = import.meta.env.VITE_ANALYZE_FUNCTION_URL;
    if (!functionUrl) {
      setError('VITE_ANALYZE_FUNCTION_URL is not configured. Add it to your .env file.');
      return;
    }

    setIsProcessing(true);
    setProcessingProgress(0);
    setError(null);
    setClipMeta(null);

    try {
      setProcessingStage('Preparing video file...');
      setProcessingProgress(5);
      const ffmpeg = ffmpegRef.current;
      const inputName = 'input.mp4';
      const outputName = 'output_720p.mp4';

      setProcessingProgress(10);
      await ffmpeg.writeFile(inputName, await fetchFile(uploadedFile));

      setProcessingStage('Compressing to 720p locally...');
      setProcessingProgress(20);
      
      // Track real-time progress for FFmpeg (20% to 50% range)
      const progressHandler = ({ progress }: { progress: number }) => {
        const percent = Math.round(20 + (progress * 30)); 
        setProcessingProgress(percent);
      };
      ffmpeg.on('progress', progressHandler);

      console.log('Running FFmpeg 720p scale...');
      await ffmpeg.exec([
        '-i', inputName,
        '-vf', 'scale=-2:720',
        '-c:v', 'libx264',
        '-crf', '23',
        '-preset', 'veryfast',
        '-c:a', 'copy',
        outputName,
      ]);

      ffmpeg.off('progress', progressHandler);
      console.log('FFmpeg scale complete');
      setProcessingProgress(50);
      setProcessingStage('Reading compressed output...');
      const data = await ffmpeg.readFile(outputName);
      const processedBlob = new Blob([data as any], { type: 'video/mp4' });

      setProcessingStage('Validating compressed output...');
      setProcessingProgress(55);
      const maxDurationSeconds = 180;
      const maxCompressedBytes = 4.5 * 1024 * 1024;
      if (videoDuration && videoDuration > maxDurationSeconds) {
        throw new Error(`Video too long. Maximum duration is ${maxDurationSeconds} seconds.`);
      }
      if (processedBlob.size > maxCompressedBytes) {
        throw new Error('Compressed video is too large for the AI pipeline. Please upload a shorter clip.');
      }

      setProcessingStage('Converting for upload...');
      setProcessingProgress(60);
      const base64Video = await blobToBase64(processedBlob);
      const maxBase64Chars = 5.2 * 1024 * 1024;
      if (base64Video.length > maxBase64Chars) {
        throw new Error('Compressed video exceeds the upload limit. Please use a shorter clip.');
      }

      setProcessingStage('Sending to Demo Pipeline...');
      setProcessingProgress(70);
      console.log('Targeting AI Function:', functionUrl);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 180000);

      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          video: base64Video,
          filename: uploadedFile.name,
          orientation,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      setProcessingProgress(90);
      setProcessingStage('Finalizing clip...');

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `AI Processing Failed (HTTP ${response.status})`);
      }

      const result = await response.json();
      if (!result.finalUrl) throw new Error('No output URL returned from AI pipeline.');

      setOutputBlobUrl(result.finalUrl);
      if (result.clipMeta) setClipMeta(result.clipMeta);
      setIsComplete(true);
      setProcessingProgress(100);
      setProcessingStage('Viral clip ready!');

    } catch (err: any) {
      console.error('Processing error:', err);
      if (err?.name === 'AbortError') {
        setError('Processing timed out. Please try again or use a shorter clip.');
      } else {
        setError(err.message || 'An error occurred during processing.');
      }
    } finally {
      setIsProcessing(false);
      try {
        const ffmpeg = ffmpegRef.current;
        await ffmpeg.deleteFile('input.mp4');
        await ffmpeg.deleteFile('output_720p.mp4');
      } catch {
        // Ignore cleanup errors
      }
    }
  }, [uploadedFile, ffmpegLoaded, orientation]);

  // Helper to convert blob to base64 for direct transmission (or better, use a presigned URL approach if size is large)
  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = (reader.result as string).split(',')[1];
        resolve(base64String);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const handleDownload = () => {
    if (!outputBlobUrl) return;
    const a = document.createElement('a');
    a.href = outputBlobUrl;
    a.download = `parallax-viral-clip-${Date.now()}.mp4`;
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
            <span className="typography-reveal"><span>Parallax Lab</span></span>
          </h1>
          <motion.span
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="lab-demo-badge"
            style={{ background: 'var(--n-accent)', color: 'white' }}
          >
            <Sparkles size={14} /> LIVE PIPELINE
          </motion.span>
        </div>
        <p className="body-medium text-muted" style={{ margin: 0 }}>
          1-to-many content engine. One video → 10+ native formats.
        </p>
      </div>

      {/* ═══ WORKSPACE ═══ */}
      <div className="lab-demo-workspace">
        <div
          style={{
            background: 'linear-gradient(90deg, #F59E0B, #F97316)',
            color: '#1F2937',
            border: '1px solid rgba(0,0,0,0.15)',
            borderRadius: '14px',
            padding: '14px 16px',
            marginBottom: '18px',
            fontWeight: 600,
            boxShadow: '0 6px 20px rgba(249,115,22,0.25)',
          }}
        >
          ⚠️ LIVE DEMO MODE ACTIVE. Due to extreme hackathon API limits, live Amazon Nova processing is temporarily disabled. The system will currently auto-process the first 10 seconds of your video as a demonstration of the rendering pipeline.
        </div>
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
                  className={`lab-dropzone ${isDragActive ? 'drag-active' : ''} ${isInitializing ? 'is-initializing' : ''}`}
                  onClick={() => !isInitializing && fileInputRef.current?.click()}
                  onDrop={handleDrop}
                  onDragOver={(e) => { e.preventDefault(); !isInitializing && setIsDragActive(true); }}
                  onDragLeave={() => setIsDragActive(false)}
                  style={{ 
                    border: error ? '2px dashed #EF4444' : undefined,
                    cursor: isInitializing ? 'wait' : 'pointer',
                    opacity: isInitializing ? 0.7 : 1
                  }}
                >
                  <input ref={fileInputRef} type="file" accept="video/*" hidden onChange={handleFileSelect} disabled={isInitializing} />
                  {isInitializing ? (
                    <div className="lab-loader-ring" style={{ width: 48, height: 48 }}></div>
                  ) : error ? (
                    <AlertCircle size={48} style={{ color: '#EF4444' }} />
                  ) : (
                    <Upload size={48} className="text-primary" />
                  )}
                  <h3 className="title-large" style={{ margin: '16px 0 4px' }}>
                    {isInitializing ? 'Checking video...' : error ? 'Upload Error' : 'Upload your raw video'}
                  </h3>
                  <p className="body-medium text-muted">
                    {isInitializing ? 'Extracting metadata & orientation...' : error ? error : 'Drag & drop or click to browse'}
                  </p>
                  <p className="body-small text-muted" style={{ marginTop: '4px' }}>
                    MP4, MOV, WebM • Max 180s • Auto-compressed to 720p
                  </p>
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

                {/* FFmpeg error state — show retry card instead of disabled button */}
                {ffmpegError ? (
                  <div style={{
                    background: 'rgba(239,68,68,0.08)',
                    border: '1.5px solid rgba(239,68,68,0.4)',
                    borderRadius: '20px',
                    padding: '20px 24px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '12px',
                    textAlign: 'center',
                  }}>
                    <AlertCircle size={28} style={{ color: '#EF4444' }} />
                    <p className="body-medium" style={{ margin: 0, color: '#EF4444', fontWeight: 600 }}>
                      {ffmpegError === 'cross-origin-isolation'
                        ? 'Video engine requires secure context. Please hard-refresh (Ctrl+Shift+R) or open DevTools → Application → check Cross-Origin Isolation is active.'
                        : `Engine failed: ${ffmpegError}`}
                    </p>
                    <button
                      className="lab-reset-btn"
                      onClick={loadFFmpeg}
                      style={{ borderColor: '#EF4444', color: '#EF4444' }}
                    >
                      Retry Loading Engine
                    </button>
                  </div>
                ) : (
                  <motion.button
                    className="lab-generate-btn"
                    onClick={ffmpegLoaded ? processVideo : undefined}
                    disabled={!ffmpegLoaded || isProcessing}
                    whileHover={ffmpegLoaded && !isProcessing ? { y: -2, boxShadow: '4px 4px 0px 0px #FFFFFF' } : {}}
                    whileTap={ffmpegLoaded && !isProcessing ? { scale: 0.97 } : {}}
                    style={{ cursor: (!ffmpegLoaded || isProcessing) ? 'wait' : 'pointer' }}
                  >
                    <Scissors size={22} style={{ animation: !ffmpegLoaded ? 'spin 1.5s linear infinite' : 'none' }} />
                    <span>{!ffmpegLoaded ? 'LOADING ENGINE...' : 'ANALYZE & REPURPOSE'}</span>
                  </motion.button>
                )}
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
                  <span className="title-medium">🎬 Viral Segment Ready!</span>
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
                        borderRadius: '20px',
                        border: '2px solid rgba(215, 25, 33, 0.3)',
                        boxShadow: '0 12px 40px rgba(215, 25, 33, 0.2), 0 4px 16px rgba(0,0,0,0.3)',
                        background: '#000',
                      }}
                    />
                  </div>

                  <div className="lab-output-details">
                    <h4 className="title-large" style={{ fontSize: '1.5rem', marginBottom: '8px' }}>AI-Optimized Clip</h4>
                    <span className="lab-tag" style={{ fontSize: '0.85rem', padding: '6px 14px', background: 'var(--n-accent)', color: '#fff', border: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: '16px' }}>
                      <Scissors size={14} /> Amazon Nova • {orientation === 'horizontal' ? '1:1 Square Crop' : 'Native Vertical'}
                    </span>

                    {/* Nova clip metadata */}
                    {clipMeta && (
                      <div style={{ background: 'rgba(215,25,33,0.06)', borderRadius: '12px', padding: '16px', border: '1px solid rgba(215,25,33,0.2)', marginBottom: '16px' }}>
                        <p className="body-small text-muted" style={{ margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>Nova AI Analysis</p>
                        <p className="body-medium" style={{ margin: '0 0 8px', fontStyle: 'italic', color: 'var(--n-on-surface)' }}>"{clipMeta.hookDescription}"</p>
                        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                          <span className="body-small text-muted">⏱ {clipMeta.startSeconds.toFixed(1)}s → {clipMeta.endSeconds.toFixed(1)}s</span>
                          <span className="body-small text-muted">📏 {clipMeta.durationSeconds.toFixed(1)}s clip</span>
                          <span className="body-small text-muted">{clipMeta.croppedToSquare ? '✂️ Cropped to 1:1' : '📱 Native format preserved'}</span>
                        </div>
                      </div>
                    )}

                    <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '16px', padding: '20px', border: '1px solid var(--n-outline)', marginBottom: '20px' }}>
                      <p className="body-medium text-muted" style={{ margin: 0, lineHeight: 1.7 }}>
                        Amazon Nova multimodal AI identified the most engaging segment of your video.
                        It has been trimmed and {orientation === 'horizontal' ? 'cropped to 1:1 square with auto subject tracking' : 'preserved in native vertical format'} for maximum platform compatibility.
                      </p>
                    </div>

                    <div className="lab-output-tags" style={{ marginBottom: '20px', gap: '8px', display: 'flex', flexWrap: 'wrap' }}>
                      <span className="lab-tag">#Viral</span>
                      <span className="lab-tag">#AmazonNova</span>

                      <span className="lab-tag">#Reels</span>
                      <span className="lab-tag">#Parallax</span>
                    </div>

                    <button
                      onClick={handleDownload}
                      className="lab-download-btn"
                    >
                      <Download size={20} />
                      Download Viral Clip
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'center', marginTop: '32px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '24px' }}>
                  <button className="lab-reset-btn" onClick={resetAll}>
                    Repurpose Another Video <ChevronRight size={16} />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

