'use client';

import { useEffect, useRef } from 'react';

import { cn } from '@/lib/utils';

// ── Types ──────────────────────────────────────────────────────────────────

interface StreamParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  norm: number;
  opacity: number;
  size: number;
  r: number;
  g: number;
  b: number;
  tailLength: number;
  life: number;
  maxLife: number;
}

interface GlowNode {
  col: number;
  row: number;
  opacity: number;
  targetOpacity: number;
  phase: number;
  r: number;
  g: number;
  b: number;
  pulseSpeed: number;
}

interface ActiveLine {
  index: number;
  axis: 'h' | 'v';
  opacity: number;
  targetOpacity: number;
  phase: number;
}

interface FlashCell {
  col: number;
  row: number;
  opacity: number;
  r: number;
  g: number;
  b: number;
}

// ── Color palettes ────────────────────────────────────────────────────────

const DARK = {
  gridLine: [255, 255, 255] as const,
  gridOpacity: 0.07,
  lineOpacity: 0.22,
  nodes: [
    [0, 138, 207] as const, // kpi-blue-light
    [255, 255, 255] as const, // white
    [240, 125, 0] as const, // kpi-orange
    [16, 98, 163] as const, // kpi-blue-mid
  ],
  particles: [[0, 138, 207] as const, [255, 255, 255] as const, [16, 98, 163] as const],
  activeLine: [0, 138, 207] as const,
  flashCells: [[0, 138, 207] as const, [240, 125, 0] as const],
};

const LIGHT = {
  gridLine: [28, 57, 110] as const,
  gridOpacity: 0.05,
  lineOpacity: 0.14,
  nodes: [[0, 138, 207] as const, [28, 57, 110] as const, [16, 98, 163] as const],
  particles: [[0, 138, 207] as const, [16, 98, 163] as const, [28, 57, 110] as const],
  activeLine: [0, 138, 207] as const,
  flashCells: [[0, 138, 207] as const, [28, 57, 110] as const],
};

// ── Component ─────────────────────────────────────────────────────────────

export interface AnimatedGridProps {
  className?: string;
  variant?: 'dark' | 'light';
  cellSize?: number;
}

