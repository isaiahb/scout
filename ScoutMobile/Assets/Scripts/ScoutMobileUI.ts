export const TOOL_NAMES = ['Camera', 'Light', 'Note', 'Standing', 'Seated'];
export type UiAction = {kind:'tool', index:number}|{kind:'undo'|'clear'};
const centers = [.148, .324, .5, .676, .852];

/** One coordinate source for both drawing and hit regions, in normalized screen space. */
export function actionAt(x:number,y:number):UiAction|null {
  if(y>=.65 && y<=.743) {
    for(let i=0;i<centers.length;i++)if(Math.abs(x-centers[i])<=.077)return {kind:'tool',index:i};
  }
  if(y>=.752 && y<=.807){
    if(x>=.075&&x<=.295)return {kind:'undo'};
    if(x>=.705&&x<=.925)return {kind:'clear'};
  }
  return null;
}
export function isScenePoint(x:number,y:number):boolean {
  return x>.035 && x<.965 && y>.235 && y<.575;
}

export class ScoutMobileUI {
  private cards:Image[]=[];
  private icons:Image[]=[];
  private labels:Text[]=[];
  private status:Text;
  private count:Text;
  private undoText:Text;
  private clearText:Text;
  private aim:Text;
  private hintUntil=0;
  private selection=0;
  private countValue=0;
  private clearArmed=false;
  private readonly ink=new vec4(.045,.055,.075,1);
  private readonly white=new vec4(.96,.97,1,1);
  private readonly muted=new vec4(.57,.62,.7,1);
  private readonly accents=[new vec4(.47,.91,.96,1),new vec4(1,.81,.39,1),new vec4(.68,.89,.61,1),new vec4(.76,.65,1,1),new vec4(.76,.65,1,1)];
  constructor(private textTemplate:Text,private imageTemplate:Image,private font:Font,
    private panel:Texture,private card:Texture,private pill:Texture,private toolIcons:Texture[]) {}

  init():void {
    this.image('Scout dock',this.panel,.5,.722,.94,.193,new vec4(.035,.045,.065,.96),0);
    this.image('Scout brand pill',this.pill,.5,.167,.3,.043,new vec4(.035,.045,.065,.92),0);
    this.text('Scout brand','SCOUT',.5,.167,.26,.04,25,this.white,700);
    this.aim=this.text('Scout aim','+',.5,.42,.05,.04,30,new vec4(1,1,1,.65));
    this.image('Scout hint pill',this.pill,.5,.6,.8,.046,new vec4(.035,.045,.065,.92),0);
    this.status=this.text('Scout hint','',.5,.6,.76,.035,17,this.white,500);
    centers.forEach((x,i)=>{
      this.cards.push(this.image(TOOL_NAMES[i]+' card',this.card,x,.695,.154,.092,this.ink,1));
      const icon=this.toolIcons[i];
      this.icons.push(icon ? this.image(TOOL_NAMES[i]+' icon',icon,x,.68,.061,.029,this.white,2):null);
      if(!icon)this.text(TOOL_NAMES[i]+' monogram',i===3?'I':'L',x,.68,.07,.03,24,this.white);
      this.labels.push(this.text(TOOL_NAMES[i]+' button',TOOL_NAMES[i],x,.721,.15,.022,14,this.white,600));
    });
    this.undoText=this.text('Undo button','Undo',.185,.781,.2,.034,17,this.muted,500);
    this.count=this.text('Marker count','0 objects',.5,.781,.31,.032,15,this.muted);
    this.clearText=this.text('Clear button','Clear',.815,.781,.2,.034,17,this.muted,500);
    this.textTemplate.getSceneObject().enabled=false;
    this.imageTemplate.getSceneObject().enabled=false;
    this.refresh(0,0,false);
  }
  private rect(obj:SceneObject,x:number,y:number,w:number,h:number):void {
    const st=obj.getComponent('Component.ScreenTransform');
    st.anchors=Rect.create(2*(x-w/2)-1,2*(x+w/2)-1,1-2*(y+h/2),1-2*(y-h/2));
    st.offsets=Rect.create(0,0,0,0);
  }
  private image(name:string,texture:Texture,x:number,y:number,w:number,h:number,color:vec4,order:number):Image {
    const source=this.imageTemplate.getSceneObject();
    const obj=source.getParent().copySceneObject(source);obj.name=name;obj.enabled=true;this.rect(obj,x,y,w,h);
    const im=obj.getComponent('Component.Image');im.mainMaterial=im.mainMaterial.clone();
    im.mainPass.baseTex=texture;im.mainPass.baseColor=color;im.stretchMode=StretchMode.Stretch;im.setRenderOrder(order);return im;
  }
  private text(name:string,value:string,x:number,y:number,w:number,h:number,size:number,color:vec4,weight=400):Text {
    const source=this.textTemplate.getSceneObject();const obj=source.getParent().copySceneObject(source);
    obj.name=name;obj.enabled=true;this.rect(obj,x,y,w,h);
    const t=obj.getComponent('Component.Text');t.text=value;t.font=this.font;t.size=size;t.weight=weight;t.sizeToFit=false;
    t.outlineSettings.enabled=false;t.dropshadowSettings.enabled=false;t.backgroundSettings.enabled=false;
    t.horizontalAlignment=HorizontalAlignment.Center;t.verticalAlignment=VerticalAlignment.Center;t.textFill.color=color;t.setRenderOrder(3);return t;
  }
  refresh(selected:number,count:number,canUndo:boolean,clearArmed=false):void {
    this.selection=selected;this.countValue=count;this.clearArmed=clearArmed;
    this.cards.forEach((im,i)=>{im.mainPass.baseColor=i===selected?this.accents[i]:new vec4(.10,.12,.15,1);
      this.labels[i].textFill.color=i===selected?this.ink:this.white;
      if(this.icons[i])this.icons[i].mainPass.baseColor=i===selected?this.ink:this.white;});
    this.count.text=count+' '+(count===1?'object':'objects');
    this.undoText.textFill.color=canUndo?this.white:this.muted;
    this.clearText.text=clearArmed?'Confirm?':'Clear';
    this.clearText.textFill.color=clearArmed?new vec4(1,.58,.55,1):count?this.white:this.muted;
    this.aim.textFill.color=this.accents[selected];
    this.tick();
  }
  toast(message:string):void {this.status.text=message;this.hintUntil=getTime()+2.2;}
  tick():void {
    if(getTime()<this.hintUntil)return;
    const text=this.clearArmed?'Tap Clear again to remove all':this.countValue>=20?'Scene full · Undo or clear an object':'Tap the scene to place '+TOOL_NAMES[this.selection].toLowerCase();
    if(this.status.text!==text)this.status.text=text;
  }
  label(name:string):Text {
    const t=this.text(name+' label',name,.5,.4,.3,.035,14,this.white,500);
    t.backgroundSettings.enabled=true;t.backgroundSettings.fill.color=new vec4(.035,.045,.065,.9);t.backgroundSettings.cornerRadius=.4;
    return t;
  }
  positionLabel(label:Text,x:number,y:number):void {this.rect(label.getSceneObject(),x,y,.32,.032);}
}
