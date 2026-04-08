import { Target } from 'lucide-react';

import { pluralize } from '@/lib/utils/common';
import type { MetricBuilder } from '@/types/metrics';

export const buildMarginMetric: MetricBuilder = ({
  metrics,
  totalBallots,
  choiceCount,
  decryptionDone,
}) => {
  if (!decryptionDone || choiceCount < 2 || metrics.leadingMargin === null) return null;

  const lm = metrics.leadingMargin;

  // ── Edge cases ───────────────────────────────────────────────────────────────
  // lm = 0: exact tie between 1st and 2nd
  // lm = 100: one choice took everything (second has 0%)
  //           — only possible if totalBallots < choiceCount or one dominated fully

  const isExactTie = lm < 0.05;
  const isAbsoluteDominance = lm > 99.95;

  // Standard tiers
  const isDeadHeat = lm < 2; // statistically indistinguishable
  const isNarrow = lm < 7; // any swing could flip it
  const isMid = lm >= 7 && lm < 20;
  const isClear = lm >= 20 && lm < 40;

  // ── Card-level interpretation ────────────────────────────────────────────────

  let interpretation: string;

  if (isExactTie) {
    interpretation = `Абсолютна нічия — 1-е і 2-е місця набрали рівно однаково`;
  } else if (isAbsoluteDominance) {
    if (totalBallots === 1) {
      interpretation = `Єдиний голос — відрив 100% є математичною константою`;
    } else {
      interpretation = `Беззаперечна монополія — другий варіант не набрав жодного голосу`;
    }
  } else if (isDeadHeat) {
    interpretation = `Практична нічия — відрив ${lm.toFixed(1)}%, результат міг змінитись від одного голосу`;
  } else if (isNarrow) {
    interpretation = `Мінімальна перевага — вирішальним міг стати кожен голос`;
  } else if (isMid) {
    interpretation = `Помірний відрив — впевнена, але не нищівна перемога`;
  } else if (isClear) {
    interpretation = `Чітка перемога — другому місцю не вдалось скласти реальну конкуренцію`;
  } else {
    interpretation = `Переконлива перемога — відрив ${lm.toFixed(1)}% не залишає сумнівів у результаті`;
  }

  // ── Detailed insight (modal) ─────────────────────────────────────────────────

  // How many votes is the margin in absolute terms?
  const absoluteMarginVotes = totalBallots > 0 ? Math.round((lm / 100) * totalBallots) : null;

  let insight: string;

  if (isExactTie) {
    if (totalBallots % 2 === 0) {
      insight =
        `Ідеальна нічия: 1-е і 2-е місця отримали рівно по ${totalBallots / 2} ${pluralize(totalBallots / 2, ['голос', 'голоси', 'голосів'])} кожне. ` +
        `Переможця визначити неможливо без додаткового критерію. ` +
        `Для вирішення нічиїх зазвичай проводять повторне голосування або застосовують процедуру жеребу.`;
    } else {
      // Shouldn't happen mathematically with integer votes, but handle gracefully
      insight =
        `Відрив між 1-м і 2-м місцем нульовий — результат ідеально рівний. ` +
        `Переможця в цьому голосуванні немає.`;
    }
  } else if (isAbsoluteDominance) {
    if (totalBallots === 1) {
      insight =
        `Один бюлетень — відрив 100% неминучий за визначенням. ` +
        `Аналітичного значення цей показник тут не несе.`;
    } else {
      insight =
        `Відрив 100%: один варіант отримав усі ${pluralize(totalBallots, ['голос', 'голоси', 'голосів'])}, жоден інший — жодного. ` +
        `Це не конкурентний результат — другого учасника у боротьбі фактично не було.`;
    }
  } else if (isDeadHeat) {
    const voteGap = absoluteMarginVotes ?? 1;
    insight =
      `Відрив ${lm.toFixed(1)}% між 1-м і 2-м місцем — ` +
      `у перекладі на абсолютні числа це ${pluralize(voteGap, ['голос', 'голоси', 'голосів'])} різниці. ` +
      `${voteGap <= 1 ? 'Буквально один голос вирішив результат.' : `${voteGap} голоси різниці — мінімальна перевага.`} ` +
      `Такі результати вимагають особливої уваги до достовірності підрахунку.`;
  } else if (isNarrow) {
    const voteGap = absoluteMarginVotes ?? 0;
    insight =
      `Відрив ${lm.toFixed(1)}%` +
      (voteGap > 0 ? ` (${pluralize(voteGap, ['голос', 'голоси', 'голосів'])})` : '') +
      ` — вузька, але вирішальна перевага. ` +
      `Другий варіант не відставав критично, і результат міг перевернутись. ` +
      `Таке голосування свідчить про реальну невизначеність аудиторії, а не про формальний вибір.`;
  } else if (isMid) {
    if (lm < 12) {
      insight =
        `${lm.toFixed(1)}% відриву — помітна, але не переконлива перевага. ` +
        `Переможець лідирував, однак конкурент залишався в грі. ` +
        `${absoluteMarginVotes !== null ? `У реальних числах — ${pluralize(absoluteMarginVotes, ['голос', 'голоси', 'голосів'])} різниці між першим і другим місцем. ` : ''}` +
        `Зміна кількох відсотків голосів ще могла б переписати підсумок.`;
    } else {
      insight =
        `Відрив ${lm.toFixed(1)}%` +
        (absoluteMarginVotes !== null
          ? ` (${pluralize(absoluteMarginVotes, ['голос', 'голоси', 'голосів'])})`
          : '') +
        ` — лідер мав стабільнішу підтримку. ` +
        `Другий варіант набирав достатньо, щоб залишатись помітним гравцем, але не міг зрівнятись.`;
    }
  } else if (isClear) {
    insight =
      `${lm.toFixed(1)}% відриву від другого місця — переконлива перемога.` +
      (absoluteMarginVotes !== null
        ? ` Різниця в голосах: ${pluralize(absoluteMarginVotes, ['голос', 'голоси', 'голосів'])}.`
        : '') +
      ` Підтримка лідера перевищила конкурента на чверть і більше — результат не викликає сумнівів, ` +
      `хоча й не є абсолютним домінуванням.`;
  } else {
    insight =
      `Відрив ${lm.toFixed(1)}%` +
      (absoluteMarginVotes !== null
        ? ` (${pluralize(absoluteMarginVotes, ['голос', 'голоси', 'голосів'])})`
        : '') +
      ` — рідкісний рівень переваги в конкурентному голосуванні. ` +
      `Лідер зібрав більше ніж удвічі більше голосів від найближчого суперника (або близько до цього). ` +
      `Це не просто перемога — це консолідована підтримка, що не залишала інтриги.`;
  }

  return {
    id: 'margin',
    icon: <Target className="h-4 w-4" />,
    label: 'Відрив лідера',
    value: isExactTie ? '0%' : `${lm.toFixed(1)}%`,
    color: isExactTie || isDeadHeat ? 'error' : isNarrow ? 'warning' : isMid ? 'blue' : 'navy',
    interpretation,
    description:
      'Різниця у відсотках між часткою голосів першого і другого місця. ' +
      'Малий відрив означає боротьбу до останнього голосу; великий — беззаперечну перевагу лідера.',
    insight,
    scale: {
      min: 0,
      max: 60,
      current: Math.min(lm, 60),
      gradientFrom: '#f07d00',
      gradientTo: '#1c396e',
      labels: ['Нічия', 'Одноосібно'],
    },
  };
};
