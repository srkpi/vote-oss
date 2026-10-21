'use client';

import { Download, FileSpreadsheet } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { APP_NAME } from '@/lib/config/client';
import { cn } from '@/lib/utils/common';
import type { Ballot, DecryptedMap } from '@/types/ballot';

interface CsvField {
  key: string;
  label: string;
  encrypted?: boolean;
}

const BASE_CSV_FIELDS: CsvField[] = [
  { key: 'index', label: '№' },
  { key: 'currentHash', label: 'Поточний хеш' },
  { key: 'previousHash', label: 'Попередній хеш' },
  { key: 'createdAt', label: 'Час голосування' },
  { key: 'signature', label: 'Підпис' },
  { key: 'encryptedBallot', label: 'Зашифрований бюлетень' },
  { key: 'decryptedChoiceIds', label: 'ID варіантів', encrypted: true },
  { key: 'decryptedChoiceLabels', label: 'Вибір', encrypted: true },
  { key: 'hashValid', label: 'Цілісність хешу', encrypted: true },
  { key: 'ballotValid', label: 'Дійсність бюлетеня', encrypted: true },
];

const VOTER_CSV_FIELDS: CsvField[] = [
  ...BASE_CSV_FIELDS,
  { key: 'voterId', label: 'ID користувача', encrypted: true },
  { key: 'voterFullName', label: 'ПІБ', encrypted: true },
];

function buildCsv(ballots: Ballot[], decryptedMap: DecryptedMap, fields: Set<string>): string {
  const active = VOTER_CSV_FIELDS.filter((f) => fields.has(f.key));
  const rows = ballots.map((ballot, i) => {
    const dec = decryptedMap.get(ballot.id);
    return active.map(({ key }) => {
      switch (key) {
        case 'index':
          return String(i + 1);
        case 'currentHash':
          return ballot.currentHash;
        case 'previousHash':
          return ballot.previousHash ?? '';
        case 'createdAt':
          return ballot.createdAt;
        case 'signature':
          return ballot.signature;
        case 'encryptedBallot':
          return ballot.encryptedBallot;
        case 'decryptedChoiceIds':
          return dec?.choiceIds?.join('; ') ?? '';
        case 'decryptedChoiceLabels':
          return dec?.choiceLabels?.join('; ') ?? '';
        case 'hashValid':
          return dec !== undefined ? (dec.hashValid ? 'TRUE' : 'FALSE') : '';
        case 'ballotValid':
          return dec !== undefined ? (dec.valid ? 'TRUE' : 'FALSE') : '';
        case 'voterId':
          return dec?.voter?.userId ?? '';
        case 'voterFullName':
          return dec?.voter?.fullName ?? '';
        default:
          return '';
      }
    });
  });
  const header = active.map((f) => f.label);
  return [header, ...rows]
    .map((row) => row.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');
}

function downloadCsv(
  ballots: Ballot[],
  decryptedMap: DecryptedMap,
  fields: Set<string>,
  electionId: string,
) {
  const csv = buildCsv(ballots, decryptedMap, fields);
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${APP_NAME}-ballots-${electionId.slice(0, 8)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

interface CsvPanelProps {
  ballots: Ballot[];
  decryptedMap: DecryptedMap;
  decryptionDone: boolean;
  electionId: string;
  anonymous: boolean;
}

export function AnalyticsCsvPanel({
  ballots,
  decryptedMap,
  decryptionDone,
  electionId,
  anonymous,
}: CsvPanelProps) {
  const fields = anonymous ? BASE_CSV_FIELDS : VOTER_CSV_FIELDS;
  const defaultSelected = new Set(['index', 'currentHash', 'createdAt']);
  const [selected, setSelected] = useState<Set<string>>(defaultSelected);

  const toggle = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  return (
    <div className="border-border-color rounded-xl border bg-card p-6 shadow-sm">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h3 className="flex items-center gap-2 font-display text-base font-semibold text-foreground">
            <FileSpreadsheet className="h-4 w-4 text-kpi-orange" />
            Експорт CSV
          </h3>
          <p className="font-body mt-1 text-xs text-muted-foreground">
            Оберіть поля. Дані обробляються локально у вашому браузері.
          </p>
        </div>
        <Button
          variant="accent"
          size="sm"
          disabled={selected.size === 0}
          onClick={() => downloadCsv(ballots, decryptedMap, selected, electionId)}
          icon={<Download className="h-3.5 w-3.5" />}
        >
          <span className="hidden sm:inline">Завантажити</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {fields.map((field) => {
          const locked = !!field.encrypted && !decryptionDone;
          const isSelected = selected.has(field.key);
          return (
            <label
              key={field.key}
              className={cn(
                'flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition-all duration-150',
                locked
                  ? 'cursor-not-allowed border-border-subtle bg-surface opacity-40'
                  : isSelected
                    ? 'border-kpi-navy/30 bg-kpi-navy/5'
                    : 'border-border-subtle bg-card hover:border-kpi-navy/20 hover:bg-surface',
              )}
            >
              <input
                type="checkbox"
                checked={isSelected}
                disabled={locked}
                onChange={() => !locked && toggle(field.key)}
                className="h-4 w-4 shrink-0 accent-kpi-navy"
              />
              <span className="font-body text-xs text-foreground">
                {field.label}
                {field.encrypted && (
                  <span className="ml-1 text-muted-foreground">(після дешифрування)</span>
                )}
              </span>
            </label>
          );
        })}
      </div>

      <p className="font-body mt-3 text-[10px] text-muted-foreground">
        Вибрано полів: {selected.size} · Рядків: {ballots.length.toLocaleString('uk-UA')}
      </p>
    </div>
  );
}
