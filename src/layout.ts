import { techs, eras, categories } from "./data";
import type { Layout, Positioned } from "./types";

/* ---------------------------------------------------------------------------
 * 圆柱塔布局。
 *
 * 两个常量必须按本项目数据标定，不能沿用为别处数据调的数值：
 *
 * (1) 层间距 gap = min(42, 14 + n*0.45)
 *     原型用 min(42, 22 + n*0.08)，因为原型每层 81~876 条。本项目每层 8~183 条，
 *     原公式的低端几乎不起作用（43 条与 183 条只差 3.5）。实测改 (14, 0.45) 后
 *     层厚比值 1.53，视觉上「近代层更厚」才成立。
 *
 * (2) 漫游 LEAD = 42
 *     视场 fov = 2*atan(1.1*R/LEAD) 钳制在 [45,125]（宽银幕纵向 45° 对应横向约 75°）。
 *     本项目实测各层半径 13.2~52.6；LEAD=42 给 fov 45~108°，与原型的 45.6~109°
 *     呼吸幅度相当。若沿用原型的 LEAD=130，最外层只到 48°，13 层里 4 层被钳到下限，
 *     视场呼吸完全消失。
 * ------------------------------------------------------------------------- */

const INNER_RATIO = 0.28;      // 最内层半径比例：中轴线留作漫游相机通道
const SECTOR_FILL = 0.84;      // 扇区角向留 16% 的缝，相邻领域看得见分界
const AREA_FILL = 0.42;        // 环带上的目标面积填充率（松弛前的起点）
const BASE_RADIUS = 42.0;      // 半径基数
const RADIUS_EXP = 0.65;       // 条数 -> 半径的幂次
const GAP_BASE = 11.0, GAP_COEF = 0.32, GAP_MAX = 36.0;
const POLY_RADIUS_XL = 2.1, POLY_RADIUS_STD = 1.5;
const NODE_CLEARANCE = 1.18;   // 节点最小间距系数（相对多面体直径）
const RELAX_ITERS = 70;        // 松弛迭代上限
const OUTER_SLACK = 1.10;      // 松弛后允许的最大半径外扩
/* 塔的粗细比 --------------------------------------------------------------
 * 半径与外扩系数是「装得下」的下限，直接用它塔会细成 10:1 的针
 * （实测 maxR 54.8 / 高 559），而原型的比例是 3.4:1。
 * 按比例放大半径即可把塔「撑胖」，节点间距同比变松、更易读。
 * 2.6 倍 + 收紧层间距 → maxR ≈ 126 / 高 ≈ 458，比例 ≈ 3.6:1，与原型的 3.4:1 相当。
 * -------------------------------------------------------------------------- */
const RADIUS_SCALE = 2.6;

export const LEAD = 109.0;  // = 42 × RADIUS_SCALE，保持视场分布不变
export const FOV_MIN = 45, FOV_MAX = 125;

export function importanceScale(i: number): number { return 1.9 - (i - 1) * 0.35; }
export function polyRadius(i: number): number { return i === 1 ? POLY_RADIUS_XL : POLY_RADIUS_STD; }

const SLOT = 2 * POLY_RADIUS_STD * NODE_CLEARANCE;

