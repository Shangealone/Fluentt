// Actual page/component rendering with isolated synthetic data. No API or account writes.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const mobile = path.resolve(__dirname, '../apps/mobile');
const local = Module.createRequire(path.join(mobile,'package.json'));
const babel = local('@babel/core');
const React = local('react');
const {renderToStaticMarkup} = local('react-dom/server');
const native = local('react-native-web');
let profile = {id:'teacher',role:'instructor'};
let state;
let params = {id:'test-class'};
let refreshed = 0;
const routes = [];
const originalLoad = Module._load;
Module._load = function(name,parent,isMain) {
  if(name==='react') return {...React,useCallback:fn=>fn};
  if(name==='react-native') return {...native,useWindowDimensions:()=>({width:390,height:700,fontScale:1,scale:1})};
  if(name==='react-native-safe-area-context') return {SafeAreaView:native.View};
  if(name==='expo-clipboard') return {setStringAsync:async()=>true};
  if(name==='expo-router') return {router:{push:route=>routes.push(route),replace:route=>routes.push(route)},useLocalSearchParams:()=>params};
  if(name.endsWith('/session/provider')) return {useSession:()=>({profile,classes:{}})};
  if(name.endsWith('/dashboard/usePagedList')) return {usePagedList:()=>({state,reload:()=>refreshed++})};
  return originalLoad.call(this,name,parent,isMain);
};
for(const ext of ['.png','.jpg']) Module._extensions[ext] = (module,filename)=>{module.exports={uri:'asset://'+path.basename(filename)};};
for(const ext of ['.ts','.tsx']) Module._extensions[ext]=(module,filename)=>{
  const result=babel.transformSync(fs.readFileSync(filename,'utf8'),{filename,babelrc:false,configFile:false,plugins:[
    [local.resolve('@babel/plugin-transform-typescript'),{isTSX:ext==='.tsx',allExtensions:true}],
    [local.resolve('@babel/plugin-transform-react-jsx'),{runtime:'automatic'}],local.resolve('@babel/plugin-transform-modules-commonjs'),
  ]}); module._compile(result.code,filename);
};
const Page=local(path.join(mobile,'src/app/class-details.tsx')).default;
const row={id:'test-class',class_name:'Unique classroom name',grade_level:7,language:'english',description:'Class note',join_code:'000042',status:'active',created_at:'2026-10-30T00:00:00Z',updated_at:'2026-10-30T00:00:00Z'};
function setup(phase='ready',classRow=row){
  profile={id:'teacher',role:'instructor'}; params={id:row.id}; routes.length=0; refreshed=0;
  state={phase,rows:[classRow],error:phase==='error'?'Service unavailable':null,hasMore:false};
}
function html(){return renderToStaticMarkup(React.createElement(Page));}
function elements(node,out=[]){if(Array.isArray(node))node.forEach(child=>elements(child,out));else if(node&&typeof node==='object'&&node.props){out.push(node);elements(node.props.children,out);}return out;}

test('class details use one real heading, a code-first layout and plain actions',()=>{
  setup();const output=html();
  for(const label of ['Assignments','Overview','Messages','Edit class','Copy code','Share code','Back to classes'])assert.ok(output.includes(label),label);
  assert.ok(output.includes('000 042'));
  assert.equal(output.split(row.class_name).length-1,1);
  assert.ok(output.indexOf('Class code')<output.indexOf('Manage your class'));
  for(const text of ['Verified Classroom','publish distributions','CLASSROOM MANAGEMENT'])assert.ok(!output.includes(text),text);
});
for(const phase of ['loading','error'])test('class details '+phase+' hides stale class data',()=>{
  setup(phase);const output=html();
  assert.ok(!output.includes(row.class_name));assert.ok(!output.includes('000 042'));
  assert.ok(output.includes('Back to classes'));
  if(phase==='error'){assert.ok(output.includes('Service unavailable'));assert.ok(output.includes('Try again'));}
  else assert.ok(output.includes('Loading your class'));
});
test('class actions use the current confirmed class id and explicit navigation',()=>{
  setup();const props=Page().props;
  for(const action of ['assignments','overview','messages','edit'])props.onAction(action);
  props.onBack();props.onAccount();
  assert.deepEqual(routes,[
    {pathname:'/assignments',params:{classId:row.id}},
    {pathname:'/instructor-monitoring',params:{classId:row.id}},
    {pathname:'/communication',params:{classId:row.id}},
    {pathname:'/class-edit',params:{id:row.id}},'/instructor','/account',
  ]);
});
test('archived classes retain assignments but block other class management actions',()=>{
  setup('ready',{...row,status:'archived',join_code:null});
  const page=Page();for(const action of ['overview','messages','edit'])page.props.onAction(action);
  assert.deepEqual(routes,[]);page.props.onAction('assignments');assert.equal(routes[0].pathname,'/assignments');
  const View=local(path.join(mobile,'src/features/classes/ClassDetailsView.tsx')).ClassDetailsView;
  const actions=elements(View(page.props)).filter(item=>['Overview','Messages','Edit class'].includes(item.props.accessibilityLabel));
  assert.equal(actions.length,3);assert.ok(actions.every(item=>item.props.disabled));
  const output=html();assert.ok(output.includes('No active code'));assert.ok(!output.includes('Copy code'));
});
test('route changes and role loss never expose a previously loaded classroom',()=>{
  setup();params={id:'different-class',created:'1'};const output=html();
  assert.ok(!output.includes(row.class_name));assert.ok(!output.includes('Your class is ready'));
  for(const invalid of [null,{id:'student',role:'school_student'}]){profile=invalid;assert.equal(Page(),null);}
});
test('newly-created confirmation appears only with loaded matching details; retry is connected',()=>{
  setup();params.created='1';assert.ok(html().includes('Your class is ready'));
  state={...state,phase:'error',error:'Try again later'};assert.ok(!html().includes('Your class is ready'));
  Page().props.onRetry();assert.equal(refreshed,1);
});
