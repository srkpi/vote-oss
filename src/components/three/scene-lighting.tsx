'use client';

import { Environment, Lightformer } from '@react-three/drei';

interface SceneLightingProps {
  quality: 'high' | 'low';
}

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
 */
export function SceneLighting({ quality }: SceneLightingProps) {
  return (
    <>
      <ambientLight intensity={0.35} color="#dce8f7" />
      <directionalLight position={[4, 5, 3]} intensity={1.1} color="#eaf4ff" />
      <pointLight position={[-4, -2, -3]} intensity={6} color="#008acf" distance={12} decay={2} />
      <pointLight position={[3, -3, 2]} intensity={3} color="#5fc4f5" distance={10} decay={2} />

      <Environment resolution={quality === 'high' ? 256 : 96} frames={1}>
        <group>
          <Lightformer
            form="ring"
            color="#bfe3ff"
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
            color="#1c396e"
            intensity={3.2}
            scale={[6, 6, 1]}
            position={[-5, -3, -2]}
            target={[0, 0, 0]}
          />
          <Lightformer
            form="circle"
            color="#008acf"
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
