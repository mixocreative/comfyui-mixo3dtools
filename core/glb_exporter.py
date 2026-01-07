import trimesh
import numpy as np
import torch
import os
from PIL import Image
from typing import List
from .scene_registry import registry
from .mesh_model import SceneNodeData, SceneMeshData
from .transform_utils import apply_transform

class GLBExporter:
    @staticmethod
    def gather_node_data(node_id, current_transform=None):
        """
        Recursively trace nodes and meshes to get final baked state.
        Returns a list of (mesh_data, final_transform).
        """
        if current_transform is None:
            current_transform = np.eye(4)
            
        item = registry.get_any(node_id)
        if not item:
            return []
            
        if isinstance(item, SceneNodeData):
            # Transform stacking: New = Parent * Child
            new_transform = current_transform @ item.transform
            return GLBExporter.gather_node_data(item.mesh_id, new_transform)
        elif isinstance(item, SceneMeshData):
            return [(item, current_transform)]
        return []
    @staticmethod
    def export(node_ids: List[str], output_path: str, add_preview_helpers: bool = False, 
               file_type: str = 'glb', up_direction: str = "Y"):
        """
        Bake transforms, merge meshes, and export a single 3D file with multi-material support.
        """
        combined_meshes = []
        
        # 🔄 Scene-wide Orientation Matrix (Convert to standard Y-up GLTF)
        # We rotate the entire assembly to match the desired Up direction
        scene_rot = np.eye(4)
        if up_direction == "Z":
            from .transform_utils import create_trs_matrix
            scene_rot = create_trs_matrix(rotation=(-90, 0, 0))
        elif up_direction == "-Y":
            from .transform_utils import create_trs_matrix
            scene_rot = create_trs_matrix(rotation=(180, 0, 0))
        elif up_direction == "-Z":
            from .transform_utils import create_trs_matrix
            scene_rot = create_trs_matrix(rotation=(90, 0, 0))

        # ⚡ Gather all meshes from all branches (Supports deep chains)
        all_items = []
        for root_id in node_ids:
            all_items.extend(GLBExporter.gather_node_data(root_id))

        for mesh_data, node_transform in all_items:
            # Combine scene orientation with recursive local transform
            final_transform = scene_rot @ node_transform
            
            mat_indices = mesh_data.face_material_indices
            if mat_indices is None:
                mat_indices = np.zeros(len(mesh_data.indices), dtype=np.int32)
            
            unique_mats = np.unique(mat_indices)
            
            # Baked positions
            baked_vertices = apply_transform(mesh_data.vertices, final_transform)
            
            # Baked normals (Rotation only)
            baked_normals = None
            if mesh_data.normals is not None:
                rot_part = final_transform[:3, :3]
                baked_normals = mesh_data.normals @ rot_part.T
                # Normalize results
                norm_lens = np.linalg.norm(baked_normals, axis=1, keepdims=True)
                baked_normals = np.divide(baked_normals, norm_lens, out=np.zeros_like(baked_normals), where=norm_lens!=0)

            for m_idx in unique_mats:
                face_mask = (mat_indices == m_idx)
                sub_faces = mesh_data.indices[face_mask]
                
                tm = trimesh.Trimesh(
                    vertices=baked_vertices,
                    faces=sub_faces,
                    vertex_normals=baked_normals,
                    process=False
                )
                
                if mesh_data.uvs is not None:
                    tm.visual = trimesh.visual.TextureVisuals(uv=mesh_data.uvs)

                mat_def = mesh_data.materials[m_idx] if m_idx < len(mesh_data.materials) else {"base_color": [0.8, 0.8, 0.8, 1.0]}
                
                tex_key = 'base_color_texture' if m_idx == 0 else f'base_color_texture_{m_idx}'
                base_color_tex = mesh_data.textures.get(tex_key)
                
                if base_color_tex is not None and isinstance(base_color_tex, torch.Tensor):
                    try:
                        t = base_color_tex
                        if t.dim() == 4: t = t[0]
                        img_np = (t.cpu().detach().numpy() * 255).astype(np.uint8)
                        base_color_tex = Image.fromarray(img_np)
                    except: pass

                pbr = trimesh.visual.material.PBRMaterial(
                    baseColorFactor=mat_def.get('base_color', [0.8, 0.8, 0.8, 1.0]),
                    metallicFactor=mat_def.get('metallic', 0.0),
                    roughnessFactor=mat_def.get('roughness', 0.5),
                    baseColorTexture=base_color_tex if isinstance(base_color_tex, Image.Image) else None
                )
                tm.visual.material = pbr
                combined_meshes.append(tm)
            
        if not combined_meshes: return False
        scene = trimesh.Scene(combined_meshes)
        scene.export(output_path, file_type=file_type)
        return True
