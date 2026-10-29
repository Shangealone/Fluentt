// Static visual review of actual components, never a runtime authentication bypass.
// Native clipboard is stubbed only for server rendering; these HTML controls are inert.
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const mobile = path.resolve(__dirname,'../apps/mobile');
const local = Module.createRequire(path.join(mobile,'package.json'));
const babel = local('@babel/core');
const originalLoad = Module._load;
Module._load = function(name,parent,isMain){
 if(name==='react-native')return local('react-native-web');
 if(name==='react-native-safe-area-context')return {SafeAreaView:local('react-native-web').View};
 if(name==='expo-clipboard')return {setStringAsync:async()=>false};
 return originalLoad.call(this,name,parent,isMain);
};
for(const ext of ['.ts','.tsx'])Module._extensions[ext]=function(module,filename){
 const source=fs.readFileSync(filename,'utf8');
 const result=babel.transformSync(source,{filename,babelrc:false,configFile:false,plugins:[[local.resolve('@babel/plugin-transform-typescript'),{isTSX:ext==='.tsx',allExtensions:true}],[local.resolve('@babel/plugin-transform-react-jsx'),{runtime:'automatic'}],local.resolve('@babel/plugin-transform-modules-commonjs')]});
 module._compile(result.code,filename);
};
const React=local('react');
const {renderToStaticMarkup}=local('react-dom/server');
const {View,Text,StyleSheet}=local('react-native-web');
const {ClassForm}=local(path.join(mobile,'src/features/classes/ClassForm.tsx'));
const {CodeCard}=local(path.join(mobile,'src/features/classes/CodeCard.tsx'));
const {s}=local(path.join(mobile,'src/components/ui.tsx'));
const h=React.createElement;
function panel(title,child){return h(View,{style:[s.container,{backgroundColor:'#F5F7F2',maxWidth:440,minHeight:880}]},h(Text,{style:s.eyebrow},'STATIC COMPONENT REVIEW · SYNTHETIC DATA'),h(Text,{style:s.title},title),child);}
const form=renderToStaticMarkup(panel('Create your class.',h(ClassForm,{initial:{class_name:'Grade 5 English A',grade_level:5,language:'english',description:'Vocabulary and language activities'},label:'Create Class',onSubmit:async()=>{}})));
const code=renderToStaticMarkup(panel('Your invitation code.',h(CodeCard,{code:'000042',name:'Synthetic class'})));
const sheet=StyleSheet.getSheet();
const html='<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>FLUENTT Section 05 static component review</title><style>'+sheet.textContent+'body{margin:0;background:#e9eee7;font-family:system-ui}main{display:flex;gap:24px;justify-content:center;flex-wrap:wrap}section{width:440px;max-width:100%}</style></head><body><main><section>'+form+'</section><section>'+code+'</section></main></body></html>';
const output=path.resolve(__dirname,'../docs/previews/section05-components.html');fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,html);console.log('Wrote static visual review with synthetic data. No API calls or stored credentials.');

