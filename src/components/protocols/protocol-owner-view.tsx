'use client';

import { useEffect, useState } from 'react';

import { ProtocolDocumentView } from '@/components/protocols/protocol-document-view';
import { ProtocolFormClient } from '@/components/protocols/protocol-form-client';
import type { ProtocolWithCounts } from '@/lib/api/client';
import type { GroupDetail } from '@/types/group';

interface ProtocolOwnerViewProps {
  group: GroupDetail;
  protocol: ProtocolWithCounts;
}

/**
 * Owner-only wrapper that lets the group owner flip between the editable form
 * and the read-only document preview without leaving the page.  The document
 * preview always renders the last-saved version of the protocol — local
 * unsaved edits aren't reflected, so the owner should save first to see them.
 */
export function ProtocolOwnerView({ group, protocol }: ProtocolOwnerViewProps) {
  const [mode, setMode] = useState<'edit' | 'document'>('edit');

  // When swapping modes the user usually wants to start at the top of the new
  // view rather than wherever they were scrolled.
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, [mode]);

  if (mode === 'document') {
    return (
      <ProtocolDocumentView
        group={group}
        protocol={protocol}
        onBackToEdit={() => setMode('edit')}
      />
    );
  }

  return (
    <ProtocolFormClient
      group={group}
      initialProtocol={protocol}
      canEdit
      initialNextNumber={null}
      onPreview={() => setMode('document')}
    />
  );
}
