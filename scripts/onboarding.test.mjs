import test from 'node:test';
import assert from 'node:assert/strict';
import {destination,usernameError,validClassCode} from '../apps/mobile/src/session/routing.ts';
import {SessionController} from '../apps/mobile/src/session/controller.ts';
import {identity,ApiError} from '../apps/mobile/src/services/api/identity.ts';
const profile={id:'synthetic',username:'Learner',canonical_username:'learner',role:'personal_student',profile_status:'onboarding',onboarding_step:'personal_preferences',grade:null,language:null};
const issued={user:profile,session:{credential:'flt_'+'a'.repeat(43)}};
function vault(value=null){return {value,async read(){return this.value;},async save(v){this.value=v;},async clear(){this.value=null;}};}
test('routes incomplete and completed profiles using backend values',()=>{
 assert.equal(destination(profile),'/language');
 for(let grade=1;grade<=12;grade++)assert.equal(destination({...profile,grade}),'/language');
 for(const language of ['english','tagalog']){
  assert.equal(destination({...profile,language}),'/experience');
  assert.equal(destination({...profile,grade:12,language,experience:'some_words',profile_status:'active'}),'/student');
 }
 assert.equal(destination({...profile,role:'school_student'}),'/class-code');
 assert.equal(destination({...profile,role:'instructor'}),'/first-class');
 assert.equal(destination({...profile,role:'instructor',profile_status:'active'}),'/instructor');
});
test('username and six-digit string validation',()=>{
 for(const name of ['ab','a\tb',' admin','ADMIN','abc!','école','x'.repeat(25)])assert.ok(usernameError(name));
 for(const name of ['abc','a b','Shan Gealone','A_B123','x'.repeat(24)])assert.equal(usernameError(name),null);
 assert.equal(validClassCode('000001'),true);
 for(const code of ['12345','1234567','12a456',' 12345','１２３４５６'])assert.equal(validClassCode(code),false);
});
test('first launch and valid session restoration',async()=>{
 const store=vault();const controller=new SessionController(store);let calls=0;
 assert.equal(await controller.restore(async()=>{calls++;return profile;}),null);assert.equal(calls,0);
 await controller.create(async()=>issued);assert.equal(store.value,issued.session.credential);
 const reopened=new SessionController(store);assert.equal(await reopened.restore(async secret=>{assert.equal(secret,store.value);return profile;}),profile);
});
test('expired session cleared, network outage retains credential',async()=>{
 const store=vault('test-secret');const controller=new SessionController(store);
 await assert.rejects(controller.restore(async()=>{throw new ApiError(503,'offline');}));assert.equal(store.value,'test-secret');
 assert.equal(await controller.restore(async()=>{throw new ApiError(401,'expired');}),null);assert.equal(store.value,null);
});
test('secure save retry reuses issuance and repeated taps issue only once',async()=>{
 const store=vault();let saves=0;store.save=async function(v){if(++saves===1)throw Error('secure storage unavailable');this.value=v;};
 const controller=new SessionController(store);let creates=0;const issue=async()=>{creates++;return issued;};
 await assert.rejects(controller.create(issue));assert.equal(controller.pending,issued);
 await controller.create(issue);assert.equal(creates,1);assert.equal(store.value,issued.session.credential);
 await assert.rejects(controller.create(issue),/already exists/);
 const secondController=new SessionController(vault());
 let resolve;const slow=()=>new Promise(r=>{resolve=r;});const first=secondController.create(slow);
 await assert.rejects(secondController.create(issue),/wait/);resolve(issued);await first;assert.equal(creates,1);
});
test('identity services send correct routes, roles, auth and safe errors',async()=>{
 const original=globalThis.fetch;const previous=process.env.EXPO_PUBLIC_API_URL;
 process.env.EXPO_PUBLIC_API_URL='http://localhost:8000/';let calls=[];
 try {
 globalThis.fetch=async(url,options)=>{calls.push({url,options});return Response.json(url.includes('usernames')?{username:'a_b',available:true,message:'available'}:options.method==='POST'?{...issued,user:{...profile,role:JSON.parse(options.body).role}}:profile);};
 await identity.check('a_b');assert.match(calls.at(-1).url,/username=a_b/);
 for(const role of ['personal_student','school_student','instructor']){await identity.create('Learner',role);assert.equal(JSON.parse(calls.at(-1).options.body).role,role);}
 await identity.me('test-secret');assert.equal(calls.at(-1).options.headers.Authorization,'Bearer test-secret');
 await identity.preferences('test-secret',{grade:12,language:'tagalog'});assert.equal(calls.at(-1).options.method,'PATCH');
 for(const status of [401,409,422,429,503]){globalThis.fetch=async()=>new Response('',{status});await assert.rejects(identity.create('Learner','personal_student'),error=>error.status===status);}
 globalThis.fetch=async()=>{throw Error('private transport details');};await assert.rejects(identity.me('test-secret'),/Check your connection/);
 globalThis.fetch=async(_url,options)=>{options.signal.dispatchEvent(new Event('abort'));throw Error('network');};await assert.rejects(identity.check('Learner'));
 } finally {globalThis.fetch=original;if(previous===undefined)delete process.env.EXPO_PUBLIC_API_URL;else process.env.EXPO_PUBLIC_API_URL=previous;}
});


test('SecureStore adapter uses only device storage and fails closed on web',async()=>{
 const {secureVault}=await import('../apps/mobile/src/session/vault.ts');
 const calls=[];const port={async getItemAsync(k){calls.push(['read',k]);return 'test';},async setItemAsync(k,v){calls.push(['save',k,v]);},async deleteItemAsync(k){calls.push(['clear',k]);}};
 const native=secureVault(port,'android');assert.equal(await native.read(),'test');await native.save('test');await native.clear();
 assert.deepEqual(calls.map(c=>c[0]),['read','save','clear']);assert.ok(calls.every(c=>c[1]==='fluentt.device-session'));
 const web=secureVault(port,'web');assert.equal(await web.read(),null);await assert.rejects(web.save('test'));await web.clear();assert.equal(calls.length,3);
});

test('identity timeout aborts request and reports retry',async context=>{
 const original=globalThis.fetch;const previous=process.env.EXPO_PUBLIC_API_URL;
 process.env.EXPO_PUBLIC_API_URL='http://localhost:8000';
 context.mock.timers.enable({apis:['setTimeout']});
 try{
 globalThis.fetch=async(_url,options)=>new Promise((_resolve,reject)=>options.signal.addEventListener('abort',()=>reject(new Error('aborted'))));
 const pending=identity.me('test-secret');const assertion=assert.rejects(pending,/timed out/);context.mock.timers.tick(8000);await assertion;
 }finally{context.mock.timers.reset();globalThis.fetch=original;if(previous===undefined)delete process.env.EXPO_PUBLIC_API_URL;else process.env.EXPO_PUBLIC_API_URL=previous;}
});
test('malformed backend role cannot route to another portal',async()=>{
 const original=globalThis.fetch;const previous=process.env.EXPO_PUBLIC_API_URL;
 process.env.EXPO_PUBLIC_API_URL='http://localhost:8000';
 try{globalThis.fetch=async()=>Response.json({...profile,role:'administrator'});await assert.rejects(identity.me('test-secret'),/Unexpected profile/);}
 finally{globalThis.fetch=original;if(previous===undefined)delete process.env.EXPO_PUBLIC_API_URL;else process.env.EXPO_PUBLIC_API_URL=previous;}
});
