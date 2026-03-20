import { Check, Copy } from 'lucide-react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

interface TokenResultProps {
  token: string;
  copied: boolean;
  copiedLink: boolean;
  onCopy: () => void;
  onCopyLink: () => void;
}

export function TokenResult({ token, copied, copiedLink, onCopy, onCopyLink }: TokenResultProps) {
  const inviteLink =
    typeof window !== 'undefined' ? `${window.location.origin}/join/${token}` : `/join/${token}`;

  return (
    <div className="space-y-5">
      <Alert variant="success" title="Токен успішно створено">
        Скопіюйте токен або поділіться посиланням.
      </Alert>

      <p className="mb-2 text-xs font-semibold uppercase">Посилання запрошення</p>
      <div className="flex items-center gap-2">
        <div className="flex-1 overflow-hidden rounded border bg-(--surface) p-3">
          <p className="font-mono text-xs break-all select-all">{inviteLink}</p>
        </div>
        <Button variant={copiedLink ? 'secondary' : 'outline'} size="icon" onClick={onCopyLink}>
          {copiedLink ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>

      <p className="mb-2 text-xs font-semibold uppercase">Токен запрошення</p>
      <div className="flex items-center gap-2">
        <div className="flex-1 overflow-hidden rounded border bg-(--surface) p-3">
          <p className="font-mono text-xs break-all select-all">{token}</p>
        </div>
        <Button variant={copied ? 'secondary' : 'outline'} size="icon" onClick={onCopy}>
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
