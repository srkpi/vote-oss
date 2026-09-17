import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const EAR_L_BASE_OUTER = new THREE.Vector3(-0.5, 0.866, 0);
const EAR_L_TIP = new THREE.Vector3(-1.262, 1.353, 0);
const EAR_L_BASE_INNER = new THREE.Vector3(-0.866, 0.5, 0);
const EAR_R_BASE_OUTER = new THREE.Vector3(0.5, 0.866, 0);
const EAR_R_TIP = new THREE.Vector3(1.262, 1.353, 0);
const EAR_R_BASE_INNER = new THREE.Vector3(0.866, 0.5, 0);

const EYE_L = new THREE.Vector3(-0.3, 0.06, 0);
const EYE_R = new THREE.Vector3(0.3, 0.06, 0);
const NOSE = new THREE.Vector3(0, -0.2, 0);

const MOUTH_START = new THREE.Vector3(0, -0.3, 0);
const MOUTH_L = new THREE.Vector3(-0.186, -0.49, 0);
const MOUTH_R = new THREE.Vector3(0.186, -0.49, 0);

export interface CatgirlFaceGeometryOptions {
  radius?: number;
  tubeThickness?: number;
  ringSegments?: number;
  radialSegments?: number;
  capDetail?: number;
}

const DEFAULTS: Required<CatgirlFaceGeometryOptions> = {
  radius: 1,
  tubeThickness: 0.145,
  ringSegments: 220,
  radialSegments: 22,
  capDetail: 16,
};

function buildOpenTriStroke(
  a: THREE.Vector3,
  b: THREE.Vector3,
  c: THREE.Vector3,
  radius: number,
  tubeRadius: number,
  radialSegments: number,
  capDetail: number,
): THREE.BufferGeometry[] {
  const scale = (v: THREE.Vector3) => v.clone().multiplyScalar(radius);
  const [pa, pb, pc] = [scale(a), scale(b), scale(c)];

  const segA = new THREE.TubeGeometry(
    new THREE.LineCurve3(pa, pb),
    1,
    tubeRadius,
    radialSegments,
    false,
  );
  const segB = new THREE.TubeGeometry(
    new THREE.LineCurve3(pb, pc),
    1,
    tubeRadius,
    radialSegments,
    false,
  );

  const caps = [pa, pb, pc].map((center) => {
    const sphere = new THREE.SphereGeometry(tubeRadius, capDetail, capDetail);
    sphere.translate(center.x, center.y, center.z);
    return sphere;
  });

  return [segA, segB, ...caps];
}

export function createCatgirlFaceGeometry(
  options: CatgirlFaceGeometryOptions = {},
): THREE.BufferGeometry {
  const opts = { ...DEFAULTS, ...options };
  const { radius, ringSegments, radialSegments, capDetail } = opts;
  const tubeRadius = radius * opts.tubeThickness;

  const headCurve = new THREE.EllipseCurve(0, 0, radius, radius, 0, Math.PI * 2, false, 0);
  const headGeometry = new THREE.TubeGeometry(
    new PlanarEllipseCurve(headCurve),
    ringSegments,
    tubeRadius,
    radialSegments,
    true,
  );

  const earL = buildOpenTriStroke(
    EAR_L_BASE_OUTER,
    EAR_L_TIP,
    EAR_L_BASE_INNER,
    radius,
    tubeRadius,
    radialSegments,
    capDetail,
  );
  const earR = buildOpenTriStroke(
    EAR_R_BASE_OUTER,
    EAR_R_TIP,
    EAR_R_BASE_INNER,
    radius,
    tubeRadius,
    radialSegments,
    capDetail,
  );
  const mouth = buildOpenTriStroke(
    MOUTH_L,
    MOUTH_START,
    MOUTH_R,
    radius,
    tubeRadius,
    radialSegments,
    capDetail,
  );

  const dotGeometry = (center: THREE.Vector3, dotRadius: number) => {
    const sphere = new THREE.SphereGeometry(radius * dotRadius, capDetail, capDetail);
    const p = center.clone().multiplyScalar(radius);
    sphere.translate(p.x, p.y, p.z);
    return sphere;
  };
  const eyeL = dotGeometry(EYE_L, 0.11);
  const eyeR = dotGeometry(EYE_R, 0.11);
  const nose = dotGeometry(NOSE, 0.09);

  const merged = mergeGeometries([headGeometry, ...earL, ...earR, ...mouth, eyeL, eyeR, nose]);

  if (!merged) {
    throw new Error('createCatgirlFaceGeometry: failed to merge cat-face geometry');
  }

  merged.computeBoundingSphere();
  merged.computeBoundingBox();

  return merged;
}

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
