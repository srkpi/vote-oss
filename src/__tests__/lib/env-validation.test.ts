import { getBooleanEnv, getIntegerEnv, getNumberEnv, getSecret, getUrlEnv } from '@/lib/config/env';

const key = 'VOTE_TEST_SCHEMA_VALUE';
const original = process.env[key];

afterEach(() => {
  if (original === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = original;
  }
});

describe('environment validation', () => {
  it.each(['Infinity', '-Infinity', 'NaN', 'not a number'])(
    'rejects invalid numbers: %s',
    (value) => {
      process.env[key] = value;
      expect(() => getNumberEnv(key)).toThrow('Invalid number env');
    },
  );

  it.each(['yes', 'FALSE', '1', '0'])('rejects ambiguous booleans: %s', (value) => {
    process.env[key] = value;
    expect(() => getBooleanEnv(key)).toThrow('Invalid boolean env');
  });

  it('parses booleans and applies defaults', () => {
    process.env[key] = 'false';
    expect(getBooleanEnv(key)).toBe(false);
    process.env[key] = 'true';
    expect(getBooleanEnv(key)).toBe(true);
    delete process.env[key];
    expect(getBooleanEnv(key, false)).toBe(false);
    expect(getIntegerEnv(key, 9000, 1, 65535)).toBe(9000);
  });

  it.each(['0', '65536', '9000.5'])('rejects invalid ports: %s', (value) => {
    process.env[key] = value;
    expect(() => getIntegerEnv(key, 9000, 1, 65535)).toThrow('Invalid integer env');
  });

  it('validates URLs without leaking the invalid value', () => {
    process.env[key] = 'sensitive invalid value';
    expect(() => getUrlEnv(key)).toThrow(`Invalid URL in env: ${key}`);
    process.env[key] = 'https://example.com';
    expect(getUrlEnv(key)).toBe('https://example.com');
  });

  it('accepts valid secrets', () => {
    process.env[key] = 'a'.repeat(64);
    expect(getSecret(key, 64, 64)).toHaveLength(64);
  });
});
