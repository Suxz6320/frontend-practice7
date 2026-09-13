/*
 * 自主实践：太阳系漫游（Three.js 版）
 * 主题：星球宇宙 —— 太阳、行星、星空组成一个完整的恒星系场景
 *
 * 第一步：场景骨架 —— 场景 / 相机 / 渲染器 / 星空 / 太阳 / 光源 / resize
 * 第二步：行星系统 —— 数据驱动生成六颗行星、轨道指示环、
 *   土星光环（Torus）、地月嵌套公转，以及支点 Group 公转动画
 * 第三步（本提交）：独立研究 —— OrbitControls 拖拽旋转/滚轮缩放，
 *   Raycaster 射线拾取实现点击行星高亮并显示跟随信息标签
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

// ---------- 3.1 轨道控制器 OrbitControls（独立研究任务1）----------
// 引入方式：index.html 中在 three.min.js 之后用 script 标签引入 examples/js 版
// OrbitControls.js（非 module 版会挂到 THREE.OrbitControls 全局）
// 关键配置：阻尼惯性、最近/最远距离限制、右键平移
const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;      // 开启阻尼，松手后有惯性，旋转更顺滑
controls.dampingFactor = 0.06;      // 阻尼系数，越小滑得越久
controls.minDistance = 3;           // 最近不能钻进太阳内部
controls.maxDistance = 40;          // 最远仍能看全整个星系
controls.enablePan = true;          // 允许右键平移
renderer.domElement.style.cursor = 'grab';

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
sun.userData = { name: '太阳', desc: '太阳系的中心天体，行星的光与热都来自这里' };
scene.add(sun);

// ---------- 7. 行星系统 ----------
// 数据驱动：每颗行星一条配置，循环生成，避免手写六个相似物体
// speed 是相对公转速度，动画时再统一乘系数
const PLANET_DATA = [
  { name: '水星', radius: 0.18, color: 0xa8a29a, orbit: 2.2, speed: 1.55, desc: '离太阳最近、公转最快的行星' },
  { name: '金星', radius: 0.30, color: 0xe8c27a, orbit: 3.0, speed: 1.15, desc: '夜空中最亮的行星' },
  { name: '地球', radius: 0.32, color: 0x4f9df7, orbit: 3.9, speed: 0.85, desc: '我们的家园，带着一颗卫星月球', hasMoon: true },
  { name: '火星', radius: 0.24, color: 0xe5703a, orbit: 4.8, speed: 0.65, desc: '布满铁锈色沙漠的红色行星' },
  { name: '木星', radius: 0.70, color: 0xd8a878, orbit: 6.1, speed: 0.40, desc: '太阳系体积最大的行星' },
  { name: '土星', radius: 0.60, color: 0xe3d6a8, orbit: 7.5, speed: 0.30, desc: '带着明亮光环的气态巨行星', hasRing: true }
];

const planets = []; // 集中保存所有可动画、可交互的天体（含太阳）
planets.push(sun);

PLANET_DATA.forEach(data => {
  // 公转支点：一个位于太阳中心的空 Group，
  // 行星挂在它的 +x 方向；动画里只转 Group，行星便沿圆周公转
  const pivot = new THREE.Group();
  pivot.rotation.y = Math.random() * Math.PI * 2; // 初始相位随机，避免排成一条线
  scene.add(pivot);

  const planet = new THREE.Mesh(
    new THREE.SphereGeometry(data.radius, 32, 32),
    new THREE.MeshStandardMaterial({ color: data.color, roughness: 0.85, metalness: 0.05 })
  );
  planet.position.x = data.orbit;
  planet.userData = {
    name: data.name,
    desc: data.desc,
    baseColor: data.color,
    pivot: pivot,
    orbitSpeed: data.speed
  };
  pivot.add(planet);

  // 轨道指示环：很细的 RingGeometry 旋转放平，让公转轨迹一目了然
  const orbitRing = new THREE.Mesh(
    new THREE.RingGeometry(data.orbit - 0.015, data.orbit + 0.015, 96),
    new THREE.MeshBasicMaterial({
      color: 0x6ea8ff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.35
    })
  );
  orbitRing.rotation.x = -Math.PI / 2; // 环默认立在 xy 平面，绕 x 轴放平
  scene.add(orbitRing);

  if (data.hasRing) {
    // 土星光环：Torus（圆环体）倾斜后挂到行星身上，随行星一起公转
    const saturnRing = new THREE.Mesh(
      new THREE.TorusGeometry(data.radius * 1.6, data.radius * 0.18, 16, 80),
      new THREE.MeshStandardMaterial({ color: 0xcdb98c, roughness: 0.9 })
    );
    saturnRing.rotation.x = Math.PI / 2.6;
    planet.add(saturnRing);
  }

  if (data.hasMoon) {
    // 地月系统：月球公转支点再嵌套在地球下，形成层级变换
    const moonPivot = new THREE.Group();
    planet.add(moonPivot);
    const moon = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 16, 16),
      new THREE.MeshStandardMaterial({ color: 0xcfcfcf, roughness: 1 })
    );
    moon.position.x = 0.62;
    moonPivot.add(moon);
    planet.userData.moonPivot = moonPivot;
  }

  planets.push(planet);
});

// ---------- 7.5 点击交互：Raycaster 射线拾取（独立研究任务2）----------
// 原理：浏览器只知道鼠标在二维屏幕上的位置，无法直接点中三维物体。
// Raycaster 从相机光心出发、穿过鼠标所在的 NDC 坐标发射一条三维射线，
// 再逐一对物体包围球/三角面求交，intersectObjects 返回按距离排序的命中列表，
// 取第一个即“最前面的物体”。
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const label = document.getElementById('planet-label');
let selected = null;
const labelWorld = new THREE.Vector3(); // 复用，避免每帧 new 对象

// 从鼠标事件找出被点中的行星（命中光环/月球等子物体时向上回溯到行星本体）
function pickPlanet(event) {
  // 屏幕像素坐标 -> NDC 归一化设备坐标，x/y 都在 -1 ~ 1
  pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, camera); // 生成射线
  const hits = raycaster.intersectObjects(planets, true); // true：递归检测子物体
  if (hits.length === 0) return null;
  let obj = hits[0].object;
  while (obj && !obj.userData.name) obj = obj.parent;
  return obj || null;
}

// 选中高亮：受光材质加自发光 + 整体放大；太阳是 Basic 材质只放大
function setSelection(planet) {
  if (selected) {
    if (selected.material.emissive) selected.material.emissive.setHex(0x000000);
    selected.scale.setScalar(1);
  }
  selected = planet;
  if (!selected) {
    label.classList.add('hidden');
    return;
  }
  if (selected.material.emissive) selected.material.emissive.setHex(0x2e6bff);
  selected.scale.setScalar(1.15);
  label.innerHTML =
    '<h2>' + selected.userData.name + '</h2><p>' + selected.userData.desc + '</p>';
  label.classList.remove('hidden');
}

// 区分“点击”和“拖拽旋转视角”：按下与松开位置几乎不变才算点击
let downX = 0;
let downY = 0;
renderer.domElement.addEventListener('pointerdown', event => {
  downX = event.clientX;
  downY = event.clientY;
});
renderer.domElement.addEventListener('pointerup', event => {
  if (Math.abs(event.clientX - downX) > 5 || Math.abs(event.clientY - downY) > 5) return;
  setSelection(pickPlanet(event)); // 点到空白处返回 null，取消选中
});
// 悬停在可点击天体上时鼠标变成手型
renderer.domElement.addEventListener('pointermove', event => {
  if (event.buttons !== 0) return; // 正在拖拽时不反复检测
  renderer.domElement.style.cursor = pickPlanet(event) ? 'pointer' : 'grab';
});

// ---------- 8. 动画循环 ----------
const clock = new THREE.Clock(); // 按真实时间驱动，帧率不同速度也一致

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta(); // 距上一帧的秒数

  sun.rotation.y += delta * 0.25;      // 太阳缓慢自转
  starField.rotation.y += delta * 0.01; // 星空极缓慢转动，营造太空漂移感

  // 行星公转与自转：转支点 Group 实现圆周运动，行星本体再自转
  planets.forEach(body => {
    if (body.userData.pivot) {
      body.userData.pivot.rotation.y += delta * body.userData.orbitSpeed * 0.3;
      body.rotation.y += delta * 0.5; // 行星本体自转
      // 月球绕地球转
      if (body.userData.moonPivot) {
        body.userData.moonPivot.rotation.y += delta * 2.2;
      }
    }
  });

  controls.update(); // 开了阻尼后必须每帧调用，惯性才生效

  // 信息标签跟随选中行星：取世界坐标投影到屏幕坐标
  if (selected) {
    selected.getWorldPosition(labelWorld);
    const projected = labelWorld.clone().project(camera);
    if (projected.z > 1) {
      label.classList.add('hidden'); // 行星在相机背后时隐藏
    } else {
      label.classList.remove('hidden');
      label.style.left = ((projected.x * 0.5 + 0.5) * window.innerWidth) + 'px';
      label.style.top = ((-projected.y * 0.5 + 0.5) * window.innerHeight) + 'px';
    }
  }

  renderer.render(scene, camera);
}
animate();

// ---------- 9. 窗口 resize 适配：相机宽高比 + 投影矩阵 + 渲染器尺寸 三件套 ----------
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------- 10. 简易帧率显示，便于观察流畅度 ----------
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
