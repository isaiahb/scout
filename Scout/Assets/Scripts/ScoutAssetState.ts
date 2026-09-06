import {DialStep} from "./ScoutRotaryDial";

/** Static photographic stop tables shared by the Camera and Light rotary dials. Sharing this reference
 * data is not the same as sharing state — every placed Camera/Light asset gets its own independent
 * CameraAssetState/LightAssetState instance (see ScoutMain), this file only builds the read-only
 * step lists both use. */
function stops(values:number[],format:(v:number)=>string):DialStep[] {
  return values.map(value=>({value,text:format(value)}));
}

export const ISO_STOPS:DialStep[]=stops([100,200,400,800,1600,3200,6400,12800],v=>String(v));
export const APERTURE_STOPS:DialStep[]=stops([1.2,1.4,2,2.8,4,5.6,8,11,16,22],v=>"f/"+v);
export const SHUTTER_STOPS:DialStep[]=
  [30,15,8,4,2,1].map(v=>({value:v,text:v+"s"}))
  .concat([2,4,8,15,30,60,125,250,500,1000,2000,4000,8000].map(v=>({value:1/v,text:"1/"+v})));
export const KELVIN_STOPS:DialStep[]=stops([2000,2500,3000,3500,4000,4500,5000,5600,6500,7500,9000,10000],v=>v+"K");
export const INTENSITY_STOPS:DialStep[]=stops(Array.from({length:21},(_,i)=>i*5),v=>v+"%");

/** Camera Asset state — exposure/WB dial positions for one placed Camera marker. Purely informational:
 * no dial here drives a real rendering effect. */
export type CameraAssetState={isoIndex:number;apertureIndex:number;shutterIndex:number;kelvinIndex:number};
/** Light Asset state — brightness/CCT dial positions for one placed Light marker. Both fields drive the
 * marker's real-time LightSource (see ScoutMain.applyLightLook). */
export type LightAssetState={intensityIndex:number;kelvinIndex:number};

export function defaultCameraState():CameraAssetState {
  return {isoIndex:2,apertureIndex:3,shutterIndex:12,kelvinIndex:7}; // ISO 400, f/2.8, 1/125s, 5600K
}
export function defaultLightState():LightAssetState {
  return {intensityIndex:20,kelvinIndex:7}; // 100%, 5600K — matches the light's original fixed look
}

/** Tanner Helland's blackbody-radiation approximation, Kelvin (roughly 1000-40000) -> normalized (0-1)
 * RGB. Accurate enough for a WB/CCT preview dial; not colorimetrically exact. */
export function kelvinToRGB(kelvin:number):vec3 {
  const t=kelvin/100;
  const clamp=(x:number)=>Math.max(0,Math.min(255,x))/255;
  const r=t<=66?255:329.698727446*Math.pow(t-60,-0.1332047592);
  const g=t<=66?99.4708025861*Math.log(t)-161.1195681661:288.1221695283*Math.pow(t-60,-0.0755148492);
  const b=t>=66?255:t<=19?0:138.5177312231*Math.log(t-10)-305.0447927307;
  return new vec3(clamp(r),clamp(g),clamp(b));
}
