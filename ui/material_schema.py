# Fixed property names and groups for Material Inspector

MATERIAL_GROUPS = {
    "BaseColor": ["base_color", "opacity"],
    "Surface": ["roughness", "metallic", "specular"],
    "Emission": ["emissive_color", "emissive_strength"],
    "Normal": ["normal_scale"]
}

# Default values for materials
DEFAULT_MATERIAL = {
    "base_color": [0.8, 0.8, 0.8, 1.0],
    "opacity": 1.0,
    "roughness": 0.5,
    "metallic": 0.0,
    "specular": 0.5,
    "emissive_color": [0.0, 0.0, 0.0],
    "emissive_strength": 1.0,
    "normal_scale": 1.0
}

TEXTURE_SLOTS = [
    "base_color_texture",
    "roughness_texture",
    "metallic_texture",
    "normal_texture",
    "emissive_texture"
]
