import {ScoutTransformGizmo} from "./ScoutTransformGizmo";
import {ScoutSharedSession} from "./ScoutSharedSession";
import {parseLayout,ScoutLayout} from "./ScoutLayout";
import {ScoutPaletteUI} from "./ScoutPaletteUI";
import {buildMarkerMesh} from "./ScoutMarkerMesh";
import {Interactable} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable";
import {InteractableManipulation} from "SpectaclesInteractionKit.lspkg/Components/Interaction/InteractableManipulation/InteractableManipulation";
import {InteractionManager} from "SpectaclesInteractionKit.lspkg/Core/InteractionManager/InteractionManager";
import {Interactor,InteractorInputType} from "SpectaclesInteractionKit.lspkg/Core/Interactor/Interactor";

import {HandInputData} from "SpectaclesInteractionKit.lspkg/Providers/HandInputData/HandInputData";
import {IMAGE_MATERIAL_ASSET} from "SpectaclesUIKit.lspkg/Scripts/Utility/Assets";

const WorldQuery=require("LensStudio:WorldQueryModule") as WorldQueryModule;
const GROUND_HIT_TIMEOUT=0.2;
const GROUND_INDICATOR=requireAsset("../Icons/ground_indicator.png") as Texture;
const GROUND_INDICATOR_COLOR=new vec4(0.72,0.58,1,1);
const GROUND_INDICATOR_FOOTPRINTS=[80,80,26,65,65]; // Camera, Light, Note, Standing, Seated — matches marker collider footprints
const GROUND_INDICATOR_LIFT=0.5; // avoid z-fighting with the real floor mesh
const GROUND_PULSE_SPEED=2.4,GROUND_PULSE_DEPTH=0.18;

const MODEL_HEIGHTS=[145,165,30,170,125];
const TOOL_NAMES=["Camera","Light","Note","Standing","Seated"];
const PALETTE_DISTANCE=110;
const PALETTE_HEIGHT_OFFSET=-14;
const PALETTE_FOLLOW_EASE=4;
const PALETTE_COLLAPSED_SIDE_OFFSET=20; // shifts the collapsed toolbar toward the right edge of view instead of dead center
// Hysteresis band (cm/s of head movement) so the palette doesn't flicker collapsed/expanded near one threshold.
const FAST_MOVE_SPEED=130;
const SLOW_MOVE_SPEED=60;

const SELECT=requireAsset("../GeneratedSFX/ScoutSelect.wav") as AudioTrackAsset;
const PLACE=requireAsset("../GeneratedSFX/ScoutPlace.wav") as AudioTrackAsset;

/** Domain state + placement. SIK provides both hand and editor mouse input. */
@component
export class ScoutMain extends BaseScriptComponent {
  @input @hint("Palette view") palette:ScoutPaletteUI;
  @input @hint("Authored parent for placed markers") markers:SceneObject;
  @input @hint("Authored placement preview") placementPreview:SceneObject;
  @input @hint("World tracking camera") camera:Camera;
  @input @hint("Vertex color material") markerMaterial:Material;
  @input @hint("Distance from the camera for midair placement, centimeters") @widget(new SliderWidget(100,500,10)) placementDistance:number=300;
  @input @hint("Maximum markers kept in this sandbox") @widget(new SliderWidget(1,30,1)) maxMarkers:number=20;
  @input @hint("Show collider wireframes for learning and debugging") debugColliders:boolean=false;
  @input @hint("Volume of select and placement cues") @widget(new SliderWidget(0,1,0.05)) sfxVolume:number=0.25;
  @input connectedLensModule:ConnectedLensModule;
  @input cloudStorageModule:CloudStorageModule;
  @input @allowUndefined cameraPrefab:ObjectPrefab;
  @input @allowUndefined lightPrefab:ObjectPrefab;
  @input @allowUndefined standingPrefab:ObjectPrefab;
  @input @allowUndefined seatedPrefab:ObjectPrefab;
  private shared:ScoutSharedSession;
  private kinds:number[]=[];
  private groundY:number[]=[];
  private selected=0;
  private editing:SceneObject=null;
  private gizmo:ScoutTransformGizmo;
  private paletteTransform:Transform;
  private prevCameraPos:vec3=null;
  private movingFast=false;
  private sequence=0;
  private placed:SceneObject[]=[];
  private previewShape:SceneObject;
  private previewGroundY:number=null;
  private groundIndicator:SceneObject;
  private groundIndicatorImage:Image;
  private interactors:Interactor[]=[];
  private lastAction=-100;
  private selectAudio:AudioComponent;
  private placeAudio:AudioComponent;
  private ready=false;
  private pinched=[false,false];
  private hitSession:HitTestSession;

