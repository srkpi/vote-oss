import type { Metadata } from 'next';

import { APP_NAME } from '@/lib/config/client';

export const metadata: Metadata = {
  title: 'Політика конфіденційності',
  description: `Політика конфіденційності системи електронного голосування ${APP_NAME}`,
};

export const lastUpdated = '27.03.2026';
const sections = [
  {
    id: 'intro',
    title: null,
    paragraphs: [
      `Цей документ описує політику конфіденційності системи електронного голосування ${APP_NAME}, розробленої для студентів КПІ ім. Ігоря Сікорського. Основною метою системи є забезпечення безпечного, прозорого та анонімного голосування в межах університетської спільноти.`,
      `Система є проєктом з відкритим кодом розміщеному за посиланням https://github.com/srkpi/vote-oss у публічному GitHub репозиторії. Використовуючи ${APP_NAME}, ви підтверджуєте свою згоду з умовами цієї Політики конфіденційності.`,
    ],
  },
  {
    id: 'collection',
    title: 'Збір персональних даних',
    paragraphs: [
      `Під час використання системи можуть оброблятись такі персональні дані користувачів: прізвище, ім'я, по батькові, унікальний ідентифікатор облікового запису KPI ID, академічна група, а також факультет або інститут.`,
      `Автентифікація здійснюється виключно через інформаційні системи «KPI ID» та «Дія». При використанні платформи ви погоджуєтесь з їх політиками конфіденційності та умовами використання: https://auth.kpi.ua/uk/privacy-policy, https://diia.gov.ua/policy.`,
      `${APP_NAME} не зберігає ваші облікові дані, окрім унікального ідентифікатора в системі «KPI ID». Ми можемо збирати технічну інформацію про використання платформи: час входу у систему, факт участі у голосуванні без розкриття змісту вибору, IP адреси, інформацію про ваш пристрій, операційну систему та браузер. Також може збиратися інформація про відвідування і використання платформи, включаючи тривалість перебування, перегляди сторінок та шляхи навігації.`,
    ],
  },
  {
    id: 'usage',
    title: 'Використання персональної інформації',
    paragraphs: [
      `Персональна інформація використовується виключно для цілей, зазначених у цій Політиці. Зокрема, персональні дані можуть використовуватися для автентифікації користувача та надання доступу до голосувань, перевірки права на участь у конкретному голосуванні відповідно до обмежень за факультетом або академічною групою, а також для запобігання повторному голосуванню. Система побудована таким чином, що зміст вашого голосу є конфіденційним навіть для адміністраторів.`,
      `Ваші персональні дані не передаються третім особам, не використовуються для таргетованої реклами та не продаються.`,
    ],
  },
  {
    id: 'security',
    title: 'Безпека даних',
    paragraphs: [
      `Ми вживаємо належних технічних і організаційних заходів для захисту даних користувачів від несанкціонованого доступу, втрати або зміни. Однак жодна система не може гарантувати абсолютну безпеку, тому ми не несемо відповідальності за дії третіх осіб поза межами нашого контролю. Доступ до адміністративних функцій системи надається лише уповноваженим особам органів студентського самоврядування.`,
    ],
  },
  {
    id: 'changes',
    title: 'Зміни до умов Політики',
    paragraphs: [
      `Адміністрація системи має право вносити зміни до умов цієї Політики у будь-який час. Усі зміни набувають чинності з моменту їх публікації на цій сторінці.`,
      `Продовжуючи використовувати систему після публікації змін, ви підтверджуєте свою згоду з оновленою редакцією Політики.`,
    ],
  },
  {
    id: 'deletion',
    title: 'Видалення персональних даних',
    paragraphs: [
      `Персональні дані користувача можуть бути видалені за його власним запитом або після деактивації системи. Для подання запиту на видалення даних зверніться до адміністраторів системи через офіційні канали зв'язку студентського самоврядування КПІ ім. Ігоря Сікорського.`,
      `Адміністрація залишає за собою право видаляти дані користувача у випадках, коли його дії шкодять функціонуванню системи або порушують правила користування платформою.`,
    ],
  },
  {
    id: 'contact',
    title: 'Контакти',
    paragraphs: [
      `З питань щодо цієї Політики конфіденційності або обробки ваших персональних даних звертайтеся до адміністраторів системи через офіційні канали студентського самоврядування КПІ ім. Ігоря Сікорського.`,
    ],
  },
];

const URL_REGEX = /(https?:\/\/[^\s)]+(?<![.,?!]))/g;

function renderText(text: string): React.ReactNode[] {
  const parts = text.split(URL_REGEX);
  return parts.map((part, i) => {
    if (/^https?:\/\//.test(part)) {
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-kpi-blue-light hover:text-kpi-blue-dark wrap-break-word underline underline-offset-2 transition-colors"
        >
          {part}
        </a>
      );
    }
    return part;
  });
}

export default function PrivacyPage() {
  return (
    <div className="bg-surface min-h-[calc(100dvh-var(--header-height))]">
      <div className="container mx-auto max-w-3xl py-10 sm:py-16">
        <div className="mb-10 text-center sm:mb-14">
          <h1 className="font-display text-kpi-navy mb-2 text-3xl font-bold sm:mb-3 sm:text-5xl">
            Політика конфіденційності
          </h1>
          <p className="font-body text-muted-foreground mx-auto max-w-xl text-base sm:text-lg">
            Останнє оновлення: {lastUpdated}
          </p>
        </div>

        <div className="mx-auto max-w-3xl">
          <div className="border-border-color shadow-shadow-sm overflow-hidden rounded-xl border bg-white">
            <div className="border-border-subtle border-b px-6 pt-8 pb-6 sm:px-12">
              <p className="font-body text-muted-foreground mb-3 text-sm font-semibold tracking-wider uppercase">
                Зміст
              </p>
              <ol className="space-y-1.5">
                {sections
                  .filter((s) => s.title)
                  .map((section, index) => (
                    <li key={section.id}>
                      <a
                        href={`#${section.id}`}
                        className="font-body group text-muted-foreground hover:text-kpi-navy flex items-center gap-2.5 text-sm transition-colors"
                      >
                        <span className="border-border-subtle bg-surface text-kpi-navy group-hover:border-kpi-navy group-hover:bg-kpi-navy flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-[10px] font-semibold transition-colors group-hover:text-white">
                          {index + 1}
                        </span>
                        {section.title}
                      </a>
                    </li>
                  ))}
              </ol>
            </div>

            <div className="space-y-10 px-6 py-8 sm:px-12">
              {sections.map((section, index) => (
                <section key={section.id} id={section.id}>
                  {section.title && (
                    <div className="mb-4 flex items-center gap-3">
                      <span className="navy-gradient font-body flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white">
                        {index}
                      </span>
                      <h2 className="font-display text-foreground text-xl font-semibold">
                        {section.title}
                      </h2>
                    </div>
                  )}
                  <div className="space-y-3">
                    {section.paragraphs.map((para, i) => (
                      <p
                        key={i}
                        className="font-body text-foreground text-justify text-sm leading-relaxed sm:text-base"
                      >
                        {renderText(para)}
                      </p>
                    ))}
                  </div>
                </section>
              ))}
            </div>

            {/* Footer */}
            <div className="border-border-subtle bg-surface border-t px-6 py-5 sm:px-8">
              <p className="font-body text-muted-foreground text-center text-xs">
                © {new Date().getFullYear()} {APP_NAME} · КПІ ім. Ігоря Сікорського
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
