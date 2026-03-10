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
    <div className="space-y-5 animate-scale-in">
      <Alert variant="success" title="Токен успішно створено">
        Скопіюйте токен або поділіться посиланням.
      </Alert>

      <div>
        <p className="text-xs font-semibold uppercase mb-2">Посилання запрошення</p>

        <div className="flex items-center gap-2">
          <div className="flex-1 p-3 rounded bg-[var(--surface)] border overflow-hidden">
            <p className="font-mono text-xs break-all select-all">{inviteLink}</p>
          </div>

          <Button variant={copiedLink ? 'secondary' : 'outline'} size="icon" onClick={onCopyLink}>
            {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase mb-2">Токен запрошення</p>

        <div className="flex items-center gap-2">
          <div className="flex-1 p-3 rounded bg-[var(--surface)] border overflow-hidden">
            <p className="font-mono text-xs break-all select-all">{token}</p>
          </div>

          <Button variant={copied ? 'secondary' : 'outline'} size="icon" onClick={onCopy}>
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
