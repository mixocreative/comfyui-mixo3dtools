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
                "material_index": ("INT", {"default": 0, "min": 0, "max": 128, "step": 1}),
                "rename_material": ("STRING", {"default": ""}),
                "texture_mode": (["Keep Existing", "Update/Replace", "Remove (Solid Color)"], {"default": "Keep Existing"}),
                "base_color_r": ("FLOAT", {"default": 1.0, "min": 0.0, "max": 1.0, "step": 0.01}),
                "base_color_g": ("FLOAT", {"default": 1.0, "min": 0.0, "max": 1.0, "step": 0.01}),
                "base_color_b": ("FLOAT", {"default": 1.0, "min": 0.0, "max": 1.0, "step": 0.01}),
                "metallic": ("FLOAT", {"default": 0.0, "min": 0.0, "max": 1.0, "step": 0.01}),
                "roughness": ("FLOAT", {"default": 0.5, "min": 0.0, "max": 1.0, "step": 0.01}),
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

    def inspect_material(self, mesh_id, material_index, rename_material, texture_mode, 
                         base_color_r, base_color_g, base_color_b, 
                         metallic, roughness, show_preview=True, 
                         base_color_texture=None, **kwargs):
        
        item = registry.get_any(mesh_id)
        if not item: return {"ui": {}, "result": ("", "")}

        target_mesh_id = mesh_id
        if isinstance(item, SceneNodeData):
            target_mesh_id = item.mesh_id
        
        mesh_data = registry.get_mesh(target_mesh_id)
        if not mesh_data: return {"ui": {}, "result": ("", "")}

        face_indices = mesh_data.face_material_indices
        if face_indices is None:
            face_indices = np.zeros(len(mesh_data.indices), dtype=np.int32)

        # Clone geometry and textures
        new_mesh_data = SceneMeshData(
            vertices=mesh_data.vertices,
            indices=mesh_data.indices,
            normals=mesh_data.normals,
            uvs=mesh_data.uvs,
            textures=mesh_data.textures.copy(),
            materials=[dict(m) for m in mesh_data.materials],
            face_material_indices=face_indices
        )
        
        while len(new_mesh_data.materials) <= material_index:
            new_mat_idx = len(new_mesh_data.materials)
            new_mesh_data.materials.append({
                "name": f"GeneratedShader_{new_mat_idx}", 
                "base_color": [0.8, 0.8, 0.8, 1.0], 
                "roughness": 0.5, 
                "metallic": 0.0
            })

        # Rename Logic
        current_mat = new_mesh_data.materials[material_index]
        if rename_material and rename_material.strip():
            current_mat["name"] = rename_material.strip()
        
        current_mat_name = current_mat.get("name", "Unknown Shader")

        # Texture Logic
        tex_key = 'base_color_texture' if material_index == 0 else f'base_color_texture_{material_index}'
        
        if texture_mode == "Remove (Solid Color)":
            if tex_key in new_mesh_data.textures:
                del new_mesh_data.textures[tex_key]
        elif texture_mode == "Update/Replace":
            if base_color_texture is not None:
                new_mesh_data.textures[tex_key] = base_color_texture

        # Update Material settings
        current_mat.update({
            "base_color": [base_color_r, base_color_g, base_color_b, 1.0],
            "metallic": metallic,
            "roughness": roughness
        })

        # Register and export preview
        # Register and export preview
        new_mesh_id = f"{target_mesh_id}_mod_{uuid.uuid4().hex[:4]}"
        registry.register_mesh(new_mesh_data, requested_id=new_mesh_id)
        
        # Preserve transform if incoming was a node
        final_id = new_mesh_id
        if isinstance(item, SceneNodeData):
            # Create a new node ID that inherits the transform but uses new mesh
            node_data = SceneNodeData(
                mesh_id=new_mesh_id,
                transform=item.transform,
                metadata=item.metadata.copy()
            )
            final_id = registry.register_node(node_data)

        out_dir = folder_paths.get_output_directory()
        subfolder = "mixo3d_cache"
        full_out_dir = os.path.join(out_dir, subfolder)
        os.makedirs(full_out_dir, exist_ok=True)
        
        preview_filename = f"preview_mat_{uuid.uuid4().hex[:8]}.glb"
        preview_path = os.path.join(full_out_dir, preview_filename)
        GLBExporter.export([final_id], preview_path, add_preview_helpers=False)

        ui_data = {
            "glb_url": [os.path.join(subfolder, preview_filename)],
            "settings": { 
                "show_preview": show_preview,
                "material_count": len(new_mesh_data.materials),
                "current_index": material_index,
                "current_name": current_mat_name
            }
        }
        
        return {"ui": ui_data, "result": (final_id, os.path.join(subfolder, preview_filename))}

NODE_CLASS_MAPPINGS = {
    "MeshMaterialInspector": MeshMaterialInspector
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "MeshMaterialInspector": "Mesh Material Inspector"
}
