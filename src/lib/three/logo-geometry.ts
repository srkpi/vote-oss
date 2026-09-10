import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Faithful 3D reconstruction of the Vote OSS mark (see `public/logo.svg` and
 * `public/favicon/*`) — a near-complete ring with a small gap, and a checkmark
 * whose top stroke breaks out through that gap.
 *
 * The source is traced directly from the SVG path data so the 3D mark matches
 * the 2D brand mark exactly rather than approximating it:
 *
 *   ring:      M21.801 10 A10 10 0 1 1 17 3.335   (circle, center (12,12), r=10)
 *   checkmark: m9 11 3 3 L22 4                    ((9,11) -> (12,14) -> (22,4))
 *
 * Both are re-expressed below in a centered, unit-circle, Y-up coordinate
 * space: `local = ((svgPoint - (12, 12)) / 10) * (1, -1)`. The Y flip converts
 * from SVG's y-down space into three.js's y-up space so the mark keeps its
 * original on-screen orientation when laid on the XY plane facing the camera.
 * All of this is verified against the source path in
 * `scripts/three/verify-logo-geometry.ts`.
 */

// Ring endpoints, normalized (see module docstring for the derivation).
const RING_START = new THREE.Vector2(0.9801, 0.2);
const RING_END = new THREE.Vector2(0.5, 0.8665);

// atan2 gives the short (~48.5°) way from RING_START to RING_END; the ring
// itself is everything else — the long way around, ~311.5° of arc.
const RING_START_ANGLE = Math.atan2(RING_START.y, RING_START.x);
const RING_END_ANGLE = Math.atan2(RING_END.y, RING_END.x);

// Checkmark vertices, normalized the same way. The final point (CHECK_P2)
// lands inside the ring's gap angle range and just outside r=1 — the
// checkmark's tip visually "breaks through" the ring, exactly as in the
// source mark.
const CHECK_P0 = new THREE.Vector3(-0.3, 0.1, 0);
const CHECK_P1 = new THREE.Vector3(0, -0.2, 0);
const CHECK_P2 = new THREE.Vector3(1.0, 0.8, 0);

/** Lifts a flat `EllipseCurve` (Vector2) into a `Curve<Vector3>` on the XY plane. */
class PlanarEllipseCurve extends THREE.Curve<THREE.Vector3> {
  private readonly ellipse: THREE.EllipseCurve;

  constructor(ellipse: THREE.EllipseCurve) {
    super();
    this.ellipse = ellipse;
  }

  override getPoint(t: number, target: THREE.Vector3 = new THREE.Vector3()): THREE.Vector3 {
    const p = this.ellipse.getPoint(t, _ellipseScratch);
    return target.set(p.x, p.y, 0);
  }
}
const _ellipseScratch = new THREE.Vector2();

export interface LogoGeometryOptions {
  /** Outer ring radius in world units. */
  radius?: number;
  /** Tube radius, as a fraction of `radius`. */
  tubeThickness?: number;
  /** Segments along the ring's circumference. */
  ringSegments?: number;
  /** Segments around each tube's circular cross-section. */
  radialSegments?: number;
  /** Sphere detail used for the rounded caps/joint. */
  capDetail?: number;
}

const DEFAULTS: Required<LogoGeometryOptions> = {
  radius: 1,
  tubeThickness: 0.115,
  ringSegments: 160,
  radialSegments: 16,
  capDetail: 16,
};

/**
 * Builds the merged, single-draw-call geometry for the Vote OSS mark: the
 * ring (with its gap) plus the two checkmark strokes, all rendered as
 * cylindrical tubes with rounded (spherical) caps/joint — matching the
 * `stroke-linecap="round" stroke-linejoin="round"` styling of the source SVG.
 */
export function createLogoMarkGeometry(options: LogoGeometryOptions = {}): THREE.BufferGeometry {
  const opts = { ...DEFAULTS, ...options };
  const { radius, ringSegments, radialSegments, capDetail } = opts;
  const tubeRadius = radius * opts.tubeThickness;

  const ellipse = new THREE.EllipseCurve(
    0,
    0,
    radius,
    radius,
    RING_START_ANGLE,
    RING_END_ANGLE,
    true, // clockwise => takes the long way around (the ~311.5° body of the ring)
    0,
  );
  const ringCurve = new PlanarEllipseCurve(ellipse);
  const ringGeometry = new THREE.TubeGeometry(
    ringCurve,
    ringSegments,
    tubeRadius,
    radialSegments,
    false,
  );

  const p0 = CHECK_P0.clone().multiplyScalar(radius);
  const p1 = CHECK_P1.clone().multiplyScalar(radius);
  const p2 = CHECK_P2.clone().multiplyScalar(radius);

  // Two straight segments (not one smoothed curve): a checkmark reads as a
  // crisp fold, not a soft "V" — the rounded joint sphere below does the same
  // job `stroke-linejoin="round"` does in the flat SVG.
  const checkSegmentA = new THREE.TubeGeometry(
    new THREE.LineCurve3(p0, p1),
    1,
    tubeRadius,
    radialSegments,
    false,
  );
  const checkSegmentB = new THREE.TubeGeometry(
    new THREE.LineCurve3(p1, p2),
    1,
    tubeRadius,
    radialSegments,
    false,
  );

  // Evaluate the centerline directly (rather than reading back tube surface
  // vertices, which are offset from the centerline by `tubeRadius`) so the
  // cap spheres sit exactly on-axis with no seam or overlap artifact.
  const ringStartPos = ringCurve.getPoint(0);
  const ringEndPos = ringCurve.getPoint(1);

  const capCenters = [ringStartPos, ringEndPos, p0, p1, p2];
  const capGeometries = capCenters.map((center) => {
    const sphere = new THREE.SphereGeometry(tubeRadius, capDetail, capDetail);
    sphere.translate(center.x, center.y, center.z);
    return sphere;
  });

  const merged = mergeGeometries([ringGeometry, checkSegmentA, checkSegmentB, ...capGeometries]);

  if (!merged) {
    throw new Error('createLogoMarkGeometry: failed to merge Vote OSS mark geometry');
  }

  // Deliberately NOT calling computeVertexNormals() here: TubeGeometry
  // (Frenet-frame normals) and SphereGeometry (analytic normals) already
  // ship correct per-piece normals, and since the pieces are disjoint,
  // recomputing would only reproduce the same smooth shading at the cost of
  // CPU time — while also touching a handful of unindexed UV-seam vertices
  // that SphereGeometry leaves in the buffer for texture-wrap purposes,
  // which have no incident triangles for a proper accumulated normal.
  merged.computeBoundingSphere();
  merged.computeBoundingBox();

  return merged;
}

/** Precomputed reference values, exported for tests/tooling. */
export const LOGO_GEOMETRY_REFERENCE = {
  ringStartAngleDeg: (RING_START_ANGLE * 180) / Math.PI,
  ringEndAngleDeg: (RING_END_ANGLE * 180) / Math.PI,
  checkP0: CHECK_P0.clone(),
  checkP1: CHECK_P1.clone(),
  checkP2: CHECK_P2.clone(),
};
