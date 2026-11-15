// DD04-A00-017 | Delegated G1/G2 evidence checks (REVIEW ONLY; existing DB guards unchanged).
import {createHash} from 'node:crypto';
const sha=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const HEX=/^[a-f0-9]{64}$/;
const deny=(reason)=>Object.freeze({ok:false,reason,executable:false,publish_allowed:false});
const verified=x=>x?.source==='SERVER_INDEPENDENT_AGENT_AUDIT'&&x?.decision==='PASS'&&
 HEX.test(x?.packet_sha256||'')&&Number.isInteger(x?.revision)&&x.revision>0&&
 typeof x?.actor_id==='string'&&x.actor_id.length>2&&
 typeof x?.agent==='string'&&/^A(0[0-9]|1[0-7])$/.test(x.agent);
const requiredChecks={G1:['A00','A02','A11','A09'],G2:['A06','A08','A09','A07']};
export function delegatedGatePreflight({gate,packet,policy,checks,finance}={}){
 if(!['G1','G2'].includes(gate))return deny('GATE_INVALID');
 if(policy?.source!=='SERVER_VERIFIED_DELEGATION'||policy.active!==true||policy.allow_internal_gates!==true||
 !HEX.test(policy.policy_sha256||'')||policy.tenant_id!==packet?.tenant_id)return deny('DELEGATION_POLICY_NOT_VERIFIED');
 if(packet?.source!=='SERVER_VERSIONED_PACKET'||!HEX.test(packet.sha256||'')||
 !Number.isInteger(packet.revision)||packet.revision<1||!packet.tenant_id||!packet.command_id||
 !Array.isArray(packet.channel_ids)||!packet.channel_ids.length||new Set(packet.channel_ids).size!==packet.channel_ids.length)
 return deny('VERSIONED_PACKET_REQUIRED');
 if(!Array.isArray(checks))return deny('SERVER_CHECKS_REQUIRED');
 const needed=requiredChecks[gate];
 for(const agent of needed){
  const matches=checks.filter(x=>x?.agent===agent);
  if(matches.length!==1||!verified(matches[0])||matches[0].packet_sha256!==packet.sha256||matches[0].revision!==packet.revision||
    matches[0].tenant_id!==packet.tenant_id||matches[0].command_id!==packet.command_id)
   return deny('INDEPENDENT_'+agent+'_CHECK_REQUIRED');
 }
 const actorIds=needed.map(x=>checks.find(c=>c.agent===x).actor_id);
 if(new Set(actorIds).size!==actorIds.length)return deny('INDEPENDENT_ACTORS_REQUIRED');
 if(checks.some(x=>x?.decision==='FAIL'||x?.decision==='HOLD'))return deny('QC_OR_POLICY_HOLD');
 if(finance?.source!=='SERVER_A11_FINANCE_DECISION'||finance.tenant_id!==packet.tenant_id||
 finance.command_id!==packet.command_id||finance.packet_sha256!==packet.sha256||
 finance.revision!==packet.revision||finance.decision!=='WITHIN_DELEGATED_LIMIT')
 return deny('A11_FINANCE_CLEARANCE_REQUIRED');
 if(gate==='G2'){
  if(packet.g1_decision?.source!=='SERVER_G1_DECISION'||packet.g1_decision.decision!=='APPROVED_INTERNAL'||
     packet.g1_decision.tenant_id!==packet.tenant_id||packet.g1_decision.command_id!==packet.command_id||
     !HEX.test(packet.g1_decision.sha256||''))return deny('INTERNAL_G1_NOT_VERIFIED');
  if(!Array.isArray(packet.asset_sha256s)||!packet.asset_sha256s.length||packet.asset_sha256s.some(x=>!HEX.test(x))||
    !HEX.test(packet.caption_sha256||'')||!HEX.test(packet.schedule_sha256||'')||
    !packet.channel_profile_hashes||packet.channel_ids.some(x=>!HEX.test(packet.channel_profile_hashes[x]||''))||
    packet.channel_schedule_immutable!==true||packet.asset_manifest_immutable!==true)
    return deny('FINAL_ASSETS_CHANNEL_SCHEDULE_REQUIRED');
  if(packet.platform_entitlement?.source!=='SERVER_PLATFORM_PERMISSION_CHECK'||packet.platform_entitlement.valid!==true||
    packet.platform_entitlement.channel_ids?.length!==packet.channel_ids.length||
    packet.channel_ids.some(x=>!packet.platform_entitlement.channel_ids.includes(x)))
    return deny('PLATFORM_PERMISSION_REQUIRED');
 }
 return Object.freeze({ok:true,gate,decision:'ELIGIBLE_INTERNAL_DELEGATED_APPROVAL',tenant_id:packet.tenant_id,
  command_id:packet.command_id,revision:packet.revision,packet_sha256:packet.sha256,
  evidence_sha256:sha({policy:policy.policy_sha256,checks:needed.map(x=>checks.find(c=>c.agent===x)),finance,packet_sha256:packet.sha256}),
  executable:false,publish_allowed:false,reason:'PREFLIGHT_ONLY_DB_GATE_STILL_LOCKED'});
}
