/** Portable layout data. Coordinates are centimeters relative to the planning frame. */
export type MarkerRecord = {kind:number; label:string; position:number[]; rotation:number[]};
export type ScoutLayout = {version:1; frame:'manual'; markers:MarkerRecord[]};
export function parseLayout(raw:string):ScoutLayout {
  if(raw.length>24000)throw new Error('Layout is too large');
  const data=JSON.parse(raw);
  if(data?.version!==1||data.frame!=='manual'||!Array.isArray(data.markers)||data.markers.length>20)throw new Error('Unsupported layout');
  const vector=(v:unknown,n:number)=>Array.isArray(v)&&v.length===n&&v.every(x=>typeof x==='number'&&Number.isFinite(x)&&Math.abs(x)<=100000);
  for(const m of data.markers){
    if(!m||![0,1,2].includes(m.kind)||typeof m.label!=='string'||m.label.length>48||!vector(m.position,3)||!vector(m.rotation,4))throw new Error('Invalid marker');
    const norm=m.rotation.reduce((sum:number,x:number)=>sum+x*x,0);
    if(Math.abs(norm-1)>.02)throw new Error('Invalid orientation');
  }
  return data as ScoutLayout;
}
