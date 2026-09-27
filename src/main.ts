import * as THREE from "three";
import { techs, eras, categories, categoryById } from "./data";
import { createStage } from "./scene";
import { Orbit } from "./controls";
import { Polyhedra } from "./polyhedra";
import { buildLabels, faceLabels } from "./labels";
import { buildEdges, prereqLinks } from "./edges";
import { Tour } from "./tour";

/* 22 个领域的固定色相：按 6 个分组给色相区间，组内均匀铺开 --------------- */
const GROUP_HUE: Record<string, [number, number]> = {
  A: [200, 232], B: [168, 196], C: [268, 318], D: [32, 58], E: [96, 136], F: [340, 366],
};
const catColors = (() => {
  const byGroup: Record<string, string[]> = {};
  for (const c of categories) (byGroup[c.group] ??= []).push(c.id);
  const map = new Map<string, THREE.Color>();
  for (const [g, ids] of Object.entries(byGroup)) {
    const [h0, h1] = GROUP_HUE[g] ?? [200, 230];
    ids.forEach((id, i) => {
      const h = (h0 + (h1 - h0) * (ids.length === 1 ? 0.5 : i / (ids.length - 1))) % 360;
      map.set(id, new THREE.Color().setHSL(h / 360, 0.62, 0.58));
    });
  }
  return map;
})();
const colorOfCat = (ci: number) => catColors.get(categories[ci].id) ?? new THREE.Color(0x9ab);

const stage = createStage(document.getElementById("app")!);
const { renderer, scene, camera, layout } = stage;

const poly = new Polyhedra(layout, colorOfCat);
scene.add(poly.group);

const labels = buildLabels(layout, 2);
scene.add(labels.mesh);

const links = prereqLinks(layout);
const edges = buildEdges(layout, links);
scene.add(edges.mesh);

const orbit = new Orbit(renderer.domElement, camera);
orbit.distance = layout.viewDistance * 0.72;
orbit.targetY = layout.height * 0.42;
const tour = new Tour(layout);

/* 筛选状态 ---------------------------------------------------------------- */
const activeCats = new Set(categories.map((c) => c.id));
const activeKinds = new Set<string>();
const onlyIndependent = { on: false };
let hovered = -1;

function passes(i: number): boolean {
  const t = techs[i];
  if (!activeCats.has(t.category)) return false;
  if (activeKinds.size && !activeKinds.has(t.kind)) return false;
  if (onlyIndependent.on && t.status !== "independent") return false;
  return true;
}

const baseColor = new Map<number, THREE.Color>();
layout.nodes.forEach((n, i) => baseColor.set(i, colorOfCat(n.tech.categoryIndex)));

function repaint() {
  poly.recolor((i) => {
    if (i === hovered) return { color: new THREE.Color(0xfff3d0), dim: 1 };
    if (!passes(i)) return { color: baseColor.get(i)!, dim: 0.13 };
    return { color: baseColor.get(i)!, dim: 1 };
  });
  labels.setVisible((i) => passes(i));
}

/* 图例 -------------------------------------------------------------------- */
const GROUP_NAME: Record<string, string> = {
  A: "基础与公理", B: "无穷的结构", C: "大基数与内模型",
  D: "分支与结构", E: "交叉接口", F: "哲学与元数学",
};
const legend = document.getElementById("legend")!;
const counts = new Map<string, number>();
for (const t of techs) counts.set(t.category, (counts.get(t.category) ?? 0) + 1);
legend.innerHTML =
  `<h1>集合论科技树</h1><div class="sub">${techs.length} 条 / ${eras.length} 个时代 / ${categories.length} 个领域</div>` +
  Object.entries(GROUP_NAME).map(([g, gname]) => {
    const items = categories.filter((c) => c.group === g).map((c) => {
      const col = "#" + colorOfCat(categories.indexOf(c)).getHexString();
      return `<div class="cat" data-cat="${c.id}"><span class="dot" style="background:${col}"></span>` +
        `<span>${c.name}</span><span class="n">${counts.get(c.id) ?? 0}</span></div>`;
    }).join("");
    return `<div class="grp">${gname}</div>${items}`;
  }).join("");
legend.addEventListener("click", (e) => {
  const el = (e.target as HTMLElement).closest(".cat") as HTMLElement | null;
  if (!el) return;
  const id = el.dataset.cat!;
  if (activeCats.has(id)) activeCats.delete(id); else activeCats.add(id);
  el.classList.toggle("off", !activeCats.has(id));
  repaint();
});
// 默认关闭两个极小的领域，避免图例过长时视觉噪声
for (const id of ["set_topology", "set_algebra"]) {
  activeCats.delete(id);
  legend.querySelector(`[data-cat="${id}"]`)?.classList.add("off");
}

