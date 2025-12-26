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
    def export(node_ids: List[str], output_path: str, add_preview_helpers: bool = False, file_type: str = 'glb'):
        """
        Bake transforms, merge meshes, and export a single 3D file.
        """
        combined_meshes = []
        
        if add_preview_helpers:
             axis = trimesh.creation.axis(origin_size=0.04, axis_radius=0.008, axis_length=1.0)
             combined_meshes.append(axis)
             
             grid_color = [200, 200, 200, 150] 
             thickness = 0.005
             extent = 5
             for x in range(-extent, extent + 1):
                 box = trimesh.creation.box(extents=[thickness, thickness, extent * 2])
                 box.apply_translation([x, 0, 0])
                 box.visual.face_colors = grid_color
                 combined_meshes.append(box)
             for z in range(-extent, extent + 1):
                 box = trimesh.creation.box(extents=[extent * 2, thickness, thickness])
                 box.apply_translation([0, 0, z])
                 box.visual.face_colors = grid_color
                 combined_meshes.append(box)

        for item_id in node_ids:
            item = registry.get_any(item_id)
            if not item: continue
            
            if isinstance(item, SceneNodeData):
                node = item
                mesh_data = registry.get_mesh(node.mesh_id)
                transform = node.transform
            else:
                mesh_data = item
                transform = np.eye(4)
                
            if not mesh_data: continue
            
            # Geometry
            baked_vertices = apply_transform(mesh_data.vertices, transform)
            
            # Create Trimesh with UVs if available
            tm = trimesh.Trimesh(
                vertices=baked_vertices,
                faces=mesh_data.indices,
                vertex_normals=mesh_data.normals
            )
            
            if mesh_data.uvs is not None:
                tm.visual = trimesh.visual.TextureVisuals(uv=mesh_data.uvs)

            # Material & Textures
            if mesh_data.materials:
                mat = mesh_data.materials[0]
                base_color_tex = mesh_data.textures.get('base_color_texture')
                
                # Handle ComfyUI Tensor Image
                if base_color_tex is not None and isinstance(base_color_tex, torch.Tensor):
                    try:
                        # ComfyUI nodes output (Batch, H, W, Channels)
                        t = base_color_tex
                        if t.dim() == 4: t = t[0]
                        # Assume [0, 1] range float tensor
                        img_np = (t.cpu().detach().numpy() * 255).astype(np.uint8)
                        base_color_tex = Image.fromarray(img_np)
                        print(f"[Mixo3D] Converted IMAGE tensor to PIL for export")
                    except Exception as e:
                        print(f"[Mixo3D] Failed texture conversion: {e}")
                        base_color_tex = None

                # PBR Material
                pbr = trimesh.visual.material.PBRMaterial(
                    baseColorFactor=mat.get('base_color', [200, 200, 200, 255]),
                    metallicFactor=mat.get('metallic', 0.0),
                    roughnessFactor=mat.get('roughness', 0.5),
                    baseColorTexture=base_color_tex if base_color_tex else None
                )
                tm.visual.material = pbr
                if base_color_tex:
                    print(f"[Mixo3D] Texture baked into mesh visual")

            combined_meshes.append(tm)
            
        if not combined_meshes: return False
        scene = trimesh.Scene(combined_meshes)
        
        if file_type.lower() == 'obj':
            export_data = scene.export(file_type='obj')
            if isinstance(export_data, dict):
                base_dir = os.path.dirname(output_path)
                base_name = os.path.splitext(os.path.basename(output_path))[0]
                obj_key = next((k for k in export_data.keys() if k.endswith('.obj')), None)
                mtl_key = next((k for k in export_data.keys() if k.endswith('.mtl')), None)
                if obj_key:
                    with open(output_path, 'wb') as f: f.write(export_data[obj_key])
                if mtl_key:
                    mtl_path = os.path.join(base_dir, base_name + ".mtl")
                    with open(mtl_path, 'wb') as f: f.write(export_data[mtl_key])
                for k, v in export_data.items():
                    if k != obj_key and k != mtl_key:
                        with open(os.path.join(base_dir, k), 'wb') as f: f.write(v)
                return True
            else:
                with open(output_path, 'wb') as f:
                    data = export_data.encode() if isinstance(export_data, str) else export_data
                    f.write(data)
                return True
        else:
            scene.export(output_path, file_type=file_type)
            return True
