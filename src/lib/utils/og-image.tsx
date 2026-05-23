import fs from 'fs';
import path from 'path';

import { APP_NAME } from '@/lib/config/client';
import { OPENGRAPH_IMAGE_DATA } from '@/lib/utils/metadata';

export const ogSize = {
  width: OPENGRAPH_IMAGE_DATA.width,
  height: OPENGRAPH_IMAGE_DATA.height,
};

export const ogContentType = 'image/png';

const BLUE_CX = 1060;
const BLUE_CY = 100;
const ORANGE_CX = 140;
const ORANGE_CY = 550;

export function clampTitle(title: string, max = 255): string {
  return title.length > max ? title.slice(0, max - 1) + '…' : title;
}

export function titleFontSize(title: string): number {
  if (title.length <= 30) return 72;
  if (title.length <= 50) return 58;
  if (title.length <= 70) return 46;
  return 40;
}

export async function loadOgFonts() {
  const [onest, bitter] = [
    fs.readFileSync(path.join(process.cwd(), 'public/fonts/Onest/Onest-Bold.ttf')),
    fs.readFileSync(path.join(process.cwd(), 'public/fonts/Bitter/Bitter-Bold.ttf')),
  ];
  return { onest, bitter };
}

export function buildOgFontConfig(onest: Buffer, bitter: Buffer) {
  return [
    { name: 'Onest', data: onest, weight: 700 as const, style: 'normal' as const },
    { name: 'Bitter', data: bitter, weight: 700 as const, style: 'normal' as const },
  ];
}

// ─── Lucide icon path data ────────────────────────────────────────────────────
// Store path/circle descriptors here so we never scatter raw SVG strings across
// opengraph files. Add new icons as needed.

type SvgPath = { d: string };
type SvgCircle = { cx: number; cy: number; r: number };
type SvgPolyline = { points: string };

export interface OgIconDescriptor {
  paths?: SvgPath[];
  circles?: SvgCircle[];
  polylines?: SvgPolyline[];
  strokeWidth?: number;
}

export const ICON_ELECTION: OgIconDescriptor = {
  paths: [{ d: 'M21.801 10A10 10 0 1 1 17 3.335' }, { d: 'm9 11 3 3L22 4' }],
  strokeWidth: 1.5,
};

export const ICON_PETITION: OgIconDescriptor = {
  paths: [
    { d: 'M12 22H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8.5L20 7.5V12' },
    { d: 'm18 14-6 6h-4v-4l6-6 4 4Z' },
  ],
  polylines: [{ points: '14 2 14 8 20 8' }],
  strokeWidth: 1.6,
};

