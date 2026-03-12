import { useState, useEffect } from 'react';

/**
 * A custom hook that detects if the user has scrolled down the page
 * past a certain threshold. Useful for changing header styles on scroll.
 */
export function useHeaderScroll(threshold = 30) {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const currentScroll = window.scrollY;
      
      // Hysteresis: wait until we scroll down further to activate, 
      // but only deactivate when we scroll almost all the way back up.
      // This prevents the page height jump from instantly untriggering it causing a shake loop.
      if (currentScroll > threshold + 10 && !isScrolled) {
        setIsScrolled(true);
      } else if (currentScroll < Math.max(0, threshold - 20) && isScrolled) {
        setIsScrolled(false);
      }
    };

    // Add scroll event listener
    window.addEventListener('scroll', handleScroll, { passive: true });

    // Cleanup
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [threshold, isScrolled]);

  return isScrolled;
}