export function AnimatedGrid({ className, variant = 'dark', cellSize = 44 }: AnimatedGridProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const C = variant === 'dark' ? DARK : LIGHT;

    // ── State ───────────────────────────────────────────────────────────
    let animId: number;
    let time = 0;
    let W = 0,
      H = 0;
    let cols = 0,
      rows = 0;
    let effectiveCell = cellSize;

    const particles: StreamParticle[] = [];
    const nodes: GlowNode[] = [];
    const activeLines: ActiveLine[] = [];
    const flashCells: FlashCell[] = [];

    // ── Resize ──────────────────────────────────────────────────────────
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio, 2);
      W = canvas.offsetWidth;
      H = canvas.offsetHeight;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      ctx.scale(dpr, dpr);

      // Coarser grid on small screens for performance
      effectiveCell = W < 640 ? cellSize * 1.25 : cellSize;

      cols = Math.ceil(W / effectiveCell);
      rows = Math.ceil(H / effectiveCell);

      initNodes();
      initActiveLines();
      if (particles.length === 0) initParticles();
    };

    // ── Nodes ───────────────────────────────────────────────────────────
    const initNodes = () => {
      nodes.length = 0;
      for (let c = 0; c <= cols; c++) {
        for (let r = 0; r <= rows; r++) {
          if (Math.random() < 0.18) {
            const pick = C.nodes[Math.floor(Math.random() * C.nodes.length)];
            nodes.push({
              col: c,
              row: r,
              opacity: 0,
              targetOpacity: Math.random() * 0.75 + 0.1,
              phase: Math.random() * Math.PI * 2,
              r: pick[0],
              g: pick[1],
              b: pick[2],
              pulseSpeed: Math.random() * 1.5 + 0.5,
            });
          }
        }
      }
    };

    // ── Active (glowing) lines ──────────────────────────────────────────
    const initActiveLines = () => {
      activeLines.length = 0;
      const count = Math.floor((cols + rows) * 0.18);
      for (let i = 0; i < count; i++) {
        const axis = Math.random() > 0.5 ? 'h' : 'v';
        const max = axis === 'h' ? rows : cols;
        activeLines.push({
          index: Math.floor(Math.random() * (max + 1)),
          axis,
          opacity: Math.random() * C.lineOpacity,
          targetOpacity: Math.random() * C.lineOpacity + 0.02,
          phase: Math.random() * Math.PI * 2,
        });
      }
    };

    // ── Particles ───────────────────────────────────────────────────────
    const maxParticles = () => Math.min(18, Math.max(6, Math.floor((W * H) / 22000)));

    const spawnParticle = (randomPos = false) => {
      const horiz = Math.random() > 0.5;
      const dir = Math.random() > 0.5 ? 1 : -1;
      const speed = Math.random() * 1.4 + 0.5; // px/frame
      const pick = C.particles[Math.floor(Math.random() * C.particles.length)];
      const maxLife = Math.floor(Math.random() * 200 + 120);

      let x: number, y: number, vx: number, vy: number;

      if (horiz) {
        const r = Math.round(Math.random() * rows);
        y = r * effectiveCell;
        vx = dir * speed;
        vy = 0;
        x = randomPos ? Math.random() * W : dir > 0 ? -10 : W + 10;
      } else {
        const c = Math.round(Math.random() * cols);
        x = c * effectiveCell;
        vy = dir * speed;
        vx = 0;
        y = randomPos ? Math.random() * H : dir > 0 ? -10 : H + 10;
      }

      particles.push({
        x,
        y,
        vx,
        vy,
        norm: speed,
        opacity: Math.random() * 0.55 + 0.35,
        size: Math.random() * 1.2 + 0.5,
        r: pick[0],
        g: pick[1],
        b: pick[2],
        tailLength: Math.random() * 70 + 25,
        life: randomPos ? Math.floor(Math.random() * maxLife) : 0,
        maxLife,
      });
    };

    const initParticles = () => {
      const n = maxParticles();
      for (let i = 0; i < n; i++) spawnParticle(true);
    };

    // ── Flash cell ──────────────────────────────────────────────────────
    const maybeFlash = () => {
      if (Math.random() < 0.004 && flashCells.length < 4) {
        const pick = C.flashCells[Math.floor(Math.random() * C.flashCells.length)];
        flashCells.push({
          col: Math.floor(Math.random() * cols),
          row: Math.floor(Math.random() * rows),
          opacity: 0.18,
          r: pick[0],
          g: pick[1],
          b: pick[2],
        });
      }
    };

    // ── Draw loop ────────────────────────────────────────────────────────
    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      time++;

      const [gR, gG, gB] = C.gridLine;
      const [aR, aG, aB] = C.activeLine;
      const cs = effectiveCell;

      // ── 1. Base grid ────────────────────────────────────────────────
      ctx.lineWidth = 0.5;
      ctx.strokeStyle = `rgba(${gR},${gG},${gB},${C.gridOpacity})`;
      ctx.beginPath();
      for (let c = 0; c <= cols; c++) {
        ctx.moveTo(c * cs, 0);
        ctx.lineTo(c * cs, H);
      }
      for (let r = 0; r <= rows; r++) {
        ctx.moveTo(0, r * cs);
        ctx.lineTo(W, r * cs);
      }
      ctx.stroke();

      // ── 2. Flash cells ──────────────────────────────────────────────
      for (let i = flashCells.length - 1; i >= 0; i--) {
        const f = flashCells[i];
        f.opacity -= 0.003;
        if (f.opacity <= 0) {
          flashCells.splice(i, 1);
          continue;
        }
        ctx.fillStyle = `rgba(${f.r},${f.g},${f.b},${f.opacity})`;
        ctx.fillRect(f.col * cs + 1, f.row * cs + 1, cs - 2, cs - 2);
      }
      maybeFlash();

      // ── 3. Active glowing lines ─────────────────────────────────────
      activeLines.forEach((line) => {
        const pulse = Math.sin(time * 0.018 + line.phase) * 0.35 + 0.65;

        // Slow random drift of target opacity
        if (Math.random() < 0.004) {
          line.targetOpacity = Math.random() * C.lineOpacity + 0.015;
        }
        line.opacity += (line.targetOpacity - line.opacity) * 0.012;
        const op = line.opacity * pulse;

        if (line.axis === 'h') {
          const y = line.index * cs;
          const g = ctx.createLinearGradient(0, y, W, y);
          g.addColorStop(0, `rgba(${aR},${aG},${aB},0)`);
          g.addColorStop(0.15, `rgba(${aR},${aG},${aB},${op})`);
          g.addColorStop(0.85, `rgba(${aR},${aG},${aB},${op})`);
          g.addColorStop(1, `rgba(${aR},${aG},${aB},0)`);
          ctx.strokeStyle = g;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(W, y);
          ctx.stroke();
        } else {
          const x = line.index * cs;
          const g = ctx.createLinearGradient(x, 0, x, H);
          g.addColorStop(0, `rgba(${aR},${aG},${aB},0)`);
          g.addColorStop(0.15, `rgba(${aR},${aG},${aB},${op})`);
          g.addColorStop(0.85, `rgba(${aR},${aG},${aB},${op})`);
          g.addColorStop(1, `rgba(${aR},${aG},${aB},0)`);
          ctx.strokeStyle = g;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, H);
          ctx.stroke();
        }
      });

      // ── 4. Stream particles ─────────────────────────────────────────
      const dead: number[] = [];
      particles.forEach((p, i) => {
        p.x += p.vx;
        p.y += p.vy;
        p.life++;

        const lr = p.life / p.maxLife;
        const fade = lr < 0.1 ? lr / 0.1 : lr > 0.8 ? (1 - lr) / 0.2 : 1;
        const op = p.opacity * fade;

        // Tail
        const tx = p.x - (p.vx / p.norm) * p.tailLength;
        const ty = p.y - (p.vy / p.norm) * p.tailLength;
        const tg = ctx.createLinearGradient(tx, ty, p.x, p.y);
        tg.addColorStop(0, `rgba(${p.r},${p.g},${p.b},0)`);
        tg.addColorStop(1, `rgba(${p.r},${p.g},${p.b},${op})`);
        ctx.strokeStyle = tg;
        ctx.lineWidth = p.size;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();

        // Head glow
        const hr = p.size * 5;
        const hg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, hr);
        hg.addColorStop(0, `rgba(${p.r},${p.g},${p.b},${op * 0.8})`);
        hg.addColorStop(1, `rgba(${p.r},${p.g},${p.b},0)`);
        ctx.fillStyle = hg;
        ctx.beginPath();
        ctx.arc(p.x, p.y, hr, 0, Math.PI * 2);
        ctx.fill();

        if (p.life >= p.maxLife || p.x < -200 || p.x > W + 200 || p.y < -200 || p.y > H + 200)
          dead.push(i);
      });
      for (let i = dead.length - 1; i >= 0; i--) {
        particles.splice(dead[i], 1);
        if (particles.length < maxParticles()) spawnParticle();
      }

      // ── 5. Intersection nodes ───────────────────────────────────────
      nodes.forEach((node) => {
        const pulse = Math.sin(time * 0.022 * node.pulseSpeed + node.phase) * 0.3 + 0.7;
        node.opacity += (node.targetOpacity - node.opacity) * 0.012;

        if (Math.random() < 0.0008) {
          node.targetOpacity = Math.random() < 0.25 ? 0 : Math.random() * 0.75 + 0.1;
        }

        const op = node.opacity * pulse;
        if (op < 0.01) return;

        const x = node.col * cs;
        const y = node.row * cs;

        // Soft halo
        const rOuter = 9;
        const og = ctx.createRadialGradient(x, y, 0, x, y, rOuter);
        og.addColorStop(0, `rgba(${node.r},${node.g},${node.b},${op * 0.35})`);
        og.addColorStop(1, `rgba(${node.r},${node.g},${node.b},0)`);
        ctx.fillStyle = og;
        ctx.beginPath();
        ctx.arc(x, y, rOuter, 0, Math.PI * 2);
        ctx.fill();

        // Core dot
        ctx.fillStyle = `rgba(${node.r},${node.g},${node.b},${Math.min(1, op * 1.4)})`;
        ctx.beginPath();
        ctx.arc(x, y, 1.5, 0, Math.PI * 2);
        ctx.fill();
      });

      animId = requestAnimationFrame(draw);
    };

    // ── Boot ─────────────────────────────────────────────────────────────
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    draw();

    return () => {
      cancelAnimationFrame(animId);
      ro.disconnect();
    };
  }, [variant, cellSize]);

  return (
    <canvas
      ref={canvasRef}
      className={cn('absolute inset-0 w-full h-full pointer-events-none', className)}
      aria-hidden="true"
    />
  );
}
