import * as THREE from "three";
import type { Layout } from "./types";

/**
 * 标签用 Canvas 图集 + 实例化 billboard。
 * 只给重要度 1~2 的条目上图集（285+432 条），其余靠悬停卡按需显示 ——
 * 1442 个标签同时画既看不清也拖性能。
 */
export interface LabelSet {
  mesh: THREE.InstancedMesh;
  indexOf: number[];
  setVisible: (visible: (i: number) => boolean) => void;
}

const ATLAS_COLS = 8, CELL_W = 256, CELL_H = 64;

export function buildLabels(layout: Layout, maxImportance = 2): LabelSet {
  const chosen: number[] = [];
  layout.nodes.forEach((n, i) => { if (n.tech.importance <= maxImportance) chosen.push(i); });

  const rows = Math.ceil(chosen.length / ATLAS_COLS);
  const canvas = document.createElement("canvas");
  canvas.width = ATLAS_COLS * CELL_W;
  canvas.height = rows * CELL_H;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = "600 30px ui-sans-serif, system-ui, 'Microsoft YaHei', sans-serif";
  ctx.textBaseline = "middle";
  chosen.forEach((nodeIdx, k) => {
    const cx = (k % ATLAS_COLS) * CELL_W, cy = Math.floor(k / ATLAS_COLS) * CELL_H;
    const label = layout.nodes[nodeIdx].tech.name;
    ctx.fillStyle = "rgba(10,14,20,0.72)";
    const w = Math.min(CELL_W - 8, ctx.measureText(label).width + 24);
    ctx.fillRect(cx + 4, cy + 10, w, 44);
    ctx.fillStyle = "#e8f1ff";
    ctx.fillText(label, cx + 16, cy + 32);
  });
  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 4;

  const geo = new THREE.PlaneGeometry(CELL_W / CELL_H * 6.4, 6.4);
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
  const mesh = new THREE.InstancedMesh(geo, mat, chosen.length);
  mesh.frustumCulled = false;

  const m = new THREE.Matrix4();
  const uv = new Float32Array(chosen.length * 4);
  chosen.forEach((nodeIdx, k) => {
    const n = layout.nodes[nodeIdx];
    m.makeTranslation(n.x, n.y + 4.2, n.z);
    mesh.setMatrixAt(k, m);
    const c = k % ATLAS_COLS, r = Math.floor(k / ATLAS_COLS);
    uv[k * 4 + 0] = c / ATLAS_COLS;
    uv[k * 4 + 1] = 1 - (r + 1) / rows;
    uv[k * 4 + 2] = (c + 1) / ATLAS_COLS;
    uv[k * 4 + 3] = 1 - r / rows;
  });
  geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));

  return {
    mesh, indexOf: chosen,
    setVisible: (visible) => {
      chosen.forEach((nodeIdx, k) => {
        const n = layout.nodes[nodeIdx];
        const on = visible(nodeIdx) ? 1 : 0.0001;
        m.makeTranslation(n.x, n.y + 4.2, n.z);
        m.scale(new THREE.Vector3(on, on, on));
        mesh.setMatrixAt(k, m);
      });
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}

/** 每帧把标签转成面向相机（billboard） */
export function faceLabels(set: LabelSet, layout: Layout, camera: THREE.Camera) {
  const q = new THREE.Quaternion();
  const m = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  const scale = new THREE.Vector3();
  camera.getWorldQuaternion(q);
  set.indexOf.forEach((nodeIdx, k) => {
    const n = layout.nodes[nodeIdx];
    pos.set(n.x, n.y + 4.2, n.z);
    m.compose(pos, q, scale.setScalar(1));
    set.mesh.setMatrixAt(k, m);
  });
  set.mesh.instanceMatrix.needsUpdate = true;
}