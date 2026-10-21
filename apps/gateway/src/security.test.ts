import {describe,it,expect,beforeAll,afterAll} from 'vitest';
import {mkdtemp} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type {Server} from 'node:http';
import {loadConfig} from './config.js';
import {createGateway} from './server.js';
import {GatewayStore} from './store.js';
import {SettingsStore} from './settings.js';
import {SigningKeyStore} from './keys.js';
import {DurableQueue,CaseLog} from '@imagineqira/qev-runtime';
import {hmacSha256Hex} from '@imagineqira/qev-shared';

describe('authenticated gateway boundary',()=>{
 let server:Server,base:string,token='fixture-token-that-is-not-a-production-secret';
 const secret='fixture-webhook-that-is-not-a-production-secret';
 beforeAll(async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'qev-auth-'));
  const config=loadConfig({QEV_DATA_DIR:dir,QEV_REQUIRE_AUTH:'true',QEV_INGEST_TOKEN:token,QEV_WEBHOOK_SECRET:secret,QEV_DEPLOYMENT_KIND:'operator_evaluation'});
  const store=new GatewayStore(config.storageDir,config.eventsDir),queue=new DurableQueue(config.queueDir),log=new CaseLog(config.caseLogDir),settings=new SettingsStore(config.settingsDir),keys=new SigningKeyStore(config.signingDir);
  await store.init();await queue.init();await log.init();await settings.init();await keys.init();
  server=createGateway(config,store,queue,log,settings,keys).server;
  await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));const addr=server.address();if(!addr||typeof addr==='string')throw Error('No address');base=`http://127.0.0.1:${addr.port}`;
 });
 afterAll(async()=>{await new Promise<void>((r,j)=>server.close(e=>e?j(e):r()));});
 it('rejects weak or absent production credentials before startup',()=>{
  expect(()=>loadConfig({NODE_ENV:'production'})).toThrow('QEV_WEBHOOK_SECRET');
  expect(()=>loadConfig({NODE_ENV:'production',QEV_WEBHOOK_SECRET:'a'.repeat(32),QEV_INGEST_TOKEN:'b'.repeat(32),QEV_PACKAGE_PASSPHRASE:'c'.repeat(32)})).toThrow('QEV_TENANT_ID');
 });
 it('exposes liveness without leaking settings, cases or storage state',async()=>{
  const r=await fetch(base+'/v1/health');expect(r.status).toBe(200);const b=await r.json() as Record<string,unknown>;expect(b.authentication_required).toBe(true);expect(b.evaluation_only).toBe(true);expect(b.settings).toBeUndefined();expect(b.preflight).toBeUndefined();expect(b.signing).toBeUndefined();
 });
 it('protects private reads, settings, portal writes, photos and the admin UI',async()=>{
  for(const [route,method] of [['/v1/settings','GET'],['/v1/preflight','GET'],['/v1/packages','GET'],['/v1/settings','PUT'],['/v1/portal/events','POST'],['/v1/photos','POST'],['/wizard','GET']]){
   const r=await fetch(base+route,{method,headers:{'content-type':'application/json'},body:method==='GET'?undefined:'{}'});expect(r.status,route).toBe(401);
  }
 });
 it('accepts authenticated preflight and rejects an incorrect bearer',async()=>{
  expect((await fetch(base+'/v1/preflight',{headers:{authorization:'Bearer incorrect'}})).status).toBe(401);
  expect((await fetch(base+'/v1/preflight',{headers:{authorization:'Bearer '+token}})).status).toBe(200);
 });
 it('keeps signed webhooks available and denies forged signatures',async()=>{
  const body=JSON.stringify({flow_id:'devops-change',case_id:'AUTH-1',action:'deployment.completed',actor:{id:'fixture@example.invalid'}});
  const send=(sig:string)=>fetch(base+'/v1/webhooks/ci',{method:'POST',headers:{'content-type':'application/json','x-qev-signature':'sha256='+sig},body});
  expect((await send('0'.repeat(64))).status).toBe(401);expect((await send(hmacSha256Hex(secret,body))).status).toBe(202);
 });
 it('rejects oversized input and path identifiers before writing files',async()=>{
  const send=(body:string)=>fetch(base+'/v1/portal/events',{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body});
  expect((await send(JSON.stringify({case_id:'../../outside',action:'job.created'}))).status).toBe(400);
  expect((await send('a'.repeat(1024*1024+1))).status).toBe(413);
 });
 it('keeps an operator evaluation out of gate mode and host folder access',async()=>{
  for(const body of [{mode:'gate',enabled:true},{mode:'shadow',connectors:{photo_file:{watch_dir:'C:/private'}}}]){
   const r=await fetch(base+'/v1/settings',{method:'PUT',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify(body)});expect(r.status).toBe(409);
  }
 });
});
