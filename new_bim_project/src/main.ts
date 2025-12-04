import * as THREE from "three";
import * as OBC from "@thatopen/components";

// ======================================================
// 0) VARIÁVEIS GLOBAIS (AR + FRAGMENTS)
// ======================================================

const arRoot = new THREE.Group();

let xrSession: XRSession | null = null;
let xrRefSpace: XRReferenceSpace | XRBoundedReferenceSpace | null = null;
let xrHitTestSource: XRHitTestSource | null | undefined = null;
let reticle: THREE.Mesh | null = null;

let userScale = 1;
let userTouchedScale = false;

// Último modelo de fragments carregado (ThatOpen)
let lastFragmentsModel: any | null = null;

// Tornar acessível no console
(window as any).lastFragmentsModel = null;

// ======================================================
// 1) COMPONENTS + WORLD
// ======================================================

const components = new OBC.Components();

const worlds = components.get(OBC.Worlds);
const world = worlds.create<
  OBC.SimpleScene,
  OBC.OrthoPerspectiveCamera,
  OBC.SimpleRenderer
>();
world.name = "main";

// ---------- Scene ----------
const sceneComponent = new OBC.SimpleScene(components);
sceneComponent.setup();
sceneComponent.three.background = new THREE.Color(0xf0f0f0);
world.scene = sceneComponent;

// ---------- Renderer ----------
const container = document.getElementById("three-canvas") as HTMLElement | null;
if (!container) {
  throw new Error("Elemento #three-canvas não encontrado");
}
const rendererComponent = new OBC.SimpleRenderer(components, container);
world.renderer = rendererComponent;

// ---------- Camera ----------
const cameraComponent = new OBC.OrthoPerspectiveCamera(components);
world.camera = cameraComponent;

// ---------- Grid ----------
components.get(OBC.Grids).create(world);

// Inicializa sistema de componentes
components.init();

// Resize
window.addEventListener("resize", () => {
  rendererComponent.resize();
  cameraComponent.updateAspect();
});

// atalhos THREE
const renderer = rendererComponent.three;
const scene = sceneComponent.three;
const camera = cameraComponent.three;

// AR root
scene.add(arRoot);
arRoot.visible = false;

// Retículo AR
reticle = new THREE.Mesh(
  new THREE.RingGeometry(0.07, 0.09, 32).rotateX(-Math.PI / 2),
  new THREE.MeshBasicMaterial({
    color: 0x00ff99,
    transparent: true,
    opacity: 0.95,
    depthTest: false
  })
);
reticle.matrixAutoUpdate = false;
reticle.visible = false;
scene.add(reticle);

// ======================================================
// 2) IFC LOADER + FRAGMENTS
// ======================================================

const ifcLoader = components.get(OBC.IfcLoader);

await ifcLoader.setup({
  autoSetWasm: false,
  wasm: {
    path: "https://unpkg.com/web-ifc@0.0.72/",
    absolute: true
  }
});

// FragmentsManager
const workerUrl = "/workers/worker.mjs";
const fragments = components.get(OBC.FragmentsManager);
await fragments.init(workerUrl);

// Expor no console
(window as any).fragments = fragments;
(window as any).components = components;

// Atualiza fragments quando a câmera “descansa”
world.camera.controls.addEventListener("rest", () =>
  fragments.core.update(true)
);

// ======================================================
// 2.1 MENU LATERAL — ELEMENTO DE PROPRIEDADES
// ======================================================

const propsContent = document.getElementById("props-content") as
  | HTMLElement
  | null;

function setPropsMessage(html: string) {
  if (propsContent) propsContent.innerHTML = html;
}

// estado inicial do painel
setPropsMessage("Nenhum modelo carregado.");

// Atualiza painel com informações gerais do modelo
function updateModelInfoPanel(file: File | null, model: any | null) {
  if (!propsContent) return;

  if (!file || !model) {
    setPropsMessage("Nenhum modelo carregado.");
    return;
  }

  const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
  const fragmentsCount = fragments.list.size;
  const childrenCount = model.object?.children?.length ?? 0;

  propsContent.innerHTML = `
    <div><strong>Arquivo:</strong> ${file.name}</div>
    <div><strong>Tamanho:</strong> ${fileSizeMB} MB</div>
    <div><strong>Fragments:</strong> ${fragmentsCount}</div>
    <div><strong>Meshes filhos:</strong> ${childrenCount}</div>
    <hr>
    <div style="font-size: 0.9rem; color: #666;">
      (Seleção por elemento e propriedades IFC detalhadas podem ser adicionadas depois.)
    </div>
  `;
}

// ======================================================
// 2.2 Evento: quando um modelo Fragments é criado
// ======================================================

let lastLoadedFile: File | null = null;

fragments.list.onItemSet.add(({ value: model }) => {
  console.log("📌 Modelo IFC convertido em Fragments:", model);

  lastFragmentsModel = model;
  (window as any).lastFragmentsModel = model;

  model.useCamera(world.camera.three);
  world.scene.three.add(model.object);

  fragments.core.update(true);

  // Atualiza painel com o modelo e o último arquivo carregado
  updateModelInfoPanel(lastLoadedFile, model);
});

