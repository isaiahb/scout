import {test,expect} from 'bun:test';
import {actionAt,isScenePoint} from '../ScoutMobile/Assets/Scripts/ScoutMobileUI';

test('all five tool cards have separate hit regions with inert gaps',()=>{
  [.148,.324,.5,.676,.852].forEach((x,index)=>expect(actionAt(x,.695)).toEqual({kind:'tool',index}));
  expect(actionAt(.236,.695)).toBeNull();
  expect(actionAt(.98,.695)).toBeNull();
});
test('editing controls and Snapchat chrome cannot place accidental objects',()=>{
  expect(actionAt(.185,.781)).toEqual({kind:'undo'});
  expect(actionAt(.815,.781)).toEqual({kind:'clear'});
  expect(actionAt(.5,.781)).toBeNull();
  for(const [x,y] of [[.5,.167],[.5,.60],[.5,.695],[.5,.781],[.5,.90],[0,.4]])expect(isScenePoint(x,y)).toBe(false);
  expect(isScenePoint(.5,.42)).toBe(true);
});
