import Event from "SpectaclesInteractionKit.lspkg/Utils/Event";
import {BackPlate} from "SpectaclesUIKit.lspkg/Scripts/BackPlate";
import {Button} from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button";
import {ElementContent} from "SpectaclesUIKit.lspkg/Scripts/Components/Content/ElementContent";
import {FlexLayout} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout";
import {FlexItem} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem";
import {FlexAlign, FlexAlignSelf, FlexDirection, FlexJustify} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes";

const ICONS: Texture[] = [requireAsset("../Icons/videocam.png") as Texture, requireAsset("../Icons/lightbulb.png") as Texture, requireAsset("../Icons/sticky_note_2.png") as Texture, requireAsset("../Icons/undo.png") as Texture, requireAsset("../Icons/delete.png") as Texture];
const ACTOR_ICONS:Texture[]=[requireAsset("../Icons/person.png") as Texture,requireAsset("../Icons/chair.png") as Texture];
const TOOL_NAMES=["Camera","Light","Notepad","Standing","Seated"];
const THEME_FONT=requireAsset("../Fonts/Inter.ttf") as Font;
const TYPE_SCALE = {Title2:{size:93,weight:700},Body:{size:52,weight:600},Caption:{size:44,weight:500}};
function applyTextRole(t: Text, role: keyof typeof TYPE_SCALE): void {
  t.font=THEME_FONT;
  t.size = TYPE_SCALE[role].size;
  (t as Text & {weight?:number}).weight = TYPE_SCALE[role].weight;
}

/** Passive UIKit views for the palette and the labels attached to placed markers. */
@component
export class ScoutPaletteUI extends BaseScriptComponent {
  @input @hint("Palette title") title: string = "scout";
  @input @hint("Placeholder shown on placed notepads") noteText: string = "Check this angle";
  @input @hint("Bright accent for the current selection") @widget(new ColorWidget()) accent: vec4 = new vec4(0.45,0.9,0.95,1);
  @input @hint("Show experimental shared-session controls") showSharedControls:boolean=false;
  onSelect = new Event<number>();
  onOrient = new Event<string>();

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

  onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => this.build());
  }
  private build(): void {
    this.sceneObject.createComponent("Component.Canvas");
    const back = this.sceneObject.createComponent(BackPlate.getTypeName()) as BackPlate;
    const height=this.showSharedControls?44:36;
    back.size = new vec2(46,height);
    const content = this.obj(this.sceneObject,"PaletteContent",new vec3(0,0,0.6));
    const col = this.flex(content,FlexDirection.Column,46,height,1,2);
    this.textRow(col,this.title,42,4,"Title2");
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
    const aimRow=this.child(col,"Aim controls",42,4.5);
    const aimLayout=this.flex(aimRow,FlexDirection.Row,42,4.5,0,0);
    ["Move","Rotate","Hide"].forEach(label=>this.button(aimLayout,label,13.3,4.5,null,()=>this.onOrient.invoke(label)));
    if(this.showSharedControls){
    const shared=this.child(col,"Shared layout",42,4.5);
    const sharedRow=this.flex(shared,FlexDirection.Row,42,4.5,.6,0);
    this.button(sharedRow,"Connect",10,4.5,null,()=>this.onConnect.invoke());
    this.button(sharedRow,"Invite",10,4.5,null,()=>this.onInvite.invoke());
    this.button(sharedRow,"Save",10,4.5,null,()=>this.onSave.invoke());
    this.button(sharedRow,"Recover",10,4.5,null,()=>this.onRecover.invoke());
    this.sharedStatus=this.textRow(col,"Shared layout • connect to begin",42,2,"Caption");
    }
    this.textRow(col,"Select object · Drag colored handles",42,2,"Caption");
    this.setState(this.selected,this.count);
  }
  setState(selected:number,count:number): void {
    this.selected=selected; this.count=count;
    if (this.status) this.status.text=TOOL_NAMES[selected]+" ready  ·  "+count+" placed";
    this.selectionLabels.forEach((label,i)=> {label.text=(i===selected?"• ":"")+TOOL_NAMES[i]});
  }
  setSharedStatus(text:string):void {if(this.sharedStatus)this.sharedStatus.text=text;}
  setHint(hint:string):void { if(this.status) this.status.text=hint; }

  /** Labels are views only; caller owns position, lifetime, and interaction state. */
  decorateMarker(root:SceneObject,label:string,note:boolean,labelY=-7): void {
    const host=this.obj(root,note?"Notepad card":"Marker label",new vec3(0,note?0:labelY,4));
    host.createComponent("Component.Canvas");
    const back=host.createComponent(BackPlate.getTypeName()) as BackPlate;
    back.size=new vec2(note?18:16,note?11:3.2);
    back.onInitialized.add(()=>{
      back.interactable.enabled=false;
      back.interactionPlane.enabled=false;
      const disable=this.createEvent("DelayedCallbackEvent");
      disable.bind(()=>{
        const visit=(node:SceneObject)=>{
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
  private button(parent:SceneObject,label:string,w:number,h:number,icon:Texture,action:()=>void):ElementContent {
    const so=this.child(parent,label,w,h);const b=so.createComponent(Button.getTypeName()) as Button;
    b.size=new vec3(w,h,1);b.onTriggerUp.add(action);
    const ec=so.createComponent(ElementContent.getTypeName()) as ElementContent;
    ec.text=label;ec.textSize=TYPE_SCALE.Body.size;ec.leadingIcon=icon;ec.spacing=0.65;
    ec.autoResize=false;ec.contentAlignment="center";
    const fontEvent=this.createEvent("DelayedCallbackEvent");
    fontEvent.bind(()=>{
      const apply=(node:SceneObject)=>{
        node.getComponents("Component.Text").forEach(t=>(t as Text).font=THEME_FONT);
        for(let i=0;i<node.getChildrenCount();i++)apply(node.getChild(i));
      };apply(so);
    });fontEvent.reset(0.05);return ec;
  }
}