// ======================================================
// 3) INPUT DE ARQUIVO IFC
// ======================================================

const fileInput = document.getElementById("ifc-file-input") as
  | HTMLInputElement
  | null;
const statusEl = document.getElementById("status") as HTMLElement | null;

async function loadIFCFromFile(file: File) {
  try {
    lastLoadedFile = file;

    if (statusEl) statusEl.textContent = "Lendo arquivo IFC...";
    setPropsMessage("Lendo arquivo IFC...");

    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    if (statusEl) statusEl.textContent = "Convertendo IFC para Fragments...";
    setPropsMessage("Convertendo IFC para Fragments...");

    await ifcLoader.load(buffer, true, file.name, {
      processData: {
        progressCallback: (progress: number) => {
          const pct = (progress * 100).toFixed(1);
          console.log(`Progresso IFC: ${pct}%`);
          if (statusEl) statusEl.textContent = `Convertendo IFC: ${pct}%`;
        }
      }
    });

    if (statusEl) statusEl.textContent = "Modelo IFC carregado!";
    setPropsMessage("Modelo IFC carregado. Aguardando montagem dos Fragments...");
  } catch (error) {
    console.error("Erro ao carregar IFC:", error);
    if (statusEl) statusEl.textContent = "Erro ao carregar IFC";
    setPropsMessage("Erro ao carregar IFC.");
  }
}

if (fileInput) {
  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (file) {
      await loadIFCFromFile(file);
    }
  });
}

// ======================================================
// 4) HELPERS PARA AR
// ======================================================

function ensureARMesh(): THREE.Object3D | null {
  if (!lastFragmentsModel) return null;

  const existing = arRoot.children.find(
    (c) => (c as any).userData?.fromFragments
  );
  if (existing) return existing;

  const src = lastFragmentsModel.object as THREE.Object3D;
  if (!src) return null;

  const clone = src.clone(true);
  (clone as any).userData.fromFragments = true;

  clone.applyMatrix4(src.matrixWorld);
  clone.updateMatrixWorld(true);

  clone.traverse((o: any) => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    mats.forEach((m: THREE.Material | null) => {
      if (!m) return;
      (m as any).depthWrite = true;
      (m as any).side = THREE.DoubleSide;
      m.needsUpdate = true;
    });
  });

  clone.position.set(0, 0, 0);
  clone.rotation.set(0, 0, 0);
  clone.scale.set(1, 1, 1);

  arRoot.add(clone);
  return clone;
}

function autoScaleFor(mesh: THREE.Object3D, targetDiagMeters = 1.5): number {
  const box = new THREE.Box3().setFromObject(mesh);
  const s = box.getSize(new THREE.Vector3());
  const diag = Math.hypot(s.x, s.y, s.z) || 1;
  const diagMeters = diag > 500 ? diag / 1000 : diag;
  const scale = targetDiagMeters / diagMeters;
  return Math.max(0.005, Math.min(10, scale));
}

function forceVisibleAndOpaque(obj: THREE.Object3D | null): void {
  if (!obj) return;
  obj.traverse((o: any) => {
    o.visible = true;
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    mats.forEach((m: THREE.Material | null) => {
      if (!m) return;
      if ((m as any).opacity === undefined) (m as any).opacity = 1;
      if ((m as any).transparent === undefined) (m as any).transparent = false;
      (m as any).depthWrite = true;
      (m as any).side = THREE.DoubleSide;
      m.needsUpdate = true;
    });
  });
}

function placeModelAtReticle(): void {
  if (!reticle || !reticle.visible) return;
  const mesh = ensureARMesh();
  if (!mesh) return;

  forceVisibleAndOpaque(mesh);
  arRoot.matrix.copy(reticle.matrix);
  arRoot.matrix.decompose(arRoot.position, arRoot.quaternion, arRoot.scale);

  arRoot.position.y += 0.01;
  if (!userTouchedScale) userScale = autoScaleFor(mesh, 1.5);
  arRoot.scale.set(userScale, userScale, userScale);
  arRoot.visible = true;
}

function placeInFrontOfCamera(distance = 1.5): void {
  const mesh = ensureARMesh();
  if (!mesh) return;

  if (!userTouchedScale) userScale = autoScaleFor(mesh, 1.5);

  const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  const pos = new THREE.Vector3().copy(camera.position).add(
    dir.multiplyScalar(distance)
  );

  arRoot.position.copy(pos);
  arRoot.quaternion.copy(camera.quaternion);
  arRoot.scale.set(userScale, userScale, userScale);
  arRoot.visible = true;
}

function tryPlaceOnTap(): void {
  if (!xrSession) return;
  if (reticle && reticle.visible) {
    placeModelAtReticle();
  } else {
    placeInFrontOfCamera();
  }
}

