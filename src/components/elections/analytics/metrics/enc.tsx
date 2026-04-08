import { GitBranch } from 'lucide-react';

import { pluralize } from '@/lib/utils/common';
import type { MetricBuilder } from '@/types/metrics';

export const buildEncMetric: MetricBuilder = ({
  metrics,
  totalBallots,
  choiceCount,
  decryptionDone,
}) => {
  if (!decryptionDone || choiceCount < 2 || metrics.enc === null) return null;

  const enc = metrics.enc;
  const n = choiceCount;

  // ENC is in range [1, n].
  // ENC = 1.0 exactly: one choice took all votes
  // ENC = n exactly: perfect tie between all choices
  // ENC ≈ 1.0–1.2: monopoly
  // ENC ≈ 1.2–1.7: near-monopoly with a token competitor
  // ENC ≈ 1.7–2.5: real two-way race
  // ENC ≈ 2.5–3.5: three-way contest
  // ENC > 3.5: broad competition

  const isExactMonopoly = enc <= 1.0 + 0.001; // floating-point safe
  const isPerfectTie = enc >= n - 0.001;
  const isMonopoly = enc <= 1.2;
  const isNearMonopoly = enc <= 1.7;
  const isDuel = enc > 1.7 && enc <= 2.5;
  const isTriple = enc > 2.5 && enc <= 3.5;

  // ── Card-level interpretation ────────────────────────────────────────────────

  let interpretation: string;

  if (isExactMonopoly) {
    if (totalBallots === 1) {
      interpretation = `Єдиний голос — по-іншому і бути не могло`;
    } else {
      interpretation = `Повна монополія — усі ${pluralize(totalBallots, ['голос', 'голоси', 'голосів'])} за одним варіантом`;
    }
  } else if (isPerfectTie) {
    interpretation = `Ідеальний розподіл — усі ${pluralize(n, ['варіант', 'варіанти', 'варіантів'])} отримали рівно однаково`;
  } else if (isMonopoly) {
    interpretation = `Фактична монополія при формально ${pluralize(n, ['варіанті', 'варіантах', 'варіантах'])}`;
  } else if (isNearMonopoly) {
    interpretation = `Є домінант і один слабкий конкурент — решта не грала ролі`;
  } else if (isDuel) {
    interpretation = `Класична дуель двох лідерів — інші варіанти грали допоміжну роль`;
  } else if (isTriple) {
    interpretation = `Тристороння боротьба — три варіанти реально претендували на перемогу`;
  } else {
    interpretation = `Широка конкуренція — одразу ${Math.round(enc)} варіантів мали реальну підтримку`;
  }

  // ── Detailed insight (modal) ─────────────────────────────────────────────────

  let insight: string;

  if (isExactMonopoly) {
    if (totalBallots === 1) {
      insight =
        `ENC = 1.0 при одному бюлетені — не аналітична знахідка, а математична необхідність. ` +
        `Один голос завжди означає одного ефективного конкурента. ` +
        `Показник набуде значення зі збільшенням вибірки.`;
    } else {
      insight =
        `ENC = 1.0 означає, що один варіант отримав абсолютно всі ${pluralize(totalBallots, ['голос', 'голоси', 'голосів'])} — ` +
        `жоден інший не набрав жодного. ` +
        `${pluralize(n - 1, ['Решта варіанта', 'Решта варіантів', 'Решта варіантів'])} присутні в бюлетені лише формально. ` +
        `Це не конкурентне голосування — це підтвердження вже відомого результату.`;
    }
  } else if (isPerfectTie) {
    insight =
      `ENC = ${enc.toFixed(2)} збігається з кількістю варіантів у бюлетені (${n}) — це математично ідеальний рівний розподіл. ` +
      `Кожен із ${pluralize(n, ['варіанту', 'варіантів', 'варіантів'])} отримав рівно однакову частку. ` +
      `${totalBallots % n === 0 ? `Можливо, оскільки ${pluralize(totalBallots, ['бюлетень', 'бюлетені', 'бюлетенів'])} ділиться на ${n} без залишку. ` : `При ${pluralize(totalBallots, ['бюлетені', 'бюлетенях', 'бюлетенях'])} і ${n} варіантах ідеальна рівність нестандартна — варто перевірити дані. `}` +
      `Переможця в такому голосуванні немає — потрібен чіткіший критерій або повторне голосування.`;
  } else if (isMonopoly) {
    insight =
      `ENC ${enc.toFixed(2)} при ${pluralize(n, ['варіанті', 'варіантах', 'варіантах'])} у бюлетені — фактична монополія. ` +
      `Один варіант настільки домінує, що всі інші разом узяті майже не впливають на підсумок. ` +
      `Наявність альтернатив у бюлетені була переважно формальною.`;
  } else if (isNearMonopoly) {
    insight =
      `ENC ${enc.toFixed(2)} вказує, що реально змагались лише два варіанти, причому один значно сильніший. ` +
      `Лідер здобув більшість, але мав принаймні одного помітного конкурента — ` +
      `разом вони поглинули більшу частину голосів, залишивши ${pluralize(n - 2, ['варіант', 'варіанти', 'варіантів'])} на позиціях статистичного шуму.`;
  } else if (isDuel) {
    const minorCount = n - 2;
    if (minorCount === 0) {
      insight =
        `При двох варіантах у бюлетені ENC ${enc.toFixed(2)} означає нерівний розподіл: ` +
        `є явний переможець, але аутсайдер також набрав помітну частку. ` +
        `Перемога не розгромна — другий варіант залишався в грі.`;
    } else {
      insight =
        `ENC ${enc.toFixed(2)} описує типову дуель: два варіанти розділили між собою основний масив голосів, ` +
        `а решта ${pluralize(minorCount, ['варіант', 'варіанти', 'варіантів'])} залишились на рівні статистичного шуму. ` +
        `Результат визначало протистояння двох, а не вибір із ${pluralize(n, ['варіанту', 'варіантів', 'варіантів'])}.`;
    }
  } else if (isTriple) {
    insight =
      `ENC ${enc.toFixed(2)} — три варіанти справді боролись за голоси, а не лише один-два. ` +
      `Це нестандартна ситуація для більшості голосувань, де зазвичай вирізняється один або два лідери. ` +
      `${n > 3 ? `Решта ${pluralize(n - 3, ['варіант', 'варіанти', 'варіантів'])} отримала незначні частки й не впливала на підсумок. ` : ''}` +
      `Результат залежав від балансу між трьома реальними претендентами.`;
  } else {
    insight =
      `ENC ${enc.toFixed(2)} при ${pluralize(n, ['варіанті', 'варіантах', 'варіантах'])} — рідкісний сценарій широкої конкуренції. ` +
      `Жоден із лідерів не міг претендувати на беззаперечну перемогу. ` +
      `Голоси розподілились між багатьма варіантами відносно рівномірно — ` +
      `результат залишався непередбачуваним до самого кінця.`;
  }

  return {
    id: 'enc',
    icon: <GitBranch className="h-4 w-4" />,
    label: 'Реальних претендентів',
    value: enc.toFixed(1),
    color: 'purple',
    interpretation,
    description:
      'Ефективна кількість конкурентів (ENC) — показник з електоральної статистики. ' +
      'Відображає, скільки варіантів реально змагаються, зважуючи їхні частки: ' +
      'якщо один варіант переміг з 95%, ENC ≈ 1, навіть якщо в бюлетені було 10 варіантів.',
    insight,
    scale: {
      min: 1,
      max: n,
      current: enc,
      gradientFrom: '#8b5cf6',
      gradientTo: '#10b981',
      labels: ['Монополія', 'Рівна боротьба'],
    },
  };
};