export function computeLayout(): Layout {
  const E = eras.length, K = categories.length;
  const counts = new Array(E).fill(0) as number[];
  const per: number[][][] = Array.from({ length: E }, () =>
    Array.from({ length: K }, () => [] as number[]));
  for (const t of techs) { counts[t.eraIndex]++; per[t.eraIndex][t.categoryIndex].push(t.index); }

  const layerRadius: number[] = [];
  const placed: number[][][] = []; // [x, z] per node index

  for (let e = 0; e < E; e++) {
    const total = counts[e];
    // 紧凑起步：按节点总面积反解半径（松弛会把它撑开一点）
    const area = per[e].reduce((s, g) => s + g.length * Math.PI * POLY_RADIUS_STD * POLY_RADIUS_STD, 0);
    let R = Math.sqrt(area / (Math.PI * (1 - INNER_RATIO * INNER_RATIO) * AREA_FILL));
    const minR = BASE_RADIUS * 0.35; // 避免极小层退化
    R = Math.max(R, minR);

    let pts: number[][] = [];
    let ok = false;
    for (let attempt = 0; attempt < 14 && !ok; attempt++) {
      pts = seedRing(e, R, total, per[e]);
      relax(pts, R);
      const actual = Math.max(...pts.map((p) => Math.hypot(p[0], p[1])), R);
      R = Math.max(R, actual);
      ok = minDist(pts) >= SLOT - 1e-6;
      if (!ok) R *= 1.04;
    }
    layerRadius.push(R * RADIUS_SCALE);
    placed.push(pts.map((p) => [p[0] * RADIUS_SCALE, p[1] * RADIUS_SCALE]));
  }

  const gaps = counts.map((c) => Math.min(GAP_MAX, GAP_BASE + c * GAP_COEF));
  const layerY: number[] = [];
  let acc = 0;
  for (let e = 0; e < E; e++) { layerY.push(acc + gaps[e] / 2); acc += gaps[e]; }
  const height = acc;

  const nodes: Positioned[] = new Array(techs.length);
  for (let e = 0; e < E; e++) {
    const idxOf: number[] = [];
    for (let ci = 0; ci < K; ci++) for (const i of per[e][ci]) idxOf.push(i);
    for (let j = 0; j < idxOf.length; j++) {
      const idx = idxOf[j], p = placed[e][j];
      const t = techs[idx];
      nodes[idx] = {
        tech: t, x: p[0], y: layerY[e], z: p[1],
        layerRadius: layerRadius[e],
        angle: Math.atan2(p[1], p[0]),
        radius: Math.hypot(p[0], p[1]),
      };
    }
  }

  const maxRadius = Math.max(...layerRadius);
  const viewDistance = 2.03 * Math.hypot(maxRadius, height / 2);
  return { nodes, eras, categories, layerY, layerRadius, layerCount: counts, height, maxRadius, viewDistance };
}

// 环形播种：每个领域的扇区宽度 = 该领域在本层的占比
function seedRing(e: number, R: number, total: number, groups: number[][]): number[][] {
  const inner = R * INNER_RATIO;
  const fill = 2 * Math.PI * SECTOR_FILL;
  let cursor = -Math.PI / 2;
  const out: number[][] = [];
  for (const g of groups) {
    const n = g.length;
    if (!n) continue;
    const sector = (fill * n) / total;
    const slots = Math.max(1, Math.floor((sector * R) / SLOT));
    const rings = Math.max(1, Math.ceil(n / slots));
    for (let i = 0; i < n; i++) {
      const ring = Math.floor(i / slots), slot = i % slots;
      const inThis = Math.min(slots, n - ring * slots);
      const rr = rings === 1 ? R : inner + (R - inner) * ((ring + 0.5) / rings);
      const a = cursor + (sector * (slot + 0.5)) / inThis;
      out.push([Math.cos(a) * rr, Math.sin(a) * rr]);
    }
    cursor += sector;
  }
  return out;
}

// 松弛：把距离小于 SLOT 的节点对推开，并把半径夹回 [inner, outer]
function relax(pts: number[][], R: number): void {
  const inner = R * INNER_RATIO, outer = R * OUTER_SLACK;
  for (let it = 0; it < RELAX_ITERS; it++) {
    let moved = false;
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const dx = pts[j][0] - pts[i][0], dy = pts[j][1] - pts[i][1];
        const d = Math.hypot(dx, dy);
        if (d < SLOT && d > 1e-9) {
          const push = ((SLOT - d) / 2) * 1.02, ux = dx / d, uy = dy / d;
          pts[i][0] -= ux * push; pts[i][1] -= uy * push;
          pts[j][0] += ux * push; pts[j][1] += uy * push;
          moved = true;
        }
      }
    }
    for (const p of pts) {
      const r = Math.hypot(p[0], p[1]);
      if (r > outer) { p[0] *= outer / r; p[1] *= outer / r; }
      else if (r < inner) {
        if (r < 1e-9) { p[0] = inner; p[1] = 0; }
        else { p[0] *= inner / r; p[1] *= inner / r; }
      }
    }
    if (!moved) break;
  }
}

function minDist(pts: number[][]): number {
  let m = Infinity;
  for (let i = 0; i < pts.length; i++)
    for (let j = i + 1; j < pts.length; j++) {
      const d = Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]);
      if (d < m) m = d;
    }
  return m;
}

export function fovFor(radius: number): number {
  return Math.min(FOV_MAX, Math.max(FOV_MIN, 2 * Math.atan((1.1 * radius) / LEAD) * 180 / Math.PI));
}