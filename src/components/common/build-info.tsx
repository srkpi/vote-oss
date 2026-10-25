import { ChevronRight, Container, ExternalLink, GitCommit, ShieldCheck } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { CopyButton } from '@/components/ui/copy-button';
import { LocalDateTime } from '@/components/ui/local-time';
import { TextLink } from '@/components/ui/text-link';
import { getBuildInfo } from '@/lib/build-info';
import { NODE_ENV } from '@/lib/config/server';
import { capitalizeFirst, cn } from '@/lib/utils/common';

interface BuildInfoProps {
  className?: string;
}

export function BuildInfo({ className }: BuildInfoProps) {
  const build = getBuildInfo();
  const isProd = NODE_ENV === 'production';
  const manualVerifyExample = build.repo
    ? `gh attestation verify ./завантажений-файл.js --repo ${build.repo}`
    : null;

  return (
    <div className={cn('border-border-color font-body rounded-xl border bg-card p-5', className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 shrink-0 text-kpi-navy" />
          <span className="text-sm font-medium text-foreground">Прозорість збірки</span>
        </div>
        <Badge variant={isProd ? 'navy' : 'warning'}>{capitalizeFirst(NODE_ENV)}</Badge>
      </div>

      {build.isLocalBuild ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Локальна збірка без даних CI: інформація про коміт, образ і перевірку походження
          з’являється лише у версіях, зібраних через GitHub Actions.
        </p>
      ) : (
        <>
          <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2.5 text-xs sm:grid-cols-2">
            {build.commit && (
              <div className="flex items-center gap-2">
                <dt className="shrink-0 text-muted-foreground">Коміт</dt>
                <dd className="flex min-w-0 items-center gap-1.5">
                  <TextLink
                    href={build.commitUrl ?? undefined}
                    title={build.commit}
                    className="inline-flex items-center gap-1 truncate font-mono"
                  >
                    <GitCommit className="h-3.5 w-3.5 shrink-0" />
                    {build.commitShort}
                  </TextLink>
                  <CopyButton text={build.commit} label="Копіювати хеш" />
                </dd>
              </div>
            )}

            {build.builtAt && (
              <div className="flex items-center gap-2">
                <dt className="shrink-0 text-muted-foreground">Зібрано</dt>
                <dd className="text-foreground">
                  <LocalDateTime date={build.builtAt} />
                </dd>
              </div>
            )}

            {build.docker && (
              <div className="flex items-center gap-2">
                <dt className="shrink-0 text-muted-foreground">Образ</dt>
                <dd className="flex min-w-0 items-center">
                  <TextLink
                    href={build.docker.hubUrl}
                    className="inline-flex items-center gap-1 truncate font-mono"
                  >
                    <Container className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{build.docker.reference}</span>
                  </TextLink>
                </dd>
              </div>
            )}

            {build.actionsRunUrl && (
              <div className="flex items-center gap-2">
                <dt className="shrink-0 text-muted-foreground">CI-запуск</dt>
                <dd>
                  <TextLink href={build.actionsRunUrl} className="inline-flex items-center gap-1">
                    GitHub Actions
                    <ExternalLink className="h-3 w-3 shrink-0" />
                  </TextLink>
                </dd>
              </div>
            )}
          </dl>

          {build.verify && manualVerifyExample && (
            <details className="group/main mt-4 border-t border-border-subtle pt-3 [&::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer list-none items-center gap-1.5 text-xs font-medium text-kpi-navy">
                <ChevronRight className="h-4 w-4 shrink-0 transition-transform duration-200 group-open/main:rotate-90" />
                Як перевірити, що сайт запускає саме цей код?
              </summary>

              <div className="mt-3 space-y-3 text-xs leading-relaxed text-muted-foreground">
                <p>
                  Кожен образ і кожен JS-файл, які ми публікуємо, підписуються GitHub через{' '}
                  <TextLink href="https://www.sigstore.dev/">Sigstore</TextLink> — той самий
                  механізм, яким{' '}
                  <TextLink href="https://docs.npmjs.com/generating-provenance-statements">
                    npm підтверджує походження пакетів
                  </TextLink>
                  , із записом у публічний незмінний журнал Rekor. Це працює у два шари: перший
                  підтверджує, що Docker-образ справжній; другий — що{' '}
                  <span className="text-foreground">цей сайт зараз віддає файли з нього</span>, бо
                  перевіряється хеш завантажених JavaScript та CSS файлів.
                </p>

                <div>
                  <p className="font-medium text-foreground">
                    Одна команда, яка перевіряє все одразу (потрібні{' '}
                    <TextLink href="https://nodejs.org/">Node.js</TextLink> і{' '}
                    <TextLink href="https://cli.github.com/">GitHub CLI</TextLink>
                    ).
                  </p>
                  <p className="mb-1 font-medium text-foreground">Linux / macOS:</p>
                  <div className="flex flex-col gap-1.5 rounded-md border border-border-subtle bg-surface px-2.5 py-1.5 sm:flex-row sm:items-center sm:justify-between">
                    <code className="overflow-x-auto font-mono whitespace-nowrap">
                      {build.verify.scriptCommand}
                    </code>
                    <CopyButton text={build.verify.scriptCommand} label="Копіювати" />
                  </div>
                  <p className="my-1 font-medium text-foreground">Windows (PowerShell):</p>
                  <div className="flex flex-col gap-1.5 rounded-md border border-border-subtle bg-surface px-2.5 py-1.5 sm:flex-row sm:items-center sm:justify-between">
                    <code className="overflow-x-auto font-mono whitespace-nowrap">
                      {build.verify.scriptCommandWindows}
                    </code>
                    <CopyButton text={build.verify.scriptCommandWindows} label="Копіювати" />
                  </div>
                  <TextLink
                    href={build.verify.scriptUrl}
                    className="mt-1 inline-flex items-center gap-1"
                  >
                    Переглянути код скрипта перед запуском
                    <ExternalLink className="h-3 w-3 shrink-0" />
                  </TextLink>
                </div>

                <details className="group/nested border-t border-border-subtle pt-4 [&::-webkit-details-marker]:hidden">
                  <summary className="flex cursor-pointer list-none items-center gap-1.5 text-xs font-medium">
                    <ChevronRight className="h-4 w-4 shrink-0 transition-transform duration-200 group-[[open]]/nested:rotate-90" />
                    Або вручну, крок за кроком
                  </summary>
                  <div className="mt-2 space-y-3">
                    <div>
                      <p className="mb-1 font-medium text-foreground">
                        1. Переглянути, що саме запаковано в образ (потрібен{' '}
                        <TextLink href="https://www.docker.com/">Docker</TextLink>):
                      </p>
                      <div className="flex flex-col gap-1.5 rounded-md border border-border-subtle bg-surface px-2.5 py-1.5 sm:flex-row sm:items-center sm:justify-between">
                        <code className="overflow-x-auto font-mono whitespace-nowrap">
                          {build.verify.inspect}
                        </code>
                        <CopyButton text={build.verify.inspect} label="Копіювати" />
                      </div>
                    </div>

                    <div>
                      <p className="mb-1 font-medium text-foreground">
                        2. Перевірити походження образу (потрібен{' '}
                        <TextLink href="https://cli.github.com/">GitHub CLI</TextLink>):
                      </p>
                      <div className="flex flex-col gap-1.5 rounded-md border border-border-subtle bg-surface px-2.5 py-1.5 sm:flex-row sm:items-center sm:justify-between">
                        <code className="overflow-x-auto font-mono whitespace-nowrap">
                          {build.verify.attest}
                        </code>
                        <CopyButton text={build.verify.attest} label="Копіювати" />
                      </div>
                    </div>

                    <div>
                      <p className="mb-1 font-medium text-foreground">
                        3. Завантажити будь-який файл із вкладки браузера «Network» (шлях виду{' '}
                        <span className="font-mono">/_next/static/…</span>) і перевірити саме його:
                      </p>
                      <div className="flex flex-col gap-1.5 rounded-md border border-border-subtle bg-surface px-2.5 py-1.5 sm:flex-row sm:items-center sm:justify-between">
                        <code className="flex flex-col overflow-x-auto font-mono whitespace-nowrap">
                          {manualVerifyExample}
                        </code>
                        <CopyButton text={manualVerifyExample} label="Копіювати" />
                      </div>
                    </div>
                  </div>
                </details>

                <p>
                  Проходження перевірок означає, що і образ, і файли, які зараз завантажуються з
                  цього сайту, походять з вказаного вище workflow. Верифікацію забезпечують GitHub
                  та публічний журнал Rekor.
                </p>
              </div>
            </details>
          )}
        </>
      )}
    </div>
  );
}
