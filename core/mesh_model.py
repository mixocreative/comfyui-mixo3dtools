from dataclasses import dataclass, field
from typing import Dict, List, Any, Optional
import numpy as np
import torch
from PIL import Image

@dataclass
class SceneMeshData:
    # geometry
    vertices: np.ndarray  # (N, 3)
    normals: Optional[np.ndarray] = None  # (N, 3)
    uvs: Optional[np.ndarray] = None  # (N, 2)
    indices: Optional[np.ndarray] = None  # (M, 3)
    
    # materials
    # list of dicts: {'base_color': [r,g,b,a], 'roughness': f, 'metallic': f, etc.}
    materials: List[Dict[str, Any]] = field(default_factory=list)
    
    # textures
    # slot_name (e.g., 'base_color_texture') -> PIL.Image or torch.Tensor
    textures: Dict[str, Any] = field(default_factory=dict)
    
    # material mapping: which face/triangle uses which material index
    face_material_indices: Optional[np.ndarray] = None # (M,)
    
    metadata: Dict[str, Any] = field(default_factory=dict)

    def get_hash(self) -> str:
        import hashlib
        # Simple hash for change detection
        h = hashlib.md5()
        h.update(self.vertices.tobytes())
        for mat in self.materials:
            h.update(str(mat).encode())
        return h.hexdigest()

@dataclass
class SceneNodeData:
    mesh_id: str
    transform: np.ndarray  # 4x4 matrix
    metadata: Dict[str, Any] = field(default_factory=dict)

    def get_hash(self) -> str:
        import hashlib
        h = hashlib.md5()
        h.update(self.mesh_id.encode())
        h.update(self.transform.tobytes())
        return h.hexdigest()
