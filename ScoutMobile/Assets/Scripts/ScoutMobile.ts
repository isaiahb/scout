import {buildMarkerMesh} from './ScoutMarkerMesh';
import {ScoutMobileUI,TOOL_NAMES,actionAt,isScenePoint,UiAction} from './ScoutMobileUI';
const MODEL_HEIGHTS=[145,165,30,170,125];
type Marker={object:SceneObject,label:Text,kind:number,height:number};
type UndoEntry={kind:'place',marker:Marker}|{kind:'move',marker:Marker,position:vec3};

@component
export class ScoutMobile extends BaseScriptComponent {
  @input camera:Camera;
  @input markerMaterial:Material;
  @input font:Font;
  @input hudTemplate:Text;
  @input imageTemplate:Image;
  @input panelTexture:Texture;
  @input cardTexture:Texture;
  @input pillTexture:Texture;
  @input cameraIcon:Texture;
  @input lightIcon:Texture;
  @input noteIcon:Texture;
  @input @allowUndefined standingIcon:Texture;
  @input @allowUndefined seatedIcon:Texture;
  @input @allowUndefined cameraPrefab:ObjectPrefab;
  @input @allowUndefined lightPrefab:ObjectPrefab;
  @input @allowUndefined standingPrefab:ObjectPrefab;
  @input @allowUndefined seatedPrefab:ObjectPrefab;
  private ui:ScoutMobileUI;
  private selected=0;
  private markers:Marker[]=[];
  private history:UndoEntry[]=[];
  private active=-1;
  private drag:Marker|null=null;
  private dragOrigin:vec3;
  private start:vec2;
  private depth=150;
  private pendingAction:UiAction|null=null;
  private sequence=0;
  private clearUntil=0;
  onAwake():void {this.createEvent('OnStartEvent').bind(()=>this.init());}
  private init():void {
    global.touchSystem.touchBlocking=true;
    this.ui=new ScoutMobileUI(this.hudTemplate,this.imageTemplate,this.font,this.panelTexture,this.cardTexture,this.pillTexture,
      [this.cameraIcon,this.lightIcon,this.noteIcon,this.standingIcon,this.seatedIcon]);
    this.ui.init();
    this.createEvent('TouchStartEvent').bind(e=>{
      if(this.active!==-1)return;
      this.active=e.getTouchId();this.start=e.getTouchPosition();this.drag=null;this.pendingAction=actionAt(this.start.x,this.start.y);
      if(this.pendingAction||!isScenePoint(this.start.x,this.start.y))return;
      let best=.075;
      for(const marker of this.markers){
        const pos=marker.object.getTransform().getWorldPosition();
        const local=this.camera.getTransform().getInvertedWorldTransform().multiplyPoint(pos);
        if(local.z>=-this.camera.near)continue;
        // Models are bottom-centered. Pick their visible center rather than only their feet.
        const screen=this.camera.worldSpaceToScreenSpace(pos.add(new vec3(0,marker.height/2,0)));
        const d=screen.sub(this.start).length;
        if(d<best){best=d;this.drag=marker;this.dragOrigin=pos;this.depth=Math.max(20,-local.z-this.camera.near);}
      }
      if(this.drag)this.ui.toast('Drag to move · Undo to restore');
    });
    this.createEvent('TouchMoveEvent').bind(e=>{
      if(e.getTouchId()!==this.active||!this.drag||!isScenePoint(e.getTouchPosition().x,e.getTouchPosition().y))return;
      // Preserve the initial finger offset so grabbing the model never makes it jump.
      const delta=this.camera.screenSpaceToWorldSpace(e.getTouchPosition(),this.depth).sub(this.camera.screenSpaceToWorldSpace(this.start,this.depth));
      this.drag.object.getTransform().setWorldPosition(this.dragOrigin.add(delta));
    });
    this.createEvent('TouchEndEvent').bind(e=>{
      if(e.getTouchId()!==this.active)return;
      const p=e.getTouchPosition();
      if(e.isCancelled()){if(this.drag)this.drag.object.getTransform().setWorldPosition(this.dragOrigin);}
      else if(this.drag){
        if(this.drag.object.getTransform().getWorldPosition().sub(this.dragOrigin).length>.1){
          this.pushUndo({kind:'move',marker:this.drag,position:this.dragOrigin});this.ui.toast('Object moved');
        }
      } else if(p.sub(this.start).length<.035){
        const endAction=actionAt(p.x,p.y);
        if(this.pendingAction&&JSON.stringify(this.pendingAction)===JSON.stringify(endAction))this.perform(this.pendingAction);
        else if(!this.pendingAction&&isScenePoint(this.start.x,this.start.y)&&isScenePoint(p.x,p.y))this.place(p);
      }
      this.active=-1;this.drag=null;this.pendingAction=null;this.refresh();
    });
    this.createEvent('UpdateEvent').bind(()=>{
      if(this.clearUntil&&getTime()>this.clearUntil){this.clearUntil=0;this.refresh();}
      this.ui.tick();
      for(const m of this.markers){
        const pos=m.object.getTransform().getWorldPosition().add(new vec3(0,m.height+8,0));
        const local=this.camera.getTransform().getInvertedWorldTransform().multiplyPoint(pos);
        const p=this.camera.worldSpaceToScreenSpace(pos);
        const obj=m.label.getSceneObject();obj.enabled=local.z<-this.camera.near&&p.x>.14&&p.x<.86&&p.y>.24&&p.y<.55;
        if(obj.enabled)this.ui.positionLabel(m.label,p.x,p.y);
      }
    });
    console.log('Scout Mobile ready: five tools, drag and undo');
  }
  private perform(action:UiAction):void {
    if(action.kind==='tool'){
      this.selected=action.index;this.clearUntil=0;
      this.ui.toast(TOOL_NAMES[this.selected]+' ready · Tap the scene');
    } else if(action.kind==='undo'){this.clearUntil=0;this.undo();}
    else if(this.markers.length){
      if(this.clearUntil>getTime())this.clear();
      else {this.clearUntil=getTime()+3;this.ui.toast('Tap Clear again to remove all');}
    }
    this.refresh();
  }
  private place(p:vec2):void {
    if(this.markers.length>=20){this.ui.toast('Scene full · Undo or clear an object');return;}
    const prefab=[this.cameraPrefab,this.lightPrefab,null,this.standingPrefab,this.seatedPrefab][this.selected];
    if(this.selected>=3&&!prefab){this.ui.toast('Actor model is not available');return;}
    const name=TOOL_NAMES[this.selected]+' '+String(++this.sequence).padStart(2,'0');
    const obj=global.scene.createSceneObject(name);
    const height=MODEL_HEIGHTS[this.selected];
    obj.getTransform().setWorldPosition(this.camera.screenSpaceToWorldSpace(p,300).sub(new vec3(0,height/2,0)));
    // Keep equipment upright even when the phone tilts.
    const f=this.camera.getTransform().forward;const yaw=Math.atan2(f.x,f.z);
    obj.getTransform().setWorldRotation(quat.angleAxis(yaw,vec3.up()));
    if(prefab){const model=prefab.instantiate(obj);model.getTransform().setLocalScale(model.getTransform().getLocalScale().uniformScale(height/30));}
    else {const visual=global.scene.createSceneObject('Note marker');visual.setParent(obj);visual.getTransform().setLocalScale(new vec3(2,2,2));buildMarkerMesh(visual,this.selected,this.markerMaterial,false);}
    const marker={object:obj,label:this.ui.label(name),kind:this.selected,height};this.markers.push(marker);this.pushUndo({kind:'place',marker});
    this.clearUntil=0;this.ui.toast(name+' placed · Drag to move');this.refresh();console.log('Scout Mobile placed '+name);
  }
  private pushUndo(entry:UndoEntry):void {this.history.push(entry);if(this.history.length>40)this.history.shift();}
  private undo():void {
    const entry=this.history.pop();if(!entry)return;
    if(entry.kind==='move')entry.marker.object.getTransform().setWorldPosition(entry.position);
    else {this.markers=this.markers.filter(m=>m!==entry.marker);entry.marker.object.destroy();entry.marker.label.getSceneObject().destroy();}
    this.ui.toast(entry.kind==='move'?'Move undone':'Placement undone');this.refresh();console.log('Scout Mobile undo '+this.markers.length);
  }
  private clear():void {
    for(const marker of this.markers){marker.object.destroy();marker.label.getSceneObject().destroy();}
    this.markers=[];this.history=[];this.clearUntil=0;this.ui.toast('Scene cleared');this.refresh();console.log('Scout Mobile clear');
  }
  private refresh():void {this.ui.refresh(this.selected,this.markers.length,this.history.length>0,this.clearUntil>getTime());}
}
