'use client';

import { useEffect } from 'react';

import { useScript } from '@/hooks/use-script';

declare global {
  interface Window {
    KPIID?: {
      init: () => void;
    };
  }
}

interface KPIIDLoginProps {
  appId?: string;
}

export function KPIIDLogin({ appId }: KPIIDLoginProps) {
  const isInitialized = useScript('https://cdn.cloud.kpi.ua/public/kpi-id-signin.js', true);

  useEffect(() => {
    if (window.KPIID && isInitialized) {
      window.KPIID.init();
    }
  }, [isInitialized]);

  return (
    <div
      id="kpi_id_signin"
      data-app-id={appId || ''}
      data-full-width="true"
      data-size="large"
      data-logo-alignment="left"
      data-locale="uk"
      data-color="brand"
    />
  );
}