export const ICON_GROUPS: OgIconDescriptor = {
  paths: [
    { d: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2' },
    { d: 'M22 21v-2a4 4 0 0 0-3-3.87' },
    { d: 'M16 3.13a4 4 0 0 1 0 7.75' },
  ],
  circles: [{ cx: 9, cy: 7, r: 4 }],
  strokeWidth: 1.5,
};

function OgIcon({ icon }: { icon: OgIconDescriptor }) {
  return (
    <svg
      width="25"
      height="25"
      viewBox="0 0 24 24"
      fill="none"
      stroke="white"
      stroke-width={String(icon.strokeWidth ?? 1.5)}
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      {icon.paths?.map(({ d }, i) => (
        <path key={`p${i}`} d={d} />
      ))}
      {icon.circles?.map(({ cx, cy, r }, i) => (
        <circle key={`c${i}`} cx={cx} cy={cy} r={r} />
      ))}
      {icon.polylines?.map(({ points }, i) => (
        <polyline key={`pl${i}`} points={points} />
      ))}
    </svg>
  );
}

export interface OgImageOptions {
  title: string;
  icon: OgIconDescriptor;
  iconBg: string;
  iconBorder: string;
  accentColor: string;
  label?: string;
  labelColor?: string;
}

export function buildOgImageElement({
  title,
  icon,
  iconBg,
  iconBorder,
  accentColor,
  label,
  labelColor = '#f07d00',
}: OgImageOptions) {
  const fontSize = titleFontSize(title);

  return (
    <div
      style={{
        width: OPENGRAPH_IMAGE_DATA.width,
        height: OPENGRAPH_IMAGE_DATA.height,
        display: 'flex',
        background: 'linear-gradient(140deg, #162d58 0%, #1d4480 55%, #1a3870 100%)',
        position: 'relative',
        overflow: 'hidden',
        fontFamily: 'Onest, sans-serif',
      }}
    >
      {/* ── Glow orbs ───────────────────────────────────────────────────────── */}
      <div
        style={{
          position: 'absolute',
          top: -220,
          right: -220,
          width: 720,
          height: 720,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(0,138,207,0.35) 0%, transparent 65%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: -160,
          left: -120,
          width: 540,
          height: 540,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(240,125,0,0.20) 0%, transparent 65%)',
        }}
      />

      {/* ── Blue radar rings ─────────────────────────────────────────────────── */}
      {[80, 160, 240, 320].map((r, i) => (
        <div
          key={`br-${i}`}
          style={{
            position: 'absolute',
            left: BLUE_CX - r,
            top: BLUE_CY - r,
            width: r * 2,
            height: r * 2,
            borderRadius: '50%',
            border: `1px solid rgba(0,138,207,${0.55 - i * 0.1})`,
          }}
        />
      ))}
      <div
        style={{
          position: 'absolute',
          left: BLUE_CX - 5,
          top: BLUE_CY - 5,
          width: 10,
          height: 10,
          borderRadius: '50%',
          background: '#008acf',
          boxShadow: '0 0 18px 6px rgba(0,138,207,0.95)',
        }}
      />

      {/* ── Orange radar rings ───────────────────────────────────────────────── */}
      {[65, 130, 195].map((r, i) => (
        <div
          key={`or-${i}`}
          style={{
            position: 'absolute',
            left: ORANGE_CX - r,
            top: ORANGE_CY - r,
            width: r * 2,
            height: r * 2,
            borderRadius: '50%',
            border: `1px solid rgba(240,125,0,${0.48 - i * 0.1})`,
          }}
        />
      ))}
      <div
        style={{
          position: 'absolute',
          left: ORANGE_CX - 4,
          top: ORANGE_CY - 4,
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: '#f07d00',
          boxShadow: '0 0 14px 5px rgba(240,125,0,0.85)',
        }}
      />

      {/* ── Vertical accent line ─────────────────────────────────────────────── */}
      <div
        style={{
          position: 'absolute',
          left: 80,
          top: 120,
          bottom: 120,
          width: 2,
          background: `linear-gradient(to bottom, transparent, ${accentColor} 30%, ${accentColor} 70%, transparent)`,
          borderRadius: 2,
        }}
      />

      {/* ── Main content ─────────────────────────────────────────────────────── */}
      <div
        style={{
          position: 'relative',
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '0 100px 0 108px',
          gap: 0,
          width: '100%',
        }}
      >
        {/* Brand row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 50,
              height: 50,
              borderRadius: '50%',
              background: iconBg,
              border: iconBorder,
            }}
          >
            <OgIcon icon={icon} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span
              style={{
                fontSize: 24,
                fontWeight: 700,
                color: 'rgba(255,255,255,0.5)',
                letterSpacing: '0.18em',
                lineHeight: 1,
                fontFamily: 'Bitter, serif',
              }}
            >
              {APP_NAME}
            </span>
            {label && (
              <span
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: labelColor,
                  letterSpacing: '0.32em',
                  lineHeight: 1,
                  fontFamily: 'Onest, sans-serif',
                }}
              >
                {label}
              </span>
            )}
          </div>
        </div>

        {/* Page title */}
        <div
          style={{
            fontSize,
            fontWeight: 700,
            color: '#ffffff',
            lineHeight: 1.12,
            letterSpacing: fontSize > 55 ? '-1.5px' : '-0.5px',
            fontFamily: 'Bitter, serif',
            marginBottom: 36,
            maxWidth: 980,
            wordBreak: 'break-word',
          }}
        >
          {title}
        </div>
      </div>
    </div>
  );
}
