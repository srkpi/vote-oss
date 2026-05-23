export type Gender = 'male' | 'female' | 'unknown';

export interface GenderResult {
  gender: Gender;
  /** How confident we are: 'patronymic' > 'lastName' > 'firstName' > 'unknown' */
  detectedBy: 'patronymic' | 'lastName' | 'firstName' | 'unknown';
}

// ---------------------------------------------------------------------------
// Patronymic rules — most reliable signal in Ukrainian
// ---------------------------------------------------------------------------

const FEMALE_PATRONYMIC_ENDINGS = ['ївна', 'івна', 'овна', 'євна', 'евна'] as const;
const MALE_PATRONYMIC_ENDINGS = ['ович', 'євич', 'евич'] as const;

function detectGenderByPatronymic(patronymic: string): Gender {
  const lower = patronymic.toLowerCase();

  for (const ending of FEMALE_PATRONYMIC_ENDINGS) {
    if (lower.endsWith(ending)) return 'female';
  }
  for (const ending of MALE_PATRONYMIC_ENDINGS) {
    if (lower.endsWith(ending)) return 'male';
  }
  return 'unknown';
}

// ---------------------------------------------------------------------------
// Last name rules — adjective-form surnames inflect by gender
// ---------------------------------------------------------------------------

const FEMALE_LAST_NAME_ENDINGS = ['ська', 'зька', 'цька', 'жня', 'дня'] as const;
const MALE_LAST_NAME_ENDINGS = ['ський', 'зький', 'цький'] as const;

function detectGenderByLastName(lastName: string): Gender {
  const lower = lastName.toLowerCase();

  for (const ending of FEMALE_LAST_NAME_ENDINGS) {
    if (lower.endsWith(ending)) return 'female';
  }
  for (const ending of MALE_LAST_NAME_ENDINGS) {
    if (lower.endsWith(ending)) return 'male';
  }
  return 'unknown';
}

// ---------------------------------------------------------------------------
// First name rules — Ukrainian female names almost always end in -а / -я
// This is a statistical heuristic, not a hard rule.
// ---------------------------------------------------------------------------

function detectGenderByFirstName(firstName: string): Gender {
  const lower = firstName.toLowerCase();

  // Apostrophe-containing names like Дар'я still end in 'я'
  if (lower.endsWith('а') || lower.endsWith('я')) return 'female';

  // Ukrainian male names very rarely end in -а/-я
  // (exceptions: Ілля, Микола, Сава — but patronymics will have caught those)
  return 'male'; // assume male as default if nothing else matched
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Detects the gender of a Ukrainian full name.
 *
 * @param fullName - Full name string in the format "Прізвище Ім'я По-батькові"
 * @returns GenderResult with gender and the field it was detected from
 *
 * @example
 * detectGender('Копчалюк Дарина Андріївна')
 * // => { gender: 'female', detectedBy: 'patronymic' }
 *
 * detectGender('Куземський Максим Володимирович')
 * // => { gender: 'male', detectedBy: 'patronymic' }
 */
export function detectGender(fullName: string): GenderResult {
  const parts = fullName.trim().split(/\s+/);

  if (parts.length < 3) {
    // If we only have 2 parts, try last name + first name
    if (parts.length === 2) {
      const [lastName, firstName] = parts;

      const byLastName = detectGenderByLastName(lastName);
      if (byLastName !== 'unknown') {
        return { gender: byLastName, detectedBy: 'lastName' };
      }

      const byFirstName = detectGenderByFirstName(firstName);
      return { gender: byFirstName, detectedBy: 'firstName' };
    }

    return { gender: 'unknown', detectedBy: 'unknown' };
  }

  const [lastName, firstName, patronymic] = parts;

  // 1. Patronymic — highest confidence
  const byPatronymic = detectGenderByPatronymic(patronymic);
  if (byPatronymic !== 'unknown') {
    return { gender: byPatronymic, detectedBy: 'patronymic' };
  }

  // 2. Last name — adjective-form surnames are gendered
  const byLastName = detectGenderByLastName(lastName);
  if (byLastName !== 'unknown') {
    return { gender: byLastName, detectedBy: 'lastName' };
  }

  // 3. First name — statistical fallback
  const byFirstName = detectGenderByFirstName(firstName);
  return { gender: byFirstName, detectedBy: 'firstName' };
}

// ---------------------------------------------------------------------------
// Convenience wrapper — returns just the gender string
// ---------------------------------------------------------------------------

export function getGender(fullName: string): Gender {
  return detectGender(fullName).gender;
}
