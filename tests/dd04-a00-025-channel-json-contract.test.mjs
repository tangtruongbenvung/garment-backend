import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {makeChannelIdentity} from '../dd04-agent-control/a00-025-channel-identity-lock.mjs';
const schemas=[
 ['channel_character_bible.schema.json','character_bible','DD04_CHARACTER_BIBLE_V1'],
 ['channel_visual_style.schema.json','visual_style','DD04_VISUAL_STYLE_V1'],
 ['channel_continuity_rules.schema.json','continuity_rules','DD04_CONTINUITY_V1']
];
test('three machine-readable JSON contracts are valid and match generated profiles',()=>{
 const identity=makeChannelIdentity({channel_id:'FB001',name:'Mẹ bé vui FB001',platform:'FANPAGE'});
 for(const [file,prop,version] of schemas){
  const schema=JSON.parse(readFileSync(new URL('../dd04-agent-control/contracts/'+file,import.meta.url),'utf8'));
  const payload=identity[prop];
  assert.equal(schema.$schema,'https://json-schema.org/draft/2020-12/schema');
  assert.equal(schema.properties.schema_version.const,version);
  assert.equal(payload.schema_version,version);
  for(const key of schema.required){
   assert.ok(Object.hasOwn(payload,key),'missing '+file+' field '+key);
  }
  assert.deepEqual(Object.keys(payload).sort(),
   Object.keys(schema.properties).filter(k=>Object.hasOwn(payload,k)).sort());
 }
});
