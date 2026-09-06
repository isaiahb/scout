import {buildMarkerMesh} from './ScoutMarkerMesh';
@component
export class ScoutMobile extends BaseScriptComponent {
 @input camera:Camera;
 @input markerMaterial:Material;
 @input font:Font;
 @input hudTemplate:Text;
 private selected=0;
 private markers:{object:SceneObject,label:Text,kind:number}[]=[];
 private buttons:Text[]=[];
 private status:Text;
 private active=-1;
 private drag:SceneObject|null=null;
 private start:vec2;
 private depth=150;
 private handled=false;
 private sequence=0;
 onAwake(){this.createEvent('OnStartEvent').bind(()=>this.init());}
 private hud(name:string,text:string,x:number,y:number,w:number,h:number,size:number):Text{
  const template=this.hudTemplate.getSceneObject();
  const obj=template.getParent().copySceneObject(template);obj.name=name;obj.enabled=true;
  const st=obj.getComponent('Component.ScreenTransform');st.anchors=Rect.create(2*(x-w/2)-1,2*(x+w/2)-1,1-2*(y+h/2),1-2*(y-h/2));st.offsets=Rect.create(0,0,0,0);
  const t=obj.getComponent('Component.Text');t.text=text;t.font=this.font;t.size=size;t.sizeToFit=false;t.outlineSettings.enabled=true;t.outlineSettings.size=.12;t.outlineSettings.fill.color=new vec4(.04,.07,.1,.85);t.backgroundSettings.enabled=true;t.backgroundSettings.fill.color=new vec4(.04,.07,.1,.65);t.backgroundSettings.cornerRadius=.12;t.horizontalAlignment=HorizontalAlignment.Center;t.verticalAlignment=VerticalAlignment.Center;t.textFill.color=new vec4(1,1,1,1);return t;
 }
 private init(){
  global.touchSystem.touchBlocking=true;
  this.hud('Scout title','SCOUT',.5,.15,.65,.06,38);
  this.status=this.hud('Scout status','',.5,.205,.84,.035,18);
  this.hud('Scout aim','+',.5,.43,.05,.04,30);
  ['Camera','Light','Notepad'].forEach((n,i)=>this.buttons.push(this.hud(n,n,.2+i*.3,.69,.28,.055,23)));
  this.hud('Undo','Undo Last',.3,.775,.36,.05,21);this.hud('Clear','Clear All',.7,.775,.36,.05,21);
  this.hud('Instructions','Tap to place • Drag a marker to move',.5,.62,.86,.035,16);
  this.hudTemplate.getSceneObject().enabled=false;
  this.refresh();
  this.createEvent('TouchStartEvent').bind(e=>{
   if(this.active!==-1)return;this.active=e.getTouchId();this.start=e.getTouchPosition();this.handled=false;this.drag=null;
   const p=this.start;
   if(p.y>=.65&&p.y<=.735){this.selected=Math.max(0,Math.min(2,Math.floor((p.x-.05)/.3)));this.handled=true;this.refresh();return;}
   if(p.y>=.745&&p.y<=.815){if(p.x<.5)this.undo();else this.clear();this.handled=true;return;}
   if(p.y<.25||p.y>.82){this.handled=true;return;}
   let best=.075;
   for(const m of this.markers){const pos=m.object.getTransform().getWorldPosition();const screen=this.camera.worldSpaceToScreenSpace(pos);const d=screen.sub(p).length;if(d<best){best=d;this.drag=m.object;const local=this.camera.getTransform().getInvertedWorldTransform().multiplyPoint(pos);this.depth=Math.max(20,-local.z-this.camera.near);}}
  });
  this.createEvent('TouchMoveEvent').bind(e=>{if(e.getTouchId()!==this.active||!this.drag)return;this.drag.getTransform().setWorldPosition(this.camera.screenSpaceToWorldSpace(e.getTouchPosition(),this.depth));});
  this.createEvent('TouchEndEvent').bind(e=>{if(e.getTouchId()!==this.active)return;const p=e.getTouchPosition();if(!this.handled&&!this.drag&&!e.isCancelled()&&p.sub(this.start).length<.035)this.place(p);this.active=-1;this.drag=null;});
  this.createEvent('UpdateEvent').bind(()=>{for(const m of this.markers){const pos=m.object.getTransform().getWorldPosition();const local=this.camera.getTransform().getInvertedWorldTransform().multiplyPoint(pos);const p=this.camera.worldSpaceToScreenSpace(pos.add(new vec3(0,-12,0)));const obj=m.label.getSceneObject();obj.enabled=local.z<0&&p.x>.05&&p.x<.95&&p.y>.25&&p.y<.59;if(obj.enabled){const st=obj.getComponent('Component.ScreenTransform');st.anchors=Rect.create(2*(p.x-.13)-1,2*(p.x+.13)-1,1-2*(p.y+.018),1-2*(p.y-.018));}}});
  console.log('Scout Mobile ready');
 }
 private place(p:vec2){if(this.markers.length>=20){this.status.text='20 markers max — Undo or Clear';return;}
  const name=['Camera','Light','Note'][this.selected]+' '+(++this.sequence);const obj=global.scene.createSceneObject(name);obj.getTransform().setWorldPosition(this.camera.screenSpaceToWorldSpace(p,150));obj.getTransform().setWorldRotation(this.camera.getTransform().getWorldRotation());obj.getTransform().setLocalScale(new vec3(2,2,2));buildMarkerMesh(obj,this.selected,this.markerMaterial,false);
  const label=this.hud(name+' label',name,.5,.4,.26,.036,17);this.markers.push({object:obj,label,kind:this.selected});this.refresh();console.log('Scout Mobile placed '+name);}
 private undo(){const m=this.markers.pop();if(m){m.object.destroy();m.label.getSceneObject().destroy();}this.refresh();console.log('Scout Mobile undo '+this.markers.length);}
 private clear(){while(this.markers.length){const m=this.markers.pop();m.object.destroy();m.label.getSceneObject().destroy();}this.refresh();console.log('Scout Mobile clear');}
 private refresh(){this.status.text=['Camera','Light','Notepad'][this.selected]+' selected · '+this.markers.length+' placed';this.buttons.forEach((b,i)=>{b.text=(i===this.selected?'● ':'')+['Camera','Light','Notepad'][i];b.textFill.color=i===this.selected?new vec4(.35,.9,1,1):new vec4(1,1,1,1);});}
}
