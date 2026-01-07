# Scene Assembler Export Enhancement

## Summary
Enhanced the Scene Assembler node to provide better export functionality with visual feedback and Windows Explorer integration.

## New Features

### 1. Custom Export Directory
- Added `export_directory` input parameter to Scene Assembler
- If left empty, uses ComfyUI's default output directory
- If specified, exports to the custom directory (creates it if needed)

### 2. Export Path Display
When `trigger_export` is set to "true", the node now displays:
- ✓ Success message with green styling
- Exported filename
- Full file path
- Interactive "Open in Explorer" button

### 3. Open in Explorer Button
- Clicking the button opens Windows Explorer at the export location
- Automatically highlights the exported file
- Falls back to showing the directory path if the API call fails

## Technical Implementation

### Backend Changes
1. **scene_assembler.py**
   - Added `export_directory` parameter
   - Returns `export_path` in UI data when export is triggered
   - Handles custom directory creation

2. **api_routes.py** (NEW)
   - Created `/mixo3d/open_explorer` POST endpoint
   - Handles Windows Explorer opening via subprocess
   - Validates paths before opening

3. **__init__.py**
   - Imports api_routes to register the endpoint

### Frontend Changes
1. **mixo3d_viewer.js**
   - Added `viewer_export_badge` element for export feedback
   - Displays export success message with file details
   - Creates interactive button with hover effects
   - Handles API call to open Explorer

## Usage

1. Set up your scene in Scene Assembler
2. (Optional) Specify a custom `export_directory`
3. Set `trigger_export` to "true"
4. Execute the node
5. View the export confirmation at the bottom of the 3D viewer
6. Click "📁 OPEN IN EXPLORER" to navigate to the file

## Notes
- The export badge appears only when export is successful
- The button is fully interactive with hover effects
- Path validation ensures the directory exists before opening
- Works specifically for Windows (uses `explorer` command)
