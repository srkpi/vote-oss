import { Clock } from 'lucide-react';

import type { MetricBuilder } from '@/types/metrics';

export const buildMedianMetric: MetricBuilder = ({ metrics, totalBallots }) => {
  if (totalBallots < 2 || metrics.medianTimePercentile === null) return null;

  const mp = metrics.medianTimePercentile;
  // isElectionClosed: when true, mp is relative to the full scheduled duration;
  // when false, mp is relative to elapsed time only (from election open to now).
  const isElectionClosed = metrics.isElectionClosed ?? true;

  // ── Thresholds ───────────────────────────────────────────────────────────────
  // < 15   — extreme early (front-loaded in first ~sixth)
  // < 35   — early wave
  // 35–65  — balanced (with sub-cases around 50)
  // > 65   — late wave
  // > 85   — extreme late (back-loaded in last sixth)

  const isExtremeEarly = mp < 15;
  const isEarly = mp < 35;
  const isLate = mp > 65;
  const isExtremeLate = mp > 85;
  const isMid = mp >= 35 && mp <= 65;

  let interpretation: string;

  if (isExtremeEarly) {
    interpretation = `Лавина на старті — половина голосів надійшла вже в перших ${mp.toFixed(0)}% часу`;
  } else if (isEarly) {
    interpretation = `Рання хвиля — більшість учасників проголосувала в першій третині часу`;
  } else if (isExtremeLate) {
    interpretation = `Фінальний ривок — половина голосів зібрана лише в останніх ${(100 - mp).toFixed(0)}% часу`;
  } else if (isLate) {
    interpretation = `Пізня хвиля — активність наростала й пришвидшилась наприкінці`;
  } else {
    if (mp >= 45 && mp <= 55) {
      interpretation = `Збалансована участь — голосування рівномірно розподілене в часі`;
    } else if (mp < 50) {
      interpretation = `Трохи раніша хвиля — незначний ухил до першої половини`;
    } else {
      interpretation = `Трохи пізніша хвиля — незначний ухил до другої половини`;
    }
  }

  // ── Detailed insight (modal) ─────────────────────────────────────────────────

  // Contextual note appended to insights when the election is still open.
  // It explains that the percentage is relative to elapsed time, not total
  // scheduled duration, so "40% of time" means 40% of what has already passed.
  const ongoingContext = isElectionClosed
    ? ''
    : ` Оскільки голосування ще триває, відсоток розраховано відносно поточного часу з моменту відкриття опитування, а не від повної запланованої тривалості.`;

  let insight: string;

  if (totalBallots === 2) {
    // With only 2 ballots, median is trivially the midpoint between them
    insight =
      `При двох бюлетенях медіанна позначка (${mp.toFixed(0)}%) вказує лише на те, де в часі розташовано середнє між двома голосами.${ongoingContext} ` +
      `Статистичне значення цього показника зростає зі збільшенням кількості учасників.`;
  } else if (isExtremeEarly) {
    insight =
      `Медіанний бюлетень надійшов на позначці ${mp.toFixed(0)}% від ${isElectionClosed ? 'загальної тривалості' : 'часу, що минув від відкриття'} — ` +
      `надзвичайно ранній момент. Понад половина учасників проголосувала ще до того, ` +
      `як минула шоста частина ${isElectionClosed ? 'відведеного часу' : 'поточного часу голосування'}. ` +
      `Це або наслідок масового синхронного нагадування на самому початку, ` +
      `або аудиторія вже давно чекала на це голосування й реагувала миттєво після відкриття. ` +
      (isElectionClosed
        ? `Тривалість голосування була непропорційно довгою відносно реальної активності.`
        : `Якщо голосування триватиме ще довго, частка може вирівнятись із надходженням нових бюлетенів.`);
  } else if (isEarly) {
    insight =
      `Половина голосів зібрана вже на ${mp.toFixed(0)}%-й позначці ${isElectionClosed ? 'тривалості' : 'часу'}. ` +
      `Перша третина ${isElectionClosed ? 'часового вікна' : 'пройденого часу'} несла непропорційно більше навантаження, ніж друга. ` +
      `Друга половина голосування тривала довше, але зібрала менше бюлетенів — ` +
      `активність поступово вичерпувалась, а не зростала.` +
      (isElectionClosed ? '' : ongoingContext);
  } else if (isMid) {
    if (mp >= 45 && mp <= 55) {
      insight =
        `Медіанна позначка ${mp.toFixed(0)}% — майже ідеальна симетрія. ` +
        `Перша і друга половини за кількістю бюлетенів практично рівні.${ongoingContext} ` +
        `Рівномірна участь у часі — ознака голосування, де учасники не відчували тиску дедлайну ` +
        `і мали достатньо можливостей підключитись у зручний момент.`;
    } else if (mp < 50) {
      insight =
        `Медіана ${mp.toFixed(0)}% — незначний ухил до першої половини.${ongoingContext} ` +
        `Участь розподілена відносно рівно з невеликою перевагою ранніх голосів. ` +
        `Різниця між половинами не критична і може бути природним коливанням.`;
    } else {
      insight =
        `Медіана ${mp.toFixed(0)}% — незначне зміщення до другої половини.${ongoingContext} ` +
        `Загалом участь зрівноважена, але друга частина часового вікна трохи переважала за обсягом. ` +
        `Можливо, нагадування або наростаючий інтерес підтримували активність до кінця.`;
    }
  } else if (isExtremeLate) {
    insight =
      `Половина всіх голосів зібрана лише на ${mp.toFixed(0)}%-й позначці — ` +
      `це означає, що більшу частину ${isElectionClosed ? 'тривалості голосування' : 'часу'} голосування було майже порожнім. ` +
      `Реальна активність сконцентрувалась в останніх ${(100 - mp).toFixed(0)}% часу. ` +
      `Найімовірніша причина: фінальне нагадування або усвідомлення дедлайну спровокувало масову участь ` +
      `саме тоді, коли час майже вийшов.` +
      (isElectionClosed ? '' : ongoingContext);
  } else {
    insight =
      `Медіана зміщена до пізнішої частини: половина голосів зібрана після ${mp.toFixed(0)}% ${isElectionClosed ? 'тривалості голосування' : 'часу'}.${ongoingContext} ` +
      `Початок голосування залишався відносно спокійним, а активність поступово наростала до кінця. ` +
      `Це може свідчити про поступове розповсюдження інформації або про нагадування ближче до фіналу.`;
  }

  // ── Description adapts to open vs closed election ───────────────────────────
  const description = isElectionClosed
    ? 'Показує, на якій часовій позначці (у відсотках від загальної тривалості) надійшов рівно 50-й відсоток бюлетенів. ' +
      'Низьке значення — рання хвиля, коли більшість поспішила проголосувати одразу; ' +
      'високе — аудиторія відклала участь до останнього.'
    : 'Показує, на якій позначці відносно часу з моменту відкриття опитування надійшов рівно 50-й відсоток бюлетенів. ' +
      'Оскільки голосування ще триває, відлік ведеться від відкриття до поточного моменту, а не до запланованого закриття. ' +
      'Низьке значення — рання хвиля; високе — активність зростала з часом.';

  return {
    id: 'median',
    icon: <Clock className="h-4 w-4" />,
    label: 'Хвиля голосування',
    value: `${mp.toFixed(0)}%`,
    color: 'navy',
    interpretation,
    description,
    insight,
    scale: {
      min: 0,
      max: 100,
      current: mp,
      gradientFrom: '#008acf',
      gradientTo: '#1c396e',
      labels: ['На початку', 'Наприкінці'],
    },
  };
};
