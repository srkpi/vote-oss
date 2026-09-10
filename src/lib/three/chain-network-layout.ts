import * as THREE from 'three';

/**
 * Small deterministic PRNG (mulberry32) so the network's layout is stable
 * across mounts/reloads instead of reshuffling on every page load — it
 * should read as a designed constellation, not random noise.
 */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface ChainNode {
  position: THREE.Vector3;
  phase: number;
  speed: number;
}

export interface ChainNetworkLayout {
  nodes: ChainNode[];
  /** Flat pairs of node indices, one pair per edge. */
  edges: [number, number][];
  /** Positions for a `LineSegments` geometry: two `Vector3`s per edge, in `edges` order. */
  edgePositions: Float32Array;
}

export interface ChainNetworkOptions {
  count?: number;
  seed?: number;
  /** Half-extents of the box nodes are scattered within. */
  bounds?: THREE.Vector3;
  /** Connect each node to its N nearest neighbors (deduplicated). */
  neighborsPerNode?: number;
}

/**
 * Builds a deterministic "distributed ledger" layout: nodes scattered
 * through a volume behind the main mark, connected to their nearest
 * neighbors — a stand-in for the ballot chain's hash-linked structure,
 * rendered as geometry rather than the 2D canvas noise it replaces.
 */
export function createChainNetworkLayout(options: ChainNetworkOptions = {}): ChainNetworkLayout {
  const {
    count = 30,
    seed = 1337,
    bounds = new THREE.Vector3(5.5, 3.2, 3.5),
    neighborsPerNode = 2,
  } = options;

  const random = mulberry32(seed);
  const nodes: ChainNode[] = [];

  for (let i = 0; i < count; i++) {
    // Scatter within an ellipsoid (not a box) so the network reads as a
    // cloud around the mark rather than a visibly rectangular volume.
    const u = random();
    const v = random();
    const theta = u * Math.PI * 2;
    const phi = Math.acos(2 * v - 1);
    const r = Math.cbrt(random()) * 0.92 + 0.08;

    const position = new THREE.Vector3(
      Math.sin(phi) * Math.cos(theta) * bounds.x * r,
      Math.cos(phi) * bounds.y * r,
      Math.sin(phi) * Math.sin(theta) * bounds.z * r - 1.2,
    );

    nodes.push({
      position,
      phase: random() * Math.PI * 2,
      speed: 0.4 + random() * 0.5,
    });
  }

  // Connect each node to its nearest `neighborsPerNode` neighbors,
  // deduplicating undirected pairs (a-b and b-a count once).
  const edgeSet = new Set<string>();
  const edges: [number, number][] = [];

  for (let i = 0; i < nodes.length; i++) {
    const distances = nodes
      .map((node, j) => ({ j, d: nodes[i].position.distanceTo(node.position) }))
      .filter(({ j }) => j !== i)
      .sort((a, b) => a.d - b.d)
      .slice(0, neighborsPerNode);

    for (const { j } of distances) {
      const key = i < j ? `${i}-${j}` : `${j}-${i}`;
      if (edgeSet.has(key)) continue;
      edgeSet.add(key);
      edges.push(i < j ? [i, j] : [j, i]);
    }
  }

  const edgePositions = new Float32Array(edges.length * 6);
  edges.forEach(([a, b], i) => {
    const pa = nodes[a].position;
    const pb = nodes[b].position;
    edgePositions.set([pa.x, pa.y, pa.z, pb.x, pb.y, pb.z], i * 6);
  });

  return { nodes, edges, edgePositions };
}
