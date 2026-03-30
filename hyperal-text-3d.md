

meshy6-text-to-3d
•
84 credits
Generate high-quality 3D models from text descriptions using Meshy6. Outputs GLB, FBX, OBJ, USDZ formats.

Parameters
prompt
Required(string)
Describe what kind of object the 3D model is (max 600 chars)
art_style
Optional(string)
Artistic style: realistic or sculpture
Default: realistic
topology
Optional(string)
Mesh topology: quad for smooth surfaces, triangle for detail
Default: triangle
target_polycount
Optional(number)
Target polygon count (100-300000)
Default: 30000
enable_pbr
Optional(boolean)
Generate PBR material maps (metallic, roughness, normal)
Default: false
Pricing
Per 3D model: $0.92
Example Input
{
  "prompt": "a medieval sword with ornate golden handle"
}

## DOCUMENTATION:

POST
/api/v1/3d/generate
New
GLB output
Generate 3D Models
Convert images or text to 3D models using state-of-the-art AI. Generate high-quality GLB models ready for use in games, AR/VR, and web applications.

Available Models
tripo3d-2-5-i3d
Single image to 3D (Tripo3D V2.5)
tripo3d-multiview-to-3d
4-view images to 3D (front, back, left, right)
hunyuan3d-v2-base
Single image to 3D with 4K textures (Hunyuan3D)
hunyuan3d-v2-multiview
3-view images to 3D, fast ~30s (front, back, left)
meshy6-text-to-3d
Text to 3D with GLB, FBX, OBJ, USDZ output (Meshy6)
meshy6-image-to-3d
Image to 3D with GLB, FBX, OBJ, USDZ output (Meshy6)
Output Format
All 3D models are returned in GLB format, which is widely supported by 3D viewers, game engines, and web frameworks.

Single Image to 3D
curl -X POST https://api.hypereal.cloud/api/v1/3d/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "model": "hunyuan3d-v2-base",
    "input": {
      "image": "https://example.com/object.png"
    }
  }'
Multi-View to 3D
{
  "model": "tripo3d-multiview-to-3d",
  "input": {
    "front_image_url": "https://example.com/front.png",
    "back_image_url": "https://example.com/back.png",
    "left_image_url": "https://example.com/left.png",
    "right_image_url": "https://example.com/right.png"
  }
}
Response
{
  "success": true,
  "outputUrl": "https://cdn.hypereal.tech/3d/model.glb",
  "creditsUsed": 45
}
