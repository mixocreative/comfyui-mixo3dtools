import os
import uuid
import folder_paths
import numpy as np
from ..core.scene_registry import registry
from ..core.mesh_model import SceneNodeData
from ..core.transform_utils import create_trs_matrix
from ..core.glb_exporter import GLBExporter

class MeshTransform:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "mesh_id": ("STRING", {"forceInput": True}),
                "pos_x": ("FLOAT", {"default": 0.0, "min": -1000.0, "max": 1000.0, "step": 0.1}),
                "pos_y": ("FLOAT", {"default": 0.0, "min": -1000.0, "max": 1000.0, "step": 0.1}),
                "pos_z": ("FLOAT", {"default": 0.0, "min": -1000.0, "max": 1000.0, "step": 0.1}),
                "rot_x": ("FLOAT", {"default": 0.0, "min": -360.0, "max": 360.0, "step": 0.1}),
                "rot_y": ("FLOAT", {"default": 0.0, "min": -360.0, "max": 360.0, "step": 0.1}),
                "rot_z": ("FLOAT", {"default": 0.0, "min": -360.0, "max": 360.0, "step": 0.1}),
                "uniform_scale": ("FLOAT", {"default": 1.0, "min": 0.001, "max": 1000.0, "step": 0.01}),
                "fov": ("FLOAT", {"default": 45.0, "min": 10.0, "max": 120.0, "step": 1.0}),
                "exposure": ("FLOAT", {"default": 1.0, "min": 0.0, "max": 5.0, "step": 0.1}),
                "bg_color": ("STRING", {"default": "#1a1a1b"}),
                "show_preview": ("BOOLEAN", {"default": True}),
            }
        }

    RETURN_TYPES = ("STRING", "STRING")
    RETURN_NAMES = ("mesh_id", "model_file")
    FUNCTION = "transform_mesh"
    CATEGORY = "mixo3dtools"

    @classmethod
    def IS_CHANGED(s, **kwargs):
        import hashlib
        h = hashlib.md5()
        for key, val in sorted(kwargs.items()):
            h.update(str(val).encode())
        return h.hexdigest()

    def transform_mesh(self, mesh_id=None, pos_x=0.0, pos_y=0.0, pos_z=0.0, 
                       rot_x=0.0, rot_y=0.0, rot_z=0.0, 
                       uniform_scale=1.0,
                       fov=45.0, exposure=1.0, bg_color="#1a1a1b", show_preview=True, **kwargs):
        # Create transform matrix
        matrix = create_trs_matrix(
            position=(pos_x, pos_y, pos_z),
            rotation=(rot_x, rot_y, rot_z),
            scale=(uniform_scale, uniform_scale, uniform_scale)
        )
        
        # Create node data
        node_data = SceneNodeData(
            mesh_id=mesh_id,
            transform=matrix
        )
        
        # Register node
        node_id = registry.register_node(node_data)
        
        # Generate preview
        out_dir = folder_paths.get_output_directory()
        subfolder = "mixo3d_cache"
        full_out_dir = os.path.join(out_dir, subfolder)
        os.makedirs(full_out_dir, exist_ok=True)
        
        preview_filename = f"preview_xform_{uuid.uuid4()}.glb"
        preview_path = os.path.join(full_out_dir, preview_filename)
        relative_out_path = os.path.join(subfolder, preview_filename)
        
        GLBExporter.export([node_id], preview_path, add_preview_helpers=False)
        
        ui_data = {
            "glb_url": [relative_out_path],
            "settings": {
                "fov": fov, "exposure": exposure, "bg_color": bg_color,
                "material_mode": "original", "up_direction": "Y",
                "show_preview": show_preview
            }
        }
        return {"ui": ui_data, "result": (node_id, relative_out_path)}

NODE_CLASS_MAPPINGS = {
    "MeshTransform": MeshTransform
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "MeshTransform": "Mesh Transform"
}