/* HUD 控件 ----------------------------------------------------------------- */
const hud = document.getElementById("hud")!;
const KINDS = ["概念", "公理", "定理", "方法", "悖论", "问题", "系统"];
hud.innerHTML =
  `<button id="tour">▶ 漫游</button>` +
  `<button id="ind">仅独立命题</button>` +
  `<div class="row">${KINDS.map((k) => `<button data-kind="${k}">${k}</button>`).join("")}</div>` +
  `<button id="reset">重置视角</button>`;
hud.querySelector("#tour")!.addEventListener("click", () => {
  if (tour.playing) { tour.pause(); (hud.querySelector("#tour") as HTMLElement).textContent = "▶ 漫游"; }
  else { tour.play(); (hud.querySelector("#tour") as HTMLElement).textContent = "⏸ 暂停"; }
});
hud.querySelector("#ind")!.addEventListener("click", (e) => {
  onlyIndependent.on = !onlyIndependent.on;
  (e.target as HTMLElement).classList.toggle("on", onlyIndependent.on);
  repaint();
});
hud.querySelector("#reset")!.addEventListener("click", () => {
  tour.reset(); orbit.theta = 0; orbit.phi = 0.42;
  orbit.distance = layout.viewDistance * 0.72; orbit.targetY = layout.height * 0.42;
  (hud.querySelector("#tour") as HTMLElement).textContent = "▶ 漫游";
  repaint();
});
hud.querySelectorAll("[data-kind]").forEach((b) => b.addEventListener("click", () => {
  const k = (b as HTMLElement).dataset.kind!;
  if (activeKinds.has(k)) activeKinds.delete(k); else activeKinds.add(k);
  (b as HTMLElement).classList.toggle("on", activeKinds.has(k));
  repaint();
}));

/* 悬停卡 ------------------------------------------------------------------- */
const card = document.getElementById("card")!;
const ray = new THREE.Raycaster();
const ptr = new THREE.Vector2(-9, -9);
renderer.domElement.addEventListener("pointermove", (e) => {
  ptr.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
});

function pickNode(): number {
  ray.setFromCamera(ptr, camera);
  let best = -1, bestD = Infinity;
  for (const n of layout.nodes) {
    const d = ray.ray.distanceSqToPoint(new THREE.Vector3(n.x, n.y, n.z));
    if (d < 9 && d < bestD) { bestD = d; best = n.tech.index; }
  }
  return best;
}

function showCard(i: number) {
  if (i < 0) { card.hidden = true; return; }
  const t = techs[i];
  const cat = categoryById.get(t.category)!;
  card.hidden = false;
  card.classList.toggle("empty", !t.desc);
  card.innerHTML =
    `<h2>${t.name}</h2><div class="en">${t.nameEn}</div>` +
    `<div class="meta"><span class="tag hot">${t.year}</span>` +
    `<span class="tag">${cat.name}</span><span class="tag">${t.kind}</span>` +
    `<span class="tag">重要度 ${t.importance}</span>` +
    (t.status !== "-" ? `<span class="tag">${t.status}</span>` : "") +
    `</div>` +
    `<div class="desc">${t.desc || "（desc 尚未撰写）"}</div>` +
    (t.year_note ? `<div class="note">${t.year_note}</div>` : "");
}

/* 主循环 ------------------------------------------------------------------- */
repaint();
const clock = new THREE.Clock();
let lastHover = -1;

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  const st = tour.update(dt);
  if (tour.playing || tour.t > 0) {
    orbit.enabled = false;
    // 视线朝下：相机高于注视点，水平距离由层半径决定
    const horiz = st.distance * 0.82;
    orbit.theta += dt * 0.075;
    orbit.distance = Math.hypot(horiz, st.distance * 0.55);
    orbit.phi = Math.atan2(st.distance * 0.55, horiz) + 0.12;
    orbit.targetY = st.y;
    camera.fov = Math.min(125, Math.max(45, 62 * st.fovScale));
    camera.updateProjectionMatrix();
  } else {
    orbit.enabled = true;
    if (Math.abs(camera.fov - 62) > 0.1) { camera.fov = 62; camera.updateProjectionMatrix(); }
  }
  orbit.update(dt);
  edges.setProgress(tour.playing || tour.t > 0 ? st.t : 1);
  faceLabels(labels, layout, camera);

  const h = pickNode();
  if (h !== lastHover) { lastHover = h; hovered = h; showCard(h); repaint(); }

  renderer.render(scene, camera);
}
frame();