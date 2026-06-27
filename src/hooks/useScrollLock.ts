import { useEffect } from 'react';

/**
 * Locks body + html scroll when `active` is true.
 * Restores original overflow on cleanup / deactivation.
 */
export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const prevBody = document.body.style.overflow;
    const prevHtml = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevBody;
      document.documentElement.style.overflow = prevHtml;
    };
  }, [active]);
}
