import * as THREE from "three";
import type { Layout } from "./types";

/**
 * 依赖边：在跨越层高时画二次贝塞尔弧（向外偏一点），
 * 同层内画直线。原型这么做是为了让「竖向的因果关系」在塔里读得出来。
 */
export interface EdgeSet {
  mesh: THREE.LineSegments;
  /** 每条边到「该边终点显现时刻」的时间戳，供漫游生长用 */
  appearAt: number[];
  count: number;
  setProgress: (t: number) => void;
}

export function buildEdges(layout: Layout, links: Array<[number, number]>): EdgeSet {
  const positions = new Float32Array(links.length * 2 * 3);
  const appearAt: number[] = [];
  const v = new THREE.Vector3();
  const times = layout.nodes.map((n) => n.tech.year);

  links.forEach(([a, b], i) => {
    const A = layout.nodes[a], B = layout.nodes[b];
    positions.set([A.x, A.y, A.z], i * 6);
    if (Math.abs(A.y - B.y) < 1e-6) {
      positions.set([B.x, B.y, B.z], i * 6 + 3);
    } else {
      // 二次贝塞尔：控制点取两端中点、径向外推 18%
      const mid = new THREE.Vector2((A.x + B.x) / 2, (A.z + B.z) / 2);
      const len = mid.length() || 1;
      const ctrl = new THREE.Vector3(mid.x / len * (len * 1.18), (A.y + B.y) / 2, mid.y / len * (len * 1.18));
      const t = 0.5;
      v.set(
        (1 - t) * (1 - t) * A.x + 2 * (1 - t) * t * ctrl.x + t * t * B.x,
        (1 - t) * (1 - t) * A.y + 2 * (1 - t) * t * ctrl.y + t * t * B.y,
        (1 - t) * (1 - t) * A.z + 2 * (1 - t) * t * ctrl.z + t * t * B.z,
      );
      positions.set([v.x, v.y, v.z], i * 6 + 3);
    }
    appearAt.push(Math.max(times[a], times[b]));
  });

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.LineBasicMaterial({ color: 0x6f8cab, transparent: true, opacity: 0.42 });
  const mesh = new THREE.LineSegments(geo, mat);

  const minT = Math.min(...appearAt, 0), maxT = Math.max(...appearAt, 1);
  return {
    mesh, appearAt, count: links.length,
    setProgress: (t: number) => {
      const cut = minT + (maxT - minT) * t;
      geo.setDrawRange(0, links.length * 2 * (t >= 1 ? 1 : 0));
      // 用顶点组控制显隐：把超过 cut 的边退化（两端同点）
      const arr = geo.getAttribute("position") as THREE.BufferAttribute;
      const a = arr.array as Float32Array;
      for (let i = 0; i < links.length; i++) {
        if (appearAt[i] > cut) { a[i * 6 + 3] = a[i * 6 + 0]; a[i * 6 + 4] = a[i * 6 + 1]; a[i * 6 + 5] = a[i * 6 + 2]; }
      }
      arr.needsUpdate = true;
      geo.setDrawRange(0, links.length * 2);
    },
  };
}

/** 由 prereqs 生成边；related 不画（会变成毛线团） */
export function prereqLinks(layout: Layout): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (const n of layout.nodes) for (const p of n.tech.prereqIdx) out.push([p, n.tech.index]);
  return out;
}