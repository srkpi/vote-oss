import { Activity } from 'lucide-react';

import { pluralize } from '@/lib/utils/common';
import type { MetricBuilder } from '@/types/metrics';

// ─────────────────────────────────────────────────────────────────────────────
// What the underlying numbers mean:
//
// peakHourConcentration — % of votes that arrived during the best sliding
//   window covering 20 % of the effective election duration. This is computed
//   entirely in continuous time and never depends on chart granularity.
//   A perfectly uniform vote flow always scores ≈ 20 %; any genuine surge
//   scores substantially above that.
//
// peakCount — number of distinct burst zones detected by Gaussian-smoothed
//   density estimation. Two bursts must be separated by a real valley (density
//   below 2 × mean) to be counted separately. A trickle before the main surge
//   does NOT count as an independent peak because it is below the burst
//   threshold.
//     0 = no region exceeded 2 × average rate → uniform / near-uniform flow
//     1 = single coherent surge
//     2+ = multiple distinct surges with clear quiet periods between them
//
// peakHourLabel — time range of the zone with the most votes (from density
//   analysis). null when no burst zone was found.
// ─────────────────────────────────────────────────────────────────────────────

// A window capturing 20 % of the election is the natural baseline.
// Anything above this threshold means real clustering is present.
const BURST_THRESHOLD_PCT = 35;

