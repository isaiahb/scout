import {test,expect} from 'bun:test';
import {parseLayout} from '../Scout/Assets/Scripts/ScoutLayout';
import {ScoutSharedSession} from '../Scout/Assets/Scripts/ScoutSharedSession';
const g=globalThis as any;
g.getTime=()=>0;
g.ConnectedLensSessionOptions={create:()=>({}),SessionCreationType:{MultiplayerReceiver:1}};
g.ConnectedLensModule={SessionShareType:{Invitation:1}};
g.CloudStorageOptions={create:()=>({})};
g.CloudStorageReadOptions={create:()=>({})};
g.CloudStorageWriteOptions={create:()=>({})};
g.StorageScope={Session:1,User:0};
const layout=JSON.stringify({version:1,frame:'manual',markers:[{kind:0,label:'Camera 01',position:[10,0,-110],rotation:[1,0,0,0]}]});
function client(db:Map<string,string>,receiver=false){
 let opts:any;let bindings=0;let lastScope=-1;let status='';
 const solo={id:'solo',isSame(other:any){return other.id===this.id;}};
 const shared={id:'shared',isSame(other:any){return other.id===this.id;}};
 const module={createSession(o:any){opts=o;o.onSessionCreated(receiver?shared:solo,receiver?1:0);o.onConnected(receiver?shared:solo,{});},shareSession(_:any,cb:any){opts.onConnected(shared,{});cb(shared);}};
 const cloud={getCloudStore(o:any,cb:any){bindings++;expect(o.session.id).toBe('shared');cb({setValue(k:any,v:any,w:any,ok:any){lastScope=w.scope;db.set(k,v);ok();},getValue(k:any,r:any,ok:any,err:any){lastScope=r.scope;db.has(k)?ok(k,db.get(k)):err('NotFound');}});}};
 const c=new ScoutSharedSession(module as any,cloud as any,s=>status=s);
 return {c,bindings:()=>bindings,scope:()=>lastScope,status:()=>status,disconnect:()=>opts.onDisconnected()};
}
test('valid snapshot preserves relative pose; rejects invalid versions and rotations',()=>{
 expect(parseLayout(layout).markers[0].position).toEqual([10,0,-110]);
 for(const value of ['{}',layout.replace('"version":1','"version":2'),layout.replace('[1,0,0,0]','[0,0,0,0]'),layout.replace('[10,0,-110]','[null,0,-110]')])expect(()=>parseLayout(value)).toThrow();
});
test('creator saves, exits, another account reopens same shared session and recovers',()=>{
 const db=new Map<string,string>();const a=client(db);a.c.connect();expect(a.bindings()).toBe(0);
 a.c.save(layout);expect(db.size).toBe(0);
 a.c.invite();expect(a.bindings()).toBe(1);a.c.save(layout);expect(a.scope()).toBe(1);a.disconnect();
 const b=client(db,true);b.c.connect();let recovered='';b.c.load(raw=>{recovered=raw;});
 expect(recovered).toBe(layout);expect(b.scope()).toBe(1);expect(b.status()).toContain('Recovered');
});
test('opening an empty shared session never overwrites it and reports missing save',()=>{
 const db=new Map<string,string>();const b=client(db,true);b.c.connect();let changed=false;b.c.load(()=>{changed=true;});
 expect(changed).toBe(false);expect(db.size).toBe(0);expect(b.status()).toContain('NotFound');
});

test('actor types survive shared-layout decoding',()=>{
 for (const kind of [3,4]) {
  const raw=JSON.parse(layout); raw.markers[0].kind=kind;
  expect(parseLayout(JSON.stringify(raw)).markers[0].kind).toBe(kind);
 }
 const raw=JSON.parse(layout); raw.markers[0].kind=5;
 expect(()=>parseLayout(JSON.stringify(raw))).toThrow();
});
