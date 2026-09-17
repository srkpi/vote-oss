'use client';

import { Environment, Lightformer } from '@react-three/drei';

import { CATGIRL_SCENE_COLORS } from '@/lib/three/catgirl-scene-theme';

interface SceneLightingProps {
  quality: 'high' | 'low';
  catgirl?: boolean;
}

const DEFAULT_LIGHTING_COLORS = {
  ambient: '#dce8f7',
  directional: '#eaf4ff',
  pointAccent: '#008acf',
  pointBright: '#5fc4f5',
  lightformerRing: '#bfe3ff',
  lightformerRectDark: '#1c396e',
};

/**
 * Lighting + reflection environment for the mark.
 *
 * The environment map is generated procedurally from `<Lightformer>` panels
 * rather than loaded from an HDRI file: this app ships a strict CSP
 * (`connect-src`/`img-src` allowlists in `next.config.ts`) and a voting
 * platform is exactly the kind of "enterprise grade" context where quietly
 * widening that allowlist for a decorative asset isn't a good trade — this
 * way the mark's reflections need zero extra network requests and zero CSP
 * changes, and keep working if a deployment is fully offline/air-gapped.
 * Catgirl mode keeps that property: it only swaps which hardcoded hex
 * strings are used below, no new asset or request.
 */
export function SceneLighting({ quality, catgirl = false }: SceneLightingProps) {
  const c = catgirl ? CATGIRL_SCENE_COLORS.lighting : DEFAULT_LIGHTING_COLORS;

  return (
    <>
      <ambientLight intensity={0.35} color={c.ambient} />
      <directionalLight position={[4, 5, 3]} intensity={1.1} color={c.directional} />
      <pointLight
        position={[-4, -2, -3]}
        intensity={6}
        color={c.pointAccent}
        distance={12}
        decay={2}
      />
      <pointLight
        position={[3, -3, 2]}
        intensity={3}
        color={c.pointBright}
        distance={10}
        decay={2}
      />

      <Environment resolution={quality === 'high' ? 256 : 96} frames={1}>
        <group>
          <Lightformer
            form="ring"
            color={c.lightformerRing}
            intensity={2.4}
            scale={6}
            position={[0, 0, -5]}
            target={[0, 0, 0]}
          />
          <Lightformer
            form="rect"
            color="#ffffff"
            intensity={1.6}
            scale={[4, 2, 1]}
            position={[4, 3, 4]}
            target={[0, 0, 0]}
          />
          <Lightformer
            form="rect"
            color={c.lightformerRectDark}
            intensity={3.2}
            scale={[6, 6, 1]}
            position={[-5, -3, -2]}
            target={[0, 0, 0]}
          />
          <Lightformer
            form="circle"
            color={c.pointAccent}
            intensity={2}
            scale={3}
            position={[0, -5, 2]}
            target={[0, 0, 0]}
          />
        </group>
      </Environment>
    </>
  );
}