export const buildPeakMetric: MetricBuilder = ({ metrics, totalBallots }) => {
  if (totalBallots < 1 || metrics.peakHourConcentration === null) return null;

  const pct = metrics.peakHourConcentration;
  const label = metrics.peakHourLabel ?? null;
  const peakCount = metrics.peakCount ?? null;

  // ── Derived booleans ────────────────────────────────────────────────────────
  const hasLabel = label !== null;
  const isUniform = peakCount === 0 || pct < BURST_THRESHOLD_PCT;
  const isMultiPeak = peakCount !== null && peakCount >= 2;
  // "hasBurst" is true when the density analysis confirmed at least one zone
  // AND the concentration is meaningfully above the uniform baseline.
  const hasBurst = !isUniform && !isMultiPeak;

  // ── Card-level interpretation (tile — one sentence) ──────────────────────────

  let interpretation: string;

  if (totalBallots === 1) {
    interpretation = 'Єдиний бюлетень — часовий розподіл активності не несе статистичного значення';
  } else if (totalBallots < 4) {
    interpretation = 'Замало голосів для надійних висновків про часовий розподіл';
  } else if (isMultiPeak) {
    const n = peakCount!;
    if (n === 2) {
      interpretation = `Два незалежних сплески активності — між хвилями спостерігався чіткий спад голосів`;
    } else {
      interpretation = `${n} окремих сплески активності — голосування відбулось кількома незалежними хвилями`;
    }
  } else if (isUniform) {
    interpretation =
      'Рівномірна участь — активність розподілена по всьому діапазону без виражених піків';
  } else if (pct >= 90) {
    interpretation = `Практично весь потік голосів (${pct.toFixed(1)}%) зосереджений в одному проміжку${hasLabel ? ` — ${label}` : ''}`;
  } else if (pct >= 70) {
    interpretation = `Різкий сплеск${hasLabel ? ` у ${label}` : ''}: ${pct.toFixed(1)}% голосів надійшло в найактивніший відрізок`;
  } else if (pct >= 50) {
    interpretation = `Виражений пік${hasLabel ? ` у ${label}` : ''}: більше половини голосів у найактивнішому проміжку`;
  } else {
    interpretation = `Помірне скупчення${hasLabel ? ` у ${label}` : ''} — основний потік дещо нерівномірний, але без різкого сплеску`;
  }

  // ── Detailed insight (modal) ──────────────────────────────────────────────────

  let insight: string;

  if (totalBallots === 1) {
    insight =
      'Голосування містить лише один бюлетень, тому будь-який показник концентрації активності є ' +
      'артефактом малої вибірки, а не реальним патерном поведінки. Метрика набуде аналітичного сенсу, ' +
      'коли накопичиться принаймні кілька голосів.';
  } else if (totalBallots < 4) {
    insight =
      `При ${pluralize(totalBallots, ['бюлетені', 'бюлетенях', 'бюлетенях'])} будь-який розрахунок ` +
      'концентрації нестабільний: один додатковий голос може кардинально змінити результат. ' +
      "Значення варто інтерпретувати з великою обережністю — надійні висновки з'являються від 10–15 голосів.";
  } else if (isMultiPeak) {
    // Multiple distinct bursts confirmed by the density analysis
    const n = peakCount!;
    const peakWord =
      n === 2 ? 'два незалежних піки' : n === 3 ? 'три незалежних піки' : `${n} незалежних піки`;

    insight =
      `Алгоритм виявив ${peakWord} активності, між якими щільність голосів опускалась нижче подвійного ` +
      `середнього рівня — це критерій справжнього спаду, а не суб\'єктивне враження від графіка. ` +
      `Найінтенсивніша хвиля${hasLabel ? ` (${label})` : ''} зібрала ${pct.toFixed(1)}% від усіх голосів ` +
      `у найактивнішому 20-відсотковому відрізку часу. ` +
      (n === 2
        ? 'Два розділених піки зазвичай свідчать про два послідовних стимули: наприклад, первинне оголошення та нагадування, ' +
          'або залучення двох аудиторій у різних часових зонах.'
        : `Кілька хвиль активності (${n}) найчастіше з\'являються при серії нагадувань, публікаціях в різних каналах ` +
          'або при охопленні аудиторій з різних часових зон.');
  } else if (isUniform) {
    // No burst zone detected OR concentration too close to baseline
    if (peakCount === 0) {
      insight =
        `Жодна ділянка часового ряду не перевищила подвійний середній рівень щільності голосів — ` +
        `це означає, що виражених сплесків активності немає. ` +
        `Найактивніший 20-відсотковий відрізок часу містить ${pct.toFixed(1)}% голосів, ` +
        `що близько до теоретичного мінімуму для рівномірного розподілу (≈ 20%). ` +
        'Такий патерн характерний для довготривалих голосувань без цілеспрямованих нагадувань, ' +
        'для аудиторій у різних часових зонах або там, де учасники приймали рішення у власний час ' +
        'без зовнішнього поштовху.';
    } else {
      // peakCount >= 1 but pct too low to confirm a meaningful burst
      insight =
        `Попри наявність певного нерівномірного розподілу, жоден проміжок не концентрує достатньо голосів, ` +
        `щоб кваліфікуватись як виражений сплеск. ` +
        `Найактивніший 20-відсотковий відрізок містить ${pct.toFixed(1)}% голосів — ` +
        'лише незначно більше, ніж дав би абсолютно рівномірний розподіл. ' +
        'Голосування протікало органічно, без домінуючого імпульсу.';
    }
  } else if (hasBurst) {
    if (pct >= 90) {
      const rest = (100 - pct).toFixed(1);
      insight =
        `${pct.toFixed(1)}% від усіх голосів надійшли в межах найактивнішого 20-відсоткового ` +
        `відрізку голосування${hasLabel ? ` — ${label}` : ''}. ` +
        `Решта ${rest}% — поодинокі бюлетені поза цим проміжком, які практично не впливають на загальну картину. ` +
        'Голосування відбулось фактично як разова подія, а не розтягнутий у часі процес. ' +
        'Найімовірніша причина: пряме сповіщення всіх учасників, спільна зустріч або жорсткий дедлайн, ' +
        'що спонукав усіх проголосувати в один короткий проміжок.';
    } else if (pct >= 70) {
      const rest = (100 - pct).toFixed(1);
      insight =
        `${pct.toFixed(1)}% голосів зосереджені в найактивнішому 20-відсотковому відрізку` +
        `${hasLabel ? ` — ${label}` : ''}. ` +
        `Решта ${rest}% розподілились рівномірніше до та/або після основного сплеску. ` +
        'Це класичний патерн "нагадування — відповідь": основна маса учасників відреагувала ' +
        'майже одночасно, а менша частина підключилась пізніше самостійно.';
    } else if (pct >= 50) {
      const rest = (100 - pct).toFixed(1);
      insight =
        `Більше половини участі — ${pct.toFixed(1)}% — припало на найактивніший 20-відсотковий відрізок` +
        `${hasLabel ? ` (${label})` : ''}. ` +
        `${rest}% голосів надійшли в інший час, демонструючи органічну активність поза основною хвилею. ` +
        'Голосування мало виражений центральний імпульс, але не зводилось до разової події: ' +
        'частина учасників підключилась незалежно від основної групи.';
    } else {
      // 35–50 %: clear burst zone but moderate concentration
      insight =
        `Найактивніший 20-відсотковий відрізок${hasLabel ? ` (${label})` : ''} зібрав ` +
        `${pct.toFixed(1)}% голосів. ` +
        'Це помітне, але не домінуюче скупчення: значна частина учасників голосувала незалежно ' +
        'від основної хвилі. Голосування поєднувало короткочасний спалах активності з органічним ' +
        'фоновим потоком.';
    }
  } else {
    insight = '';
  }

  // ── Color ─────────────────────────────────────────────────────────────────
  const color: 'orange' | 'warning' | 'success' = isMultiPeak
    ? 'warning'
    : pct >= 60
      ? 'orange'
      : pct >= BURST_THRESHOLD_PCT
        ? 'warning'
        : 'success';

  return {
    id: 'peak',
    icon: <Activity className="h-4 w-4" />,
    label: 'Пікова активність',
    value: `${pct.toFixed(1)}%`,
    color,
    interpretation,
    description:
      'Показує, яка частка від усіх голосів надійшла в найактивніший відрізок, що охоплює ' +
      '20% тривалості голосування. При рівномірному розподілі цей показник становить ≈ 20%; ' +
      'реальний сплеск активності дає значно вище значення. Розрахунок ведеться ' +
      'в безперервному часі й не залежить від розміру часових кошиків на графіку. ' +
      'Окремо визначається кількість виразних хвиль активності — незалежних піків, ' +
      'розділених реальним спадом голосів між ними.',
    insight,
    scale: {
      min: 0,
      max: 100,
      current: pct,
      gradientFrom: '#16a34a',
      gradientTo: '#f07d00',
      labels: ['Рівномірно', 'Один сплеск'],
    },
  };
};
