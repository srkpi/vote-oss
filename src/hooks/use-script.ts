'use client';

import { useEffect, useState } from 'react';

export const useScript = (url: string, suppressCache: boolean = false): boolean => {
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const script = document.createElement('script');
    script.src = suppressCache ? `${url}?t=${+new Date()}` : url;
    script.async = true;
    script.onload = () => {
      setIsInitialized(true);
    };
    document.body.appendChild(script);

    return () => {
      try {
        document.body.removeChild(script);
      } catch {
        // script might already be removed
      }
    };
  }, [url, suppressCache]);

  return isInitialized;
};
