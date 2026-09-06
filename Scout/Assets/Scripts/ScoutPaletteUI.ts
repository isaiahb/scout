import Event from "SpectaclesInteractionKit.lspkg/Utils/Event";
import {BackPlate} from "SpectaclesUIKit.lspkg/Scripts/BackPlate";
import {ElementContent} from "SpectaclesUIKit.lspkg/Scripts/Components/Content/ElementContent";
import {FlexLayout} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout";
import {FlexItem} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem";
import {FlexAlign, FlexAlignSelf, FlexDirection, FlexJustify} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes";
import {IMAGE_MATERIAL_ASSET} from "SpectaclesUIKit.lspkg/Scripts/Utility/Assets";
import {ScoutRotaryDial, RotaryDialTheme, DialStep} from "./ScoutRotaryDial";
import {CameraAssetState, LightAssetState, ISO_STOPS, APERTURE_STOPS, SHUTTER_STOPS, KELVIN_STOPS, INTENSITY_STOPS, kelvinToRGB} from "./ScoutAssetState";

const ICONS: Texture[] = [requireAsset("../Icons/videocam.png") as Texture, requireAsset("../Icons/lightbulb.png") as Texture, requireAsset("../Icons/sticky_note_2.png") as Texture, requireAsset("../Icons/undo.png") as Texture, requireAsset("../Icons/delete.png") as Texture];
const ACTOR_ICONS:Texture[]=[requireAsset("../Icons/person.png") as Texture,requireAsset("../Icons/chair.png") as Texture];
const ARROW_ICON=requireAsset("../Icons/keyboard_arrow_down.png") as Texture;
const EDIT_ICON=requireAsset("../Icons/edit.png") as Texture;
const CLOSE_ICON=requireAsset("../Icons/close.png") as Texture;
const SPHERE_TINT=new vec4(0x5a/255,0x44/255,0xb8/255,1);
const DELETE_SPHERE_TINT=new vec4(0.85,0.4,0.4,1);
const DELETE_ICON_TINT=new vec4(1,1,1,1);
const LOGO=requireAsset("../Logo/shotscout_wordmark.png") as Texture;
const MASCOT=requireAsset("../Logo/shotscout_mascot.png") as Texture;
const MASCOT_ASPECT=550/720;
const LOGO_HEIGHT=8,LOGO_WIDTH=16.9;
const PANEL_TINT=new vec4(0x3e/255,0x30/255,0x82/255,1);
const BUTTON_TINT=new vec4(0x24/255,0x17/255,0x4d/255,1);
const TEXT_TINT=new vec4(0xc1/255,0xad/255,0xff/255,1);
// Rotary dial rings read as gear, not menu — neutral gunmetal grey matching the camera/light housings,
// not the palette's purple/cyan theme.
const DIAL_IDLE_TINT=new vec4(0.24,0.24,0.26,1);
const DIAL_HOVER_TINT=new vec4(0.38,0.38,0.41,1);
const DIAL_ACTIVE_TINT=new vec4(0.55,0.55,0.58,1);
const DIAL_TICK_TINT=new vec4(0.5,0.5,0.52,1);
const DIAL_PANEL_TINT=new vec4(0.12,0.12,0.13,1);
const PANEL_RADIUS=2.6,BUTTON_RADIUS=1.4;
const CAP_WIDTH=6,CAP_HEIGHT=14;
const TOOLBAR_ICON=6,TOOLBAR_GAP=1.2,TOOLBAR_COUNT=4;
const COLLAPSED_SIZE=new vec2(TOOLBAR_ICON+3,TOOLBAR_COUNT*TOOLBAR_ICON+(TOOLBAR_COUNT-1)*TOOLBAR_GAP+3);
const TOOL_NAMES=["Camera","Light","Notepad","Standing","Seated"];
const THEME_FONT=requireAsset("../Fonts/Inter.ttf") as Font;
const TYPE_SCALE = {Title2:{size:93,weight:700},Body:{size:52,weight:600},Caption:{size:44,weight:500}};
/** WB/Kelvin dials fill their ring's hole with the color that Kelvin value represents. */
function kelvinFill(kelvin:number):vec4 {
  const rgb=kelvinToRGB(kelvin);
  return new vec4(rgb.x,rgb.y,rgb.z,1);
}
function applyTextRole(t: Text, role: keyof typeof TYPE_SCALE): void {
  t.font=THEME_FONT;
  t.size = TYPE_SCALE[role].size;
  t.textFill.color=TEXT_TINT;
  (t as Text & {weight?:number}).weight = TYPE_SCALE[role].weight;
}

