# Scout

A spatial pre-production prototype for filmmakers: select a camera, light, note, standing actor, or seated actor, place it in space, and move it while planning a scene.

## Tonight’s Specs demo

The primary demo is `Scout/Scout.esproj` in Lens Studio’s Specs interactive preview: place equipment and actors, grab to move, adjust facing with the rotation ring, then record a walkthrough from multiple viewpoints. Share the recording as a visual setup brief.

Select a placed object to attach its move arrows and horizontal rotation ring together. Drag the red X, green Y, or blue Z arrow to translate along one world axis; drag the green horizontal ring to change facing continuously around the vertical Y axis. Free grabbing only translates, so objects stay upright. **Hide handles** removes them for the walkthrough; **Show handles** brings them back. Grabbing another object selects it; new placements are selected automatically. These controls transform the whole model, including its stand. The mobile project is retained as an earlier experiment.

Shared-session controls are experimental and hidden by default (`showSharedControls` on ScoutPaletteUI). This demo does not require account sharing or room relocalization.

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
4. Choose Camera, Light, Note, Standing, or Seated; tap empty space to place. Drag a marker to move it. Try Undo and Clear.

This sends a development preview; it does not publish the Lens publicly.

## Prototype status

Both projects have passed Lens Studio preview interaction checks. The mobile build has also been tested in Snapchat on a Pixel 8: the equipment/note controls and both new actor poses have been exercised. Clear requires a second tap; Undo supports placements and moves. Physical walk-around tracking still needs further testing.

Models use approximate real-world heights: camera 145 cm, light 165 cm, standing actor 170 cm, seated actor 125 cm. Mobile placement starts 3 metres from the viewer.

Placement is in free space. Surface snapping, editable notes, automatic spatial recovery and venue reconstruction are not implemented. Mobile markers reset when the Lens restarts. The mobile build allows up to 20 markers.

## Development

Edit runtime scripts under each project's `Assets/Scripts/`. Make scene and project-setting changes through Lens Studio. Local MCP connection files, credentials, editor caches, and workspace state are ignored by Git.

See `THIRD_PARTY_NOTICES.md` for bundled asset notices.

## Shared layout recovery prototype (Specs)

The Specs palette now includes Connect, Invite, Save, and Recover. The implementation uses Connected Lenses and session-scoped Persistent Cloud Storage. It is a prototype; recovery between real accounts has not yet been verified on devices.

1. Connect, then Invite a teammate using the system invitation UI.
2. Place markers and choose Save. Wait for the shared-save confirmation.
3. The teammate opens the same session invitation, connects, then chooses Recover.
4. To return later, reopen that original invitation. Opening the Lens normally can create a different session.

Saved data includes marker types, labels, positions, and rotations in a manual planning frame. Recover recreates that frame at the current camera pose. This recovers a layout **relative to the viewer**, not its original physical location. Automatic site alignment needs a shared spatial anchor. For a manual alignment test, stand at the same starting position and face the same direction.

There is one saved snapshot per session. Save replaces it (last completed write wins); edits are not broadcast live. Recover replaces the local working layout only after its saved data passes validation. A connection/storage error is displayed rather than reported as a successful save. Session access depends on retaining its invitation.

Snap currently documents Connected Lenses for Specs and Camera Kit, not the Snapchat phone app. This feature is therefore only wired in the Specs project. The portable layout format can be reused by a future shared backend.

Validation: Lens Studio TypeScript compilation and isolated storage/serialization tests (`bun test tests/shared-layout.test.ts`). The tests simulate two accounts against a shared store; they do not prove Snap backend or hardware interoperability.


## Snapchat backend compatibility

Verified against Snap's current API reference: `InternetModule` is available only on Specs and Camera Kit. The Snapchat app supports the Remote Service Module's provided integrations (for example, weather, places, and ChatGPT); the documented route for a custom API is to contact Snap. Scout therefore does not advertise shared backend access in the Snapchat app. A successful desktop preview request would not establish Snapchat support.

References: [InternetModule platform support](https://developers.snap.com/lens-studio/api/lens-scripting/classes/Built-In.InternetModule.html), [Remote Service Module](https://developers.snap.com/lens-studio/features/remote-apis/remote-service-module).

For a self-service custom backend, use Specs or a Camera Kit host application. A phone Lens in Snapchat needs a supported Snap integration before cross-platform cloud save/recover can be implemented there.
