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
                "grid_size": (["10cm", "20cm", "30cm"], {"default": "10cm"}),
                "export_format": (["glb", "obj", "stl"], {"default": "glb"}),
                "export_filename": ("STRING", {"default": "scene_export"}),
                "trigger_export": (["true", "false"], {"default": "false"}),
                "show_preview": ("BOOLEAN", {"default": True}),
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

    def assemble_and_preview(self, mesh_id_1=None, up_direction="Y", material_mode="original", 
                             fov=45.0, exposure=1.0, bg_color="#1a1a1b", grid_size="10cm",
                             export_format="glb", export_filename="scene_export", 
                             trigger_export="false", show_preview=True, **kwargs):
        
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

        output_dir = folder_paths.get_output_directory()
        actual_export_filename = f"{export_filename}.{export_format}"
        glb_path = os.path.join(output_dir, actual_export_filename)

        import uuid
        subfolder = "mixo3d_cache"
        full_out_dir = os.path.join(output_dir, subfolder)
        os.makedirs(full_out_dir, exist_ok=True)
        
        preview_filename = f"preview_scene_{uuid.uuid4()}.glb"
        preview_path = os.path.join(full_out_dir, preview_filename)
        relative_out_path = os.path.join(subfolder, preview_filename)
        
        GLBExporter.export(id_list, preview_path, add_preview_helpers=False)
        
        if trigger_export == "true":
            GLBExporter.export(id_list, glb_path, add_preview_helpers=False, file_type=export_format)

        ui_data = {
            "glb_url": [relative_out_path],
            "settings": {
                "fov": fov, "exposure": exposure, "bg_color": bg_color,
                "material_mode": material_mode, "up_direction": up_direction,
                "grid_size": grid_size,
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
