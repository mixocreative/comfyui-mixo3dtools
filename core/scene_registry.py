import uuid
from typing import Dict, Any, Optional
from .mesh_model import SceneMeshData, SceneNodeData

class SceneRegistry:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(SceneRegistry, cls).__new__(cls)
            cls._instance.SCENE_MESHES: Dict[str, SceneMeshData] = {}
            cls._instance.SCENE_NODES: Dict[str, SceneNodeData] = {}
        return cls._instance

    def register_mesh(self, mesh_data: SceneMeshData, requested_id: str = None) -> str:
        mesh_id = requested_id if requested_id and requested_id.strip() else str(uuid.uuid4())
        self.SCENE_MESHES[mesh_id] = mesh_data
        return mesh_id

    def get_mesh(self, mesh_id: str) -> Optional[SceneMeshData]:
        return self.SCENE_MESHES.get(mesh_id)

    def register_node(self, node_data: SceneNodeData, requested_id: str = None) -> str:
        node_id = requested_id if requested_id and requested_id.strip() else str(uuid.uuid4())
        self.SCENE_NODES[node_id] = node_data
        return node_id

    def get_node(self, node_id: str) -> Optional[SceneNodeData]:
        return self.SCENE_NODES.get(node_id)

    def get_any(self, id: str) -> Optional[Any]:
        """Returns either a SceneNodeData or SceneMeshData if found."""
        node = self.SCENE_NODES.get(id)
        if node:
            return node
        return self.SCENE_MESHES.get(id)

    def clear(self):
        self.SCENE_MESHES.clear()
        self.SCENE_NODES.clear()

# Singleton instance
registry = SceneRegistry()
