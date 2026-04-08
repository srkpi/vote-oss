import { TrendingUp } from 'lucide-react';

import { pluralize } from '@/lib/utils/common';
import type { MetricBuilder } from '@/types/metrics';

export const buildFrontrunnerMetric: MetricBuilder = ({
  metrics,
  totalBallots,
  choiceCount,
  decryptionDone,
}) => {
  if (!decryptionDone || choiceCount < 2 || metrics.frontrunnerChanges === null) return null;

  const fc = metrics.frontrunnerChanges;

  // With only 1 ballot, no changes are possible — metric is trivial
  if (totalBallots < 2) return null;

  // ── Thresholds ───────────────────────────────────────────────────────────────
  // 0:     stable leader from the very first ballot
  // 1–2:   brief early fluctuation
  // 3–5:   sustained mid-race volatility
  // > 5:   high volatility — constant lead changes

  // Theoretical maximum changes: totalBallots - 1
  // (each new ballot could flip the leader)
  const maxPossibleChanges = totalBallots - 1;
  // Volatility as a share of theoretical maximum — useful for small ballot counts
  const volatilityRatio = maxPossibleChanges > 0 ? fc / maxPossibleChanges : 0;

  const isStable = fc === 0;
  const isLow = fc >= 1 && fc <= 2;
  const isMid = fc >= 3 && fc <= 5;

  // ── Card-level interpretation ────────────────────────────────────────────────

  let interpretation: string;

  if (isStable) {
    interpretation = `Лідер не змінювався — результат визначився з перших голосів`;
  } else if (isLow) {
    if (fc === 1) {
      interpretation = `Одна зміна лідера — короткий момент невизначеності на початку`;
    } else {
      interpretation = `${fc} зміни лідера — незначна волатильність на ранньому етапі`;
    }
  } else if (isMid) {
    interpretation = `${pluralize(fc, ['зміна', 'зміни', 'змін'])} лідера — голосування зберігало інтригу тривалий час`;
  } else {
    interpretation = `${pluralize(fc, ['зміна', 'зміни', 'змін'])} лідера — постійно непередбачуваний результат`;
  }

  // ── Detailed insight (modal) ─────────────────────────────────────────────────

  let insight: string;

  // Small ballot counts: contextualize fc relative to totalBallots
  const isSmallSample = totalBallots <= 10;

  if (isStable) {
    insight =
      `Один і той самий варіант лідирував від першого бюлетеня до останнього — жодної зміни. ` +
      `${
        isSmallSample
          ? `При ${pluralize(totalBallots, ['бюлетені', 'бюлетенях', 'бюлетенях'])} це може означати як справжню стабільну перевагу, так і те, що перший голос одразу визначив напрямок. `
          : `Стабільне лідерство при ${pluralize(totalBallots, ['бюлетені', 'бюлетенях', 'бюлетенях'])} — ознака консолідованої підтримки, а не випадкового результату перших голосів. `
      }` +
      `Це не обов'язково нецікаве голосування — просто перевага виявилась достатньо стійкою, ` +
      `щоб жоден наступний пакет голосів не міг її відіграти.`;
  } else if (fc === 1) {
    insight =
      `Лідерство змінювалось рівно один раз — є конкретний переломний момент. ` +
      `До цього голосу один варіант вів, після — інший вийшов уперед і більше не поступався. ` +
      `${
        isSmallSample
          ? `При ${pluralize(totalBallots, ['бюлетені', 'бюлетенях', 'бюлетенях'])} одна зміна — це максимально проста динаміка. `
          : `Мінімальна волатильність свідчить про те, що конкуренція була реальною, але переломилась в один момент. `
      }` +
      `Пошук цього переломного голосу в хронології може виявити, якою саме хвилею голосів визначився підсумок.`;
  } else if (isLow) {
    insight =
      `Лідерство переходило ${pluralize(fc, ['раз', 'рази', 'разів'])} — ` +
      `${
        isSmallSample
          ? `що при ${pluralize(totalBallots, ['бюлетені', 'бюлетенях', 'бюлетенях'])} становить ${(volatilityRatio * 100).toFixed(0)}% від теоретичного максимуму змін. `
          : `коротка нестабільність, після якої поточний переможець закріпився попереду. `
      }` +
      `Кілька змін свідчать про реальну конкуренцію на початку — ` +
      `голосування не було нецікавим, але результат визначився порівняно швидко.`;
  } else if (isMid) {
    insight =
      `${pluralize(fc, ['Зміна', 'Зміни', 'Змін'])} лідера: голосування зберігало непередбачуваність значну частину часу. ` +
      `${
        isSmallSample
          ? `При ${pluralize(totalBallots, ['бюлетені', 'бюлетенях', 'бюлетенях'])} це ${(volatilityRatio * 100).toFixed(0)}% від теоретичного максимуму — висока волатильність для такої вибірки. `
          : `Декілька варіантів поперемінно тримали першу позицію, і результат не визначився до певного пізнього моменту. `
      }` +
      `Учасники, що голосували в різний час, формували різні «версії» лідерства.`;
  } else {
    insight =
      `${pluralize(fc, ['Зміна', 'Зміни', 'Змін'])} першого місця — виняткова волатильність. ` +
      `${
        isSmallSample
          ? `При ${pluralize(totalBallots, ['бюлетені', 'бюлетенях', 'бюлетенях'])} це ${(volatilityRatio * 100).toFixed(0)}% від теоретичного максимуму змін. `
          : ''
      }` +
      `Жоден варіант не міг утримати лідерство надовго — ` +
      `результат залишався відкритим до фінальних голосів. ` +
      `Такий паттерн характерний для голосувань із хвилеподібними нагадуваннями або ` +
      `різними групами учасників, що голосують у різний час із різними уподобаннями.`;
  }

  return {
    id: 'frontrunner',
    icon: <TrendingUp className="h-4 w-4" />,
    label: 'Зміни лідера',
    value: String(fc),
    color: isStable ? 'success' : isLow ? 'blue' : isMid ? 'orange' : 'error',
    interpretation,
    description:
      'Рахує, скільки разів перше місце переходило від одного варіанта до іншого в процесі накопичення голосів. ' +
      '0 — стабільний лідер від перших голосів; ' +
      'висока цифра — постійна боротьба за першість, результат залишався невідомим до кінця.',
    insight,
  };
};
