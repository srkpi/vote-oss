'use client';

import { Key } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';

interface KeyDisclosureProps {
  children: React.ReactNode;
}

export function KeyDisclosure({ children }: KeyDisclosureProps) {
  const [show, setShow] = useState(false);

  if (show) {
    return <>{children}</>;
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => setShow(true)}
      className="text-muted-foreground shadow-shadow-card border-border-color shadow-shadow-sm w-full gap-2 rounded-xl border"
    >
      <Key className="h-4 w-4" />
      Показати ключі шифрування
    </Button>
  );
}
