import type { Layout } from "./types";

/**
 * 漫游排期：从塔底年代向上升，视线恒定朝下（俯角约 -28°），
 * 相机领先当前年代一点，避免遮挡正在显现的层。
 */
export interface TourState {
  t: number;          // 0..1 进度
  y: number;          // 相机注视高度
  distance: number;   // 水平距离
  fovScale: number;   // 视场缩放（层半径大时收紧）
  activeEra: number;
}

export class Tour {
  playing = false;
  t = 0;
  speed = 0.045;                  // 每秒进度
  private layout: Layout;
  constructor(layout: Layout) { this.layout = layout; }

  get startViewDistance() { return this.layout.viewDistance; }

  update(dt: number): TourState {
    const L = this.layout;
    if (this.playing) {
      this.t = Math.min(1, this.t + dt * this.speed);
      if (this.t >= 1) this.playing = false;
    }
    const y = -0.06 * L.height + this.t * 1.12 * L.height;
    // 当前年代索引（按高度反查）
    let e = 0;
    for (let i = 0; i < L.layerY.length; i++) if (L.layerY[i] <= y) e = i;
    const R = L.layerRadius[e];
    // LEAD=42 的等效：让视场随层半径呼吸
    const fov = Math.min(125, Math.max(45, 2 * Math.atan((1.1 * R) / 42) * 180 / Math.PI));
    const baseFov = 62;
    return {
      t: this.t, y, distance: (baseFov / fov) * L.viewDistance * 0.62,
      fovScale: baseFov / fov, activeEra: e,
    };
  }
  play() { this.playing = true; if (this.t >= 1) this.t = 0; }
  pause() { this.playing = false; }
  reset() { this.t = 0; this.playing = false; }
}