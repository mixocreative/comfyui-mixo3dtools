import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

const loadLib = (url) => new Promise(resolve => {
    const s = document.createElement("script");
    s.src = url; s.onload = () => resolve(true); s.onerror = () => resolve(false);
    document.head.appendChild(s);
});

(async () => {
    if (window.mixo3d_libs_loaded) return;
    await loadLib("https://unpkg.com/three@0.128.0/build/three.min.js");
    await loadLib("https://unpkg.com/three@0.128.0/examples/js/loaders/GLTFLoader.js");
    await loadLib("https://unpkg.com/three@0.128.0/examples/js/controls/OrbitControls.js");
    await loadLib("https://unpkg.com/three@0.128.0/examples/js/controls/TransformControls.js");

    // Safety timeout to ensure scripts are actually parsed and ready
    setTimeout(() => {
        window.mixo3d_libs_loaded = (typeof THREE !== "undefined" && THREE.GLTFLoader);
        console.log("[Mixo3D] Libs loaded check:", window.mixo3d_libs_loaded);
    }, 500);
})();

app.registerExtension({
    name: "Mixo3DTools.Viewer",
    async beforeRegisterNodeDef(nodeType, nodeData) {
        const supported = ["SceneAssembler", "MeshMaterialInspector", "MeshTransform", "MeshFromPath"];
        if (!supported.includes(nodeData.name) || nodeType.__mixo3d_wrapped) return;
        nodeType.__mixo3d_wrapped = true;

        const onNodeCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            const r = onNodeCreated ? onNodeCreated.apply(this, arguments) : undefined;
            const self = this;

            // 1. CREATE CONTAINER
            const container = document.createElement("div");
            container.className = "mixo3d-viewer-container";
            Object.assign(container.style, {
                width: "100%", height: "200px",
                backgroundColor: "#0b0b0c", borderRadius: "4px",
                border: "2px solid #333", position: "relative", overflow: "hidden", display: "flex",
                flexDirection: "column", alignItems: "stretch", marginTop: "10px"
            });

            // Refresh Button (Fallback)
            const refreshBtn = document.createElement("button");
            refreshBtn.textContent = "🔄 LOAD 3D VIEWER";
            Object.assign(refreshBtn.style, {
                position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                zIndex: 100, padding: '10px 20px', background: '#333', color: '#fff', border: '1px solid #555', cursor: 'pointer'
            });
            refreshBtn.onclick = () => {
                window.mixo3d_libs_loaded = (typeof THREE !== "undefined" && THREE.GLTFLoader);
                if (self.initEngine) self.initEngine();
            };
            container.appendChild(refreshBtn);
            this.viewer_refresh_btn = refreshBtn;

            // Badges
            const createBadge = (posFn) => {
                const d = document.createElement("div");
                Object.assign(d.style, {
                    position: "absolute", backgroundColor: "rgba(0,0,0,0.7)", color: "#eee",
                    fontSize: "10px", padding: "6px 10px", borderRadius: "4px",
                    fontFamily: "monospace", zIndex: "10", display: "none", border: "1px solid #444"
                });
                posFn(d.style);
                container.appendChild(d);
                return d;
            };

            this.viewer_info_badge = createBadge(s => { s.top = "10px"; s.left = "10px"; s.pointerEvents = "none"; });
            this.viewer_export_badge = createBadge(s => {
                s.bottom = "10px"; s.left = "10px"; s.right = "10px";
                s.backgroundColor = "rgba(0,100,0,0.85)"; s.border = "1px solid #0f0";
            });
            this.viewer_stats_badge = createBadge(s => { s.top = "10px"; s.right = "10px"; s.minWidth = "150px"; });

            // Canvas
            const canvas = document.createElement("canvas");
            Object.assign(canvas.style, { width: "100%", height: "100%", display: "block" });
            container.appendChild(canvas);
            this.viewer_element = canvas;

            // Add Widget
            const widget = this.addDOMWidget("", "mixo3d_viewport", container, {
                serialize: false, get_value: () => undefined, set_value: () => { }
            });

            // Fix widget order
            if (this.widgets && this.widgets.length > 1) {
                const idx = this.widgets.indexOf(widget);
                if (idx !== -1) { this.widgets.splice(idx, 1); this.widgets.push(widget); }
            }

            container.addEventListener("mousedown", (e) => e.stopPropagation());
            container.addEventListener("wheel", (e) => e.stopPropagation(), { passive: false });

            // Focus for keys
            container.tabIndex = 0;
            container.style.outline = "none";

            const syncSize = () => {
                if (!self.threeRenderer || !self.viewer_element) return;
                const rect = container.getBoundingClientRect();
                if (rect.width < 1 || rect.height < 1) return;
                const w = Math.floor(rect.width);
                const h = Math.floor(rect.height);
                if (self.__lastW !== w || self.__lastH !== h) {
                    self.__lastW = w; self.__lastH = h;
                    self.threeRenderer.setSize(w, h, false);
                    self.threeCamera.aspect = w / h;
                    self.threeCamera.updateProjectionMatrix();
                }
            };
            const resizeObserver = new ResizeObserver(syncSize);
            resizeObserver.observe(container);

            // 2. ENGINE INIT
            this.initEngine = function () {
                try {
                    if (!window.mixo3d_libs_loaded || this.threeScene) return;

                    // Gizmo check
                    if (!THREE.TransformControls) {
                        console.warn("[Mixo3D] TransformControls missing, retrying later...");
                        return;
                    }

                    this.threeScene = new THREE.Scene();
                    this.threeScene.background = new THREE.Color(0x0b0b0c);

                    this.threeCamera = new THREE.PerspectiveCamera(45, 1, 0.1, 50000);
                    this.threeCamera.position.set(150, 150, 150);

                    this.threeRenderer = new THREE.WebGLRenderer({
                        canvas: this.viewer_element, antialias: true, alpha: true, logarithmicDepthBuffer: true
                    });
                    this.threeRenderer.setPixelRatio(window.devicePixelRatio);
                    this.threeRenderer.physicallyCorrectLights = true;
                    this.threeRenderer.outputEncoding = THREE.sRGBEncoding;
                    this.threeRenderer.toneMapping = THREE.ACESFilmicToneMapping;

                    this.threeControls = new THREE.OrbitControls(this.threeCamera, this.viewer_element);
                    this.threeControls.enableDamping = true;
                    this.threeControls.addEventListener("change", () => {
                        if (this.__mouseIn) this.__cameraMoved = true;
                        this.setDirtyCanvas(true);
                    });

                    // GIZMO
                    this.transformControl = new THREE.TransformControls(this.threeCamera, this.viewer_element);
                    this.transformControl.setSpace('local');
                    this.transformControl.addEventListener('change', () => this.setDirtyCanvas(true));
                    this.transformControl.addEventListener('dragging-changed', (event) => {
                        this.threeControls.enabled = !event.value;
                    });
                    // 🔄 SYNC GIZMO -> NODE WIDGETS
                    this.transformControl.addEventListener('change', () => {
                        if (this.transformControl.object) {
                            const wrapper = this.transformControl.object;
                            const nodeId = wrapper.userData.sourceNodeId;
                            if (nodeId) {
                                const node = app.graph.getNodeById(nodeId);
                                if (node) {
                                    const mode = this.transformControl.getMode();
                                    if (mode === 'translate') {
                                        const p = wrapper.position;
                                        const setW = (n, name, v) => {
                                            const w = n.widgets?.find(x => x.name?.toLowerCase() === name.toLowerCase());
                                            if (w) { w.value = Math.round(v * 10) / 10; w.callback?.(w.value); }
                                        };
                                        setW(node, "pos_x", p.x); setW(node, "pos_y", p.y); setW(node, "pos_z", p.z);
                                    } else if (mode === 'rotate') {
                                        const r = wrapper.rotation;
                                        const setW = (n, name, v) => {
                                            const w = n.widgets?.find(x => x.name?.toLowerCase() === name.toLowerCase());
                                            if (w) { w.value = Math.round(v * 57.2958 * 10) / 10; w.callback?.(w.value); }
                                        };
                                        setW(node, "rot_x", r.x); setW(node, "rot_y", r.y); setW(node, "rot_z", r.z);
                                    } else if (mode === 'scale') {
                                        const s = wrapper.scale.x;
                                        const setW = (n, name, v) => {
                                            const w = n.widgets?.find(x => x.name?.toLowerCase() === name.toLowerCase());
                                            if (w) { w.value = Math.round(v * 100) / 100; w.callback?.(w.value); }
                                        };
                                        setW(node, "uniform_scale", s);
                                    }
                                }
                            }
                        }
                    });
                    this.threeScene.add(this.transformControl);

                    // SELECTION RAYCASTER
                    const raycaster = new THREE.Raycaster();
                    const mouse = new THREE.Vector2();
                    let dragStart = { x: 0, y: 0 };

                    container.addEventListener('pointerdown', (e) => { dragStart = { x: e.clientX, y: e.clientY }; });
                    container.addEventListener('pointerup', (e) => {
                        const dx = Math.abs(e.clientX - dragStart.x);
                        const dy = Math.abs(e.clientY - dragStart.y);
                        if (dx > 2 || dy > 2) return; // Drag
                        if (this.transformControl.dragging) return;

                        const rect = container.getBoundingClientRect();
                        mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
                        mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
                        raycaster.setFromCamera(mouse, this.threeCamera);

                        const meshes = [];
                        this.threeScene.traverse(o => { if (o.isMesh && o.type !== "GridHelper") meshes.push(o); });
                        const intersects = raycaster.intersectObjects(meshes, false);

                        if (intersects.length > 0) {
                            let t = intersects[0].object;
                            while (t && !t.isWrapper && t.parent) t = t.parent;
                            if (t && t.isWrapper) {
                                if (this.transformControl.object !== t) this.transformControl.attach(t);
                                this.setDirtyCanvas(true);
                                return;
                            }
                        }
                        this.transformControl.detach();
                        this.setDirtyCanvas(true);
                    });

                    // KEYS
                    container.addEventListener('keydown', (e) => {
                        switch (e.key.toLowerCase()) {
                            case 'w': this.transformControl.setMode('translate'); break;
                            case 'e': this.transformControl.setMode('rotate'); break;
                            case 'r': this.transformControl.setMode('scale'); break;
                            case '+': this.transformControl.setSize(this.transformControl.size + 0.1); break;
                            case '-': this.transformControl.setSize(Math.max(0.1, this.transformControl.size - 0.1)); break;
                        }
                    });

                    // LIGHTS
                    this.threeScene.add(new THREE.AmbientLight(0xffffff, 0.5));
                    const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1.0);
                    hemi.position.set(0, 500, 0);
                    this.threeScene.add(hemi);
                    const sun = new THREE.DirectionalLight(0xffffff, 1.2);
                    sun.position.set(500, 1000, 700);
                    this.threeScene.add(sun);

                    try {
                        const pmremGenerator = new THREE.PMREMGenerator(this.threeRenderer);
                        pmremGenerator.compileEquirectangularShader();
                        const s = new THREE.Scene();
                        s.add(new THREE.PointLight(0xffffff, 10, 100));
                        this.threeScene.environment = pmremGenerator.fromScene(s).texture;
                    } catch (e) { }

                    this.updateGrid("10cm");
                    this.compositionModels = {};
                    this.gltfLoader = new THREE.GLTFLoader();

                    // Loop
                    const animate = () => {
                        if (!this.threeRenderer) return;
                        requestAnimationFrame(animate);
                        this.threeControls.update();
                        this.threeRenderer.render(this.threeScene, this.threeCamera);
                    };
                    animate();
                    syncSize();

                    // Success! Hide button
                    if (this.viewer_refresh_btn) this.viewer_refresh_btn.style.display = 'none';

                } catch (err) {
                    console.error("[Mixo3D] Init Crash:", err);
                }
            };

            this.updateGrid = function (sz) {
                if (!this.threeScene) return;
                if (this.currentGrid) this.threeScene.remove(this.currentGrid);
                let size = 100.0, div = 10;
                if (sz === "20cm") { size = 200.0; div = 20; }
                else if (sz === "30cm") { size = 300.0; div = 30; }
                this.currentGrid = new THREE.GridHelper(size, div, 0x888888, 0x333333);
                this.threeScene.add(this.currentGrid);
                this.setDirtyCanvas(true);
            };

            this.clearAllModels = function () {
                if (!this.compositionModels) return;
                for (const k in this.compositionModels) {
                    const m = this.compositionModels[k];
                    if (m && m.isObject3D) {
                        this.threeScene.remove(m);
                        m.traverse(c => { if (c.geometry) c.geometry.dispose(); if (c.material) { if (Array.isArray(c.material)) c.material.forEach(x => x.dispose()); else c.material.dispose(); } });
                    }
                }
                this.compositionModels = {};
            };

            this.fitCamera = (force = false) => {
                if (!this.threeScene || (this.__cameraMoved && !force)) return;
                const box = new THREE.Box3(); let any = false;
                this.threeScene.traverse(m => { if (m.isMesh && m.type !== "GridHelper") { box.expandByObject(m); any = true; } });
                if (!any) return;
                const c = box.getCenter(new THREE.Vector3()); const s = box.getSize(new THREE.Vector3());
                const d = Math.max(s.x, s.y, s.z) * 2.2;
                if (d < 0.1) return;
                this.threeControls.target.copy(c);
                this.threeCamera.position.set(c.x + d, c.y + d, c.z + d);
            };

            container.addEventListener("mouseenter", () => { this.__mouseIn = true; });
            container.addEventListener("mouseleave", () => { this.__mouseIn = false; });

            // Trace Helper
            const traceScene = (node, depth = 0, visited = new Set()) => {
                if (!node || depth > 20 || visited.has(node.id)) return [];
                visited.add(node.id);
                let results = [];
                const type = (node.type || node.comfyClass || "").toLowerCase();
                const getW = (n, tag) => {
                    const w = n.widgets?.find(x => x.name?.toLowerCase() === tag || x.label?.toLowerCase() === tag);
                    return w ? w.value : undefined;
                };

                // Source?
                let url = null, sid = null;
                if (node.mixo3d_last_url) url = node.mixo3d_last_url;
                else {
                    for (const w of (node.widgets || [])) {
                        const v = String(w.value || "");
                        if (v.match(/\.(glb|obj|stl)$/i)) {
                            const fn = v.split(/[/\\]/).pop();
                            const sub = v.includes("mixo3d_cache") ? "mixo3d_cache" : (v.includes("mixo3d_assembled") ? "mixo3d_assembled" : "");
                            url = api.apiURL(`/view?filename=${encodeURIComponent(fn)}&type=output&subfolder=${encodeURIComponent(sub)}`);
                            break;
                        }
                    }
                }
                if (url) {
                    sid = (node && node.id) ? node.id : null;
                    results.push({ url, matrix: new THREE.Matrix4(), materialState: null, sourceNodeId: sid });
                }

                // Upstream
                const meshInputs = (node.inputs || []).filter(i => i.name?.startsWith("mesh_id") && i.link);
                let incoming = [];
                for (const inp of meshInputs) {
                    const l = app.graph.links[inp.link];
                    if (l && l.origin_id) {
                        const origin = app.graph.getNodeById(l.origin_id);
                        if (origin) incoming.push(...traceScene(origin, depth + 1, visited));
                    }
                }
                if (incoming.length > 0) results = incoming;

                // Transforms
                results.forEach(obj => {
                    if (type.includes("transform")) {
                        const px = parseFloat(getW(node, "pos_x") || 0), py = parseFloat(getW(node, "pos_y") || 0), pz = parseFloat(getW(node, "pos_z") || 0);
                        const rx = parseFloat(getW(node, "rot_x") || 0) * 0.0174533, ry = parseFloat(getW(node, "rot_y") || 0) * 0.0174533, rz = parseFloat(getW(node, "rot_z") || 0) * 0.0174533;
                        const s = parseFloat(getW(node, "uniform_scale") || 1.0);
                        const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'XYZ'));
                        const m = new THREE.Matrix4().compose(new THREE.Vector3(px, py, pz), q, new THREE.Vector3(s, s, s));
                        obj.matrix.premultiply(m);
                    }
                    if (type.includes("material")) {
                        const r = getW(node, "base_color_r");
                        if (r !== undefined) {
                            obj.materialState = {
                                r: parseFloat(r), g: parseFloat(getW(node, "base_color_g") || 0), b: parseFloat(getW(node, "base_color_b") || 0),
                                metallic: parseFloat(getW(node, "metallic") || 0), roughness: parseFloat(getW(node, "roughness") || 0.5)
                            };
                        }
                    }
                });
                return results;
            };

            // Monitor
            this.monitor = setInterval(() => {
                const show = self.widgets?.find(x => x.name === "show_preview")?.value !== false;
                if (!show) {
                    if (container.style.display !== "none") { container.style.display = "none"; self.clearAllModels(); }
                    return;
                }
                if (container.style.display === "none") { container.style.display = "flex"; self.setDirtyCanvas(true); }

                if (!self.threeScene) { self.initEngine(); return; }

                syncSize();

                // Badges
                if (self.mixo3d_settings && self.mixo3d_settings.material_count !== undefined) {
                    self.viewer_info_badge.style.display = "block";
                    self.viewer_info_badge.innerHTML = `SLOTS: ${self.mixo3d_settings.material_count}`;
                } else self.viewer_info_badge.style.display = "none";

                // Grid
                const gs = self.widgets?.find(x => x.name === "grid_size")?.value || "10cm";
                if (gs !== self.__lastGridSize) { self.__lastGridSize = gs; self.updateGrid(gs); }

                // Trace
                let sceneObjects = [];
                if (self.type === "SceneAssembler") {
                    const upDir = (self.widgets?.find(x => x.name === "up_direction")?.value) || "Y";
                    const orient = new THREE.Matrix4();
                    if (upDir === "Z") orient.makeRotationX(-Math.PI / 2);
                    else if (upDir === "-Y") orient.makeRotationX(Math.PI);
                    else if (upDir === "-Z") orient.makeRotationX(Math.PI / 2);

                    (self.inputs || []).forEach(inp => {
                        if (inp.name?.startsWith("mesh_id") && inp.link) {
                            const l = app.graph.links[inp.link];
                            if (l && l.origin_id) {
                                const origin = app.graph.getNodeById(l.origin_id);
                                if (origin) {
                                    traceScene(origin).forEach((o, i) => {
                                        o.id = `asm_${inp.name}_${i}`;
                                        o.matrix.premultiply(orient);
                                        sceneObjects.push(o);
                                    });
                                }
                            }
                        }
                    });
                    if (sceneObjects.length === 0 && self.mixo3d_last_url) sceneObjects.push({ id: "baked", url: self.mixo3d_last_url, matrix: new THREE.Matrix4() });
                } else {
                    traceScene(self).forEach((o, i) => { o.id = `live_${i}`; sceneObjects.push(o); });
                    if (sceneObjects.length === 0 && self.mixo3d_last_url) sceneObjects.push({ id: "baked", url: self.mixo3d_last_url, matrix: new THREE.Matrix4() });
                }

                // Sync
                const active = new Set(sceneObjects.map(o => o.id));
                sceneObjects.forEach(obj => {
                    let m = self.compositionModels[obj.id];
                    if (!m || (m !== "LOADING" && m.__lastUrl !== obj.url)) {
                        if (m === "LOADING") return;
                        if (m) self.threeScene.remove(m);
                        self.compositionModels[obj.id] = "LOADING";
                        self.gltfLoader.load(obj.url, (gltf) => {
                            const w = new THREE.Group();
                            w.add(gltf.scene);
                            w.__lastUrl = obj.url;
                            w.isWrapper = true;
                            if (obj.sourceNodeId) w.userData.sourceNodeId = obj.sourceNodeId;
                            self.compositionModels[obj.id] = w;
                            self.threeScene.add(w);
                            if (!self.__initCam) { self.fitCamera(true); self.__initCam = true; }
                        });
                    }
                    if (m && m.isObject3D) {
                        const sel = (self.transformControl && self.transformControl.object === m);
                        if (!sel) {
                            m.matrixAutoUpdate = false;
                            m.matrix.copy(obj.matrix);
                            m.updateMatrixWorld(true);
                        }
                        // Materials
                        if (obj.materialState) {
                            m.traverse(c => {
                                if (c.isMesh && c.material) {
                                    c.material.color.setRGB(obj.materialState.r, obj.materialState.g, obj.materialState.b);
                                    c.material.metalness = obj.materialState.metallic;
                                    c.material.roughness = obj.materialState.roughness;
                                }
                            });
                        }
                    }
                });

                // Cleanup
                for (const k in self.compositionModels) {
                    if (!active.has(k)) {
                        const m = self.compositionModels[k];
                        if (m && m.isObject3D) self.threeScene.remove(m);
                        delete self.compositionModels[k];
                    }
                }

            }, 50);

            return r;
        };

        const onExecuted = nodeType.prototype.onExecuted;
        nodeType.prototype.onExecuted = function (message) {
            onExecuted?.apply(this, arguments);
            if (this.clearAllModels) this.clearAllModels();
            const d = message?.ui || message;
            if (d?.settings) this.mixo3d_settings = d.settings;
            if (d?.glb_url) {
                // Format URL
                let path = d.glb_url[0].replace(/\\/g, "/");
                let fn = path.split("/").pop();
                let sub = path.includes("/") ? path.substring(0, path.lastIndexOf("/")) : "";
                this.mixo3d_last_url = api.apiURL(`/view?filename=${encodeURIComponent(fn)}&type=output&subfolder=${encodeURIComponent(sub)}`);
            }
            // Export Badge
            if (d?.export_path && this.viewer_export_badge) {
                this.viewer_export_badge.innerHTML = `<div style="color:#0f0">✓ EXPORTED</div><div style="font-size:9px">${d.export_path}</div>`;
                this.viewer_export_badge.style.display = "block";
            }
        };
    }
});
