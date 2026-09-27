import * as THREE from "three";
import { importanceScale, polyRadius } from "./layout";
import type { Layout } from "./types";

/** 重要度 1..5 → 面数递减的柏拉图立体：越基础面越多、块越大 */
export const TIER_GEOMETRY = [
  new THREE.IcosahedronGeometry(1, 0),   // 20 面
  new THREE.DodecahedronGeometry(1, 0),  // 12 面
  new THREE.OctahedronGeometry(1, 0),    // 8 面
  new THREE.BoxGeometry(1.5, 1.5, 1.5),  // 6 面
  new THREE.TetrahedronGeometry(1.1, 0), // 4 面
];

export interface Ring {
  mesh: THREE.InstancedMesh;
  /** 实例 i 对应的 tech 下标 */
  indexOf: number[];
}

export class Polyhedra {
  readonly tiers: Ring[] = [];
  readonly group = new THREE.Group();
  private color = new THREE.Color();

  constructor(private layout: Layout, categoryColor: (ci: number) => THREE.Color) {
    const buckets: number[][] = TIER_GEOMETRY.map(() => []);
    layout.nodes.forEach((n, i) => {
      const tier = THREE.MathUtils.clamp(n.tech.importance, 1, 5) - 1;
      buckets[tier].push(i);
    });

    buckets.forEach((idxs, tier) => {
      const geo = TIER_GEOMETRY[tier];
      const mat = new THREE.MeshStandardMaterial({
        metalness: 0.25, roughness: 0.42, flatShading: true, vertexColors: true,
      });
      const mesh = new THREE.InstancedMesh(geo, mat, Math.max(idxs.length, 1));
      const m = new THREE.Matrix4(), q = new THREE.Quaternion();
      const s = new THREE.Vector3(), p = new THREE.Vector3();
      idxs.forEach((nodeIdx, k) => {
        const n = layout.nodes[nodeIdx];
        const scale = importanceScale(n.tech.importance) * polyRadius(n.tech.importance) / 1.5;
        p.set(n.x, n.y, n.z);
        q.setFromEuler(new THREE.Euler(0.4 * k, 0.9 * k, 0.2 * k));
        s.setScalar(scale);
        m.compose(p, q, s);
        mesh.setMatrixAt(k, m);
        mesh.setColorAt(k, this.color.copy(categoryColor(n.tech.categoryIndex)));
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.count = idxs.length;
      this.group.add(mesh);
      this.tiers.push({ mesh, indexOf: idxs });
    });
  }

  /** 只改颜色不改位置：筛选、悬停高亮都走这里 */
  recolor(pick: (i: number) => { color: THREE.Color; dim: number }) {
    this.tiers.forEach((ring) => {
      ring.indexOf.forEach((nodeIdx, k) => {
        const r = pick(nodeIdx);
        const c = this.color.copy(r.color).multiplyScalar(r.dim);
        ring.mesh.setColorAt(k, c);
      });
      if (ring.mesh.instanceColor) ring.mesh.instanceColor.needsUpdate = true;
    });
  }
}