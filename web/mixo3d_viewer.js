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
        const supported = ["SceneAssembler", "MeshMaterialInspector", "MeshTransform"];
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
                this.threeCamera = new THREE.PerspectiveCamera(45, 1, 0.1, 50000); // Zoomed out for MM scale
                this.threeCamera.position.set(150, 150, 150); // Moved back for 100mm cube
                this.threeRenderer = new THREE.WebGLRenderer({ canvas: this.viewer_element, antialias: true, alpha: true, logarithmicDepthBuffer: true });
                this.threeRenderer.setPixelRatio(window.devicePixelRatio);
                this.threeControls = new THREE.OrbitControls(this.threeCamera, this.viewer_element);
                this.threeControls.enableDamping = true;
                this.threeScene.add(new THREE.AmbientLight(0xffffff, 0.8));
                const sun = new THREE.DirectionalLight(0xffffff, 0.6); sun.position.set(500, 1000, 700);
                this.threeScene.add(sun);

                this.updateGrid("10cm");
                this.compositionModels = {};
                this.gltfLoader = new THREE.GLTFLoader();
                const animate = () => { if (!this.threeRenderer) return; requestAnimationFrame(animate); this.threeControls.update(); this.threeRenderer.render(this.threeScene, this.threeCamera); };
                animate(); syncSize();
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

            const traceScene = (node, inputToFollow = null, depth = 0, visited = new Set()) => {
                if (!node || depth > 20 || visited.has(node.id)) return [];
                visited.add(node.id);
                let list = [];
                let localRes = { url: node.mixo3d_last_url || null, matrix: new THREE.Matrix4(), materialIds: [] };
                if (node.comfyClass === "MeshMaterialInspector") localRes.materialIds.push(node.id);
                if (!localRes.url && node.widgets && (node.comfyClass === "MeshFromPath")) {
                    const widgets = node.widgets || [];
                    const path = (widgets.find(x => x.name === "mesh_path"))?.value;
                    if (path && (path.toLowerCase().endsWith(".glb") || path.toLowerCase().endsWith(".gltf"))) {
                        const fn = path.split(/[/\\]/).pop(); const type = path.includes("mixo3d_cache") ? "output" : "input";
                        const sub = path.includes("mixo3d_cache") ? "mixo3d_cache" : "";
                        localRes.url = api.apiURL(`/view?filename=${encodeURIComponent(fn)}&type=${type}${sub ? "&subfolder=" + encodeURIComponent(sub) : ""}`);
                    }
                }
                if (inputToFollow) {
                    const inp = node.inputs?.find(x => x.name === inputToFollow);
                    if (inp && inp.link !== null) {
                        const link = app.graph.links[inp.link];
                        if (link) {
                            const upstream = app.graph.getNodeById(link.origin_id);
                            list = [...list, ...traceScene(upstream, null, depth + 1, visited)];
                        }
                    }
                } else if (node.comfyClass === "SceneAssembler") {
                    if (!localRes.url) {
                        (node.inputs || []).forEach(inp => {
                            if (inp.name?.startsWith("mesh_id") && inp.link !== null) {
                                const link = app.graph.links[inp.link];
                                if (link) {
                                    const upstream = app.graph.getNodeById(link.origin_id);
                                    list = [...list, ...traceScene(upstream, null, depth + 1, visited)];
                                }
                            }
                        });
                    }
                } else if (node.inputs) {
                    const inp = node.inputs.find(x => x.name === "mesh_id" || x.name === "mesh_id_1");
                    if (inp && inp.link !== null) {
                        const link = app.graph.links[inp.link];
                        if (link) {
                            const upstream = app.graph.getNodeById(link.origin_id);
                            list = [...list, ...traceScene(upstream, null, depth + 1, visited)];
                        }
                    }
                }
                if (localRes.url && list.length === 0) list.push(localRes);
                if (node.comfyClass === "MeshTransform") {
                    const gW = (n) => node.widgets?.find(x => x.name === n)?.value || 0;
                    const s = gW("uniform_scale") || 1;
                    const lM = new THREE.Matrix4().compose(new THREE.Vector3(gW("pos_x"), gW("pos_y"), gW("pos_z")), new THREE.Quaternion().setFromEuler(new THREE.Euler(gW("rot_x") * 0.01745, gW("rot_y") * 0.01745, gW("rot_z") * 0.01745)), new THREE.Vector3(s, s, s));
                    list.forEach(o => o.matrix.multiply(lM));
                }
                if (node.comfyClass === "MeshMaterialInspector") list.forEach(o => o.materialIds.push(node.id));
                return list;
            };

            this.monitor = setInterval(() => {
                if (!self.viewer_element || !window.mixo3d_libs_loaded) return;
                const showPreview = self.widgets?.find(x => x.name === "show_preview")?.value !== false;
                if (!showPreview) { if (container.style.display !== "none") { container.style.display = "none"; self.setDirtyCanvas(true); } return; } else { if (container.style.display === "none") { container.style.display = "flex"; self.setDirtyCanvas(true); } }
                const nodeWidth = self.size[0]; const targetHeight = Math.floor(nodeWidth * 0.75);
                if (Math.abs(parseFloat(container.style.height) - targetHeight) > 1) { container.style.height = targetHeight + "px"; widget.y = self.size[1]; self.setDirtyCanvas(true); }
                if (!self.threeScene) { self.initEngine(); return; }
                syncSize();

                if (self.mixo3d_settings && self.mixo3d_settings.material_count !== undefined) {
                    self.viewer_info_badge.style.display = "block";
                    const name = self.mixo3d_settings.current_name || "Unknown";
                    self.viewer_info_badge.innerHTML = `SLOTS: <span style="color:#fff">${self.mixo3d_settings.material_count}</span> | INDEX: <span style="color:#fff">${self.mixo3d_settings.current_index}</span><br/>SHADER: <span style="color:#4af; font-weight:bold;">${name.toUpperCase()}</span>`;
                } else { self.viewer_info_badge.style.display = "none"; }

                const gridWidget = self.widgets?.find(x => x.name === "grid_size");
                const currentGridVal = gridWidget ? gridWidget.value : (self.mixo3d_settings?.grid_size || "10cm");
                if (currentGridVal !== self.__lastGridSize) {
                    self.__lastGridSize = currentGridVal;
                    self.updateGrid(currentGridVal);
                }

                const active = new Set();
                const nodeInputs = (nodeData.name === "SceneAssembler") ? (self.inputs || []) : [{ name: "mesh_id", link: null }];
                nodeInputs.forEach(inp => {
                    if (nodeData.name === "SceneAssembler" && (inp.link === null || inp.link === undefined)) return;
                    const sceneObjects = traceScene(self, (nodeData.name === "SceneAssembler" ? inp.name : null));
                    sceneObjects.forEach((obj, subIdx) => {
                        if (!obj.url) return;
                        const idx = `${inp.name}_${subIdx}`; active.add(idx);
                        if (!self.compositionModels[idx] || self.compositionModels[idx].__lastUrl !== obj.url) {
                            if (self.compositionModels[idx] && self.compositionModels[idx].isGroup) self.threeScene.remove(self.compositionModels[idx]);
                            self.compositionModels[idx] = "LOADING";
                            self.gltfLoader.load(obj.url, (g) => { self.threeScene.add(g.scene); g.scene.__lastUrl = obj.url; self.compositionModels[idx] = g.scene; self.fitCamera(); }, undefined, () => self.compositionModels[idx] = null);
                        }
                        const m = self.compositionModels[idx];
                        if (m && m !== "LOADING") {
                            obj.matrix.decompose(m.position, m.quaternion, m.scale);
                            if (obj.materialIds.length > 0) {
                                const matNode = app.graph.getNodeById(obj.materialIds[0]);
                                if (matNode) {
                                    const gM = (n) => matNode.widgets?.find(x => x.name === n)?.value;
                                    if (gM("base_color_r") !== undefined) {
                                        m.traverse(c => { if (c.isMesh && c.material) { c.material.color.setRGB(gM("base_color_r"), gM("base_color_g"), gM("base_color_b")); c.material.roughness = gM("roughness") ?? 0.5; c.material.metalness = gM("metallic") ?? 0; } });
                                    }
                                }
                            }
                        }
                    });
                });
                for (const k in self.compositionModels) { if (!active.has(k)) { if (self.compositionModels[k] && self.compositionModels[k].isGroup) self.threeScene.remove(self.compositionModels[k]); delete self.compositionModels[k]; self.fitCamera(); } }
            }, 100);

            if (nodeData.name === "SceneAssembler") { this.onConnectionsChange = function () { setTimeout(() => { let last = 1; (this.inputs || []).forEach(i => { if (i.link !== null && i.name.startsWith("mesh_id_")) { let n = parseInt(i.name.replace("mesh_id_", "")); if (n > last) last = n; } }); const target = Math.min(last + 1, 50); if (!this.inputs.some(i => i.name === `mesh_id_${target}`)) this.addInput(`mesh_id_${target}`, "STRING"); }, 50); } }
            return r;
        };

        const onExecuted = nodeType.prototype.onExecuted;
        nodeType.prototype.onExecuted = function (message) {
            onExecuted?.apply(this, arguments);
            const data = message?.ui || message;
            if (data?.settings) this.mixo3d_settings = data.settings;
            if (data?.glb_url) { let path = data.glb_url[0].replace(/\\/g, "/"); let fn = path.split("/").pop(); let sub = path.includes("/") ? path.substring(0, path.lastIndexOf("/")) : ""; const url = api.apiURL(`/view?filename=${encodeURIComponent(fn)}&type=output${sub ? "&subfolder=" + encodeURIComponent(sub) : ""}`); this.mixo3d_last_url = url; }
        };
    }
});
