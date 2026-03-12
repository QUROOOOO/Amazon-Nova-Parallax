import { useRef, useEffect, useCallback, useState } from 'react';
import './CustomCursor.css';

export default function CustomCursor() {
  const cursorRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<number>(0);
  const mousePos = useRef({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState(false);

  const updateCursor = useCallback(() => {
    if (cursorRef.current) {
      cursorRef.current.style.transform = `translate3d(${mousePos.current.x}px, ${mousePos.current.y}px, 0)`;
    }
    requestRef.current = requestAnimationFrame(updateCursor);
  }, []);

  const onMouseMove = useCallback((e: MouseEvent) => {
    mousePos.current.x = e.clientX;
    mousePos.current.y = e.clientY;

    // Detect if hovering over clickable element
    const target = e.target as HTMLElement;
    const isClickable = 
      target.tagName.toLowerCase() === 'button' ||
      target.tagName.toLowerCase() === 'a' ||
      target.closest('button') !== null ||
      target.closest('a') !== null ||
      window.getComputedStyle(target).cursor === 'pointer';
    
    setIsHovering(isClickable);
    // Toggle class on documentElement for CSS morph effect
    if (isClickable) {
      document.documentElement.classList.add('custom-cursor-hovering');
    } else {
      document.documentElement.classList.remove('custom-cursor-hovering');
    }
  }, []);

  const onMouseDown = useCallback(() => {
    document.documentElement.classList.add('custom-cursor-clicking');
  }, []);

  const onMouseUp = useCallback(() => {
    document.documentElement.classList.remove('custom-cursor-clicking');
  }, []);

  useEffect(() => {
    const isTouchDevice = window.matchMedia('(pointer: coarse)').matches;
    if (isTouchDevice) return;

    // Show cursor and hide native
    document.documentElement.classList.add('custom-cursor-active');
    
    // Initial request
    requestRef.current = requestAnimationFrame(updateCursor);
    
    document.addEventListener('mousemove', onMouseMove, { passive: true });
    document.addEventListener('mousedown', onMouseDown, { passive: true });
    document.addEventListener('mouseup', onMouseUp, { passive: true });

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      document.documentElement.classList.remove('custom-cursor-active');
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, [updateCursor, onMouseMove, onMouseDown, onMouseUp]);

  return (
    <div ref={cursorRef} className="vc-cursor" style={{ willChange: 'transform' }}>
      <svg
        className="cursor-svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill={isHovering ? '#D71921' : 'var(--n-on-surface)'}
        stroke={isHovering ? '#D71921' : 'var(--n-bg)'}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        style={{
          transform: isHovering ? 'scale(0.9) translate(-10%, -10%)' : 'scale(1) translate(-10%, -10%)',
          transition: 'transform 0.15s ease-out, fill 0.15s ease-out, stroke 0.15s ease-out',
          transformOrigin: 'top left',
        }}
      >
        <path d="M0 0L24 8L13 13L8 24Z" />
      </svg>
    </div>
  );
}
