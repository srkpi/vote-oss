import type { Metadata } from 'next';

import { APP_NAME } from '@/lib/config/client';

export const metadata: Metadata = {
  title: 'Політика конфіденційності',
  description: `Політика конфіденційності системи електронного голосування ${APP_NAME}`,
};

const lastUpdated = '20.03.2026';
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
      `Автентифікація здійснюється виключно через інформаційну систему «KPI ID». При використанні платформи ви погоджуєтесь з їх політикою конфіденційності (https://auth.kpi.ua/uk/privacy-policy).`,
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

function renderText(text: string): React.ReactNode[] {
  const URL_REGEX = /(https?:\/\/[^\s)]+)/g;
  const parts = text.split(URL_REGEX);
  return parts.map((part, i) => {
    if (/^https?:\/\//.test(part)) {
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[var(--kpi-blue-light)] underline underline-offset-2 hover:text-[var(--kpi-blue-dark)] transition-colors break-all"
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
    <div className="min-h-[calc(100dvh-var(--header-height))] bg-[var(--surface)]">
      <div className="container py-10 sm:py-16 max-w-3xl mx-auto">
        <div className="mb-10 sm:mb-14 text-center">
          <h1 className="font-display text-3xl sm:text-5xl font-bold text-[var(--kpi-navy)] mb-2 sm:mb-3">
            Політика конфіденційності
          </h1>
          <p className="text-[var(--muted-foreground)] font-body text-base sm:text-lg max-w-xl mx-auto">
            Останнє оновлення: {lastUpdated}
          </p>
        </div>

        <div className="max-w-3xl mx-auto">
          <div className="bg-white rounded-[var(--radius-xl)] border border-[var(--border-color)] shadow-[var(--shadow-sm)] overflow-hidden">
            <div className="px-6 sm:px-12 pt-8 pb-6 border-b border-[var(--border-subtle)]">
              <p className="text-sm font-semibold text-[var(--muted-foreground)] uppercase tracking-wider font-body mb-3">
                Зміст
              </p>
              <ol className="space-y-1.5">
                {sections
                  .filter((s) => s.title)
                  .map((section, index) => (
                    <li key={section.id}>
                      <a
                        href={`#${section.id}`}
                        className="flex items-center gap-2.5 text-sm font-body text-[var(--muted-foreground)] hover:text-[var(--kpi-navy)] transition-colors group"
                      >
                        <span className="w-5 h-5 rounded-md bg-[var(--surface)] border border-[var(--border-subtle)] flex items-center justify-center text-[10px] font-semibold text-[var(--kpi-navy)] shrink-0 group-hover:bg-[var(--kpi-navy)] group-hover:text-white group-hover:border-[var(--kpi-navy)] transition-colors">
                          {index + 1}
                        </span>
                        {section.title}
                      </a>
                    </li>
                  ))}
              </ol>
            </div>

            <div className="px-6 sm:px-12 py-8 space-y-10">
              {sections.map((section, index) => (
                <section key={section.id} id={section.id}>
                  {section.title && (
                    <div className="flex items-center gap-3 mb-4">
                      <span className="w-7 h-7 rounded-lg navy-gradient flex items-center justify-center text-white text-xs font-bold font-body shrink-0">
                        {index}
                      </span>
                      <h2 className="font-display text-xl font-semibold text-[var(--foreground)]">
                        {section.title}
                      </h2>
                    </div>
                  )}
                  <div className="space-y-3">
                    {section.paragraphs.map((para, i) => (
                      <p
                        key={i}
                        className="font-body text-sm sm:text-base leading-relaxed text-[var(--foreground)] text-justify"
                      >
                        {renderText(para)}
                      </p>
                    ))}
                  </div>
                </section>
              ))}
            </div>

            {/* Footer */}
            <div className="px-6 sm:px-8 py-5 bg-[var(--surface)] border-t border-[var(--border-subtle)]">
              <p className="text-xs font-body text-[var(--muted-foreground)] text-center">
                © {new Date().getFullYear()} {APP_NAME} · КПІ ім. Ігоря Сікорського
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
