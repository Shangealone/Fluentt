const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const local = require('node:module').createRequire(path.resolve(__dirname, '../apps/mobile/package.json'));
const ts = local('typescript');
function load(file) { const mod={exports:{}}; new Function('exports','module',ts.transpile(fs.readFileSync(path.resolve(__dirname,'../apps/mobile/src',file),'utf8'),{module:ts.ModuleKind.CommonJS}))(mod.exports,mod); return mod.exports; }
const {routeAllowed}=load('session/routing.ts');
for(const profile of [null,{role:'instructor',has_password:false},{role:'instructor',profile_status:'active'},{role:'school_student',profile_status:'onboarding'},{role:'school_student',profile_status:'active'},{role:'personal_student'}]) {
 test(`notices accessible for ${JSON.stringify(profile)} including recovery`,()=>{
  for(const pending of [false,true]) for(const route of ['privacy-policy','terms']) assert.equal(routeAllowed(profile,route,pending),true);
 });
}
test('making notices public does not expose classroom or account routes anonymously',()=>{
 for(const route of ['account','student','instructor','communication','assignment-attempt']) assert.equal(routeAllowed(null,route),false);
});
test('draft documents contain the agreed operator, contact, and developer without a guessed expiry',()=>{
 const {legalSections}=load('features/legal/content.ts');
 const text=JSON.stringify(legalSections);
 for(const value of ['NE Learning Inc.','nelearninginc@outlook.com','Fluency','Lyceum of the Philippines University - Cavite']) assert(text.includes(value));
 assert.equal(legalSections.privacy.length,9);assert.equal(legalSections.terms.length,7);
 assert(text.includes('before publication'));
});
