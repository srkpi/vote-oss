'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';

import {
  auroraFragmentShaderHigh,
  auroraFragmentShaderLow,
  auroraVertexShader,
} from '@/lib/three/aurora-shader';
import { CATGIRL_SCENE_COLORS } from '@/lib/three/catgirl-scene-theme';

const BACKDROP_DEPTH = -9;

const DEFAULT_AURORA_COLORS = {
  deep: '#0a1f42',
  base: '#1c396e',
  accent: '#008acf',
  highlight: '#5fc4f5',
};

interface AuroraBackdropProps {
  quality: 'high' | 'low';
  intensity?: number;
  catgirl?: boolean;
}

export function AuroraBackdrop({ quality, intensity = 1, catgirl = false }: AuroraBackdropProps) {
  return (
    <AuroraBackdropMesh
      key={`${quality}-${catgirl}`}
      quality={quality}
      intensity={intensity}
      catgirl={catgirl}
    />
  );
}

function AuroraBackdropMesh({ quality, intensity = 1, catgirl = false }: AuroraBackdropProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const fragmentShader = quality === 'high' ? auroraFragmentShaderHigh : auroraFragmentShaderLow;
  const colors = catgirl ? CATGIRL_SCENE_COLORS.aurora : DEFAULT_AURORA_COLORS;

  // Uniforms are only ever mutated in place (below, inside useFrame) via the
  // ref to the live material — this object itself never needs to change
  // identity, so `[]` deps are correct even though `intensity` is read here.
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uColorDeep: { value: new THREE.Color(colors.deep) },
      uColorBase: { value: new THREE.Color(colors.base) },
      uColorAccent: { value: new THREE.Color(colors.accent) },
      uColorHighlight: { value: new THREE.Color(colors.highlight) },
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
