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
                inp_path = os.path.join(folder_paths.get_input_directory(), mesh_path)
                if os.path.exists(inp_path): final_path = inp_path
                else: raise FileNotFoundError(f"Path not found: {mesh_path}")

            scene_or_mesh = trimesh.load(final_path)
            
            if isinstance(scene_or_mesh, trimesh.Scene):
                all_verts = []
                all_faces = []
                all_normals = []
                all_uvs = []
                all_mats = []
                all_face_mat_indices = []
                
                v_offset = 0
                mat_cache = {} 

                for name, mesh in scene_or_mesh.geometry.items():
                    mat_obj = getattr(mesh.visual, 'material', None)
                    mat_key = str(id(mat_obj)) if mat_obj else "default"
                    
                    if mat_key not in mat_cache:
                        mat_idx = len(all_mats)
                        mat_cache[mat_key] = mat_idx
                        # Extract material data with NAME
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

                mesh_data = SceneMeshData(
                    vertices=np.vstack(all_verts) if all_verts else np.zeros((0,3)),
                    indices=np.vstack(all_faces) if all_faces else np.zeros((0,3), dtype=np.int32),
                    normals=np.vstack(all_normals) if all_normals else None,
                    uvs=np.vstack(all_uvs) if all_uvs else None,
                    materials=all_mats,
                    face_material_indices=np.concatenate(all_face_mat_indices) if all_face_mat_indices else None
                )
            else:
                mesh = scene_or_mesh
                m_obj = getattr(mesh.visual, 'material', None)
                m_name = getattr(m_obj, 'name', "DefaultMaterial")
                if not m_name: m_name = "DefaultMaterial"
                
                m_info = {"name": m_name, "base_color": [0.8, 0.8, 0.8, 1.0], "metallic": 0.0, "roughness": 0.5}
                if m_obj and hasattr(m_obj, 'baseColorFactor'):
                    m_info["base_color"] = list(m_obj.baseColorFactor)
                    m_info["metallic"] = float(getattr(m_obj, 'metallicFactor', 0.0))
                    m_info["roughness"] = float(getattr(m_obj, 'roughnessFactor', 0.5))

                mesh_data = SceneMeshData(
                    vertices=np.array(mesh.vertices, dtype=np.float32),
                    indices=np.array(mesh.faces, dtype=np.int32),
                    normals=np.array(mesh.vertex_normals, dtype=np.float32) if hasattr(mesh, 'vertex_normals') else None,
                    uvs=np.array(mesh.visual.uv, dtype=np.float32) if hasattr(mesh.visual, 'uv') else None,
                    materials=[m_info],
                    face_material_indices=np.zeros(len(mesh.faces), dtype=np.int32)
                )

            registry.register_mesh(mesh_data, requested_id=mesh_id)
            return (mesh_id,)

        except Exception as e:
            print(f"[Mixo3D] ERROR: {str(e)}")
            return ("",)

NODE_CLASS_MAPPINGS = {
    "MeshFromPath": MeshFromPath
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "MeshFromPath": "Mesh From Path"
}
