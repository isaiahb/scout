/** Explicit shared saves. Never bind cloud storage to the initial solo session. */
export class ScoutSharedSession {
  private session:MultiplayerSession|null=null;
  private store:CloudStore|null=null;
  private boundSession:MultiplayerSession|null=null;
  private receiver=false;
  private sharedSession:MultiplayerSession|null=null;
  private started=false;
  private busy=false;
  private generation=0;
  private busyUntil=0;
  private readonly key='scout.layout.v1';
  constructor(private connected:ConnectedLensModule,private cloud:CloudStorageModule,private status:(text:string)=>void){}
  connect():void {
    if(this.started){this.status(this.store?'Shared session ready':'Use Invite, or reopen the original invitation');return;}
    this.started=true;this.status('Connecting…');
    const opts=ConnectedLensSessionOptions.create();
    opts.onSessionCreated=(_session,type)=>{this.receiver=type===ConnectedLensSessionOptions.SessionCreationType.MultiplayerReceiver;this.attach();};
    opts.onConnected=session=>{this.session=session;this.generation++;this.busy=false;this.status('Connected • Invite to share');this.attach();};
    opts.onDisconnected=()=>{this.session=null;this.store=null;this.busy=false;this.generation++;this.status('Disconnected • reopen this Lens to reconnect');};
    opts.onError=(_s,code)=>{this.busy=false;this.status('Connection error: '+code);};
    try{this.connected.createSession(opts);}catch(e){this.started=false;this.status('Could not connect');console.error(String(e));}
  }
  invite():void {
    if(!this.session){this.status('Connect first');return;}
    if(this.boundSession){this.status('Reopen the existing invitation to recover this session');return;}
    this.status('Choose a friend in the invitation screen');
    try{this.connected.shareSession(ConnectedLensModule.SessionShareType.Invitation,(session)=>{this.sharedSession=session;this.attach();});}
    catch(e){this.status('Invitation unavailable');console.error(String(e));}
  }
  private attach():void {
    const session=this.session;
    if(!session||(!this.receiver&&(!this.sharedSession||!session.isSame(this.sharedSession))))return;
    if(this.boundSession){
      if(!session.isSame(this.boundSession))this.status('Session changed • reopen its invitation');
      return;
    }
    this.boundSession=session;
    const generation=this.generation;
    const opts=CloudStorageOptions.create();opts.session=session;
    this.status('Opening shared storage…');
    this.cloud.getCloudStore(opts,store=>{if(generation!==this.generation)return;this.store=store;this.status('Shared ready • Save or Recover');},code=>{if(generation===this.generation)this.status('Storage error: '+code+' • reopen Lens');});
  }
  private begin():number {
    if(!this.store||!this.session){this.status('Connect and Invite, or reopen an invitation');return -1;}
    if(this.busy){this.status('Waiting for storage…');return -1;}
    this.busy=true;this.busyUntil=getTime()+20;return ++this.generation;
  }
  tick():void {if(this.busy&&getTime()>this.busyUntil){this.busy=false;this.generation++;this.status('Storage timed out • Recover before retrying Save');}}
  save(raw:string):void {
    const generation=this.begin();if(generation<0)return;
    this.status('Saving shared layout…');
    const opts=CloudStorageWriteOptions.create();opts.scope=StorageScope.Session;
    this.store.setValue(this.key,raw,opts,()=>{if(generation!==this.generation)return;this.busy=false;this.status('Saved to shared session');},code=>this.failed(generation,'Save',code));
  }
  load(apply:(raw:string)=>void):void {
    const generation=this.begin();if(generation<0)return;
    this.status('Recovering shared layout…');
    const opts=CloudStorageReadOptions.create();opts.scope=StorageScope.Session;
    this.store.getValue(this.key,opts,(_key,value)=>{
      if(generation!==this.generation)return;this.busy=false;
      try{if(typeof value!=='string')throw new Error('No layout');apply(value);this.status('Recovered here • manual alignment');}
      catch(e){this.status('No valid saved layout • current markers kept');}
    },code=>this.failed(generation,'Recover',code));
  }
  private failed(generation:number,action:string,code:string):void {if(generation!==this.generation)return;this.busy=false;this.status(action+' failed: '+code);}
}
