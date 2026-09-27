import * as THREE from "three";
import { computeLayout, fovFor } from "./layout";
import type { Layout } from "./types";

export interface Stage {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  layout: Layout;
}

export function createStage(container: HTMLElement): Stage {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.setClearColor(0x0b0f16, 1);
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x0b0f16, 400, 1600);

  const camera = new THREE.PerspectiveCamera(fovFor(40), innerWidth / innerHeight, 0.5, 6000);

  // 光照：冷色环境 + 暖色主光，让塔身有体积感
  scene.add(new THREE.HemisphereLight(0x9fc6ff, 0x141a24, 1.15));
  const key = new THREE.DirectionalLight(0xffe6c0, 1.35);
  key.position.set(160, 320, 220);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x7fd7ff, 0.55);
  rim.position.set(-240, 120, -180);
  scene.add(rim);

  // 地面网格：给塔一个基座参照
  const grid = new THREE.PolarGridHelper(320, 16, 10, 96, 0x24313f, 0x1a232e);
  grid.position.y = -20;
  (grid.material as THREE.Material).transparent = true;
  (grid.material as THREE.Material).opacity = 0.5;
  scene.add(grid);

  addEventListener("resize", () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  return { renderer, scene, camera, layout: computeLayout() };
}