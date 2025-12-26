import os
import uuid
import torch
import numpy as np
import folder_paths
from ..core.scene_registry import registry
from ..core.mesh_model import SceneNodeData, SceneMeshData
from ..core.glb_exporter import GLBExporter

class MeshMaterialInspector:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "mesh_id": ("STRING", {"forceInput": True}),
                "base_color_r": ("FLOAT", {"default": 1.0, "min": 0.0, "max": 1.0, "step": 0.01}),
                "base_color_g": ("FLOAT", {"default": 1.0, "min": 0.0, "max": 1.0, "step": 0.01}),
                "base_color_b": ("FLOAT", {"default": 1.0, "min": 0.0, "max": 1.0, "step": 0.01}),
                "metallic": ("FLOAT", {"default": 0.0, "min": 0.0, "max": 1.0, "step": 0.01}),
                "roughness": ("FLOAT", {"default": 0.5, "min": 0.0, "max": 1.0, "step": 0.01}),
                "fov": ("FLOAT", {"default": 45.0, "min": 10.0, "max": 120.0, "step": 1.0}),
                "exposure": ("FLOAT", {"default": 1.0, "min": 0.0, "max": 5.0, "step": 0.1}),
                "bg_color": ("STRING", {"default": "#1a1a1b"}),
                "show_preview": ("BOOLEAN", {"default": True}),
            },
            "optional": {
                "base_color_texture": ("IMAGE",),
            }
        }

    RETURN_TYPES = ("STRING", "STRING")
    RETURN_NAMES = ("mesh_id", "model_file")
    FUNCTION = "inspect_material"
    CATEGORY = "mixo3dtools"

    def inspect_material(self, mesh_id, base_color_r, base_color_g, base_color_b, 
                         metallic, roughness, fov, exposure, bg_color, show_preview=True, 
                         base_color_texture=None, **kwargs):
        
        # Get existing mesh or node
        item = registry.get_any(mesh_id)
        if not item:
            return {"ui": {}, "result": ("", "")}

        # If it's a node, get its mesh
        target_mesh_id = mesh_id
        if isinstance(item, SceneNodeData):
            target_mesh_id = item.mesh_id
        
        mesh_data = registry.get_mesh(target_mesh_id)
        if not mesh_data:
            return {"ui": {}, "result": ("", "")}

        # Create a copy of mesh data with new material
        new_mesh_data = SceneMeshData(
            vertices=mesh_data.vertices,
            indices=mesh_data.indices,
            normals=mesh_data.normals,
            uvs=mesh_data.uvs,
            textures=mesh_data.textures.copy()
        )
        
        # Update material
        new_mesh_data.materials = [{
            "base_color": [base_color_r, base_color_g, base_color_b, 1.0],
            "metallic": metallic,
            "roughness": roughness
        }]
        
        # Update texture if provided
        if base_color_texture is not None:
            new_mesh_data.textures['base_color_texture'] = base_color_texture

        # Register as a NEW mesh to avoid side effects
        new_id = f"{target_mesh_id}_mod_{uuid.uuid4().hex[:8]}"
        registry.register_mesh(new_mesh_data, requested_id=new_id)

        # Generate preview
        out_dir = folder_paths.get_output_directory()
        subfolder = "mixo3d_cache"
        full_out_dir = os.path.join(out_dir, subfolder)
        os.makedirs(full_out_dir, exist_ok=True)
        
        preview_filename = f"preview_mat_{uuid.uuid4()}.glb"
        preview_path = os.path.join(full_out_dir, preview_filename)
        relative_out_path = os.path.join(subfolder, preview_filename)
        
        # Export this specific mesh
        GLBExporter.export([new_id], preview_path, add_preview_helpers=False)

        ui_data = {
            "glb_url": [relative_out_path],
            "settings": {
                "fov": fov, "exposure": exposure, "bg_color": bg_color,
                "base_color_r": base_color_r, "base_color_g": base_color_g, "base_color_b": base_color_b,
                "metallic": metallic, "roughness": roughness,
                "show_preview": show_preview
            }
        }
        
        return {"ui": ui_data, "result": (new_id, relative_out_path)}

NODE_CLASS_MAPPINGS = {
    "MeshMaterialInspector": MeshMaterialInspector
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "MeshMaterialInspector": "Mesh Material Inspector"
}
