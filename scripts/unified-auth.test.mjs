import test from "node:test";
import assert from "node:assert/strict";
import {SessionController} from "../apps/mobile/src/session/controller.ts";
import {isPronunciationDemoScoreEnabled} from "../apps/mobile/src/features/pronunciation/simulatedScore.ts";
import {request} from "../apps/mobile/src/services/api/client.ts";
test("normal accounts never enable simulated scoring from a public flag",()=>{process.env.EXPO_PUBLIC_PRONUNCIATION_DEMO_SCORE="true";assert.equal(isPronunciationDemoScoreEnabled(),false);delete process.env.EXPO_PUBLIC_PRONUNCIATION_DEMO_SCORE;});
const profile={id:"test",username:"Learner",canonical_username:"learner",has_password:true,role:"personal_student",profile_status:"onboarding",onboarding_step:"personal_preferences",grade:null,language:null};
const issued={user:profile,session:{credential:"flt_"+"a".repeat(43)}};
test("login storage retry preserves the issued session",async()=>{
 let writes=0,issues=0;const controller=new SessionController({read:async()=>null,clear:async()=>{},save:async()=>{if(++writes===1)throw Error("storage");}});
 const issue=async()=>{issues++;return issued;};
 await assert.rejects(controller.login(issue));assert.equal(controller.pending,issued);
 assert.equal(await controller.login(issue),profile);assert.equal(issues,1);
});
test("browser restoration and login never write a bearer to the vault",async()=>{
 const browser={user:profile,csrf_token:"a".repeat(64)};let writes=0;
 const c=new SessionController({read:async()=>{throw Error("must not read");},save:async()=>{writes++;},clear:async()=>{}},async()=>browser);
 assert.equal(await c.restore(async()=>{throw Error("native only");}),profile);
 await c.logout(async ctx=>assert.equal(ctx.kind,"browser"));
 assert.equal(await c.login(async()=>browser),profile);assert.equal(writes,0);
 assert.deepEqual(c.credential,{kind:"browser",csrfToken:browser.csrf_token});
});
test("late browser login cannot restore a signed out account",async()=>{
 const c=new SessionController({read:async()=>null,save:async()=>{},clear:async()=>{}},async()=>null);
 let finish;const pending=c.login(()=>new Promise(r=>finish=r));
 await c.invalidate();finish({user:profile,csrf_token:"a".repeat(64)});
 await assert.rejects(pending,/session changed/);assert.equal(c.credential,null);
});
test("production clients refuse insecure API addresses before sending credentials",async()=>{
 const oldDev=globalThis.__DEV__,oldUrl=process.env.EXPO_PUBLIC_API_URL;globalThis.__DEV__=false;process.env.EXPO_PUBLIC_API_URL="http://example.test";
 try {await assert.rejects(request("/sessions/login","POST",{username:"test",password:"not-a-real-password"}),/HTTPS/);}
 finally {if(oldDev===undefined)delete globalThis.__DEV__;else globalThis.__DEV__=oldDev;if(oldUrl===undefined)delete process.env.EXPO_PUBLIC_API_URL;else process.env.EXPO_PUBLIC_API_URL=oldUrl;}
});
test("browser reads include session proof as well as cookies",async()=>{
 const original=globalThis.fetch;process.env.EXPO_PUBLIC_API_URL="http://localhost:8001";
 try{globalThis.fetch=async(_url,options)=>{assert.equal(options.headers["X-CSRF-Token"],"tab-proof");return Response.json({ok:true});};
 await request("/sessions/me","GET",undefined,{kind:"browser",csrfToken:"tab-proof"});
 }finally{globalThis.fetch=original;}
});
test("browser transport includes cookies and CSRF without bearer headers",async()=>{
 const original=globalThis.fetch;process.env.EXPO_PUBLIC_API_URL="http://localhost:8001";
 try{globalThis.fetch=async(url,options)=>{assert.equal(options.credentials,"include");assert.equal(options.headers.Authorization,undefined);assert.equal(options.headers["X-CSRF-Token"],"csrf");assert.equal(options.headers["X-Fluentt-Web"],"1");return Response.json({ok:true});};
 await request("/users/me/preferences","PATCH",{}, {kind:"browser",csrfToken:"csrf"});
 }finally{globalThis.fetch=original;}
});