async function isWebXRARSupported(): Promise<boolean> {
  if (!("xr" in navigator)) return false;
  try {
    const xr: any = (navigator as any).xr;
    if (xr && typeof xr.isSessionSupported === "function") {
      return await xr.isSessionSupported("immersive-ar");
    }
  } catch {
    // ignore
  }
  return false;
}

// ======================================================
// 5) INICIAR / FINALIZAR AR
// ======================================================

async function startAR(domOverlayRoot: HTMLElement | null): Promise<void> {
  if (!lastFragmentsModel) {
    alert("Carregue um arquivo IFC antes de iniciar o AR.");
    return;
  }

  if (!(await isWebXRARSupported())) {
    alert(
      "Este dispositivo/navegador não suporta WebXR AR (Android + Chrome necessários)."
    );
    return;
  }

  renderer.xr.enabled = true;
  renderer.xr.setReferenceSpaceType("local-floor");

  const xr: any = (navigator as any).xr;
  const session: XRSession = await xr.requestSession("immersive-ar", {
    requiredFeatures: ["local-floor"],
    optionalFeatures: ["hit-test", "dom-overlay"],
    domOverlay: { root: domOverlayRoot || document.body }
  });

  xrSession = session;
  await renderer.xr.setSession(session);

  try {
    xrRefSpace =
      (await session.requestReferenceSpace("local-floor")) ??
      (await session.requestReferenceSpace("local"));
  } catch {
    xrRefSpace = await session.requestReferenceSpace("local");
  }

  // Hit-test
  try {
    const viewerSpace = await session.requestReferenceSpace("viewer");
    xrHitTestSource = await session.requestHitTestSource?.({
      space: viewerSpace
    });
  } catch {
    xrHitTestSource = null;
  }

  renderer.domElement.style.background = "transparent";
  renderer.setClearColor(0x000000, 0);
  scene.background = null;

  // luzes
  if (!scene.getObjectByName("ar-ambient")) {
    const amb = new THREE.AmbientLight(0xffffff, 0.8);
    amb.name = "ar-ambient";
    scene.add(amb);
  }
  if (!scene.getObjectByName("ar-dir")) {
    const dir = new THREE.DirectionalLight(0xffffff, 0.6);
    dir.position.set(1, 2, 1);
    dir.name = "ar-dir";
    scene.add(dir);
  }

  if (lastFragmentsModel?.object) {
    lastFragmentsModel.object.visible = false;
  }

  const clone = ensureARMesh();
  forceVisibleAndOpaque(clone);

  session.addEventListener("select", () => {
    tryPlaceOnTap();
  });

  session.addEventListener("end", () => {
    endAR();
  });

  renderer.setAnimationLoop((_time, frame) => {
    if (
      frame &&
      xrHitTestSource &&
      xrRefSpace &&
      reticle &&
      xrSession
    ) {
      const hits = frame.getHitTestResults(xrHitTestSource);
      if (hits.length) {
        const pose = hits[0].getPose(xrRefSpace);
        if (pose) {
          reticle.visible = true;
          reticle.matrix.fromArray(pose.transform.matrix);
        }
      } else {
        reticle.visible = false;
      }
    }

    renderer.render(scene, camera);
  });

  arRoot.visible = true;
  if (!xrHitTestSource) placeInFrontOfCamera();

  domOverlayRoot?.classList.remove("hidden");
  document.body.classList.add("is-ar");
}

function endAR(): void {
  if (xrSession) {
    xrSession.end().catch(() => {});
  }

  xrSession = null;
  xrRefSpace = null;
  xrHitTestSource = null;

  renderer.setAnimationLoop(null);
  renderer.xr.enabled = false;

  for (let i = arRoot.children.length - 1; i >= 0; i--) {
    const child = arRoot.children[i] as any;
    if (child.userData?.fromFragments) {
      arRoot.remove(child);
    }
  }

  arRoot.visible = false;

  if (lastFragmentsModel?.object) {
    lastFragmentsModel.object.visible = true;
  }

  renderer.setClearColor(0xf0f0f0, 1);
  scene.background = new THREE.Color(0xf0f0f0);

  const overlay = document.getElementById("ar-overlay");
  overlay?.classList.add("hidden");
  document.body.classList.remove("is-ar");
}

// ======================================================
// 6) BOTÕES AR (HTML)
// ======================================================

const arBtn = document.getElementById("ar-button") as HTMLButtonElement | null;
const arExitBtn = document.getElementById(
  "ar-exit-button"
) as HTMLButtonElement | null;

const arOverlay = document.getElementById("ar-overlay") as HTMLElement | null;

if (arBtn) {
  arBtn.addEventListener("click", async () => {
    await startAR(arOverlay);
  });
}

if (arExitBtn) {
  arExitBtn.addEventListener("click", () => {
    endAR();
  });
}

// ======================================================
// 7) POSIÇÃO INICIAL DA CÂMERA
// ======================================================

await world.camera.controls.setLookAt(15, 15, 15, 0, 0, 0);

console.log("Aplicação inicializada com menu de propriedades gerais IFC.");
