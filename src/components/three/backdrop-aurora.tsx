'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';

import {
  auroraFragmentShaderHigh,
  auroraFragmentShaderLow,
  auroraVertexShader,
} from '@/lib/three/aurora-shader';

const BACKDROP_DEPTH = -9;

interface AuroraBackdropProps {
  quality: 'high' | 'low';
  intensity?: number;
}

/**
 * Full-frame background plane rendered with the aurora shader (see
 * `aurora-shader.ts` — compiled and pixel-checked against a real WebGL2
 * pipeline before being wired in here; see the Puppeteer-driven check
 * described alongside it). Sized every frame via
 * `viewport.getCurrentViewport`, so it always exactly fills the camera's
 * frustum at `BACKDROP_DEPTH` regardless of aspect ratio or FOV changes
 * between the hero/aside/ambient placements.
 *
 * Just a thin `key`-remounting wrapper around the real mesh: switching
 * `quality` needs a different compiled fragment shader, and remounting a
 * lightweight plane is simpler and safer than mutating `fragmentShader` +
 * `needsUpdate` on a live material.
 */
export function AuroraBackdrop({ quality, intensity = 1 }: AuroraBackdropProps) {
  return <AuroraBackdropMesh key={quality} quality={quality} intensity={intensity} />;
}

function AuroraBackdropMesh({ quality, intensity = 1 }: AuroraBackdropProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const fragmentShader = quality === 'high' ? auroraFragmentShaderHigh : auroraFragmentShaderLow;

  // Uniforms are only ever mutated in place (below, inside useFrame) via the
  // ref to the live material — this object itself never needs to change
  // identity, so `[]` deps are correct even though `intensity` is read here.
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uColorDeep: { value: new THREE.Color('#0a1f42') },
      uColorBase: { value: new THREE.Color('#1c396e') },
      uColorAccent: { value: new THREE.Color('#008acf') },
      uColorHighlight: { value: new THREE.Color('#5fc4f5') },
      uIntensity: { value: intensity },
      uAspect: { value: 1 },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useFrame(({ clock, viewport, camera }) => {
    const material = materialRef.current;
    if (!material) return;

    material.uniforms.uTime.value = clock.elapsedTime;
    material.uniforms.uIntensity.value = intensity;

    if (meshRef.current) {
      const dims = viewport.getCurrentViewport(camera, [0, 0, BACKDROP_DEPTH]);
      meshRef.current.scale.set(dims.width, dims.height, 1);
      material.uniforms.uAspect.value = dims.width / dims.height;
    }
  });

  const { viewport, camera } = useThree();
  const initial = viewport.getCurrentViewport(camera, [0, 0, BACKDROP_DEPTH]);

  return (
    <mesh
      ref={meshRef}
      position={[0, 0, BACKDROP_DEPTH]}
      scale={[initial.width, initial.height, 1]}
      renderOrder={-10}
    >
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={auroraVertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        depthWrite={false}
        depthTest={false}
        toneMapped={false}
      />
    </mesh>
  );
}
