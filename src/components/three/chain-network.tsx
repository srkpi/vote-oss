'use client';

import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';

import { createChainNetworkLayout } from '@/lib/three/chain-network-layout';

const BLUE_LIGHT = '#5fc4f5';
const BLUE = '#008acf';

interface ChainNetworkProps {
  count?: number;
  seed?: number;
  bounds?: [number, number, number];
  /** Lower particle/segment budget for the "ambient" (no-logo) placements. */
  compact?: boolean;
}

const scratchObject = new THREE.Object3D();

/**
 * The "distributed ballot chain" backdrop: a sparse constellation of nodes,
 * connected to their nearest neighbors, with a soft dashed pulse animated
 * along each connection — evoking verification flowing through a
 * hash-linked chain rather than the decorative-only sparkle a generic
 * particle field would give.
 *
 * Built entirely from core three.js primitives (`InstancedMesh`,
 * `LineSegments` + `LineDashedMaterial`) rather than a custom shader, since
 * both are long-stable, well-documented APIs — the "chain" concept is
 * expressed through the deterministic layout and animation, not through
 * bespoke GLSL that would be harder to get right without visual iteration.
 */
export function ChainNetwork({
  count = 30,
  seed = 1337,
  bounds,
  compact = false,
}: ChainNetworkProps) {
  const layout = useMemo(
    () =>
      createChainNetworkLayout({
        count,
        seed,
        bounds: bounds ? new THREE.Vector3(...bounds) : undefined,
        neighborsPerNode: 2,
      }),
    [count, seed, bounds],
  );

  const instancedRef = useRef<THREE.InstancedMesh>(null);
  const lineRef = useRef<THREE.LineSegments>(null);
  const groupRef = useRef<THREE.Group>(null);

  const lineGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(layout.edgePositions, 3));

    // LineDashedMaterial requires a `lineDistance` attribute — the cumulative
    // distance along the line at each vertex, which is what the dashed
    // fragment shader mods against `dashSize + gapSize` to decide what to
    // discard. `computeLineDistances()` lives on `Line`/`LineSegments` (it
    // reads consecutive vertex pairs), not on `BufferGeometry` itself, but
    // only ever touches `this.geometry` — a throwaway wrapper is the
    // simplest way to compute and attach it.
    new THREE.LineSegments(geometry).computeLineDistances();
    geometry.computeBoundingSphere();
    return geometry;
  }, [layout]);

  // Three's built-in dashed-line shader has no offset/phase uniform (unlike
  // SVG's stroke-dashoffset) — only a static `lineDistance` attribute and a
  // `scale` factor. To get the pulse actually *flowing* along each
  // connection rather than sitting still, the base distances are captured
  // once here and re-written into the attribute every frame with a
  // time-based offset added on top (wrapped with modulo so the values — and
  // the float precision of adding to them — never grow unbounded over a
  // long-lived session).
  const baseLineDistances = useMemo(
    () => Float32Array.from(lineGeometry.attributes.lineDistance.array as Float32Array),
    [lineGeometry],
  );
  const dashCycle = 0.22 + 0.28; // dashSize + gapSize below

  useFrame((state, delta) => {
    const clampedDelta = Math.min(delta, 1 / 30);
    const t = state.clock.elapsedTime;

    if (groupRef.current) {
      groupRef.current.rotation.y += 0.014 * clampedDelta;
    }

    if (instancedRef.current) {
      layout.nodes.forEach((node, i) => {
        const bob = Math.sin(t * node.speed + node.phase) * 0.09;
        scratchObject.position.copy(node.position);
        scratchObject.position.y += bob;
        const pulse = 0.75 + Math.sin(t * node.speed * 1.5 + node.phase) * 0.25;
        scratchObject.scale.setScalar(pulse);
        scratchObject.updateMatrix();
        instancedRef.current!.setMatrixAt(i, scratchObject.matrix);
      });
      instancedRef.current.instanceMatrix.needsUpdate = true;
    }

    if (lineRef.current) {
      const attr = lineRef.current.geometry.attributes.lineDistance as THREE.BufferAttribute;
      const array = attr.array as Float32Array;
      // Wrap into a handful of dash cycles rather than [0, dashCycle) — with
      // the offset applied identically everywhere, any multiple of the full
      // cycle is visually equivalent, and wrapping too tightly would make
      // the modulo boundary land inside the visible window at low `t`.
      const wrapWindow = dashCycle * 4096;
      const offset = -((t * 0.55) % wrapWindow);
      for (let i = 0; i < array.length; i++) {
        array[i] = baseLineDistances[i] + offset;
      }
      attr.needsUpdate = true;
    }
  });

  const nodeSize = compact ? 0.032 : 0.045;

  return (
    <group ref={groupRef}>
      <instancedMesh ref={instancedRef} args={[undefined, undefined, layout.nodes.length]}>
        <icosahedronGeometry args={[nodeSize, 0]} />
        <meshStandardMaterial
          color={BLUE_LIGHT}
          emissive={BLUE_LIGHT}
          emissiveIntensity={1.1}
          toneMapped={false}
          transparent
          opacity={0.85}
        />
      </instancedMesh>

      <lineSegments ref={lineRef} geometry={lineGeometry}>
        <lineDashedMaterial
          color={BLUE}
          transparent
          opacity={0.4}
          dashSize={0.22}
          gapSize={0.28}
          toneMapped={false}
        />
      </lineSegments>
    </group>
  );
}
