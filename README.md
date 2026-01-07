# Mixo3D Tools for ComfyUI

A modular, high-performance 3D scene assembly and material editing suite for ComfyUI. This toolkit allows you to load, transform, and inspect 3D meshes with a professional, responsive 3D viewer integrated directly into the nodes.

## ✨ Features

-   **Responsive 3D Viewer**: Integrated Three.js viewport in nodes that maintains a perfect 4:3 aspect ratio and resizes fluidly with the node window.
-   **Multi-Material Support**: Edit complex models with multiple materials/shaders. Chain Inspector nodes to target specific material slots.
-   **Advanced Material Inspection**: Full PBR (Physically-Based Rendering) support with metallic, roughness, and texture controls.
-   **Material Naming & Organization**: Rename materials for better workflow organization. Names are preserved in exports.
-   **Texture Control Modes**: Keep existing textures, replace them, or remove them for solid color shading.
-   **Auto-Material Generation**: Automatically creates materials for raw geometry files that lack shader definitions.
-   **Proportional Transforms**: Uniform scaling and precise XYZ positioning/rotation for 3D assets.
-   **Industrial-Scale Grid**: Calibrated millimeter-precision grid (10cm, 20cm, or 30cm) with 1cm increments for accurate product visualization.
-   **Opaque Registry System**: Efficiently manage 3D data across your graph using unique IDs, preventing memory overhead and redundant data copying.
-   **Multi-Object Assembly**: Merge multiple branches of 3D objects into a single scene with the Scene Assembler.
-   **Custom Export**: Export your final scene to GLB, OBJ, or STL formats.
-   **Clean UI**: Toggle 3D previews on/off per node to optimize your workspace.

## 🛠️ Nodes

### 1. Mesh From Path
The bridge between ComfyUI's official 3D nodes and the Mixo3D ecosystem.

**Inputs:**
-   **Path**: Direct path to your 3D file (.glb, .obj, .stl). **Note**: This node is best used in conjunction with the official ComfyUI (Beta) "Load 3D" nodes. Simply plug the path output from the official node into this input to register it into the Mixo3D registry.
-   **Mesh ID**: Assign a unique name to reference this object in downstream Mixo3D nodes.

**Features:**
-   Automatically detects and preserves multi-material structures from source files
-   Extracts material names from GLB/OBJ files for better organization
-   Handles models with no materials by auto-generating default shaders

### 2. Mesh Transform
Apply spatial adjustments to your 3D assets with real-time preview.

**Inputs:**
-   **Uniform Scale**: Proportional resizing on all axes (single slider for consistent scaling)
-   **Position (X, Y, Z)**: Precise control for scene placement
-   **Rotation (X, Y, Z)**: Rotation controls in degrees
-   **Show Preview**: Toggle the 3D viewport on/off

**Features:**
-   Real-time 4:3 aspect ratio 3D viewport
-   Non-destructive transformations
-   Chainable with other nodes

### 3. Mesh Material Inspector
The creative core for texturing and fine-tuning materials.

**Inputs:**
-   **Material Index**: Select which material slot to edit (0-128)
-   **Rename Material**: Give your material a custom name (e.g., "CarBody", "Chrome", "Glass")
-   **Texture Mode**: 
    - *Keep Existing*: Preserve current textures
    - *Update/Replace*: Replace with new texture from Image input
    - *Remove (Solid Color)*: Strip texture and use solid color
-   **Base Color (R, G, B)**: RGB color sliders (0.0 - 1.0)
-   **Metallic**: Metalness factor (0.0 = dielectric, 1.0 = metal)
-   **Roughness**: Surface roughness (0.0 = mirror, 1.0 = matte)
-   **Base Color Texture** (Optional): Connect any ComfyUI Image node to apply textures
-   **Show Preview**: Toggle the 3D viewport on/off

