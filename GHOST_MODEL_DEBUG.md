# Ghost Model Debugging Guide

## 🔍 **How to Diagnose the Issue**

### **Step 1: Refresh ComfyUI**
```bash
# Stop ComfyUI (Ctrl+C in terminal)
python main.py

# In browser: Ctrl+Shift+R (hard refresh)
```

### **Step 2: Open Browser Console**
1. Press **F12** to open DevTools
2. Click on **Console** tab
3. Keep it open while testing

### **Step 3: Test with Single Mesh**
1. Add a **Mesh From Path** or **Mesh Loader** node
2. Add a **Mesh Transform** node
3. Connect them
4. Execute the workflow

### **Step 4: Watch the Console**

You should see logs like this:

```
[Mixo3D] Cleared all models from viewer
[Mixo3D] Loading model: mesh_id_0 from my_mesh.glb
[Mixo3D] Model loaded: mesh_id_0
```

### **Step 5: Count the Models**

**In the console, look for:**
- How many times does `"Loading model:"` appear?
- How many times does `"Model loaded:"` appear?
- Are there different `idx` values? (e.g., `mesh_id_0`, `mesh_id_1`, etc.)

---

## 🐛 **What the Logs Tell Us**

### **Scenario 1: Multiple Different IDs**
```
[Mixo3D] Loading model: mesh_id_0 from my_mesh.glb
[Mixo3D] Loading model: mesh_id_1 from my_mesh.glb  ← PROBLEM!
[Mixo3D] Loading model: undefined_0 from my_mesh.glb ← PROBLEM!
```

**Diagnosis:** The traceScene function is finding multiple paths to the same model  
**Cause:** Logic bug in how inputs are being traced

### **Scenario 2: Same ID, Multiple Loads**
```
[Mixo3D] Loading model: mesh_id_0 from my_mesh.glb
[Mixo3D] Model loaded: mesh_id_0
[Mixo3D] Loading model: mesh_id_0 from my_mesh.glb  ← PROBLEM!
[Mixo3D] Model loaded: mesh_id_0
```

**Diagnosis:** The URL check is failing, causing re-loads  
**Cause:** `__lastUrl` not being set correctly

### **Scenario 3: Stops at 4**
```
Run 1: 2 models
Run 2: 3 models
Run 3: 4 models
Run 4: 4 models (stops)
```

**Diagnosis:** The cleanup is partially working  
**Cause:** Some models are being removed, but not all

---

## 📊 **Expected vs Actual**

### **Expected (Correct Behavior):**
```
Execute #1:
[Mixo3D] Cleared all models from viewer
[Mixo3D] Loading model: mesh_id_0 from my_mesh.glb
[Mixo3D] Model loaded: mesh_id_0
→ Total models in scene: 1 ✅

Execute #2:
[Mixo3D] Cleared all models from viewer
[Mixo3D] Loading model: mesh_id_0 from my_mesh.glb
[Mixo3D] Model loaded: mesh_id_0
→ Total models in scene: 1 ✅
```

### **Actual (Your Bug):**
```
Execute #1:
[Mixo3D] Cleared all models from viewer
[Mixo3D] Loading model: ??? from ???
[Mixo3D] Loading model: ??? from ???  ← Extra load!
→ Total models in scene: 2 ❌

Execute #2:
[Mixo3D] Cleared all models from viewer
[Mixo3D] Loading model: ??? from ???
[Mixo3D] Loading model: ??? from ???
[Mixo3D] Loading model: ??? from ???  ← Another extra!
→ Total models in scene: 3 ❌
```

---

## 🔧 **Next Steps Based on Logs**

### **If you see multiple different IDs:**

The issue is in the `nodeInputs` logic. For non-SceneAssembler nodes, it should only have ONE input.

**Check line 271:**
```javascript
const nodeInputs = (nodeData.name === "SceneAssembler") ? 
    (self.inputs || []) : 
    [{ name: "mesh_id", link: null }];
```

**Problem:** For MeshTransform, this creates a fake input with `link: null`, but then the traceScene still runs and finds `mixo3d_last_url`.

### **If you see the same ID loading multiple times:**

The URL comparison is failing. The issue is that `obj.url` and `model.__lastUrl` don't match.

**Check:**
- Is the URL being constructed differently each time?
- Is there a timestamp or random parameter in the URL?

---

## 🎯 **Likely Root Cause**

Based on "stops at 4", I suspect:

1. **clearAllModels()** clears the `compositionModels` dictionary
2. **Monitor loop** runs and finds models to load
3. **traceScene** is returning multiple objects for a single mesh
4. Each object gets a different `idx` like:
   - `mesh_id_0`
   - `mesh_id_1`
   - `undefined_0`
   - etc.
5. After 4 models, the cleanup logic finally catches up

---

## 🛠️ **Immediate Fix to Try**

### **Option 1: Don't clear on every execution**

Remove the clearAllModels call from onExecuted and rely only on the monitor loop cleanup:

```javascript
// COMMENT THIS OUT:
// if (this.clearAllModels) {
//     this.clearAllModels();
// }
```

### **Option 2: Add execution counter**

Only clear if it's a genuinely new execution:

```javascript
if (this.clearAllModels && this._lastExecutionId !== message.prompt_id) {
    this._lastExecutionId = message.prompt_id;
    this.clearAllModels();
}
```

---

## 📝 **What to Report Back**

After refreshing and testing, please share:

1. **Console logs** - Copy/paste the `[Mixo3D]` messages
2. **Model count** - How many objects appear in the viewer?
3. **Node type** - Which node are you testing? (MeshTransform, SceneAssembler, etc.)
4. **Connections** - What's connected to what?

This will help me pinpoint the exact issue!

---

## 🎯 **Quick Test Command**

Open browser console and run:

```javascript
// Count models in the scene
let count = 0;
app.graph._nodes.forEach(n => {
    if (n.compositionModels) {
        console.log(`Node ${n.id}:`, Object.keys(n.compositionModels));
        count += Object.keys(n.compositionModels).length;
    }
});
console.log(`Total models across all nodes: ${count}`);
```

This will show exactly which nodes have which models loaded.
