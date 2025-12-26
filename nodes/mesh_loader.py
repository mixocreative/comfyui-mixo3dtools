import os
import torch
import numpy as np
import trimesh
import folder_paths
from ..core.scene_registry import registry
from ..core.mesh_model import SceneMeshData

class MeshFromPath:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "mesh_path": ("STRING", {"default": ""}),
                "mesh_id": ("STRING", {"default": "model_path_1"}),
            }
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("mesh_id",)
    FUNCTION = "import_mesh"
    CATEGORY = "mixo3dtools"

    def import_mesh(self, mesh_path, mesh_id, **kwargs):
        try:
            import trimesh
            final_path = mesh_path
            if not os.path.exists(final_path):
                 # Check Input Dir fallback
                inp_path = os.path.join(folder_paths.get_input_directory(), mesh_path)
                if os.path.exists(inp_path):
                    final_path = inp_path
                else:
                    raise FileNotFoundError(f"Path not found: {mesh_path}")

            scene_or_mesh = trimesh.load(final_path)
            
            def process_tm(tm_mesh):
                m_data = SceneMeshData(
                    vertices=np.array(tm_mesh.vertices, dtype=np.float32),
                    indices=np.array(tm_mesh.faces, dtype=np.int32),
                    normals=np.array(tm_mesh.vertex_normals, dtype=np.float32) if hasattr(tm_mesh, 'vertex_normals') else None,
                    uvs=np.array(tm_mesh.visual.uv, dtype=np.float32) if hasattr(tm_mesh.visual, 'uv') else None
                )
                try:
                    if hasattr(tm_mesh.visual, 'material'):
                        mat = tm_mesh.visual.material
                        m_data.materials = [{
                            "base_color": list(mat.baseColorFactor) if hasattr(mat, 'baseColorFactor') else [0.8, 0.8, 0.8, 1.0],
                            "metallic": float(getattr(mat, 'metallicFactor', 0.0)),
                            "roughness": float(getattr(mat, 'roughnessFactor', 0.5)),
                        }]
                        if hasattr(mat, 'baseColorTexture') and mat.baseColorTexture is not None:
                            m_data.textures['base_color_texture'] = mat.baseColorTexture
                        elif hasattr(mat, 'image') and mat.image is not None:
                            m_data.textures['base_color_texture'] = mat.image
                except:
                    m_data.materials = [{"base_color": [0.8, 0.8, 0.8, 1.0], "roughness": 0.5, "metallic": 0.0}]
                return m_data

            if isinstance(scene_or_mesh, trimesh.Scene):
                mesh_data = process_tm(scene_or_mesh.dump(concatenate=True))
            else:
                mesh_data = process_tm(scene_or_mesh)

            mesh_id = registry.register_mesh(mesh_data, requested_id=mesh_id)
            return (mesh_id,)

        except Exception as e:
            print(f"[Mixo3D] ERROR: {str(e)}")
            return ("",)

NODE_CLASS_MAPPINGS = {
    "MeshFromPath": MeshFromPath
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "MeshFromPath": "Mesh From Path (Mixo3D)"
}
