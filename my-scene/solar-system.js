/*
 * 自主实践：太阳系漫游（Three.js 版）
 * 主题：星球宇宙 —— 太阳、行星、星空组成一个完整的恒星系场景
 *
 * 第一步（本提交）：场景骨架
 *   场景 / 透视相机 / 渲染器 / 星空背景粒子 / 太阳 / 双光源 / 窗口 resize 适配 / 动画循环
 */

// ---------- 1. 场景 ----------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05070f); // 深夜空蓝黑色

// ---------- 2. 透视相机：fov / 宽高比 / 近裁剪面 / 远裁剪面 ----------
const camera = new THREE.PerspectiveCamera(
  50,
  window.innerWidth / window.innerHeight,
  0.1,
  500
);
camera.position.set(0, 6, 13); // 站在侧上方俯瞰太阳系
camera.lookAt(0, 0, 0);

// ---------- 3. 渲染器 ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // 高分屏不糊
document.getElementById('scene-container').appendChild(renderer.domElement);

// ---------- 4. 光源：环境光打底 + 太阳位置的点光源造型 ----------
// 环境光：弱，只保证行星背光面不是死黑
scene.add(new THREE.AmbientLight(0xffffff, 0.25));
// 点光源：放在太阳位置，向四周发光，模拟太阳照亮行星
const sunLight = new THREE.PointLight(0xfff2cc, 2, 100);
sunLight.position.set(0, 0, 0);
scene.add(sunLight);

// ---------- 5. 星空背景：2500 个点粒子组成的球壳 ----------
const starGeometry = new THREE.BufferGeometry();
const STAR_COUNT = 2500;
const starPositions = new Float32Array(STAR_COUNT * 3);
for (let i = 0; i < STAR_COUNT; i++) {
  // 在半径 60~120 的球壳内随机撒点
  const radius = 60 + Math.random() * 60;
  const theta = Math.random() * Math.PI * 2;       // 绕 y 轴方位角
  const phi = Math.acos(2 * Math.random() - 1);   // 与 y 轴夹角
  starPositions[i * 3]     = radius * Math.sin(phi) * Math.cos(theta);
  starPositions[i * 3 + 1] = radius * Math.cos(phi);
  starPositions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
}
starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
const starField = new THREE.Points(
  starGeometry,
  new THREE.PointsMaterial({ color: 0xffffff, size: 0.35, sizeAttenuation: true })
);
scene.add(starField);

// ---------- 6. 太阳：Basic 材质不受光，本身就是最亮的“光源本体” ----------
const sun = new THREE.Mesh(
  new THREE.SphereGeometry(1.2, 48, 48),
  new THREE.MeshBasicMaterial({ color: 0xffcc33 })
);
sun.userData.name = '太阳';
scene.add(sun);

// ---------- 7. 动画循环 ----------
const clock = new THREE.Clock(); // 按真实时间驱动，帧率不同速度也一致

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta(); // 距上一帧的秒数

  sun.rotation.y += delta * 0.25;      // 太阳缓慢自转
  starField.rotation.y += delta * 0.01; // 星空极缓慢转动，营造太空漂移感

  renderer.render(scene, camera);
}
animate();

// ---------- 8. 窗口 resize 适配：相机宽高比 + 投影矩阵 + 渲染器尺寸 三件套 ----------
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------- 9. 简易帧率显示，便于观察流畅度 ----------
const fpsElement = document.getElementById('fps');
let frameCount = 0;
let fpsTimer = 0;
const fpsClock = new THREE.Clock();
function updateFps() {
  requestAnimationFrame(updateFps);
  frameCount++;
  fpsTimer += fpsClock.getDelta();
  if (fpsTimer >= 0.5) {
    fpsElement.textContent = 'FPS: ' + Math.round(frameCount / fpsTimer);
    frameCount = 0;
    fpsTimer = 0;
  }
}
updateFps();
