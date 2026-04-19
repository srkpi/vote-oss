import { Zap } from 'lucide-react';

import { pluralize } from '@/lib/utils/common';
import type { MetricBuilder } from '@/types/metrics';

export const buildVelocityMetric: MetricBuilder = ({ metrics, totalBallots }) => {
  // Velocity is only meaningful with at least 4 ballots spread across two halves.
  if (totalBallots < 4 || metrics.velocityRatio === null) return null;

  const vr = metrics.velocityRatio;
  // isElectionClosed tells us whether we are comparing the two halves of the
  // full scheduled duration (closed) or only of the elapsed time so far (open).
  const isElectionClosed = metrics.isElectionClosed ?? true;

  // ── Thresholds ───────────────────────────────────────────────────────────────
  // > 2.0  — sharp acceleration (late surge)
  // > 1.25 — mild acceleration
  // 0.75–1.25 — stable / symmetric
  // < 0.75  — mild slowdown
  // < 0.4   — sharp drop (front-loaded)

  const isSharpAccel = vr > 2.0;
  const isAccel = vr > 1.25;
  const isNeutral = vr >= 0.75 && vr <= 1.25;
  const isSharpDrop = vr < 0.4;

  // Determine color
  const color = isSharpAccel
    ? 'success'
    : isAccel
      ? 'success'
      : isNeutral
        ? 'blue'
        : isSharpDrop
          ? 'error'
          : 'warning';

  // ── Card-level interpretation ────────────────────────────────────────────────

  let interpretation: string;

  if (vr === 0) {
    // Pathological: zero votes in second half — all front-loaded
    interpretation = `Повністю фронтальне: жодного голосу в другій половині`;
  } else if (isSharpAccel) {
    interpretation = `Різкий пізній сплеск — у другій половині голосів надійшло в ${vr.toFixed(1)}× більше`;
  } else if (isAccel) {
    interpretation = `Прискорення до кінця — активність зростала із плином голосування`;
  } else if (isNeutral) {
    if (vr >= 0.95 && vr <= 1.05) {
      interpretation = `Ідеальний баланс — перша й друга половини майже рівні`;
    } else if (vr > 1) {
      interpretation = `Незначне прискорення в другій половині — темп загалом стабільний`;
    } else {
      interpretation = `Незначне сповільнення в другій половині — темп загалом стабільний`;
    }
  } else if (isSharpDrop) {
    interpretation = `Різкий спад: більшість проголосувала одразу, потім активність завмерла`;
  } else {
    interpretation = `Сповільнення — основна участь зосереджена в першій половині`;
  }

  // ── Detailed insight (modal) ─────────────────────────────────────────────────

  // Qualifier that appears in insights when the election is still running.
  // It reminds the reader that the comparison covers only elapsed time, so the
  // "second half" is not the future — it is what already happened after the
  // chronological midpoint of votes cast so far.
  const ongoingNote = isElectionClosed
    ? ''
    : ` (показник розраховується лише по минулому часу голосування, а не по всій запланованій тривалості)`;

  let insight: string;

  if (vr === 0) {
    insight =
      `Усі ${pluralize(totalBallots, ['бюлетень', 'бюлетені', 'бюлетенів'])} надійшли виключно в першій половині часового діапазону${ongoingNote} — ` +
      `друга половина залишилась порожньою. Голосування фактично завершилось задовго до офіційного закриття. ` +
      `Зазвичай це означає, що аудиторія вже давно чекала на голосування і відреагувала відразу, ` +
      `або ж повторних нагадувань не було й ті, хто не проголосував одразу, так і не повернулись.`;
  } else if (isSharpAccel) {
    insight =
      `Темп у другій половині голосування${ongoingNote} перевищив першу у ${vr.toFixed(2)}× — це дуже виражена мобілізація наприкінці. ` +
      `Перша половина фактично була затишшям перед кульмінацією. ` +
      `Такий паттерн виникає або після повторного нагадування безпосередньо перед закриттям, ` +
      `або якщо ключові учасники підключились пізно й стимулювали інших. ` +
      `${totalBallots < 20 ? 'Зважте, що при невеликій вибірці навіть кілька голосів суттєво впливають на коефіцієнт.' : ''}`;
  } else if (isAccel) {
    insight =
      `У другій половині голосування${ongoingNote} надходило в ${vr.toFixed(2)}× активніше, ніж у першій. ` +
      `Це типовий «відкладений старт»: частина учасників не поспішала на початку, проте ближче до закриття темп зріс. ` +
      `Може свідчити про нагадування, надіслане в середині голосування, або про ефект дедлайну, ` +
      `коли люди відкладають рішення до останнього.`;
  } else if (isNeutral) {
    if (vr >= 0.95 && vr <= 1.05) {
      insight =
        `Коефіцієнт ${vr.toFixed(2)}×${ongoingNote} — практично ідеальна симетрія. ` +
        `Перша та друга половини голосування зібрали майже однакову кількість бюлетенів. ` +
        `Рівномірна участь — ознака добре підготованої аудиторії або голосування з кількома рівномірними нагадуваннями.`;
    } else if (vr > 1) {
      insight =
        `Незначне прискорення у другій половині (${vr.toFixed(2)}×)${ongoingNote} — різниця є, але знаходиться в межах природних коливань. ` +
        `Участь загалом збалансована з невеликим ухилом до фіналу.`;
    } else {
      insight =
        `Незначне сповільнення у другій половині (${vr.toFixed(2)}×)${ongoingNote} — більшість учасників проголосувала трохи раніше, ` +
        `але різниця між половинами мінімальна. Голосування було рівномірним без яскравих сплесків.`;
    }
  } else if (isSharpDrop) {
    insight =
      `Активність у другій половині${ongoingNote} становила лише ${(vr * 100).toFixed(0)}% від першої — ` +
      `фактично голосування завершилось задовго до формального закриття. ` +
      `${totalBallots < 10 ? `При ${pluralize(totalBallots, ['бюлетені', 'бюлетенях', 'бюлетенях'])} загалом ця різниця може означати буквально 1–2 голоси в другій половині. ` : ''}` +
      `Такий паттерн характерний для аудиторій, де тема була відома заздалегідь і більшість відреагувала відразу після відкриття.`;
  } else {
    insight =
      `Перша половина голосування${ongoingNote} була активнішою: темп у другій половині склав ${(vr * 100).toFixed(0)}% від початкового. ` +
      `Певна частина учасників не дочекалась кінця — можливо, вирішальна маса зібралась рано ` +
      `і подальша активність мала залишковий характер.`;
  }

  // ── Description adapts to open vs closed election ───────────────────────────
  const description = isElectionClosed
    ? 'Порівнює кількість голосів у другій половині часового діапазону з першою. ' +
      'Значення більше 1× означає прискорення до кінця, менше 1× — сповільнення, близько 1× — стабільний рівномірний темп.'
    : 'Порівнює темп надходження голосів у другій половині вже минулого часу з першою. ' +
      'Оскільки голосування ще триває, обидві «половини» стосуються лише тих годин, що вже пройшли. ' +
      'Значення більше 1× означає прискорення, менше 1× — сповільнення.';

  return {
    id: 'velocity',
    icon: <Zap className="h-4 w-4" />,
    label: 'Тренд голосування',
    value: vr === 0 ? '0×' : `${vr.toFixed(2)}×`,
    color,
    interpretation,
    description,
    insight,
    scale: {
      min: 0,
      max: 2.5,
      current: Math.min(vr, 2.5),
      gradientFrom: '#f59e0b',
      gradientTo: '#10b981',
      labels: ['Сповільнення', 'Прискорення'],
    },
  };
};
