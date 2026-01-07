import os
import folder_paths
from ..core.scene_registry import registry
from ..core.glb_exporter import GLBExporter

class SceneAssembler:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "mesh_id_1": ("STRING", {"forceInput": True}),
                "scene_name": ("STRING", {"default": "assembled_scene"}),
                "up_direction": (["Y", "Z", "-Y", "-Z"], {"default": "Y"}),
                "material_mode": (["original", "normal", "wireframe"], {"default": "original"}),
                "fov": ("FLOAT", {"default": 45.0, "min": 10.0, "max": 120.0, "step": 1.0}),
                "exposure": ("FLOAT", {"default": 1.0, "min": 0.0, "max": 5.0, "step": 0.1}),
                "bg_color": ("STRING", {"default": "#1a1a1b"}),
                "grid_size": (["10cm", "20cm", "30cm"], {"default": "10cm"}),
                "optimize_mesh": (["none", "weld_vertices", "full"], {"default": "none"}),
                "use_cache": ("BOOLEAN", {"default": True}),
                "export_format": (["glb", "obj", "stl"], {"default": "glb"}),
                "export_filename": ("STRING", {"default": "scene_export"}),
                "export_directory": ("STRING", {"default": ""}),
                "trigger_export": (["true", "false"], {"default": "false"}),
                "show_preview": ("BOOLEAN", {"default": True}),
                "show_stats": ("BOOLEAN", {"default": True}),
            }
        }

    RETURN_TYPES = ("STRING", "STRING")
    RETURN_NAMES = ("mesh_id", "model_file")
    FUNCTION = "assemble_and_preview"
    CATEGORY = "mixo3dtools"
    OUTPUT_NODE = True

    @classmethod
    def IS_CHANGED(s, **kwargs):
        import hashlib
        h = hashlib.md5()
        for key, val in sorted(kwargs.items()):
            if val is None: continue
            if key.startswith("mesh_id_"):
                item = registry.get_any(val)
                if item:
                    h.update(item.get_hash().encode())
            else:
                h.update(str(val).encode())
        return h.hexdigest()

    def assemble_and_preview(self, mesh_id_1=None, scene_name="assembled_scene", 
                             up_direction="Y", material_mode="original", 
                             fov=45.0, exposure=1.0, bg_color="#1a1a1b", grid_size="10cm",
                             optimize_mesh="none", use_cache=True,
                             export_format="glb", export_filename="scene_export", 
                             export_directory="", trigger_export="false", 
                             show_preview=True, show_stats=True, **kwargs):
        
        id_list = []
        if mesh_id_1 and isinstance(mesh_id_1, str) and mesh_id_1.strip():
            id_list.append(mesh_id_1)
            
        for i in range(2, 51):
            val = kwargs.get(f"mesh_id_{i}")
            if val:
                if isinstance(val, list): id_list.extend(val)
                elif isinstance(val, str) and val.strip(): id_list.append(val)

        if not id_list:
            return {"ui": {}, "result": ("", "")}

        import uuid
        import trimesh
        import numpy as np
        import hashlib
        from ..core.mesh_model import SceneMeshData
        
        # Sanitize scene name for filename
        safe_scene_name = "".join(c for c in scene_name if c.isalnum() or c in (' ', '_', '-')).strip()
        if not safe_scene_name:
            safe_scene_name = "assembled_scene"
        safe_scene_name = safe_scene_name.replace(' ', '_')
        
        # Generate cache key from inputs
        cache_key = hashlib.md5()
        for mesh_id in sorted(id_list):
            item = registry.get_any(mesh_id)
            if item:
                cache_key.update(item.get_hash().encode())
        cache_key.update(optimize_mesh.encode())
        cache_hash = cache_key.hexdigest()[:8]
        
        # Create a persistent combined GLB file for the assembled scene
        output_dir = folder_paths.get_output_directory()
        subfolder = "mixo3d_assembled"
        full_out_dir = os.path.join(output_dir, subfolder)
        os.makedirs(full_out_dir, exist_ok=True)
        
        # Generate scene ID with custom name and cache hash
        scene_id = f"{safe_scene_name}_{cache_hash}"
        combined_filename = f"{scene_id}.glb"
        combined_path = os.path.join(full_out_dir, combined_filename)
        relative_combined_path = os.path.join(subfolder, combined_filename)
        
        # Check if cached version exists
        use_existing = False
        stats = {}
        
        if use_cache and os.path.exists(combined_path):
            # Check if mesh is already registered
            existing_mesh = registry.get_mesh(scene_id)
            if existing_mesh:
                print(f"[Mixo3D] Using cached scene: {scene_id}")
                use_existing = True
                # Get stats from existing mesh
                stats = {
                    "vertices": len(existing_mesh.vertices),
                    "faces": len(existing_mesh.indices) if existing_mesh.indices is not None else 0,
                    "materials": len(existing_mesh.materials),
                    "input_meshes": existing_mesh.metadata.get("input_count", len(id_list)),
                    "cached": True
                }
        
        if not use_existing:
            # Export the combined scene to a persistent GLB file
            GLBExporter.export(id_list, combined_path, add_preview_helpers=False)
            
            # Apply mesh optimization if requested
            if optimize_mesh != "none":
                try:
                    mesh_to_optimize = trimesh.load(combined_path)
                    
                    if optimize_mesh == "weld_vertices":
                        # Merge duplicate vertices
                        if isinstance(mesh_to_optimize, trimesh.Scene):
                            for name, geom in mesh_to_optimize.geometry.items():
                                geom.merge_vertices()
                        else:
                            mesh_to_optimize.merge_vertices()
                        print(f"[Mixo3D] Applied vertex welding optimization")
                    
                    elif optimize_mesh == "full":
                        # Full optimization: weld + remove duplicates + fix normals
                        if isinstance(mesh_to_optimize, trimesh.Scene):
                            for name, geom in mesh_to_optimize.geometry.items():
                                geom.merge_vertices()
                                geom.remove_duplicate_faces()
                                geom.fix_normals()
                        else:
                            mesh_to_optimize.merge_vertices()
                            mesh_to_optimize.remove_duplicate_faces()
                            mesh_to_optimize.fix_normals()
                        print(f"[Mixo3D] Applied full mesh optimization")
                    
                    # Re-export optimized mesh
                    mesh_to_optimize.export(combined_path, file_type='glb')
                except Exception as e:
                    print(f"[Mixo3D] Warning: Optimization failed: {e}")
            
            # Load the combined GLB back and register it as a new mesh
            try:
                combined_mesh = trimesh.load(combined_path)
                
                # Handle both Scene and Mesh types
                if isinstance(combined_mesh, trimesh.Scene):
                    # Merge all geometries in the scene
                    all_verts = []
                    all_faces = []
                    all_normals = []
                    all_uvs = []
                    all_mats = []
                    all_face_mat_indices = []
                    
                    v_offset = 0
                    mat_cache = {}
                    
                    for name, mesh in combined_mesh.geometry.items():
                        mat_obj = getattr(mesh.visual, 'material', None)
                        mat_key = str(id(mat_obj)) if mat_obj else "default"
                        
                        if mat_key not in mat_cache:
                            mat_idx = len(all_mats)
                            mat_cache[mat_key] = mat_idx
                            m_name = getattr(mat_obj, 'name', f"Material_{mat_idx}")
                            if not m_name: m_name = f"Material_{mat_idx}"
                            
                            m_info = {
                                "name": m_name,
                                "base_color": [0.8, 0.8, 0.8, 1.0],
                                "metallic": 0.0,
                                "roughness": 0.5
                            }
                            if mat_obj and hasattr(mat_obj, 'baseColorFactor'):
                                m_info["base_color"] = list(mat_obj.baseColorFactor)
                                m_info["metallic"] = float(getattr(mat_obj, 'metallicFactor', 0.0))
                                m_info["roughness"] = float(getattr(mat_obj, 'roughnessFactor', 0.5))
                            all_mats.append(m_info)
                        
                        m_idx = mat_cache[mat_key]
                        all_verts.append(mesh.vertices)
                        all_faces.append(mesh.faces + v_offset)
                        if hasattr(mesh, 'vertex_normals'): all_normals.append(mesh.vertex_normals)
                        if hasattr(mesh.visual, 'uv'): all_uvs.append(mesh.visual.uv)
                        else: all_uvs.append(np.zeros((len(mesh.vertices), 2)))
                        
                        all_face_mat_indices.append(np.full(len(mesh.faces), m_idx, dtype=np.int32))
                        v_offset += len(mesh.vertices)
                    
                    combined_mesh_data = SceneMeshData(
                        vertices=np.vstack(all_verts) if all_verts else np.zeros((0,3)),
                        indices=np.vstack(all_faces) if all_faces else np.zeros((0,3), dtype=np.int32),
                        normals=np.vstack(all_normals) if all_normals else None,
                        uvs=np.vstack(all_uvs) if all_uvs else None,
                        materials=all_mats,
                        face_material_indices=np.concatenate(all_face_mat_indices) if all_face_mat_indices else None,
                        metadata={"source": "scene_assembler", "input_count": len(id_list), "optimization": optimize_mesh}
                    )
                else:
                    # Single mesh
                    mesh = combined_mesh
                    m_obj = getattr(mesh.visual, 'material', None)
                    m_name = getattr(m_obj, 'name', "CombinedMaterial")
                    
                    m_info = {"name": m_name, "base_color": [0.8, 0.8, 0.8, 1.0], "metallic": 0.0, "roughness": 0.5}
                    if m_obj and hasattr(m_obj, 'baseColorFactor'):
                        m_info["base_color"] = list(m_obj.baseColorFactor)
                        m_info["metallic"] = float(getattr(m_obj, 'metallicFactor', 0.0))
                        m_info["roughness"] = float(getattr(m_obj, 'roughnessFactor', 0.5))
                    
                    combined_mesh_data = SceneMeshData(
                        vertices=np.array(mesh.vertices, dtype=np.float32),
                        indices=np.array(mesh.faces, dtype=np.int32),
                        normals=np.array(mesh.vertex_normals, dtype=np.float32) if hasattr(mesh, 'vertex_normals') else None,
                        uvs=np.array(mesh.visual.uv, dtype=np.float32) if hasattr(mesh.visual, 'uv') else None,
                        materials=[m_info],
                        face_material_indices=np.zeros(len(mesh.faces), dtype=np.int32),
                        metadata={"source": "scene_assembler", "input_count": len(id_list), "optimization": optimize_mesh}
                    )
                
                # Register the combined mesh with the scene_id
                registry.register_mesh(combined_mesh_data, requested_id=scene_id)
                
                # Calculate statistics
                stats = {
                    "vertices": len(combined_mesh_data.vertices),
                    "faces": len(combined_mesh_data.indices) if combined_mesh_data.indices is not None else 0,
                    "materials": len(combined_mesh_data.materials),
                    "input_meshes": len(id_list),
                    "cached": False,
                    "optimization": optimize_mesh
                }
                
                # Calculate bounding box
                if len(combined_mesh_data.vertices) > 0:
                    bbox_min = combined_mesh_data.vertices.min(axis=0)
                    bbox_max = combined_mesh_data.vertices.max(axis=0)
                    bbox_size = bbox_max - bbox_min
                    stats["bbox_mm"] = {
                        "width": float(bbox_size[0]),
                        "height": float(bbox_size[1]),
                        "depth": float(bbox_size[2])
                    }
                
            except Exception as e:
                print(f"[Mixo3D] Warning: Could not register combined mesh: {e}")
                # Still continue with the file output
                stats = {"error": str(e)}
        
        # Handle optional user export
        export_path = None
        if trigger_export == "true":
            # Determine export directory
            if export_directory and export_directory.strip():
                export_dir = export_directory.strip()
                os.makedirs(export_dir, exist_ok=True)
            else:
                export_dir = folder_paths.get_output_directory()
            
            actual_export_filename = f"{export_filename}.{export_format}"
            export_file_path = os.path.join(export_dir, actual_export_filename)
            GLBExporter.export(id_list, export_file_path, add_preview_helpers=False, file_type=export_format)
            export_path = os.path.abspath(export_file_path)

        ui_data = {
            "glb_url": [relative_combined_path],
            "settings": {
                "fov": fov, "exposure": exposure, "bg_color": bg_color,
                "material_mode": material_mode, "up_direction": up_direction,
                "grid_size": grid_size,
                "show_preview": show_preview,
                "show_stats": show_stats
            }
        }
        
        # Add statistics if enabled
        if show_stats and stats:
            ui_data["stats"] = stats
        
        # Add export path to UI data if export was triggered
        if export_path:
            ui_data["export_path"] = export_path

        # Return the new scene_id and the persistent combined file path
        return {"ui": ui_data, "result": (scene_id, relative_combined_path)}

NODE_CLASS_MAPPINGS = {
    "SceneAssembler": SceneAssembler
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "SceneAssembler": "Scene Assembler"
}
