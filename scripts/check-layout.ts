import { computeLayout, fovFor, LEAD } from "../src/layout";
import { techs } from "../src/data";
const L = computeLayout();
console.log("techs:", techs.length, "nodes:", L.nodes.length);
console.log("layer counts :", L.layerCount.join(", "));
console.log("layer radius :", L.layerRadius.map((r) => r.toFixed(1)).join(", "));
const ratio = Math.max(...L.layerRadius) / Math.min(...L.layerRadius);
console.log("radius ratio :", ratio.toFixed(2), "LEAD:", LEAD);
console.log("height:", L.height.toFixed(1), "maxRadius:", L.maxRadius.toFixed(1), "viewDist:", L.viewDistance.toFixed(1));
const fovs = L.layerRadius.map(fovFor);
console.log("fov          :", fovs.map((f) => f.toFixed(1)).join(", "));
console.log("clamped low  :", fovs.filter((f) => f <= 45.001).length, "/", fovs.length);
const gaps = L.layerY.map((y, i) => i === 0 ? y * 2 : (y - L.layerY[i - 1]) * 2);
console.log("layer gaps   :", gaps.map((g) => g.toFixed(1)).join(", "));
console.log("gap ratio    :", (Math.max(...gaps) / Math.min(...gaps)).toFixed(2));
// 层内最近距离
let worst = Infinity, bad = 0;
for (let e = 0; e < L.layerRadius.length; e++) {
  const pts = L.nodes.filter((n) => n.tech.eraIndex === e);
  let m = Infinity;
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
    const d = Math.hypot(pts[i].x - pts[j].x, pts[i].z - pts[j].z);
    if (d < m) m = d;
  }
  if (m < 3.53) bad++;
  if (m < worst) worst = m;
}
console.log("min node dist:", worst.toFixed(2), "(need 3.54) | layers under:", bad);
// 节点是否都在各自层半径内
let outOfRing = 0;
for (const n of L.nodes) if (n.radius > n.layerRadius * 1.11) outOfRing++;
console.log("nodes outside layer ring:", outOfRing);