/** Passive UIKit views for the palette and the labels attached to placed markers. */
@component
export class ScoutPaletteUI extends BaseScriptComponent {
  @input @hint("Placeholder shown on placed notepads") noteText: string = "Check this angle";
  @input @hint("Bright accent for the current selection") @widget(new ColorWidget()) accent: vec4 = new vec4(0.45,0.9,0.95,1);
  @input @hint("Show experimental shared-session controls") showSharedControls:boolean=false;
  onSelect = new Event<number>();

  onUndo = new Event<void>();
  onClear = new Event<void>();
  onConnect = new Event<void>();
  onInvite = new Event<void>();
  onSave = new Event<void>();
  onRecover = new Event<void>();
  private sharedStatus:Text;
  private status: Text;
  private selectionLabels: ElementContent[] = [];
  private selected = 0;
  private count = 0;
  private back:BackPlate;
  private col:SceneObject;
  private collapsedBar:SceneObject;
  private cap:SceneObject;
  private capIcon:Image;
  private expandedSize:vec2;
  private collapsed=false;
  private manualCollapsed=true;
  private forcedCollapsed=false;
  get isCollapsed():boolean { return this.collapsed; }
  private subjectPose=3;
  private badgeMaterial:Material=null;

  onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => this.build());
  }
  /** Vertex-color material for the Edit/Delete sphere badges — provided by ScoutMain, which already owns
   * one. Only needed once a marker is actually placed, well after start(), so no ordering gate is required. */
  setBadgeMaterial(material:Material):void { this.badgeMaterial=material; }
  private build(): void {
    this.sceneObject.createComponent("Component.Canvas");
    const back = this.sceneObject.createComponent(BackPlate.getTypeName()) as BackPlate;
    this.back=back;
    back.style="simple";
    const height=(this.showSharedControls?44:36)+LOGO_HEIGHT;
    this.expandedSize=new vec2(46,height);
    back.size = this.expandedSize;
    back.onInitialized.add(()=>{this.style(back,PANEL_TINT,PANEL_RADIUS);});
    const content = this.obj(this.sceneObject,"PaletteContent",new vec3(0,0,0.6));
    const col = this.flex(content,FlexDirection.Column,46,height,1,2);
    this.col=col;
    this.headerRow(col);
    this.status = this.textRow(col,"Camera ready  ·  0 placed",42,2,"Body");
    const types = this.child(col,"Marker types",42,6);
    const row = this.flex(types,FlexDirection.Row,42,6,1,0);
    ["Camera","Light","Notepad"].forEach((label,i) => {
      const result = this.button(row,label,13.3,6,ICONS[i],() => this.onSelect.invoke(i));
      this.selectionLabels.push(result);
    });
    const actors=this.child(col,"Actor poses",42,5);
    const actorRow=this.flex(actors,FlexDirection.Row,42,5,1,0);
    ["Standing","Seated"].forEach((label,i)=>{
      this.selectionLabels.push(this.button(actorRow,label,20.5,5,ACTOR_ICONS[i],()=>this.onSelect.invoke(i+3)));
    });
    const actions = this.child(col,"Actions",42,4.5);
    const actionRow = this.flex(actions,FlexDirection.Row,42,4.5,1,0);
    this.button(actionRow,"Undo Last",20.5,4.5,ICONS[3],()=>this.onUndo.invoke());
    this.button(actionRow,"Clear All",20.5,4.5,ICONS[4],()=>this.onClear.invoke());
    if(this.showSharedControls){
    const shared=this.child(col,"Shared layout",42,4.5);
    const sharedRow=this.flex(shared,FlexDirection.Row,42,4.5,.6,0);
    this.button(sharedRow,"Connect",10,4.5,null,()=>this.onConnect.invoke());
    this.button(sharedRow,"Invite",10,4.5,null,()=>this.onInvite.invoke());
    this.button(sharedRow,"Save",10,4.5,null,()=>this.onSave.invoke());
    this.button(sharedRow,"Recover",10,4.5,null,()=>this.onRecover.invoke());
    this.sharedStatus=this.textRow(col,"Shared layout • connect to begin",42,2,"Caption");
    }
    this.textRow(col,"Tap the pencil on an asset to adjust it",42,2,"Caption");
    this.collapsedBar=this.buildCollapsedBar(content);
    this.buildCap(content);
    this.applyCollapsed();
    this.setState(this.selected,this.count);
  }
  /** Manually toggled by the cap. */
  setCollapsed(collapsed:boolean):void { this.manualCollapsed=collapsed; this.applyCollapsed(); }
  /** Driven by ScoutMain based on head movement speed; overrides the manual state while moving fast. */
  setAutoCollapsed(forced:boolean):void { this.forcedCollapsed=forced; this.applyCollapsed(); }
  private applyCollapsed():void {
    const collapsed=this.manualCollapsed||this.forcedCollapsed;
    if(collapsed===this.collapsed)return;
    this.collapsed=collapsed;
    this.col.enabled=!collapsed;
    this.collapsedBar.enabled=collapsed;
    this.back.size=collapsed?COLLAPSED_SIZE:this.expandedSize;
    this.updateCap();
  }
  /** Vertical row of tool icons — the default collapsed view. Tapping Subject alternates Standing/Seated. */
  private buildCollapsedBar(parent:SceneObject):SceneObject {
    const bar=this.obj(parent,"CollapsedBar",new vec3(0,0,0.02));
    const tools:[Texture,()=>void][]=[
      [ICONS[0],()=>this.onSelect.invoke(0)],
      [ICONS[1],()=>this.onSelect.invoke(1)],
      [ICONS[2],()=>this.onSelect.invoke(2)],
      [ACTOR_ICONS[0],()=>{this.subjectPose=this.subjectPose===3?4:3;this.onSelect.invoke(this.subjectPose);}]
    ];
    const totalH=TOOLBAR_COUNT*TOOLBAR_ICON+(TOOLBAR_COUNT-1)*TOOLBAR_GAP;
    tools.forEach(([icon,action],i)=>{
      const y=totalH/2-TOOLBAR_ICON/2-i*(TOOLBAR_ICON+TOOLBAR_GAP);
      this.iconBadge(this.obj(bar,"Tool"+i,new vec3(0,y,0)),icon,TEXT_TINT,TOOLBAR_ICON,0,action);
    });
    bar.enabled=false;
    return bar;
  }
  /** Persistent rounded tab on the panel's right edge; toggles collapsed state and stays put across both states. */
  private buildCap(parent:SceneObject):void {
    const cap=this.obj(parent,"Cap",new vec3(0,0,0.3));
    this.cap=cap;
    const back=cap.createComponent(BackPlate.getTypeName()) as BackPlate;
    back.style="simple";
    back.size=new vec2(CAP_WIDTH,CAP_HEIGHT);
    back.onInitialized.add(()=>{
      this.style(back,BUTTON_TINT,CAP_WIDTH/2);
      back.interactionPlane.enabled=false;
      back.interactable.onTriggerStart.add(()=>this.setCollapsed(!this.collapsed));
    });
    const iconHost=this.obj(cap,"Icon",new vec3(0,0,0.5));
    const img=iconHost.createComponent("Component.Image") as Image;
    img.mainMaterial=IMAGE_MATERIAL_ASSET.clone();
    img.mainPass.baseTex=ARROW_ICON;img.mainPass.baseColor=TEXT_TINT;
    iconHost.getTransform().setLocalScale(new vec3(4,4,1));
    this.capIcon=img;
    this.updateCap();
  }
  private updateCap():void {
    if(!this.cap)return;
    const size=this.collapsed?COLLAPSED_SIZE:this.expandedSize;
    this.cap.getTransform().setLocalPosition(new vec3(size.x/2+CAP_WIDTH/2-1.5,0,0.3));
    if(this.capIcon)this.capIcon.rotationAngle=this.collapsed?-90:90;
  }
  setState(selected:number,count:number): void {
    this.selected=selected; this.count=count;
    if (this.status) this.status.text=TOOL_NAMES[selected]+" ready  ·  "+count+" placed";
    this.selectionLabels.forEach((label,i)=> {label.text=(i===selected?"• ":"")+TOOL_NAMES[i]});
  }
  setSharedStatus(text:string):void {if(this.sharedStatus)this.sharedStatus.text=text;}
  setHint(hint:string):void { if(this.status) this.status.text=hint; }

  /** Labels are views only; caller owns position, lifetime, and interaction state. */
  decorateMarker(root:SceneObject,label:string,note:boolean,labelY=-7,onEdit:()=>void=()=>{},onDelete:()=>void=()=>{}): void {
    const host=this.obj(root,note?"Notepad card":"Marker label",new vec3(0,note?0:labelY,4));
    host.createComponent("Component.Canvas");
    const back=host.createComponent(BackPlate.getTypeName()) as BackPlate;
    const size=new vec2(note?18:16,note?11:3.2);
    back.size=size;
    const editX=size.x/2-3.2;
    this.cornerButton(host,"Delete",new vec3(editX-7.4,size.y/2,1.2),CLOSE_ICON,DELETE_SPHERE_TINT,DELETE_ICON_TINT,onDelete);
    this.cornerButton(host,"Edit",new vec3(editX,size.y/2,1.2),EDIT_ICON,SPHERE_TINT,TEXT_TINT,onEdit);
    back.onInitialized.add(()=>{
      back.interactable.enabled=false;
      back.interactionPlane.enabled=false;
      const disable=this.createEvent("DelayedCallbackEvent");
      disable.bind(()=>{
        // Skip the Edit/Delete badges — they need their own collider to stay tappable.
        const visit=(node:SceneObject)=>{
          if(node.name==="Edit"||node.name==="Delete")return;
          node.getComponents("Physics.ColliderComponent").forEach(c=>c.enabled=false);
          for(let i=0;i<node.getChildrenCount();i++)visit(node.getChild(i));
        };visit(host);
      });disable.reset(0.1);
    });
    const content=this.obj(host,"LabelContent",new vec3(0,0,0.6));
    const col=this.flex(content,FlexDirection.Column,note?18:16,note?11:3.2,0.7,0.7);
    const t=this.textRow(col,label,note?16.6:14.6,1.8,"Body");
    t.textFill.color=this.accent;
    if(note){
      this.textRow(col,this.noteText,16.6,3.5,"Body");
      this.textRow(col,"Pinch + drag to move",16.6,1.8,"Caption");
    }
  }
  /** Compact ISO/Aperture/Shutter/WB dial row for one placed Camera asset — purely informational, no
   * dial here drives a real effect (see AGENTS request: only the Light asset's dials do). */
  buildCameraControls(root:SceneObject,labelY:number,state:CameraAssetState,onChange:(patch:Partial<CameraAssetState>)=>void):void {
    this.buildControlsRow(root,labelY,38,[
      {label:"ISO",steps:ISO_STOPS,initialIndex:state.isoIndex,onChange:i=>onChange({isoIndex:i})},
      {label:"Aperture",steps:APERTURE_STOPS,initialIndex:state.apertureIndex,onChange:i=>onChange({apertureIndex:i})},
      {label:"Shutter",steps:SHUTTER_STOPS,initialIndex:state.shutterIndex,onChange:i=>onChange({shutterIndex:i})},
      {label:"WB",steps:KELVIN_STOPS,initialIndex:state.kelvinIndex,onChange:i=>onChange({kelvinIndex:i}),fillColorForValue:kelvinFill},
    ]);
  }
  /** Compact Intensity/Kelvin dial row for one placed Light asset — both dials drive the marker's
   * real-time LightSource via ScoutMain.applyLightLook. */
  buildLightControls(root:SceneObject,labelY:number,state:LightAssetState,onChange:(patch:Partial<LightAssetState>)=>void):void {
    this.buildControlsRow(root,labelY,20,[
      {label:"Intensity",steps:INTENSITY_STOPS,initialIndex:state.intensityIndex,onChange:i=>onChange({intensityIndex:i})},
      {label:"Kelvin",steps:KELVIN_STOPS,initialIndex:state.kelvinIndex,onChange:i=>onChange({kelvinIndex:i}),fillColorForValue:kelvinFill},
    ]);
  }
  /** Shared visual plumbing behind buildCameraControls/buildLightControls — a small BackPlate panel,
   * floating above the marker's existing label card (never replacing it), hosting a row of RotaryDials.
   * Camera and Light keep their own public methods/types above; only this rendering helper is shared. */
  private buildControlsRow(root:SceneObject,labelY:number,rowWidth:number,dials:{label:string;steps:DialStep[];initialIndex:number;onChange:(index:number)=>void;fillColorForValue?:(value:number)=>vec4}[]):void {
    if(!this.badgeMaterial)return; // same guard sphereButton uses — set once in ScoutMain.start(), before any marker exists
    const material=this.badgeMaterial;
    const dialRadius=3.2;
    const panelH=dialRadius*2+9;
    const labelCardHalfHeight=1.6,gap=2;
    const y=labelY+labelCardHalfHeight+gap+panelH/2;
    const host=this.obj(root,"Asset controls",new vec3(0,y,4));
    host.createComponent("Component.Canvas");
    const back=host.createComponent(BackPlate.getTypeName()) as BackPlate;
    back.style="simple";
    back.size=new vec2(rowWidth,panelH);
    back.onInitialized.add(()=>{
      // Neutral dark gear-grey, not the palette's purple PANEL_TINT — this backdrop is the physical
      // gear's own control panel, not menu chrome, so it should read as equipment, not UI.
      this.style(back,DIAL_PANEL_TINT,PANEL_RADIUS);
      back.interactable.enabled=false;
      back.interactionPlane.enabled=false;
      // Mirrors decorateMarker's own defensive sweep: BackPlate's stray collider(s) would otherwise sit
      // in front of (and block) the dials' own colliders. Exempt DialKnob nodes so drag still works.
      const disable=this.createEvent("DelayedCallbackEvent");
      disable.bind(()=>{
        const visit=(node:SceneObject)=>{
          if(node.name==="DialKnob")return;
          node.getComponents("Physics.ColliderComponent").forEach(c=>c.enabled=false);
          for(let i=0;i<node.getChildrenCount();i++)visit(node.getChild(i));
        };visit(host);
      });disable.reset(0.1);
    });
    const content=this.obj(host,"ControlsContent",new vec3(0,0,0.5));
    const theme:RotaryDialTheme={font:THEME_FONT,textColor:TEXT_TINT,idleColor:DIAL_IDLE_TINT,hoverColor:DIAL_HOVER_TINT,activeColor:DIAL_ACTIVE_TINT,tickColor:DIAL_TICK_TINT};
    const spacing=rowWidth/dials.length;
    dials.forEach((d,i)=>{
      const x=-rowWidth/2+spacing*(i+0.5);
      new ScoutRotaryDial(content,new vec3(x,0,0),material,theme,{label:d.label,steps:d.steps,initialIndex:d.initialIndex,radius:dialRadius,onChange:idx=>d.onChange(idx),fillColorForValue:d.fillColorForValue});
    });
  }
  /** Mascot + wordmark, always the first row of the expanded panel. */
  private headerRow(parent:SceneObject):void {
    const h=LOGO_HEIGHT+2;
    const row=this.child(parent,"Header",42,h);
    const layout=this.flex(row,FlexDirection.Row,42,h,2,0);
    this.imageItem(layout,MASCOT,LOGO_HEIGHT*MASCOT_ASPECT,LOGO_HEIGHT);
    this.imageItem(layout,LOGO,LOGO_WIDTH,LOGO_HEIGHT);
  }
  private imageItem(parent:SceneObject,texture:Texture,w:number,h:number):void {
    const so=this.child(parent,"Image",w,h);
    const img=so.createComponent("Component.Image") as Image;
    img.mainMaterial=IMAGE_MATERIAL_ASSET.clone();
    img.mainPass.baseTex=texture;
    so.getTransform().setLocalScale(new vec3(w,h,1));
  }
  /** Real 3D sphere anchored at a corner offset from an asset's card — Edit/Delete only. */
  private cornerButton(parent:SceneObject,name:string,pos:vec3,icon:Texture,sphereTint:vec4,iconTint:vec4,onTap:()=>void):void {
    this.sphereButton(this.obj(parent,name,pos),icon,sphereTint,iconTint,5.6,onTap);
  }
  /** A genuine 3D sphere (reads correctly as a rounded volume from any angle) with a crisp flat icon
   * (a real anti-aliased PNG, not geometry) sitting just off its front surface — baking the icon into the
   * mesh's own per-face color looked clean molded onto the curve but rendered visibly faceted/pixelated at
   * badge scale, so the sharp 2D icon wins here; the sphere still supplies the genuine 3D presence. */
  private sphereButton(so:SceneObject,icon:Texture,sphereTint:vec4,iconTint:vec4,size:number,onTap:()=>void):void {
    // BackPlate supplies the (already-proven) collider + interactable, sized to match the sphere; its own
    // flat visual is fully hidden behind the opaque sphere drawn in front of it, so its color doesn't matter.
    const back=so.createComponent(BackPlate.getTypeName()) as BackPlate;
    back.style="simple";
    back.size=new vec2(size,size);
    back.onInitialized.add(()=>{
      this.style(back,BUTTON_TINT,size/2);
      back.interactionPlane.enabled=false;
      back.interactable.onTriggerStart.add(()=>onTap());
    });
    const radius=size/2;
    if(this.badgeMaterial){
      const sphere=this.obj(so,"Sphere",vec3.zero());
      const visual=sphere.createComponent("Component.RenderMeshVisual") as RenderMeshVisual;
      const b=this.sphereMeshBuilder(radius,sphereTint);
      // Mirrors ScoutTransformGizmo's proven order: bind the (empty) mesh to the visual first, then
      // populate it — binding after updateMesh() left mainMaterial's mesh reference empty.
      visual.mesh=b.getMesh();
      visual.mainMaterial=this.badgeMaterial.clone();
      b.updateMesh();
    }
    const iconHost=this.obj(so,"Icon",new vec3(0,0,radius+0.7));
    const img=iconHost.createComponent("Component.Image") as Image;
    img.mainMaterial=IMAGE_MATERIAL_ASSET.clone();
    img.mainPass.baseTex=icon;img.mainPass.baseColor=iconTint;
    iconHost.getTransform().setLocalScale(new vec3(size*0.55,size*0.55,1));
  }
  /** Dense UV sphere with a fixed-light diffuse+specular shade baked in per-face (not per-vertex): this
   * project's vertex-color material renders flat-shaded (one color per triangle, not interpolated —
   * confirmed by inspecting the transform gizmo's own handles), so faces share no vertices here and each
   * gets one unambiguous color from its own centroid, rather than a shared-vertex gradient that would only
   * ever show as a couple of hard-edged bands. */
  private sphereMeshBuilder(radius:number,tint:vec4):MeshBuilder {
    const b=new MeshBuilder([{name:"position",components:3},{name:"normal",components:3,normalized:true},{name:"color",components:4}]);
    b.topology=MeshTopology.Triangles;b.indexType=MeshIndexType.UInt16;
    const lat=18,lon=24;
    const lx=-0.45,ly=0.55,lz=0.7;const llen=Math.sqrt(lx*lx+ly*ly+lz*lz);
    const nlx=lx/llen,nly=ly/llen,nlz=lz/llen;
    type V={x:number,y:number,z:number};
    const dir=(i:number,j:number):V=>{
      const theta=i*Math.PI/lat,phi=j*2*Math.PI/lon;
      const sinT=Math.sin(theta);
      return {x:sinT*Math.cos(phi),y:Math.cos(theta),z:sinT*Math.sin(phi)};
    };
    const colorFor=(n:V):[number,number,number]=>{
      const diffuse=Math.max(0,n.x*nlx+n.y*nly+n.z*nlz);
      const shade=Math.min(1.35,0.55+diffuse*0.55+Math.pow(diffuse,20)*1.2);
      return [Math.min(1,tint.x*shade),Math.min(1,tint.y*shade),Math.min(1,tint.z*shade)];
    };
    let vi=0;
    const addTri=(a:V,b2:V,c:V)=>{
      const cx=(a.x+b2.x+c.x)/3,cy=(a.y+b2.y+c.y)/3,cz=(a.z+b2.z+c.z)/3;
      const clen=Math.sqrt(cx*cx+cy*cy+cz*cz)||1;
      const col=colorFor({x:cx/clen,y:cy/clen,z:cz/clen});
      [a,b2,c].forEach(p=>b.appendVerticesInterleaved([p.x*radius,p.y*radius,p.z*radius,p.x,p.y,p.z,col[0],col[1],col[2],1]));
      b.appendIndices([vi,vi+1,vi+2]);vi+=3;
    };
    for(let i=0;i<lat;i++)for(let j=0;j<lon;j++){
      const p00=dir(i,j),p10=dir(i+1,j),p01=dir(i,j+1),p11=dir(i+1,j+1);
      addTri(p00,p11,p10);
      addTri(p00,p01,p11);
    }
    return b;
  }
  /** Flat round badge with a centered icon; used for the collapsed toolbar's tool icons. */
  private iconBadge(so:SceneObject,icon:Texture,tint:vec4,size:number,rotation:number,onTap:()=>void):void {
    const back=so.createComponent(BackPlate.getTypeName()) as BackPlate;
    back.style="simple";
    back.size=new vec2(size,size);
    back.onInitialized.add(()=>{
      this.style(back,BUTTON_TINT,size/2);
      back.interactionPlane.enabled=false;
      back.interactable.onTriggerStart.add(()=>onTap());
    });
    const iconHost=this.obj(so,"Icon",new vec3(0,0,0.5));
    const img=iconHost.createComponent("Component.Image") as Image;
    img.mainMaterial=IMAGE_MATERIAL_ASSET.clone();
    img.mainPass.baseTex=icon;img.mainPass.baseColor=tint;img.rotationAngle=rotation;
    iconHost.getTransform().setLocalScale(new vec3(size*0.6,size*0.6,1));
  }
  private style(back:BackPlate,color:vec4,radius:number):void {
    const rect=(back as unknown as {roundedRectangle:{gradient:boolean;backgroundColor:vec4;cornerRadius:number}}).roundedRectangle;
    rect.gradient=false;rect.backgroundColor=color;rect.cornerRadius=radius;
  }
  private obj(parent:SceneObject,name:string,pos?:vec3):SceneObject {
    const so=global.scene.createSceneObject(name);so.setParent(parent);
    if(pos)so.getTransform().setLocalPosition(pos);return so;
  }
  private child(parent:SceneObject,name:string,w:number,h:number):SceneObject {
    const so=this.obj(parent,name,new vec3(0,0,0.02));
    const item=so.createComponent(FlexItem.getTypeName()) as FlexItem;
    item.overrideWidth=w;item.overrideHeight=h;item.flexShrink=0;item.alignSelf=FlexAlignSelf.Center;
    (parent.getComponent(FlexLayout.getTypeName()) as FlexLayout).addItems([item]);return so;
  }
  private flex(parent:SceneObject,direction:FlexDirection,w:number,h:number,gap:number,pad:number):SceneObject {
    const so=this.obj(parent,"Layout",new vec3(0,0,0.02));
    const f=so.createComponent(FlexLayout.getTypeName()) as FlexLayout;
    f.autoDiscoverItemsOnStart=false;
    f.onInitialized.add(()=>{
      f.width=w;f.height=h;f.direction=direction;f.rowGap=gap;f.columnGap=gap;
      f.paddingTop=pad;f.paddingBottom=pad;f.paddingLeft=pad;f.paddingRight=pad;
      f.alignItems=FlexAlign.Center;f.justifyContent=FlexJustify.Center;
    });return so;
  }
  private textRow(parent:SceneObject,value:string,w:number,h:number,role:keyof typeof TYPE_SCALE):Text {
    const so=this.child(parent,value,w,h);const t=so.createComponent("Component.Text") as Text;
    t.text=value;t.depthTest=true;applyTextRole(t,role);
    t.horizontalAlignment=HorizontalAlignment.Center;t.verticalAlignment=VerticalAlignment.Center;
    t.horizontalOverflow=HorizontalOverflow.Overflow;t.verticalOverflow=VerticalOverflow.Overflow;
    t.layoutRect=Rect.create(-w/2,w/2,-h/2,h/2);return t;
  }
  /** Button's own visual comes from a theme system with no direct color override, so buttons are built on
   * BackPlate (full color control) instead, with ElementContent laid on top purely for icon+text content. */
  private button(parent:SceneObject,label:string,w:number,h:number,icon:Texture,action:()=>void):ElementContent {
    const so=this.child(parent,label,w,h);
    const back=so.createComponent(BackPlate.getTypeName()) as BackPlate;
    back.style="simple";
    back.size=new vec2(w,h);
    back.onInitialized.add(()=>{
      this.style(back,BUTTON_TINT,BUTTON_RADIUS);
      back.interactionPlane.enabled=false;
      back.interactable.onTriggerEnd.add(()=>action());
    });
    const ec=so.createComponent(ElementContent.getTypeName()) as ElementContent;
    ec.sizeOverride=new vec2(w,h);
    ec.text=label;ec.textSize=TYPE_SCALE.Body.size;ec.leadingIcon=icon;ec.spacing=0.65;
    ec.autoResize=false;ec.contentAlignment="center";
    // ElementContent defers building its Text/Icon children until the BackPlate sibling's own
    // onInitialized fires; subscribing here (after that content-building subscription is registered
    // above) guarantees this runs once the Text node actually exists, instead of racing a fixed delay.
    back.onInitialized.add(()=>{
      const apply=(node:SceneObject)=>{
        node.getComponents("Component.Text").forEach(t=>{const tt=t as Text;tt.font=THEME_FONT;tt.textFill.color=TEXT_TINT;});
        const img=node.getComponent("Component.Image") as Image;
        if(img)img.mainPass.baseColor=TEXT_TINT;
        for(let i=0;i<node.getChildrenCount();i++)apply(node.getChild(i));
      };apply(so);
    });
    return ec;
  }
}
