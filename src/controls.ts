import * as THREE from "three";

/**
 * 极简轨道相机。自己写而不是用 three/examples 的 OrbitControls：
 * 漫游需要「相机绕塔飞、始终看向塔内一点」这种受控轨迹，
 * OrbitControls 的自由旋转会与之打架。
 */
export class Orbit {
  theta = 0;          // 方位角
  phi = 0.42;         // 仰角（0 = 水平）
  distance = 700;     // 距塔心距离
  targetY = 0;        // 看向的高度
  private dragging = false;
  private px = 0; private py = 0;
  autoRotate = 0.0;   // rad/s
  enabled = true;

  constructor(private dom: HTMLElement, private camera: THREE.PerspectiveCamera) {
    dom.addEventListener("pointerdown", (e) => {
      if (!this.enabled) return;
      this.dragging = true; this.px = e.clientX; this.py = e.clientY;
      dom.setPointerCapture(e.pointerId);
    });
    dom.addEventListener("pointermove", (e) => {
      if (!this.dragging || !this.enabled) return;
      const dx = e.clientX - this.px, dy = e.clientY - this.py;
      this.px = e.clientX; this.py = e.clientY;
      this.theta -= dx * 0.005;
      this.phi = THREE.MathUtils.clamp(this.phi + dy * 0.004, -1.35, 1.35);
    });
    const stop = (e: PointerEvent) => { this.dragging = false; try { dom.releasePointerCapture(e.pointerId); } catch {} };
    dom.addEventListener("pointerup", stop);
    dom.addEventListener("pointercancel", stop);
    dom.addEventListener("wheel", (e) => {
      if (!this.enabled) return;
      this.distance = THREE.MathUtils.clamp(this.distance * (1 + Math.sign(e.deltaY) * 0.08), 120, 2600);
    }, { passive: true });
  }

  update(dt: number) {
    if (this.autoRotate) this.theta += this.autoRotate * dt;
    const cp = Math.cos(this.phi), sp = Math.sin(this.phi);
    this.camera.position.set(
      Math.cos(this.theta) * cp * this.distance,
      this.targetY + sp * this.distance,
      Math.sin(this.theta) * cp * this.distance,
    );
    this.camera.lookAt(0, this.targetY, 0);
  }
}