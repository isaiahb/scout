import {ScoutSharedSession} from "./ScoutSharedSession";
import {parseLayout,ScoutLayout} from "./ScoutLayout";
import {ScoutPaletteUI} from "./ScoutPaletteUI";
import {buildMarkerMesh} from "./ScoutMarkerMesh";
import {Interactable} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable";
import {InteractableManipulation} from "SpectaclesInteractionKit.lspkg/Components/Interaction/InteractableManipulation/InteractableManipulation";
import {InteractionManager} from "SpectaclesInteractionKit.lspkg/Core/InteractionManager/InteractionManager";
import {Interactor,InteractorInputType} from "SpectaclesInteractionKit.lspkg/Core/Interactor/Interactor";

import {HandInputData} from "SpectaclesInteractionKit.lspkg/Providers/HandInputData/HandInputData";

const MODEL_HEIGHTS=[145,165,30,170,125];
const TOOL_NAMES=["Camera","Light","Note","Standing","Seated"];

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
  private selected=0;
  private sequence=0;
  private placed:SceneObject[]=[];
  private previewShape:SceneObject;
  private interactors:Interactor[]=[];
  private lastAction=-100;
  private selectAudio:AudioComponent;
  private placeAudio:AudioComponent;
  private ready=false;
  private pinched=[false,false];

  onAwake():void {
    this.createEvent("OnStartEvent").bind(()=>this.start());
    this.createEvent("UpdateEvent").bind(()=>this.update());
  }
  private start():void {
    if(!this.palette||!this.markers||!this.placementPreview||!this.camera||!this.markerMaterial){console.error("Scout: required scene references are missing");return}
    this.selectAudio=this.audio(SELECT);this.placeAudio=this.audio(PLACE);
    this.palette.onSelect.add(kind=>{this.selected=kind;this.lastAction=getTime();this.selectAudio.play(1);this.rebuildPreview();this.refresh()});
    this.palette.onUndo.add(()=>this.undo());
    this.palette.onClear.add(()=>this.clear());
    // Manual planning frame; automatic physical relocalization is a later layer.
    this.markers.getTransform().setWorldPosition(this.camera.getTransform().getWorldPosition());
    this.markers.getTransform().setWorldRotation(this.camera.getTransform().getWorldRotation());
    if(this.connectedLensModule&&this.cloudStorageModule){
      this.shared=new ScoutSharedSession(this.connectedLensModule,this.cloudStorageModule,text=>this.palette.setSharedStatus(text));
      this.palette.onConnect.add(()=>{this.lastAction=getTime();this.shared.connect();});
      this.palette.onInvite.add(()=>{this.lastAction=getTime();this.shared.invite();});
      this.palette.onSave.add(()=>{this.lastAction=getTime();this.shared.save(this.snapshot());});
      this.palette.onRecover.add(()=>{this.lastAction=getTime();this.shared.load(raw=>this.restore(raw));});
    }
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
  private update():void {
    if(!this.ready)return;
    this.shared?.tick();
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
    this.placementPreview.enabled=!active?.currentInteractable&&this.placed.length<this.maxMarkers;
    this.placementPreview.getTransform().setWorldPosition(this.positionFor(active));
    // Face the user at placement; manipulation can adjust the orientation.
    const q=this.camera.getTransform().getWorldRotation();
    this.placementPreview.getTransform().setWorldRotation(q);
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
    const label=TOOL_NAMES[kind]+" "+String(++this.sequence).padStart(2,"0");
    const root=this.makeMarker(kind,label);
    root.getTransform().setWorldPosition(position);
    const f=this.camera.getTransform().forward;
    root.getTransform().setWorldRotation(quat.angleAxis(Math.atan2(f.x,f.z),vec3.up()));
    this.placeAudio.play(1);this.refresh();
    console.log("Scout placed "+label);
  }
  private prefabFor(kind:number):ObjectPrefab {return [this.cameraPrefab,this.lightPrefab,null,this.standingPrefab,this.seatedPrefab][kind];}
  private makeMarker(kind:number,label:string):SceneObject {
    const root=global.scene.createSceneObject(label);root.setParent(this.markers);
    const prefab=this.prefabFor(kind),height=MODEL_HEIGHTS[kind];
    if(prefab){
      const model=prefab.instantiate(root),t=model.getTransform();
      t.setLocalScale(t.getLocalScale().uniformScale(height/30));
      t.setLocalPosition(new vec3(0,-height/2,0));
    }else if(kind!==2)buildMarkerMesh(root,kind,this.markerMaterial,false);
    this.palette.decorateMarker(root,label,kind===2,kind===2?0:height/2+8);
    const col=root.createComponent("Physics.ColliderComponent") as ColliderComponent;
    const shape=Shape.createBoxShape();shape.size=kind===2?new vec3(18,11,10):new vec3(kind>=3?55:70,height,kind>=3?55:70);
    col.shape=shape;col.debugDrawEnabled=this.debugColliders;
    const interactable=root.createComponent(Interactable.getTypeName()) as Interactable;
    interactable.targetingMode=3;
    const manipulation=root.createComponent(InteractableManipulation.getTypeName()) as InteractableManipulation;
    manipulation.setCanScale(false);
    this.placed.push(root);this.kinds.push(kind);return root;
  }
  private undo():void {
    this.lastAction=getTime();const obj=this.placed.pop();this.kinds.pop();
    if(obj&&!isNull(obj))obj.destroy();this.selectAudio.play(1);this.refresh();
    console.log("Scout undo: "+this.placed.length+" markers remain");
  }
  private clear():void {
    this.lastAction=getTime();this.placed.forEach(obj=>{if(!isNull(obj))obj.destroy()});
    this.placed=[];this.kinds=[];this.selectAudio.play(1);this.refresh();console.log("Scout cleared");
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
    for(const m of data.markers){const obj=this.makeMarker(m.kind,m.label),t=obj.getTransform();
      t.setLocalPosition(new vec3(m.position[0],m.position[1],m.position[2]));
      t.setLocalRotation(new quat(m.rotation[0],m.rotation[1],m.rotation[2],m.rotation[3]));
    }
    this.sequence=Math.max(this.sequence,...data.markers.map(m=>Number(m.label.match(/(\d+)$/)?.[1])||0));this.refresh();
  }
  private refresh():void {this.palette.setState(this.selected,this.placed.length)}
}
