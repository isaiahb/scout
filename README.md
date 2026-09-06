# Scout

A spatial pre-production prototype for filmmakers: select a camera, light, or notepad marker, place it in space, and move it while planning a scene.

## Two Lens Studio projects

| Project | Device | Controls |
| --- | --- | --- |
| `Scout/Scout.esproj` | SPECS / Spectacles | Hand palette, pinch to place, grab to move, Undo Last, Clear All |
| `ScoutMobile/ScoutMobile.esproj` | Snapchat on a phone | Tap a marker type, tap the camera view to place, drag a marker to move, Undo, Clear |

Open either project in Lens Studio **5.23.2**. Assets, scripts, scenes, and required package archives are included. The SPECS project uses Spectacles Interaction Kit 2 and UIKit 2. Keep each project in its own folder.

## Test on Snapchat

1. Open `ScoutMobile/ScoutMobile.esproj` in Lens Studio and let compilation finish.
2. Click **Preview Lens**. If prompted, scan the pairing Snapcode using Snapchat on your phone and confirm pairing.
3. Send the Lens to the paired phone and open its preview in Snapchat.
4. Choose Camera, Light, or Notepad; tap empty space to place. Drag a marker to move it. Try Undo and Clear.

This sends a development preview; it does not publish the Lens publicly.

## Prototype status

Both projects have passed Lens Studio preview interaction checks. The mobile build has also been tested in Snapchat on a Pixel 8: all three marker types, dragging, Undo, and Clear worked. Physical walk-around tracking still needs further testing.

Placement is in free space. Surface snapping, editable notes, saved layouts, shared sessions, and venue reconstruction are not implemented. Markers reset when the Lens restarts. The mobile build allows up to 20 markers.

## Development

Edit runtime scripts under each project's `Assets/Scripts/`. Make scene and project-setting changes through Lens Studio. Local MCP connection files, credentials, editor caches, and workspace state are ignored by Git.

See `THIRD_PARTY_NOTICES.md` for bundled asset notices.