**Features:**
-   **Multi-Material Workflow**: Chain multiple Inspector nodes to edit different material slots
-   **Live Material Info**: Displays total material count, current index, and shader name in the 3D viewer
-   **Auto-Material Creation**: Automatically generates materials for models without shader definitions
-   **Material Naming**: Custom names are preserved through the pipeline and exported to final files
-   **Instant Visual Feedback**: High-fidelity PBR rendering of material changes in real-time

### 4. Scene Assembler
The final aggregator for complex 3D scenes with industrial-grade visualization.

**Inputs:**
-   **Mesh ID Inputs**: Connect up to 50 individual mesh branches (dynamic inputs)
-   **Up Direction**: Choose scene orientation (Y, Z, -Y, -Z)
-   **Material Mode**: Display mode (original, normal, wireframe)
-   **FOV**: Field of view for the camera (10-120 degrees)
-   **Exposure**: Lighting exposure (0.0-5.0)
-   **Background Color**: Hex color for viewport background
-   **Grid Size**: Industrial grid bed size (10cm, 20cm, or 30cm with 1cm increments)
-   **Export Format**: Output file type (GLB, OBJ, STL)
-   **Export Filename**: Name for exported file
-   **Trigger Export**: Enable to export the final scene
-   **Show Preview**: Toggle the 3D viewport on/off

**Features:**
-   **Industrial-Scale Grid**: Millimeter-precision grid calibrated for 3D printing and product design (1 unit = 1mm)
-   **Auto-Cleanup**: Automatically removes unplugged models from the preview
-   **Multi-Format Export**: Save to GLB, OBJ, or STL with full material preservation
-   **Global Scene View**: Preview the entire combined scene with accurate scale representation

## 🚀 Installation

### Option 1: Manual Installation (Recommended)

1.  **Open a Terminal/Command Prompt** and navigate to your ComfyUI `custom_nodes` folder:
    ```bash
    cd ComfyUI/custom_nodes
    ```

2.  **Clone this repository**:
    ```bash
    git clone https://github.com/mixocreative/comfyui-mixo3dtools.git
    ```

3.  **Install Dependencies**:
    *   **If you are using the ComfyUI Portable/Standalone version (Windows)**, go to the `ComfyUI_windows_portable` folder and run:
        ```bash
        python_embeded\python.exe -m pip install -r custom_nodes\mixo3dtools\requirements.txt
        ```
    *   **If you are using a standard Python/Conda environment**:
        ```bash
        pip install -r mixo3dtools/requirements.txt
        ```

4.  **Restart ComfyUI**.

### Option 2: ComfyUI-Manager (Coming Soon)
Search for `mixo3dtools` in the ComfyUI-Manager and click "Install". (If it's not there yet, use Option 1).

## 📦 Dependencies

-   `trimesh`: Robust 3D mesh processing and multi-material handling
-   `numpy`: Numerical operations for geometry transformations
-   `Pillow`: Image handling for texture baking
-   `three.js` (Frontend): Industry-standard 3D web rendering (v0.128.0)

## 🎯 Workflow Examples

### Basic Material Editing
1. Load a 3D model with the official ComfyUI "Load 3D" node
2. Connect to **Mesh From Path** to register it
3. Connect to **Mesh Material Inspector** to edit materials
4. Adjust colors, metallic, and roughness values
5. Connect to **Scene Assembler** to preview and export

### Multi-Material Workflow
1. Load a complex model (e.g., a car with body, tires, glass)
2. Chain multiple **Mesh Material Inspector** nodes
3. Set **Material Index** to 0 on the first Inspector (edit car body)
4. Set **Material Index** to 1 on the second Inspector (edit tires)
5. Set **Material Index** to 2 on the third Inspector (edit glass)
6. Each Inspector shows the material name and total slot count in the viewer badge

### Industrial Product Visualization
1. Load your product model (calibrated in millimeters)
2. Use **Mesh Transform** to position and scale
3. Set **Scene Assembler** grid to match your product size (10cm, 20cm, or 30cm)
4. The grid will display with 1cm precision increments
5. Export to GLB for use in other 3D software or 3D printing

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

---
*Created by Mixo Creative*
