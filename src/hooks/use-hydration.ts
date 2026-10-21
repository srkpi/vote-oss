'use client';

import { useEffect, useState } from 'react';

export function useHydration() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    setHydrated(true);
  }, []);

  return hydrated;
}
