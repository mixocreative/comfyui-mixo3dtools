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
    window.mixo3d_libs_loaded = (typeof THREE !== "undefined" && THREE.GLTFLoader);
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

            const container = document.createElement("div");
            container.className = "mixo3d-viewer-container";
            Object.assign(container.style, {
                width: "100%", height: "200px",
                backgroundColor: "#0b0b0c", borderRadius: "4px",
                border: "2px solid #333", position: "relative", overflow: "hidden", display: "flex",
                flexDirection: "column", alignItems: "stretch", marginTop: "10px"
            });

            const infoBadge = document.createElement("div");
            Object.assign(infoBadge.style, {
                position: "absolute", top: "10px", left: "10px",
                backgroundColor: "rgba(0,0,0,0.7)", color: "#eee",
                fontSize: "10px", padding: "6px 10px", borderRadius: "4px",
                fontFamily: "monospace", pointerEvents: "none", zIndex: "10",
                display: "none", border: "1px solid #444"
            });
            container.appendChild(infoBadge);
            this.viewer_info_badge = infoBadge;

            const exportBadge = document.createElement("div");
            Object.assign(exportBadge.style, {
                position: "absolute", bottom: "10px", left: "10px", right: "10px",
                backgroundColor: "rgba(0,100,0,0.85)", color: "#fff",
                fontSize: "11px", padding: "10px 12px", borderRadius: "6px",
                fontFamily: "monospace", zIndex: "10",
                display: "none", border: "1px solid #0f0",
                maxWidth: "calc(100% - 20px)", wordBreak: "break-all"
            });
            container.appendChild(exportBadge);
            this.viewer_export_badge = exportBadge;

            const statsBadge = document.createElement("div");
            Object.assign(statsBadge.style, {
                position: "absolute", top: "10px", right: "10px",
                backgroundColor: "rgba(0,0,0,0.8)", color: "#fff",
                fontSize: "10px", padding: "8px 10px", borderRadius: "4px",
                fontFamily: "monospace", zIndex: "10",
                display: "none", border: "1px solid #555",
                minWidth: "150px"
            });
            container.appendChild(statsBadge);
            this.viewer_stats_badge = statsBadge;

            const canvas = document.createElement("canvas");
            Object.assign(canvas.style, { width: "100%", height: "100%", display: "block" });
            container.appendChild(canvas);
            this.viewer_element = canvas;

            const widget = this.addDOMWidget("", "mixo3d_viewport", container, {
                serialize: false, get_value: () => undefined, set_value: () => { }
            });
            widget.serializeValue = () => undefined;

            if (this.widgets && this.widgets.length > 1) {
                const idx = this.widgets.indexOf(widget);
                if (idx !== -1) { this.widgets.splice(idx, 1); this.widgets.push(widget); }
            }

            container.addEventListener("mousedown", (e) => e.stopPropagation());
            container.addEventListener("wheel", (e) => e.stopPropagation(), { passive: false });

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

            this.initEngine = function () {
                if (!window.mixo3d_libs_loaded || this.threeScene) return;
                this.threeScene = new THREE.Scene();
                this.threeScene.background = new THREE.Color(0x0b0b0c);

                this.threeCamera = new THREE.PerspectiveCamera(45, 1, 0.1, 50000);
                this.threeCamera.position.set(150, 150, 150);

                this.threeRenderer = new THREE.WebGLRenderer({
                    canvas: this.viewer_element,
                    antialias: true,
                    alpha: true,
                    logarithmicDepthBuffer: true
                });
                this.threeRenderer.setPixelRatio(window.devicePixelRatio);
                this.threeRenderer.physicallyCorrectLights = true;
                this.threeRenderer.outputEncoding = THREE.sRGBEncoding;
                this.threeRenderer.toneMapping = THREE.ACESFilmicToneMapping;
                this.threeRenderer.toneMappingExposure = 1.0;

                this.threeControls = new THREE.OrbitControls(this.threeCamera, this.viewer_element);
                this.threeControls.enableDamping = true;

                // 💡 Advanced Lighting setup
                const ambient = new THREE.AmbientLight(0xffffff, 0.5);
                this.threeScene.add(ambient);

                const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1.0);
                hemi.position.set(0, 500, 0);
                this.threeScene.add(hemi);

                const sun = new THREE.DirectionalLight(0xffffff, 1.2);
                sun.position.set(500, 1000, 700);
                this.threeScene.add(sun);

                // 🌎 Add Procedural Environment Map (Fixes dark metallic)
                try {
                    const pmremGenerator = new THREE.PMREMGenerator(this.threeRenderer);
                    pmremGenerator.compileEquirectangularShader();

                    // Simple procedural room env
                    const scene = new THREE.Scene();
                    const light = new THREE.PointLight(0xffffff, 10, 100);
                    light.position.set(5, 5, 5);
                    scene.add(light);

                    const envRT = pmremGenerator.fromScene(scene);
                    this.threeScene.environment = envRT.texture;
                } catch (e) { console.error("[Mixo3D] EnvMap Error:", e); }

                this.updateGrid("10cm");
                this.compositionModels = {};
                this.gltfLoader = new THREE.GLTFLoader();

                const animate = () => {
                    if (!this.threeRenderer) return;
                    requestAnimationFrame(animate);
                    this.threeControls.update();
                    this.threeRenderer.render(this.threeScene, this.threeCamera);
                };
                animate();
                syncSize();
            };

            this.clearAllModels = function () {
                if (!this.threeScene || !this.compositionModels) return;

                // Remove all models from the scene
                for (const k in this.compositionModels) {
                    const model = this.compositionModels[k];
                    if (model && (model.isScene || model.isGroup || model.isObject3D)) {
                        this.threeScene.remove(model);
                        // Dispose of geometries and materials
                        model.traverse((child) => {
                            if (child.geometry) child.geometry.dispose();
                            if (child.material) {
                                if (Array.isArray(child.material)) {
                                    child.material.forEach(mat => mat.dispose());
                                } else {
                                    child.material.dispose();
                                }
                            }
                        });
                    }
                }

                // Clear the models dictionary
                this.compositionModels = {};
                console.log("[Mixo3D] Cleared all models from viewer");
            };

            this.updateGrid = function (gridSizeStr) {
                if (!this.threeScene) return;
                if (this.currentGrid) this.threeScene.remove(this.currentGrid);

                // 📏 RE-ALIGNED TO MM STANDARD (1.0 = 1mm)
                // A 10cm cube = 100mm units.
                let size = 100.0;
                let div = 10;   // 10 Divisions = 10mm/1cm increments
                let c1 = 0x888888;
                let c2 = 0x333333;

                if (gridSizeStr === "20cm") {
                    size = 200.0; div = 20;
                } else if (gridSizeStr === "30cm") {
                    size = 300.0; div = 30;
                } else {
                    size = 100.0; div = 10; // Default 100mm (10cm)
                }

                this.currentGrid = new THREE.GridHelper(size, div, c1, c2);
                this.threeScene.add(this.currentGrid);
                self.setDirtyCanvas(true);
            };

            this.fitCamera = () => {
                if (!this.threeScene) return;
                const box = new THREE.Box3(); let any = false;
                this.threeScene.traverse(m => { if (m.isMesh && m.type !== "GridHelper") { box.expandByObject(m); any = true; } });
                if (!any) return;
                const c = box.getCenter(new THREE.Vector3()); const s = box.getSize(new THREE.Vector3());
                const d = Math.max(s.x, s.y, s.z) * 2.2; if (d < 0.1) return;
                this.threeControls.target.copy(c); this.threeCamera.position.set(c.x + d, c.y + d, c.z + d);
            }

            const traceScene = (node, depth = 0, visited = new Set()) => {
                if (!node || depth > 20 || visited.has(node.id)) return [];
                visited.add(node.id);

                let results = [];
                const type = (node.type || node.comfyClass || "").toLowerCase();
                const getWVal = (n, name) => {
                    if (!n?.widgets) return undefined;
                    const w = n.widgets.find(x => x.name === name || (x.name?.toLowerCase() === name.toLowerCase()) || x.label === name);
                    return w ? w.value : undefined;
                };

                // 1. SOURCE DETECTION (Is this node itself a source of truth?)
                // Priority: Widgets like "mesh_path", "path", or any widget ending in .glb/.obj/.stl
                let localUrl = null;
                const widgets = node.widgets || [];
                for (const w of widgets) {
                    const val = String(w.value || "");
                    if (val.length > 3 && (val.toLowerCase().endsWith(".glb") || val.toLowerCase().endsWith(".obj") || val.toLowerCase().endsWith(".stl"))) {
                        const filename = val.split(/[/\\]/).pop();
                        const isCached = val.includes("mixo3d_cache") || val.includes("mixo3d_assembled");
                        const st = (isCached || val.includes("output")) ? "output" : "input";
                        const sub = val.includes("mixo3d_cache") ? "mixo3d_cache" : (val.includes("mixo3d_assembled") ? "mixo3d_assembled" : "");
                        localUrl = api.apiURL(`/view?filename=${encodeURIComponent(filename)}&type=${st}${sub ? "&subfolder=" + encodeURIComponent(sub) : ""}`);
                        break;
                    }
                }
                if (!localUrl && node.mixo3d_last_url) localUrl = node.mixo3d_last_url;

                if (localUrl) {
                    results.push({ url: localUrl, matrix: new THREE.Matrix4(), materialState: null });
                }

                // 2. TRACE UPSTREAM (Only if it's not a terminal source or for combining)
                // We combine upstream results with local source if it's an assembler
                const meshInputs = (node.inputs || []).filter(i => (i.name === "mesh_id" || i.name === "mesh_id_1" || i.name?.startsWith("mesh_id_")) && i.link !== null);

                let incoming = [];
                for (const inp of meshInputs) {
                    const link = app.graph.links[inp.link];
                    if (link && link.origin_id) {
                        const origin = app.graph.getNodeById(link.origin_id);
                        if (origin) incoming = [...incoming, ...traceScene(origin, depth + 1, visited)];
                    }
                }

                // If we have upstream data, we use it. If not, we use our local source if we found one.
                if (incoming.length > 0) results = incoming;

                // 3. APPLY THIS NODE'S LOGIC
                results.forEach(obj => {
                    if (type.includes("transform")) {
                        const px = parseFloat(getWVal(node, "pos_x") || 0);
                        const py = parseFloat(getWVal(node, "pos_y") || 0);
                        const pz = parseFloat(getWVal(node, "pos_z") || 0);
                        const rx = parseFloat(getWVal(node, "rot_x") || 0) * 0.01745329;
                        const ry = parseFloat(getWVal(node, "rot_y") || 0) * 0.01745329;
                        const rz = parseFloat(getWVal(node, "rot_z") || 0) * 0.01745329;
                        const sVal = parseFloat(getWVal(node, "uniform_scale") || 1.0);
                        const m = new THREE.Matrix4().compose(new THREE.Vector3(px, py, pz), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sVal, sVal, sVal));
                        obj.matrix.premultiply(m);
                    }
                    if (type.includes("material")) {
                        const r = getWVal(node, "base_color_r");
                        if (r !== undefined) {
                            obj.materialState = {
                                r: parseFloat(r), g: parseFloat(getWVal(node, "base_color_g") || 1.0), b: parseFloat(getWVal(node, "base_color_b") || 1.0),
                                metallic: parseFloat(getWVal(node, "metallic") || 0), roughness: parseFloat(getWVal(node, "roughness") || 0.5)
                            };
                        }
                    }
                });

                return results;
            };

            this.monitor = setInterval(() => {
                if (!self.viewer_element || !window.mixo3d_libs_loaded) return;

                const showPreview = self.widgets?.find(x => x.name === "show_preview")?.value !== false;
                if (!showPreview) {
                    if (container.style.display !== "none") {
                        container.style.display = "none";
                        self.clearAllModels();
                    }
                    return;
                } else {
                    if (container.style.display === "none") {
                        container.style.display = "flex";
                        self.setDirtyCanvas(true);
                    }
                }

                if (!self.threeScene) {
                    self.initEngine();
                    return;
                }

                syncSize();

                // ℹ️ INFO BADGE
                if (self.mixo3d_settings && self.mixo3d_settings.material_count !== undefined) {
                    self.viewer_info_badge.style.display = "block";
                    const name = self.mixo3d_settings.current_name || "Unknown";
                    self.viewer_info_badge.innerHTML = `SLOTS: <span style="color:#fff">${self.mixo3d_settings.material_count}</span> | INDEX: <span style="color:#fff">${self.mixo3d_settings.current_index}</span><br/>SHADER: <span style="color:#4af; font-weight:bold;">${name.toUpperCase()}</span>`;
                } else { self.viewer_info_badge.style.display = "none"; }

                // 📏 GRID
                const gridWidget = self.widgets?.find(x => x.name === "grid_size");
                const currentGridVal = gridWidget ? gridWidget.value : (self.mixo3d_settings?.grid_size || "10cm");
                if (currentGridVal !== self.__lastGridSize) {
                    self.__lastGridSize = currentGridVal;
                    self.updateGrid(currentGridVal);
                }

                // Build the current live scene state
                const activeKeys = new Set();
                let sceneObjects = [];
                const currentType = self.type || self.comfyClass || "";

                // BUILD LIVE SCENE
                if (currentType === "SceneAssembler") {
                    (self.inputs || []).forEach(inp => {
                        if (inp.name?.startsWith("mesh_id") && inp.link !== null) {
                            const link = app.graph.links[inp.link];
                            if (link) {
                                const upstream = app.graph.getNodeById(link.origin_id);
                                if (upstream) {
                                    const objs = traceScene(upstream);
                                    objs.forEach((o, i) => {
                                        o.id = `asm_${inp.name}_${i}`;
                                        sceneObjects.push(o);
                                    });
                                }
                            }
                        }
                    });

                    // Assembler fallback: If absolutely nothing from inputs, show its own last result
                    if (sceneObjects.length === 0 && self.mixo3d_last_url) {
                        sceneObjects.push({ id: "baked", url: self.mixo3d_last_url, matrix: new THREE.Matrix4(), materialState: null });
                    }
                } else {
                    const objs = traceScene(self);
                    if (objs.length > 0) {
                        objs.forEach((o, i) => { o.id = `live_${i}`; sceneObjects.push(o); });
                    } else if (self.mixo3d_last_url) {
                        sceneObjects.push({ id: "baked", url: self.mixo3d_last_url, matrix: new THREE.Matrix4(), materialState: null });
                    }
                }

                // SYNC MODELS
                sceneObjects.forEach(obj => {
                    if (!obj.url) return;
                    activeKeys.add(obj.id);

                    let model = self.compositionModels[obj.id];
                    if (!model || (model !== "LOADING" && model.__lastUrl !== obj.url)) {
                        if (model === "LOADING") return;
                        if (model && model.isObject3D) self.threeScene.remove(model);

                        self.compositionModels[obj.id] = "LOADING";
                        self.gltfLoader.load(obj.url, (gltf) => {
                            const m = gltf.scene;
                            m.__lastUrl = obj.url;
                            self.compositionModels[obj.id] = m;
                            self.threeScene.add(m);
                            self.fitCamera();
                        }, undefined, (err) => {
                            console.error("[Mixo3D] Failed to load live model:", err);
                            self.compositionModels[obj.id] = null;
                        });
                    }

                    // ⚡ FORCE MATRIX SYNC ⚡
                    if (model && model.isObject3D) {
                        model.matrixAutoUpdate = false;
                        model.matrix.copy(obj.matrix);
                        model.updateMatrixWorld(true);

                        // Handle Material Injection
                        if (obj.materialState) {
                            model.traverse(c => {
                                if (c.isMesh && c.material) {
                                    c.material.color.setRGB(obj.materialState.r, obj.materialState.g, obj.materialState.b);
                                    c.material.metalness = obj.materialState.metallic;
                                    c.material.roughness = obj.materialState.roughness;

                                    c.material.needsUpdate = true;
                                }
                            });
                        }
                    }
                });

                // REMOVE GHOSTS
                for (const key in self.compositionModels) {
                    if (!activeKeys.has(key)) {
                        const m = self.compositionModels[key];
                        if (m && m.isObject3D) self.threeScene.remove(m);
                        delete self.compositionModels[key];
                    }
                }
            }, 50);

            if (nodeData.name === "SceneAssembler") { this.onConnectionsChange = function () { setTimeout(() => { let last = 1; (this.inputs || []).forEach(i => { if (i.link !== null && i.name.startsWith("mesh_id_")) { let n = parseInt(i.name.replace("mesh_id_", "")); if (n > last) last = n; } }); const target = Math.min(last + 1, 50); if (!this.inputs.some(i => i.name === `mesh_id_${target}`)) this.addInput(`mesh_id_${target}`, "STRING"); }, 50); } }
            return r;
        };

        const onExecuted = nodeType.prototype.onExecuted;
        nodeType.prototype.onExecuted = function (message) {
            onExecuted?.apply(this, arguments);

            // Clear all previous models to prevent ghosts
            if (this.clearAllModels) {
                this.clearAllModels();
            }

            const data = message?.ui || message;
            if (data?.settings) this.mixo3d_settings = data.settings;
            if (data?.glb_url) { let path = data.glb_url[0].replace(/\\/g, "/"); let fn = path.split("/").pop(); let sub = path.includes("/") ? path.substring(0, path.lastIndexOf("/")) : ""; const url = api.apiURL(`/view?filename=${encodeURIComponent(fn)}&type=output${sub ? "&subfolder=" + encodeURIComponent(sub) : ""}`); this.mixo3d_last_url = url; }

            // Handle export path display
            if (data?.export_path && this.viewer_export_badge) {
                const exportPath = data.export_path;
                const fileName = exportPath.split(/[/\\]/).pop();
                const dirPath = exportPath.substring(0, exportPath.lastIndexOf(exportPath.includes("\\") ? "\\" : "/"));

                this.viewer_export_badge.innerHTML = `
                    <div style="margin-bottom: 6px; font-weight: bold; color: #0f0;">✓ EXPORT SUCCESSFUL</div>
                    <div style="margin-bottom: 4px; color: #ddd;">File: <span style="color: #fff; font-weight: bold;">${fileName}</span></div>
                    <div style="margin-bottom: 8px; color: #aaa; font-size: 9px;">Path: ${exportPath}</div>
                    <button id="open-explorer-btn-${this.id}" style="
                        background: linear-gradient(135deg, #0a0, #060);
                        color: white;
                        border: 1px solid #0f0;
                        padding: 6px 12px;
                        border-radius: 4px;
                        cursor: pointer;
                        font-family: monospace;
                        font-size: 10px;
                        font-weight: bold;
                        pointer-events: auto;
                        transition: all 0.2s;
                    " onmouseover="this.style.background='linear-gradient(135deg, #0c0, #080)'; this.style.transform='scale(1.05)';" 
                       onmouseout="this.style.background='linear-gradient(135deg, #0a0, #060)'; this.style.transform='scale(1)';">
                        📁 OPEN IN EXPLORER
                    </button>
                `;
                this.viewer_export_badge.style.display = "block";
                this.viewer_export_badge.style.pointerEvents = "auto";

                // Add click handler for the button
                setTimeout(() => {
                    const btn = document.getElementById(`open-explorer-btn-${this.id}`);
                    if (btn) {
                        btn.onclick = async () => {
                            try {
                                // Call ComfyUI API to open explorer
                                const response = await api.fetchApi("/mixo3d/open_explorer", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ path: dirPath })
                                });
                                if (!response.ok) {
                                    alert("Failed to open Explorer. Please open manually:\n" + dirPath);
                                }
                            } catch (e) {
                                alert("Failed to open Explorer. Please open manually:\n" + dirPath);
                            }
                        };
                    }
                }, 100);
            } else if (this.viewer_export_badge) {
                this.viewer_export_badge.style.display = "none";
            }

            // Handle statistics display
            if (data?.stats && this.viewer_stats_badge && data.settings?.show_stats !== false) {
                const stats = data.stats;
                let statsHTML = '<div style="font-weight: bold; margin-bottom: 6px; color: #4af;">📊 SCENE STATS</div>';

                if (stats.cached) {
                    statsHTML += '<div style="color: #0f0; margin-bottom: 4px;">⚡ CACHED</div>';
                }

                statsHTML += `<div style="color: #ddd;">Vertices: <span style="color: #fff; font-weight: bold;">${stats.vertices?.toLocaleString() || 'N/A'}</span></div>`;
                statsHTML += `<div style="color: #ddd;">Faces: <span style="color: #fff; font-weight: bold;">${stats.faces?.toLocaleString() || 'N/A'}</span></div>`;
                statsHTML += `<div style="color: #ddd;">Materials: <span style="color: #fff; font-weight: bold;">${stats.materials || 'N/A'}</span></div>`;
                statsHTML += `<div style="color: #ddd;">Inputs: <span style="color: #fff; font-weight: bold;">${stats.input_meshes || 'N/A'}</span></div>`;

                if (stats.optimization && stats.optimization !== 'none') {
                    statsHTML += `<div style="color: #fa0; margin-top: 4px;">⚙️ ${stats.optimization.replace('_', ' ').toUpperCase()}</div>`;
                }

                if (stats.bbox_mm) {
                    statsHTML += '<div style="margin-top: 6px; padding-top: 6px; border-top: 1px solid #444; color: #aaa; font-size: 9px;">BOUNDING BOX (mm)</div>';
                    statsHTML += `<div style="color: #ddd; font-size: 9px;">W: ${stats.bbox_mm.width.toFixed(1)} | H: ${stats.bbox_mm.height.toFixed(1)} | D: ${stats.bbox_mm.depth.toFixed(1)}</div>`;
                }

                if (stats.error) {
                    statsHTML = `<div style="color: #f00;">Error: ${stats.error}</div>`;
                }

                this.viewer_stats_badge.innerHTML = statsHTML;
                this.viewer_stats_badge.style.display = "block";
            } else if (this.viewer_stats_badge) {
                this.viewer_stats_badge.style.display = "none";
            }
        };
    }
});
