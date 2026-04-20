import fs from 'fs';
import { ImageResponse } from 'next/og';
import path from 'path';

import { APP_NAME } from '@/lib/config/client';
import { OPENGRAPH_IMAGE_DATA } from '@/lib/utils/metadata';

export const runtime = 'nodejs';
export const alt = OPENGRAPH_IMAGE_DATA.alt;
export const size = {
  width: OPENGRAPH_IMAGE_DATA.width,
  height: OPENGRAPH_IMAGE_DATA.height,
};
export const contentType = 'image/png';

// Blue orb center:  top = -180 + 330 = 150,  right = -180 + 330 = 150  → left = 1050
// Orange orb center: bottom = -120 + 230 = 110 from bottom → top = 520,  left = -80 + 230 = 150

const BLUE_CX = 1050;
const BLUE_CY = 150;
const ORANGE_CX = 150;
const ORANGE_CY = 520;

export default function OgImage() {
  const [onest, bitter] = [
    fs.readFileSync(path.join(process.cwd(), 'public/fonts/Onest/Onest-Bold.ttf')),
    fs.readFileSync(path.join(process.cwd(), 'public/fonts/Bitter/Bitter-Bold.ttf')),
  ];

  return new ImageResponse(
    <div
      style={{
        width: OPENGRAPH_IMAGE_DATA.width,
        height: OPENGRAPH_IMAGE_DATA.height,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #1c396e 0%, #1d4480 100%)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Blue glow orb — top-right */}
      <div
        style={{
          position: 'absolute',
          top: -180,
          right: -180,
          width: 660,
          height: 660,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(0,138,207,0.42) 0%, transparent 68%)',
        }}
      />

      {/* Orange glow orb — bottom-left */}
      <div
        style={{
          position: 'absolute',
          bottom: -120,
          left: -80,
          width: 460,
          height: 460,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(240,125,0,0.28) 0%, transparent 68%)',
        }}
      />

      {/* Center subtle orb */}
      <div
        style={{
          position: 'absolute',
          top: '30%',
          right: '28%',
          width: 300,
          height: 300,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(0,80,127,0.25) 0%, transparent 65%)',
        }}
      />

      {/* Blue radar rings — centered on blue orb */}
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
            border: `1px solid rgba(0,138,207,${0.6 - i * 0.1})`,
          }}
        />
      ))}
      {/* Blue center dot */}
      <div
        style={{
          position: 'absolute',
          left: BLUE_CX - 5,
          top: BLUE_CY - 5,
          width: 10,
          height: 10,
          borderRadius: '50%',
          background: '#008acf',
          boxShadow: '0 0 14px 5px rgba(0,138,207,0.95)',
        }}
      />

      {/* Orange radar rings — centered on orange orb */}
      {[70, 140, 210].map((r, i) => (
        <div
          key={`or-${i}`}
          style={{
            position: 'absolute',
            left: ORANGE_CX - r,
            top: ORANGE_CY - r,
            width: r * 2,
            height: r * 2,
            borderRadius: '50%',
            border: `1px solid rgba(240,125,0,${0.55 - i * 0.1})`,
          }}
        />
      ))}
      {/* Orange center dot */}
      <div
        style={{
          position: 'absolute',
          left: ORANGE_CX - 4,
          top: ORANGE_CY - 4,
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: '#f07d00',
          boxShadow: '0 0 12px 4px rgba(240,125,0,0.9)',
        }}
      />

      {/* Main content */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 40,
        }}
      >
        <div
          style={{
            width: 200,
            height: 200,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.10)',
            border: '2px solid rgba(255,255,255,0.22)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg
            width="100"
            height="100"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21.801 10A10 10 0 1 1 17 3.335" />
            <path d="m9 11 3 3L22 4" />
          </svg>
        </div>
        <span
          style={{
            fontSize: 128,
            fontWeight: 700,
            color: '#ffffff',
            letterSpacing: '-3px',
            lineHeight: 1,
            fontFamily: 'Bitter, serif',
          }}
        >
          {APP_NAME}
        </span>
        <span
          style={{
            fontSize: 36,
            fontWeight: 400,
            color: 'rgba(255,255,255,0.55)',
            letterSpacing: '8px',
            textTransform: 'uppercase',
            fontFamily: 'Onest, sans-serif',
          }}
        >
          Система голосування
        </span>
      </div>
    </div>,
    {
      ...size,
      fonts: [
        { name: 'Onest', data: onest, weight: 700, style: 'normal' },
        { name: 'Bitter', data: bitter, weight: 700, style: 'normal' },
      ],
    },
  );
}
