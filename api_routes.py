import os
import subprocess
import json
from aiohttp import web
import server

@server.PromptServer.instance.routes.post("/mixo3d/open_explorer")
async def open_explorer(request):
    """Open Windows Explorer at the specified path"""
    try:
        data = await request.json()
        path = data.get("path", "")
        
        if not path:
            return web.json_response({"error": "No path provided"}, status=400)
        
        # Normalize path for Windows
        path = os.path.normpath(path)
        
        # Verify path exists
        if not os.path.exists(path):
            return web.json_response({"error": f"Path does not exist: {path}"}, status=404)
        
        # Open Windows Explorer
        # Use /select to highlight the file if it's a file path
        if os.path.isfile(path):
            subprocess.Popen(f'explorer /select,"{path}"')
        else:
            subprocess.Popen(f'explorer "{path}"')
        
        return web.json_response({"success": True, "path": path})
    
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)
