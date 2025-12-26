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
                "up_direction": (["Y", "Z", "-Y", "-Z"], {"default": "Y"}),
                "material_mode": (["original", "normal", "wireframe"], {"default": "original"}),
                "fov": ("FLOAT", {"default": 45.0, "min": 10.0, "max": 120.0, "step": 1.0}),
                "exposure": ("FLOAT", {"default": 1.0, "min": 0.0, "max": 5.0, "step": 0.1}),
                "bg_color": ("STRING", {"default": "#1a1a1b"}),
                "export_format": (["glb", "obj", "stl"], {"default": "glb"}),
                "export_filename": ("STRING", {"default": "scene_export"}),
                "trigger_export": (["true", "false"], {"default": "false"}),
                "grid_unit": (["meters", "cm (10cm bed)", "mm (1cm bed)"], {"default": "meters"}),
                "grid_scale": ("FLOAT", {"default": 1.0, "min": 0.01, "max": 100.0, "step": 0.01}),
                "show_preview": ("BOOLEAN", {"default": True}),
            },
            "optional": {
            }
        }

    RETURN_TYPES = ("STRING", "STRING")
    RETURN_NAMES = ("mesh_id", "model_file")
    FUNCTION = "assemble_and_preview"
    CATEGORY = "mixo3dtools"
    OUTPUT_NODE = True

    @classmethod
    def IS_CHANGED(s, **kwargs):
        # We include all settings in the hash to trigger update on changes
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

    def assemble_and_preview(self, mesh_id_1=None, up_direction="Y", material_mode="original", 
                             fov=45.0, exposure=1.0, bg_color="#1a1a1b",
                             export_format="glb", export_filename="scene_export", 
                             trigger_export="false", grid_unit="meters", grid_scale=1.0, 
                             show_preview=True, **kwargs):
        print(f"[Mixo3D] Assembling scene...")
        id_list = []
        # Add the first mesh_id
        if mesh_id_1 and isinstance(mesh_id_1, str) and mesh_id_1.strip():
            id_list.append(mesh_id_1)
            
        # Support dynamic inputs from mesh_id_2 up to 50
        for i in range(2, 51):
            val = kwargs.get(f"mesh_id_{i}")
            if val:
                if isinstance(val, list):
                    id_list.extend(val)
                elif isinstance(val, str) and val.strip():
                    id_list.append(val)

        if not id_list:
            return {"ui": {}, "result": ("", "")}

        # Determine full export path
        output_dir = folder_paths.get_output_directory()
        actual_export_filename = f"{export_filename}.{export_format}"
        glb_path = os.path.join(output_dir, actual_export_filename)

        # Temp preview path (always GLB for viewer)
        import uuid
        out_dir = folder_paths.get_output_directory()
        subfolder = "mixo3d_cache"
        full_out_dir = os.path.join(out_dir, subfolder)
        os.makedirs(full_out_dir, exist_ok=True)
        
        preview_filename = f"preview_scene_{uuid.uuid4()}.glb"
        preview_path = os.path.join(full_out_dir, preview_filename)
        relative_out_path = os.path.join(subfolder, preview_filename)
        
        GLBExporter.export(id_list, preview_path, add_preview_helpers=False)
        
        if trigger_export == "true":
            # Final production export (no preview helpers)
            GLBExporter.export(id_list, glb_path, add_preview_helpers=False, file_type=export_format)
            print(f"[Mixo3D] Scene exported to: {glb_path}")

        ui_data = {
            "glb_url": [relative_out_path],
            "settings": {
                "fov": fov,
                "exposure": exposure,
                "bg_color": bg_color,
                "material_mode": material_mode,
                "up_direction": up_direction,
                "grid_unit": grid_unit,
                "grid_scale": grid_scale,
                "show_preview": show_preview
            }
        }

        res_id = id_list[0] if id_list else ""
        return {"ui": ui_data, "result": (res_id, relative_out_path)}

NODE_CLASS_MAPPINGS = {
    "SceneAssembler": SceneAssembler
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "SceneAssembler": "Scene Assembler"
}
