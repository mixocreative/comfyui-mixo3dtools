# Mixo3D Tools for ComfyUI

A modular, high-performance 3D scene assembly and material editing suite for ComfyUI. This toolkit allows you to load, transform, and inspect 3D meshes with a professional, responsive 3D viewer integrated directly into the nodes.

![Mixo3D Workspace](https://via.placeholder.com/800x450.png?text=Mixo3D+Tools+Interactive+Viewer)

## ✨ Features

-   **Responsive 3D Viewer**: Integrated Three.js viewport in nodes that maintains a perfect 4:3 aspect ratio and resizes fluidly with the node window.
-   **Advanced Material Inspection**: Physically-based rendering (PBR) support. Plug ComfyUI Image nodes directly into the Material Inspector to apply high-quality textures.
-   **Proportional Transforms**: Uniform scaling and precise XYZ positioning/rotation for 3D assets.
-   **Opaque Registry System**: Efficiently manage 3D data across your graph using unique IDs, preventing memory overhead and redundant data copying.
-   **Multi-Object Assembly**: Merge multiple branches of 3D objects into a single scene with the Scene Assembler.
-   **Custom Export**: Export your final scene to GLB, OBJ, or STL formats.
-   **Clean UI**: Toggle 3D previews on/off per node to optimize your workspace.

## 🛠️ Nodes

### 1. Mesh From Path (Mixo3D)
The bridge between your local filesystem and the Mixo3D ecosystem.
-   **Path**: Direct path to your `.glb`, `.obj`, or `.stl` file.
-   **Mesh ID**: Assign a unique name to reference this object in downstream nodes.

### 2. Mesh Transform
Apply spatial adjustments to your 3D assets.
-   **Uniform Scale**: Proportional resizing on all axes.
-   **Position/Rotation**: Precise control for scene placement.
-   **Preview**: Real-time 4:3 3D viewport.

### 3. Mesh Material Inspector
The creative core for texturing and fine-tuning.
-   **Base Color Texture**: Connect any ComfyUI Image node to "bake" textures onto your mesh.
-   **PBR Controls**: Adjust Metallic and Roughness settings in real-time.
-   **Visual Feedback**: Instant high-fidelity rendering of material changes.

### 4. Scene Assembler
The final aggregator for complex 3D scenes.
-   **Multi-Input**: Connect up to 50 individual mesh branches.
-   **Global View**: Preview the entire combined scene.
-   **Export Engine**: Save your creation to high-quality 3D file formats.

## 🚀 Installation

1.  Navigate to your ComfyUI `custom_nodes` directory:
    ```bash
    cd ComfyUI/custom_nodes
    ```
2.  Clone this repository:
    ```bash
    git clone https://github.com/mixocreative/comfyui-mixo3dtool.git
    ```
3.  Install dependencies:
    ```bash
    pip install -r requirements.txt
    ```
4.  Restart ComfyUI.

## 📦 Dependencies

-   `trimesh`: Robust 3D mesh processing.
-   `numpy`: Numerical operations.
-   `Pillow`: Image handling for texture baking.
-   `three.js`: (Frontend) Industry-standard 3D web rendering.

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

---
*Created by Mixo Creative*