  onAwake():void {
    this.createEvent("OnStartEvent").bind(()=>this.start());
    this.createEvent("UpdateEvent").bind(()=>this.update());
  }
  private start():void {
    if(!this.palette||!this.markers||!this.placementPreview||!this.camera||!this.markerMaterial){console.error("Scout: required scene references are missing");return}
    this.palette.setBadgeMaterial(this.markerMaterial);
    this.selectAudio=this.audio(SELECT);this.placeAudio=this.audio(PLACE);
    this.palette.onSelect.add(kind=>{this.selected=kind;this.lastAction=getTime();this.selectAudio.play(1);this.rebuildPreview();this.refresh()});
    this.gizmo=new ScoutTransformGizmo(this.markerMaterial,this.camera,()=>{this.lastAction=getTime();});
    this.hitSession=WorldQuery.createHitTestSessionWithOptions(HitTestSessionOptions.create());
    this.hitSession.start();
    this.palette.onUndo.add(()=>this.undo());
    this.palette.onClear.add(()=>this.clear());
    // Manual planning frame; automatic physical relocalization is a later layer.
    this.markers.getTransform().setWorldPosition(this.camera.getTransform().getWorldPosition());
    this.markers.getTransform().setWorldRotation(this.camera.getTransform().getWorldRotation());
    this.paletteTransform=this.palette.sceneObject.getTransform();
    if(this.connectedLensModule&&this.cloudStorageModule){
      this.shared=new ScoutSharedSession(this.connectedLensModule,this.cloudStorageModule,text=>this.palette.setSharedStatus(text));
      this.palette.onConnect.add(()=>{this.lastAction=getTime();this.shared.connect();});
      this.palette.onInvite.add(()=>{this.lastAction=getTime();this.shared.invite();});
      this.palette.onSave.add(()=>{this.lastAction=getTime();this.shared.save(this.snapshot());});
      this.palette.onRecover.add(()=>{this.lastAction=getTime();this.shared.load(raw=>this.restore(raw));});
    }
    this.buildGroundIndicator();
    this.rebuildPreview();this.refresh();this.ready=true;
    console.log("Scout ready: choose equipment, notes, or actors; pinch empty space to place.");
  }
  private audio(track:AudioTrackAsset):AudioComponent {
    const audio=this.sceneObject.createComponent("Component.AudioComponent") as AudioComponent;
    audio.audioTrack=track;audio.volume=this.sfxVolume;audio.playbackMode=Audio.PlaybackMode.LowLatency;return audio;
  }
  private rebuildPreview():void {
    if(this.previewShape&&!isNull(this.previewShape))this.previewShape.destroy();
    const prefab=this.prefabFor(this.selected);
    if(prefab){
      this.previewShape=prefab.instantiate(this.placementPreview);
      // A small cursor model indicates the selected tool without hiding the venue.
      this.previewShape.getTransform().setLocalPosition(new vec3(0,-15,0));
    }else this.previewShape=buildMarkerMesh(this.placementPreview,this.selected,this.markerMaterial,true);
  }
  /** Flat glowing grid decal on the real floor, showing where the selected asset will land. */
  private buildGroundIndicator():void {
    const so=global.scene.createSceneObject("GroundIndicator");
    // Tip the quad from facing the camera (+Z) to facing straight up (+Y), so it lies flat on the floor.
    so.getTransform().setLocalRotation(quat.angleAxis(-Math.PI/2,vec3.right()));
    const img=so.createComponent("Component.Image") as Image;
    img.mainMaterial=IMAGE_MATERIAL_ASSET.clone();
    img.mainPass.baseTex=GROUND_INDICATOR;
    img.mainPass.baseColor=GROUND_INDICATOR_COLOR;
    this.groundIndicator=so;this.groundIndicatorImage=img;
  }
  private update():void {
    if(!this.ready)return;
    this.shared?.tick();
    this.gizmo.update();
    this.followPalette();
    const all=InteractionManager.getInstance().getInteractorsByType(InteractorInputType.All);
    all.forEach(interactor=>{
      if(this.interactors.indexOf(interactor)>=0)return;
      this.interactors.push(interactor);
      interactor.onTriggerStart.add(target=>{
        if(interactor.inputType===InteractorInputType.Mouse && !target && getTime()-this.lastAction>0.25) this.placeAt(this.positionFor(interactor));
      });
    });
    // Hand pinch remains available in empty space even when SIK has no direct target.
    (["left","right"] as const).forEach((side,index)=>{
      const hand=HandInputData.getInstance().getHand(side);
      const down=hand.isPinching();
      const interactor=all.find(i=>i.inputType===(index===0?InteractorInputType.LeftHand:InteractorInputType.RightHand));
      if(down&&!this.pinched[index]&&!interactor?.currentInteractable&&getTime()-this.lastAction>0.25){
        this.placeAt(this.positionFor(interactor));
      }
      this.pinched[index]=down;
    });
    const active=all.find(i=>i.isActive()&&i.isTargeting());
    // A lingering target on the palette itself (e.g. right after tapping a toolbar icon) shouldn't
    // suppress the placement guides — only a real scene object (a placed marker, a gizmo handle) should.
    const blocking=active?.currentInteractable&&!this.isPaletteTarget(active.currentInteractable);
    const canPlace=!blocking&&this.placed.length<this.maxMarkers;
    this.placementPreview.enabled=canPlace;
    const aim=this.positionFor(active);
    this.groundHitTest(aim,result=>{if(result)this.previewGroundY=result.position.y;});
    const y=this.previewGroundY===null?aim.y:this.previewGroundY;
    this.placementPreview.getTransform().setWorldPosition(new vec3(aim.x,y,aim.z));
    // Face the user upright at placement; manipulation can adjust the orientation.
    const f=this.camera.getTransform().forward;
    this.placementPreview.getTransform().setWorldRotation(quat.angleAxis(Math.atan2(f.x,f.z),vec3.up()));
    this.updateGroundIndicator(canPlace,new vec3(aim.x,y,aim.z));
  }
  /** True if a targeted interactable belongs to the palette (buttons, badges, the cap) rather than the 3D scene. */
  private isPaletteTarget(interactable:{sceneObject?:SceneObject}):boolean {
    let node=interactable?.sceneObject;
    while(node){
      if(node===this.palette.sceneObject)return true;
      node=node.getParent();
    }
    return false;
  }
  /** Pulses a glowing grid on the floor under the placement preview, sized to the selected asset's footprint. */
  private updateGroundIndicator(visible:boolean,groundPosition:vec3):void {
    if(!this.groundIndicator)return;
    this.groundIndicator.enabled=visible;
    if(!visible)return;
    this.groundIndicator.getTransform().setWorldPosition(groundPosition.add(new vec3(0,GROUND_INDICATOR_LIFT,0)));
    const pulse=1+Math.sin(getTime()*GROUND_PULSE_SPEED)*GROUND_PULSE_DEPTH;
    const size=GROUND_INDICATOR_FOOTPRINTS[this.selected]*pulse;
    this.groundIndicator.getTransform().setLocalScale(new vec3(size,size,1));
    if(this.groundIndicatorImage)this.groundIndicatorImage.mainPass.baseColor=new vec4(
      GROUND_INDICATOR_COLOR.x,GROUND_INDICATOR_COLOR.y,GROUND_INDICATOR_COLOR.z,
      GROUND_INDICATOR_COLOR.w*(0.75+0.25*Math.sin(getTime()*GROUND_PULSE_SPEED))
    );
  }
  /** Casts straight down from above `position` to find the real-world floor via surface tracking. */
  private groundHitTest(position:vec3,callback:(result:WorldQueryHitTestResult)=>void):void {
    if(!this.hitSession){callback(null);return}
    const top=new vec3(position.x,position.y+80,position.z);
    const bottom=new vec3(position.x,position.y-400,position.z);
    this.hitSession.hitTest(top,bottom,result=>callback(result));
  }
  /** Keeps the palette a fixed distance in front of the user, smoothly trailing head movement instead of staying pinned in world space. */
  private followPalette():void {
    const camT=this.camera.getTransform();
    const camPos=camT.getWorldPosition();
    if(this.prevCameraPos){
      const speed=camPos.sub(this.prevCameraPos).length/Math.max(getDeltaTime(),1/240);
      if(!this.movingFast&&speed>FAST_MOVE_SPEED)this.movingFast=true;
      else if(this.movingFast&&speed<SLOW_MOVE_SPEED)this.movingFast=false;
      this.palette.setAutoCollapsed(this.movingFast);
    }
    this.prevCameraPos=camPos;
    const forward=camT.forward.uniformScale(-1);
    const side=this.palette.isCollapsed?camT.left.uniformScale(-PALETTE_COLLAPSED_SIDE_OFFSET):vec3.zero();
    const target=camPos.add(forward.uniformScale(PALETTE_DISTANCE)).add(new vec3(0,PALETTE_HEIGHT_OFFSET,0)).add(side);
    const ease=Math.min(1,getDeltaTime()*PALETTE_FOLLOW_EASE);
    const pos=this.paletteTransform.getWorldPosition();
    this.paletteTransform.setWorldPosition(pos.add(target.sub(pos).uniformScale(ease)));
    const f=camT.forward;
    const targetRot=quat.angleAxis(Math.atan2(f.x,f.z),vec3.up());
    this.paletteTransform.setWorldRotation(quat.slerp(this.paletteTransform.getWorldRotation(),targetRot,ease));
  }
  private positionFor(interactor?:Interactor):vec3 {
    const cam=this.camera.getTransform();
    const start=interactor?.startPoint;
    const direction=interactor?.direction;
    if(start&&direction){
      const forward=cam.forward.uniformScale(-1);
      const denom=direction.dot(forward);
      const t=denom>0.1?(this.placementDistance-start.sub(cam.getWorldPosition()).dot(forward))/denom:this.placementDistance;
      return start.add(direction.uniformScale(Math.max(20,Math.min(500,t))));
    }
    return cam.getWorldPosition().add(cam.forward.uniformScale(-this.placementDistance));
  }
  private placeAt(position:vec3):void {
    if(this.placed.length>=this.maxMarkers){this.palette.setHint("Marker limit reached — Undo or Clear All");return}
    this.lastAction=getTime();
    const kind=this.selected;
    let committed=false;
    const commit=(grounded:vec3)=>{if(committed)return;committed=true;this.spawnMarker(kind,grounded);};
    // Snap to the real floor when surface tracking resolves in time; otherwise fall back to the aimed midair position.
    this.groundHitTest(position,result=>commit(result?new vec3(position.x,result.position.y,position.z):position));
    const timeout=this.createEvent("DelayedCallbackEvent");
    timeout.bind(()=>commit(position));
    timeout.reset(GROUND_HIT_TIMEOUT);
  }
  private spawnMarker(kind:number,position:vec3):void {
    const label=TOOL_NAMES[kind]+" "+String(++this.sequence).padStart(2,"0");
    const root=this.makeMarker(kind,label,position.y);
    root.getTransform().setWorldPosition(position);
    const f=this.camera.getTransform().forward;
    root.getTransform().setWorldRotation(quat.angleAxis(Math.atan2(f.x,f.z),vec3.up()));
    this.placeAudio.play(1);this.refresh();
    console.log("Scout placed "+label);
  }
  private prefabFor(kind:number):ObjectPrefab {return [this.cameraPrefab,this.lightPrefab,null,this.standingPrefab,this.seatedPrefab][kind];}
  private makeMarker(kind:number,label:string,groundY:number):SceneObject {
    const root=global.scene.createSceneObject(label);root.setParent(this.markers);
    const prefab=this.prefabFor(kind),height=MODEL_HEIGHTS[kind];
    if(prefab){
      const model=prefab.instantiate(root),t=model.getTransform();
      t.setLocalScale(t.getLocalScale().uniformScale(height/30));
      t.setLocalPosition(new vec3(0,-height/2,0));
    }else if(kind!==2)buildMarkerMesh(root,kind,this.markerMaterial,false);
    this.palette.decorateMarker(root,label,kind===2,kind===2?0:height/2+8,()=>this.editMarker(root),()=>this.deleteMarker(root));
    const col=root.createComponent("Physics.ColliderComponent") as ColliderComponent;
    const shape=Shape.createBoxShape();shape.size=kind===2?new vec3(18,11,10):new vec3(kind>=3?55:70,height,kind>=3?55:70);
    col.shape=shape;col.debugDrawEnabled=this.debugColliders;
    const interactable=root.createComponent(Interactable.getTypeName()) as Interactable;
    interactable.targetingMode=3;
    interactable.onTriggerStart.add(()=>{this.lastAction=getTime();});
    const manipulation=root.createComponent(InteractableManipulation.getTypeName()) as InteractableManipulation;
    manipulation.setCanScale(false);
    manipulation.setCanRotate(false);
    this.placed.push(root);this.kinds.push(kind);this.groundY.push(groundY);return root;
  }
  /** Toggles the constrained-axis handles for one specific asset; vertical movement only applies to standing/seated actors. */
  private editMarker(root:SceneObject):void {
    this.lastAction=getTime();
    const idx=this.placed.indexOf(root);
    if(idx<0)return;
    if(this.gizmo.isEditing(root)){this.gizmo.select(null);this.editing=null;return}
    this.editing=root;
    const allowVertical=this.kinds[idx]===3||this.kinds[idx]===4;
    this.gizmo.select(root,allowVertical,this.groundY[idx]);
    this.gizmo.setMode("Show handles");
  }
  private deleteMarker(root:SceneObject):void {
    this.lastAction=getTime();
    const idx=this.placed.indexOf(root);
    if(idx<0)return;
    this.placed.splice(idx,1);this.kinds.splice(idx,1);this.groundY.splice(idx,1);
    if(!isNull(root))root.destroy();
    this.selectAudio.play(1);this.refresh();
  }
  private undo():void {
    this.lastAction=getTime();const obj=this.placed.pop();this.kinds.pop();this.groundY.pop();
    if(obj&&!isNull(obj))obj.destroy();this.selectAudio.play(1);this.refresh();
    console.log("Scout undo: "+this.placed.length+" markers remain");
  }
  private clear():void {
    this.lastAction=getTime();this.placed.forEach(obj=>{if(!isNull(obj))obj.destroy()});
    this.placed=[];this.kinds=[];this.groundY=[];this.selectAudio.play(1);this.refresh();console.log("Scout cleared");
  }
  private snapshot():string {
    const data:ScoutLayout={version:1,frame:'manual',markers:this.placed.map((obj,i)=>{
      const t=obj.getTransform(),p=t.getLocalPosition(),q=t.getLocalRotation();
      return {kind:this.kinds[i],label:obj.name,position:[p.x,p.y,p.z],rotation:[q.w,q.x,q.y,q.z]};
    })};return JSON.stringify(data);
  }
  private restore(raw:string):void {
    const data=parseLayout(raw); // Validate every marker before removing current work.
    this.clear();
    this.markers.getTransform().setWorldPosition(this.camera.getTransform().getWorldPosition());
    this.markers.getTransform().setWorldRotation(this.camera.getTransform().getWorldRotation());
    for(const m of data.markers){const obj=this.makeMarker(m.kind,m.label,0),t=obj.getTransform();
      t.setLocalPosition(new vec3(m.position[0],m.position[1],m.position[2]));
      t.setLocalRotation(new quat(m.rotation[0],m.rotation[1],m.rotation[2],m.rotation[3]));
      this.groundY[this.groundY.length-1]=t.getWorldPosition().y;
    }
    this.sequence=Math.max(this.sequence,...data.markers.map(m=>Number(m.label.match(/(\d+)$/)?.[1])||0));this.refresh();
  }
  private refresh():void {
    // Only clear the gizmo when its target was actually removed; never auto-show it for a fresh placement.
    if(this.editing&&this.placed.indexOf(this.editing)<0){this.editing=null;this.gizmo?.select(null);}
    this.palette.setState(this.selected,this.placed.length);
  }
}
