import { useRef, useEffect, useCallback } from 'react';

/* ──────────────────────────────────────────────────────────────
   Crisp, Smooth Randomized Scatter Particle Engine
   ────────────────────────────────────────────────────────────── */

interface ParticleBackgroundProps {
  isStatic?: boolean;
}

/* ── Physics Constants ── */
const PARTICLE_COUNT = 3000;   // Slightly lower density for cleaner look
const PARTICLE_RAD   = 1.0;    // Even more subtle dots
const SPRING         = 0.006;  // Extremely gentle snap back to base (slower return)
const FRICTION       = 0.92;   // Smoother, floatier damping
const MOUSE_RADIUS   = 220;    // Wider, very soft interaction area
const MOUSE_FORCE    = 0.005;  // Barely noticeable gentle push/pull
const SHIMMER_AMP    = 1.5;    // Barely noticeable float range
const SHIMMER_SPEED  = 0.0006; // Extremely slow idle wobble

/* ── Particle Struct ── */
interface Particle {
  x: number;
  y: number;
  baseX: number;     // Random base coordinate X
  baseY: number;     // Random base coordinate Y
  vx: number;
  vy: number;
  randomOff: number;   // Random phase for independent shimmering
  repelFactor: number; // Randomizer so they don't form a perfect circle around the mouse
}

export default function ParticleBackground({ isStatic = false }: ParticleBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particles = useRef<Particle[]>([]);
  const mouse     = useRef({ x: -9999, y: -9999 });
  const rafId     = useRef(0);
  
  // Theme state tracking
  const themeRef  = useRef<'dark' | 'light'>('dark');

  /* Build Randomized Scatter */
  const rebuild = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Pixel Ratio for High-Res/Retina displays (Fixes "low resolution")
    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth;
    const h = window.innerHeight;

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
    }

    // Sync theme
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    themeRef.current = currentTheme as 'dark' | 'light';

    const arr: Particle[] = [];
    
    // Generate organic random scatter
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const rx = Math.random() * w;
      const ry = Math.random() * h;
      arr.push({
        x: rx,
        y: ry,
        baseX: rx,
        baseY: ry,
        vx: 0,
        vy: 0,
        randomOff: Math.random() * Math.PI * 2,
        repelFactor: 0.4 + Math.random() * 1.6, // Variation from 0.4x to 2.0x push strength
      });
    }
    particles.current = arr;
  }, []);

  /* Theme Observer */
  useEffect(() => {
    themeRef.current = (document.documentElement.getAttribute('data-theme') || 'dark') as 'dark' | 'light';

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'data-theme') {
          const newTheme = document.documentElement.getAttribute('data-theme') || 'dark';
          themeRef.current = newTheme as 'dark' | 'light';
        }
      });
    });

    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  /* Core Physics Loop */
  const animate = useCallback((time: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const w = window.innerWidth;
    const h = window.innerHeight;

    // Theme Execution (Inverse Logic)
    const isDark = themeRef.current === 'dark';
    
    // Dark mode = Black Bg, Light mode = White Bg
    ctx.fillStyle = isDark ? '#000000' : '#FFFFFF';
    ctx.fillRect(0, 0, w, h);

    // Dark mode = Bright white dots, Light mode = Dark black dots
    // Opacity raised to 0.7 for brighter, clearer dots (not "grey")
    ctx.fillStyle = isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)';

    const mx = mouse.current.x;
    const my = mouse.current.y;
    const isMouseActive = mx !== -9999 && my !== -9999;

    const arr = particles.current;
    const len = arr.length;

    for (let i = 0; i < len; i++) {
      const p = arr[i];

      if (!isStatic) {
        // Idle Shimmer
        const shimmerX = Math.cos(time * SHIMMER_SPEED + p.randomOff) * SHIMMER_AMP;
        const shimmerY = Math.sin(time * SHIMMER_SPEED + p.randomOff) * SHIMMER_AMP;

        const targetX = p.baseX + shimmerX;
        const targetY = p.baseY + shimmerY;

        // Spring Force (Gentle return)
        p.vx += (targetX - p.x) * SPRING;
        p.vy += (targetY - p.y) * SPRING;

        // Organic Mouse Repulsion
        if (isMouseActive) {
          const dx = p.x - mx;
          const dy = p.y - my;
          const distSq = dx * dx + dy * dy;
          const radiusSq = MOUSE_RADIUS * MOUSE_RADIUS;

          if (distSq < radiusSq && distSq > 0) {
            const dist = Math.sqrt(distSq);
            // Non-linear, gentle falloff
            const force = Math.pow((MOUSE_RADIUS - dist) / MOUSE_RADIUS, 1.5);
            
            // Random repel scale breaks the "perfect circle" shape
            const actualForce = force * MOUSE_FORCE * p.repelFactor * 30; // Reduced force multiplier from 100 to 30
            const direction = isDark ? -1 : 1; // Attract in dark mode, repel in light mode
            
            p.vx += (dx / dist) * actualForce * direction;
            p.vy += (dy / dist) * actualForce * direction;
          }
        }

        p.vx *= FRICTION;
        p.vy *= FRICTION;
        
        p.x += p.vx;
        p.y += p.vy;
      }

      // Render crisp dot
      ctx.beginPath();
      // Use exact center coordinates and slightly smaller radius for sharpness
      ctx.arc(p.x, p.y, PARTICLE_RAD, 0, Math.PI * 2);
      ctx.fill();
    }

    rafId.current = requestAnimationFrame(animate);
  }, [isStatic]);

  /* Lifecycle & Resize Setup */
  useEffect(() => {
    rebuild();
    let resizeTimer: any;
    const onResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(rebuild, 100);
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      clearTimeout(resizeTimer);
    };
  }, [rebuild]);

  /* Mouse Listener hooks */
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      mouse.current.x = e.clientX;
      mouse.current.y = e.clientY;
    };
    const onLeave = () => {
      mouse.current.x = -9999;
      mouse.current.y = -9999;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseleave', onLeave);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseleave', onLeave);
    };
  }, []);

  /* Init Animation Loop */
  useEffect(() => {
    rafId.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId.current);
  }, [animate]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: -1,
        pointerEvents: 'none',
        transition: 'background-color 0.3s ease'
      }}
    />
  );
}
