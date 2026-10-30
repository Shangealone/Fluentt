const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Module=require('node:module');
const mobile=path.resolve(__dirname,'../apps/mobile');
const local=Module.createRequire(path.join(mobile,'package.json'));
const babel=local('@babel/core');
const platform={OS:'web'};
let write=async()=>true,share=async()=>undefined;
const original=Module._load;
Module._load=function(name,parent,isMain){
  if(name==='react-native')return {Platform:platform,Share:{share:body=>share(body),sharedAction:'sharedAction'}};
  if(name==='expo-clipboard')return {setStringAsync:value=>write(value)};
  return original.call(this,name,parent,isMain);
};
Module._extensions['.ts']=(module,filename)=>{
  const result=babel.transformSync(fs.readFileSync(filename,'utf8'),{filename,babelrc:false,configFile:false,plugins:[
    local.resolve('@babel/plugin-transform-typescript'),local.resolve('@babel/plugin-transform-modules-commonjs'),
  ]});module._compile(result.code,filename);
};
const {copyInvitation,shareInvitation}=local(path.join(mobile,'src/features/classes/invitationActions.ts'));
const navigatorDescriptor=Object.getOwnPropertyDescriptor(globalThis,'navigator');
test.after(()=>{if(navigatorDescriptor)Object.defineProperty(globalThis,'navigator',navigatorDescriptor);else delete globalThis.navigator;});
const browser=value=>Object.defineProperty(globalThis,'navigator',{configurable:true,value});

test('native copy preserves exact leading zeros',async()=>{
  platform.OS='android';let copied;
  write=async value=>{copied=value;return true;};
  assert.equal(await copyInvitation('000042'),'Class code copied.');assert.equal(copied,'000042');
});
test('web copy confirms the browser write instead of a legacy fallback',async()=>{
  platform.OS='web';let copied;let legacy=0;
  write=async()=>{legacy++;return true;};
  browser({clipboard:{writeText:async value=>{copied=value;}}});
  assert.equal(await copyInvitation('000042'),'Class code copied.');assert.equal(copied,'000042');assert.equal(legacy,0);
});
test('denied or unavailable web clipboard reports manual copying, never success',async()=>{
  platform.OS='web';
  for(const value of [{},{clipboard:{writeText:async()=>{throw new Error('denied');}}}]){
    browser(value);await assert.rejects(copyInvitation('000042'),/copy the code manually/);
  }
});
test('browser share supports its void result and recognizable cancellation',async()=>{
  platform.OS='web';let sent;
  share=async body=>{sent=body;};
  assert.equal(await shareInvitation('000042','My class'),'Share sheet opened.');
  assert.match(sent.message,/000042/);
  share=async()=>{const error=new Error('cancelled');error.name='AbortError';throw error;};
  assert.equal(await shareInvitation('000042','My class'),'Sharing cancelled.');
});
test('native share respects its action and unsupported sharing has plain feedback',async()=>{
  platform.OS='android';share=async()=>({action:'dismissedAction'});
  assert.equal(await shareInvitation('000042','My class'),'Sharing cancelled.');
  share=async()=>({action:'sharedAction'});
  assert.equal(await shareInvitation('000042','My class'),'Share sheet opened.');
  share=async()=>{throw new Error('raw implementation error');};
  await assert.rejects(shareInvitation('000042','My class'),error=>/Copy the code/.test(error.message)&&!error.message.includes('raw implementation'));
});
