// Actual component rendering with synthetic props; no learner route or auth bypass.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const mobile = path.resolve(__dirname, '../apps/mobile');
const admin = path.resolve(__dirname, '../apps/admin');
const local = Module.createRequire(path.join(mobile, 'package.json'));
const React = local('react'), jsx = local('react/jsx-runtime');
const { renderToStaticMarkup } = local('react-dom/server');
const babel = local('@babel/core'), original = Module._load;
let assignmentNavigation = null;
Module._load = function(name, parent, isMain) {
  if (name === 'expo-router') return { router: { replace() {}, push() {} }, useFocusEffect(callback) {React.useEffect(callback, [callback]);}, usePreventRemove(active, callback) { assignmentNavigation={active,callback};return ()=>{}; } };
  if (name.endsWith('/session/provider')) return { useSession:()=>({profile:null}) };
  if (name === 'expo-crypto') return { randomUUID:()=> '00000000-0000-0000-0000-000000000018' };
  if (name === 'react') return React;
  if (name === 'react/jsx-runtime') return jsx;
  if (name === 'react-native') return local('react-native-web');
  if (name === 'react-native-safe-area-context') return { SafeAreaView: local('react-native-web').View };
  if (name.startsWith('@/')) return original.call(this, path.join(admin, 'src', name.slice(2)), parent, isMain);
  return original.call(this, name, parent, isMain);
};
for (const ext of ['.ts', '.tsx']) Module._extensions[ext] = function(module, filename) {
  const result = babel.transformSync(fs.readFileSync(filename, 'utf8'), { filename, babelrc: false, configFile: false,
    plugins: [[local.resolve('@babel/plugin-transform-typescript'), { isTSX: ext === '.tsx', allExtensions: true }],
      [local.resolve('@babel/plugin-transform-react-jsx'), { runtime: 'automatic' }], local.resolve('@babel/plugin-transform-modules-commonjs')] });
  module._compile(result.code, filename);
};
const { ChoiceQuestion, UnscoredChoicePreview } = require('../apps/mobile/src/features/questions/ChoiceQuestion.tsx');
const { ChoicePreview, QuestionEditor } = require('../apps/admin/src/components/question-editor.tsx');
const { newDraft } = require('../apps/admin/src/services/questions-contract.ts');
const { TextQuestion, UnscoredTextPreview } = require('../apps/mobile/src/features/questions/TextQuestion.tsx');
const { TextPreview } = require('../apps/admin/src/components/question-editor.tsx');
const { MultiSelectionQuestion, UnscoredMultiPreview } = require('../apps/mobile/src/features/questions/MultiSelectionQuestion.tsx');
const { MultiPreview } = require('../apps/admin/src/components/question-editor.tsx');
const { ArrangementQuestion, UnscoredArrangementPreview } = require('../apps/mobile/src/features/questions/ArrangementQuestion.tsx');
const { ArrangementPreview, SequenceControls } = require('../apps/admin/src/components/question-editor.tsx');
const { MatchingQuestion, UnscoredMatchingPreview } = require('../apps/mobile/src/features/questions/MatchingQuestion.tsx');
const { MatchingPreview, MatchingControls } = require('../apps/admin/src/components/question-editor.tsx');
const { FlashcardQuestion, FlashcardPractice } = require('../apps/mobile/src/features/questions/FlashcardQuestion.tsx');
const { FlashcardPreview } = require('../apps/admin/src/components/question-editor.tsx');
const { AssignmentEditor, Picker } = require('../apps/mobile/src/features/assignments/AssignmentEditor.tsx');
const { ItemPreview } = require('../apps/mobile/src/features/assignments/ItemPreview.tsx');
const { PublishedDetails } = require('../apps/mobile/src/features/assignments/PublishedDetails.tsx');
const { AttemptPlayer } = require('../apps/mobile/src/features/assignments/AttemptPlayer.tsx');
const { CaptureQuestion } = require('../apps/mobile/src/features/assignments/CaptureQuestion.tsx');
const { ResultDetails, resultMessage } = require('../apps/mobile/src/features/assignments/ResultDetails.tsx');
const { ProgressTotals, ProgressOverview } = require('../apps/mobile/src/features/progress/ProgressSummary.tsx');
const { HistoryCard, HistoryBrowser } = require('../apps/mobile/src/features/progress/HistoryBrowser.tsx');
const item = { id: 'fixture-revision', prompt: 'Synthetic prompt', instructions: null, method: 'multiple_choice',
  content: { options: [{ id: 'a', text: 'Synthetic A' }, { id: 'b', text: 'Synthetic B' }] } };
const matchItem = { ...item, method: 'matching_type', content: { left: [{id:'a',text:'Same ñ😀'},{id:'b',text:'Same ñ😀'}], right: [{id:'a',text:'Same ñ😀'},{id:'b',text:'Same ñ😀'}] } };
test('native matching handlers select, associate, reassign, remove/reset and gate disabled input', () => {
  let value = [], selectedLeft = null;
  const tree = disabled => MatchingQuestion({ item: matchItem, value, selectedLeft, disabled, onSelectLeft(next) {selectedLeft=next;},onChange(next){value=next;} });
  const left = (n, disabled=false) => nodes(tree(disabled),e=>e.props?.accessibilityLabel===`Left ${n}: Same ñ😀`)[0].props.onPress();
  const press = (label,disabled=false) => nodes(tree(disabled),e=>e.props?.label===label)[0].props.onPress();
  press('Match with right 1: Same ñ😀'); assert.deepEqual(value,[]);
  left(1); assert.equal(selectedLeft,'a'); press('Match with right 2: Same ñ😀'); assert.deepEqual(value,[{left_id:'a',right_id:'b'}]); assert.equal(selectedLeft,null);
  left(2); press('Match with right 2: Same ñ😀'); assert.deepEqual(value,[{left_id:'b',right_id:'b'}]);
  left(1,true); assert.equal(selectedLeft,null); press('Remove association for left 2',true); assert.equal(value.length,1);
  press('Remove association for left 2'); assert.deepEqual(value,[]);
  left(2); press('Reset matching'); assert.equal(selectedLeft,null); assert.deepEqual(value,[]);
});
test('native matching exposes selected states and safe phase/reset boundaries', () => {
  const html = render(MatchingQuestion,{item:{...matchItem,answer_key:'PRIVATE'},value:[],selectedLeft:'a',disabled:true,onSelectLeft(){},onChange(){}});
  assert(html.includes('aria-checked="true"') && html.includes('aria-disabled="true"') && html.includes('Left 2: Same'));
  assert(!html.includes('PRIVATE'));
  for(const extra of [{phase:'loading'},{phase:'error',onRetry(){}},{item:null},{active:false}]) assert(!render(UnscoredMatchingPreview,{item:matchItem,...extra}).includes('Synthetic prompt'));
  assert(render(UnscoredMatchingPreview,{item:matchItem,phase:'error',onRetry(){}}).includes('Retry preview'));
  assert.notEqual(UnscoredMatchingPreview({item:matchItem,resetKey:1}).key,UnscoredMatchingPreview({item:matchItem,resetKey:2}).key);
});
test('browser matching controls associate, revise, remove and reset using keyboard buttons', () => {
  let pairs=[],selectedLeft=null;
  const controls=()=>nodes(MatchingControls({...matchItem.content,pairs,selectedLeft,onSelectLeft(next){selectedLeft=next;},onChange(next){pairs=next;}}),e=>!!e.props?.onClick);
  const click=text=>controls().find(e=>React.Children.toArray(e.props.children).join('')===text).props.onClick();
  click('Left 1: Same ñ😀');click('Match with right 2: Same ñ😀'); assert.deepEqual(pairs,[{left_id:'a',right_id:'b'}]);
  click('Left 2: Same ñ😀');click('Match with right 2: Same ñ😀');assert.deepEqual(pairs,[{left_id:'b',right_id:'b'}]);
  click('Remove association for left 2');assert.deepEqual(pairs,[]);click('Left 1: Same ñ😀');click('Reset matching');assert.equal(selectedLeft,null);
  const html=render(MatchingPreview,{definition:{...matchItem,prompt:'<script>fixture</script>',answer_key:'PRIVATE'}});
  assert(html.includes('&lt;script&gt;') && !html.includes('<script>') && !html.includes('PRIVATE') && html.includes('Unfinished'));
});
test('matching editor presents independent stable sets, private complete mappings and field errors', () => {
  const html=render(QuestionEditor,{draft:newDraft('matching_type'),errors:{left_0:'Missing label',pairs:'Complete mapping required'},busy:false,mode:'Create',onChange(){},onSave(){},onPreview(){},onCancel(){}});
  assert(html.includes('Left set') && html.includes('Right set') && html.includes('Private expected associations') && html.includes('Complete mapping required'));
  assert(html.includes('Missing label') && html.includes('aria-invalid="true"') && html.includes('Add right item'));
});
function nodes(element, predicate) {
  if (!element || typeof element !== 'object') return [];
  return [...(predicate(element) ? [element] : []), ...React.Children.toArray(element.props?.children).flatMap(child => nodes(child, predicate))];
}
function render(Component, props) { return renderToStaticMarkup(React.createElement(Component, props)); }
const assignmentItem={id:'fixture-question-revision',question_id:'fixture-question',version:1,eligible:true,definition:{method:'true_false',lesson_id:'fixture-lesson',prompt:'Synthetic assignment item',instructions:null,content:{}}};
const progressFixture={availability:'available',as_of:'2026-10-19T00:00:00Z',class_id:null,class_name:null,class_count:2,policy_version:'submission-counts-v1',counts:{available:3,submitted:1,in_progress:1,not_started:1,pending:2}};
const historyFixture={id:'fixture-assignment',version_id:'fixture-version',class_id:'fixture-class',class_name:'Synthetic class',language:'tagalog',title:'<script>Synthetic history</script>',context:{lesson_id:'l',lesson_name:'Original lesson',curriculum_version_id:'v',curriculum_name:'Original edition',grade:5,subject_id:'s',subject_name:'Filipino'},submission_status:'submitted',result_state:'withheld',attempt_id:'a',published_at:progressFixture.as_of,started_at:progressFixture.as_of,last_activity_at:progressFixture.as_of,submitted_at:progressFixture.as_of,sort_at:progressFixture.as_of,released_run_id:null,policy_version:null,earned_points:null,possible_points:null};

test('progress shows trusted submission counts and keeps unavailable distinct from zero',()=>{
 const html=render(ProgressTotals,{row:progressFixture});assert(html.includes('1 submitted / 3 available')&&html.includes('Pending')&&html.includes('not mastery'));
 assert(html.includes('2</div>') || html.includes('>2<'));
 assert(!html.includes('%')&&!html.includes('Objective points'));
 const empty=render(ProgressTotals,{row:{...progressFixture,counts:{available:0,submitted:0,in_progress:0,not_started:0,pending:0}}});
 assert(empty.includes('No available assignments')&&!empty.includes('0 submitted / 0'));
 const personal=render(ProgressTotals,{row:{...progressFixture,availability:'unavailable',counts:null,class_count:null}});
 assert(personal.includes('not yet available')&&!personal.includes('0 submitted'));
});

test('history review hides withheld points and preserves context and released decimal zero',()=>{
 const hidden=render(HistoryCard,{row:{...historyFixture,earned_points:'999.00',possible_points:'999.00'}});
 assert(!hidden.includes('999.00')&&hidden.includes('Filipino')&&hidden.includes('Tagalog')&&hidden.includes('Original edition'));
 assert(hidden.includes('&lt;script&gt;')&&!hidden.includes('<script>'));
 const shown=render(HistoryCard,{row:{...historyFixture,result_state:'released',released_run_id:'run',policy_version:'objective-exact-v1',earned_points:'0.00',possible_points:'9.00'}});
 assert(shown.includes('0.00 / 9.00')&&shown.includes('original capture remains unscored'));
 const personal=render(HistoryBrowser,{api:{},personal:true});assert(personal.includes('Personal learning history is not yet recorded')&&!personal.includes('History start date'));
});

test('progress focus reads clear stale data on error or blur and ignore late completion',async()=>{
 const host=hookHarness(ProgressOverview,{api:{summary:async()=>progressFixture}});
 const inner=nodes(host.render(),e=>e.type?.name==='ProgressRead')[0];
 const ready=hookHarness(inner.type,inner.props,{effects:true});ready.render();await new Promise(done=>setImmediate(done));
 assert.equal(nodes(ready.render(),e=>e.type===ProgressTotals)[0].props.row,progressFixture);
 const before=inner.key;inner.props.refresh();assert.notEqual(nodes(host.render(),e=>e.type?.name==='ProgressRead')[0].key,before);
 const failed=hookHarness(inner.type,{...inner.props,api:{summary:async()=>{throw new Error('Offline fixture');}}},{effects:true});failed.render();await new Promise(done=>setImmediate(done));
 assert(!nodes(failed.render(),e=>e.type===ProgressTotals).length);assert(JSON.stringify(failed.render()).includes('Offline fixture'));
 let resolve;const late=hookHarness(inner.type,{...inner.props,api:{summary:()=>new Promise(done=>{resolve=done;})}},{effects:true});late.render();late.cleanup();resolve(progressFixture);await new Promise(done=>setImmediate(done));
 assert(!nodes(late.render(),e=>e.type===ProgressTotals).length);
});

test('history filters apply explicitly, validate dates, preserve scope and reset pagination',async()=>{
 const calls=[];const h=hookHarness(HistoryBrowser,{initialClassId:'fixture-class',api:{history:async(filters,offset)=>{calls.push({filters,offset});return{items:[],has_more:false,offset,limit:20};},classes:async()=>({items:[],has_more:false,offset:0,limit:20})}});
 const press=label=>nodes(h.render(),e=>e.props?.label===label)[0].props.onPress();
 const input=label=>nodes(h.render(),e=>e.props?.accessibilityLabel===label)[0];
 input('History start date').props.onChangeText('2026-02-30');press('Apply history filters');assert(JSON.stringify(h.render()).includes('valid calendar date'));
 input('History start date').props.onChangeText('2026-10-18');input('History end date inclusive').props.onChangeText('2026-10-19');
 const choices=nodes(h.render(),e=>Array.isArray(e.props?.values)&&e.props.values.includes('submitted'))[0];choices.props.onChange('submitted');
 press('Apply history filters');const picker=()=>nodes(h.render(),e=>e.type===Picker&&e.props.emptyTitle==='No assignments match these filters')[0];
 await picker().props.fetch(20);assert.equal(calls[0].filters.class_id,'fixture-class');assert.equal(calls[0].filters.status,'submitted');assert.equal(calls[0].offset,20);
 const key=picker().key;press('Clear history filters');assert.notEqual(picker().key,key);await picker().props.fetch(0);assert.deepEqual(calls[1].filters,{status:'all'});
});
const resultFixture={assignment_id:'fixture-assignment',class_id:'fixture-class',version_id:'fixture-version',title:'Synthetic result',attempt_id:'fixture-attempt',student_id:'fixture-student',student_username:'FixtureStudent',
  submitted_at:'2026-10-19T00:00:00Z',submission_status:'submitted',state:'withheld',released:false,revision:'a'.repeat(64),pinned_run_id:null,
  evaluation:{id:'fixture-run',status:'COMPLETE',policy_version:'objective-exact-v1',engine_version:'fixture-engine',evaluated_at:'now'},earned_points:'0.00',possible_points:'1.00',
  items:[{result_id:'fixture-result',assignment_question_id:'aq',question_revision_id:assignmentItem.id,response_id:'response',position:1,question:assignmentItem,answer:{value:false},state:'AUTO_GRADABLE',correct:false,awarded_points:'0.00',max_points:'1.00'}]};

test('result review confirms visibility, retries identical requests, withdraws and guards Back',async()=>{
 const seen=[];let fail=true,refreshed=0;const h=hookHarness(ResultDetails,{initial:resultFixture,instructor:true,onVisibilityChanged(){refreshed++;},api:{async release(row,released,key){seen.push({row,released,key});if(fail){fail=false;throw new Error('Offline synthetic fixture');}return {...row,released,state:released?'released':'withheld',revision:'b'.repeat(64),pinned_run_id:row.evaluation.id};}}});
 const press=label=>nodes(h.render(),e=>e.props?.label===label)[0].props.onPress();
 press('Release this evaluation');assert.equal(seen.length,0);press('Cancel visibility change');assert.equal(seen.length,0);
 press('Release this evaluation');press('Confirm visibility change');await new Promise(done=>setImmediate(done));
 assert(!nodes(h.render(),e=>e.type===CaptureQuestion).length);assert(JSON.stringify(h.render()).includes('unverified'));assert.equal(refreshed,0);
 h.render();let repeated=0;assignmentNavigation.callback({repeat(){repeated++;}});press('Stay on result review');assert.equal(repeated,0);
 press('Retry original visibility change');await new Promise(done=>setImmediate(done));assert.deepEqual(seen[0],seen[1]);assert.equal(refreshed,1);
 const review=nodes(h.render(),e=>e.type===CaptureQuestion)[0];assert(review.props.disabled&&review.props.review);assert.equal(review.props.answer.value,false);
 press('Withdraw result visibility');press('Confirm visibility change');await new Promise(done=>setImmediate(done));assert.equal(seen.at(-1).released,false);
 assert(JSON.stringify(h.render()).includes('Withheld'));
});

test('result review hides protected data on access loss and ignores responses after unmount',async()=>{
 for(const status of [401,403,404]){
  const h=hookHarness(ResultDetails,{initial:resultFixture,instructor:true,api:{async release(){throw Object.assign(new Error('Access ended'),{status});}}});
  const press=label=>nodes(h.render(),e=>e.props?.label===label)[0].props.onPress();press('Release this evaluation');press('Confirm visibility change');await new Promise(done=>setImmediate(done));
  assert(!nodes(h.render(),e=>e.type===CaptureQuestion).length);assert(!JSON.stringify(h.render()).includes('FixtureStudent'));
 }
 let resolve;const h=hookHarness(ResultDetails,{initial:resultFixture,instructor:true,api:{release:()=>new Promise(done=>{resolve=done;})}},{effects:true});
 const press=label=>nodes(h.render(),e=>e.props?.label===label)[0].props.onPress();press('Release this evaluation');press('Confirm visibility change');h.cleanup();resolve({...resultFixture,released:true,state:'released'});await new Promise(done=>setImmediate(done));
 assert(!JSON.stringify(h.render()).includes('has released this evaluation'));
});

test('result status and readonly Flashcard/text review never offers keys or further response entry',()=>{
 for(const state of ['not_submitted','submitted','awaiting_manual_review','withheld','released','not_applicable'])assert.equal(typeof resultMessage({...resultFixture,state}),'string');
 const flash={...assignmentItem,definition:{...assignmentItem.definition,method:'flashcards',content:{cue:'Synthetic cue'}}};
 const html=render(CaptureQuestion,{item:flash,answer:{recall:'hard'},back:{back:'PRIVATE BACK',revision_id:flash.id},disabled:true,review:true,onChange(){throw Error('must not edit');},onReveal(){throw Error('must not reveal');}});
 assert(html.includes('hard')&&html.includes('Card back withheld')&&!html.includes('PRIVATE BACK')&&!html.includes('Reveal assignment card back'));
 const text={...assignmentItem,definition:{...assignmentItem.definition,method:'identification',content:{}}};
 const textHtml=render(CaptureQuestion,{item:text,answer:{text:'  ñ😀 e\u0301  '},back:null,disabled:true,review:true,onChange(){},onReveal(){}});
 assert(textHtml.includes('Original submitted text')&&textHtml.includes('readOnly'));
 const hidden=render(ResultDetails,{initial:{...resultFixture,student_id:null,student_username:null,items:[],earned_points:null,possible_points:null},api:{}});
 assert(!hidden.includes('Objective points:')&&!hidden.includes('Release this evaluation'));
});
const assignmentRow={id:'fixture-assignment',class_id:'fixture-class',version_id:'fixture-version',revision:'a'.repeat(64),status:'draft',title:'Synthetic draft',instructions:null,
  context:{lesson_id:'fixture-lesson',lesson_name:'Synthetic lesson',curriculum_name:'Synthetic edition',grade:5,subject_name:'Filipino'},questions:[assignmentItem],eligible:true,editable:true,requires_subject:true};
const attemptItem={...assignmentItem,assignment_question_id:'assignment-item'};
const attemptRow={id:'fixture-attempt',assignment_id:assignmentRow.id,class_id:assignmentRow.class_id,version_id:assignmentRow.version_id,title:'Synthetic capture',instructions:null,status:'in_progress',revision:'a'.repeat(64),started_at:'2026-10-19T00:00:00Z',submitted_at:null,position:1,question_count:1,completed_count:0,questions:[attemptItem],responses:[],revealed_item_ids:[]};
test('attempt player saves false, confirms incomplete submission, retries exact body/key and shows receipt only',async()=>{
  let saves=0;const calls=[];
  const api={async save(row,body){saves++;assert.equal(body.responses[0].answer.value,false);return{...row,revision:'b'.repeat(64),responses:body.responses,completed_count:1};},
    async submit(row,body,key){calls.push({row,body,key});if(calls.length===1)throw new Error('Interrupted submission');return{...row,status:'submitted',submitted_at:'2026-10-19T01:00:00Z',questions:[],responses:[],completed_count:0};}};
  const h=hookHarness(AttemptPlayer,{initial:attemptRow,api});const press=label=>nodes(h.render(),e=>e.props?.label===label)[0].props.onPress();
  nodes(h.render(),e=>e.type===CaptureQuestion)[0].props.onChange({value:false});h.render();assert(assignmentNavigation.active);
  press('Save progress');await new Promise(done=>setImmediate(done));assert.equal(saves,1);
  press('Clear current response');press('Review final submission');assert(JSON.stringify(h.render()).includes('1 questions are unanswered or incomplete'));
  assert.equal(calls.length,0);press('Confirm');await new Promise(done=>setImmediate(done));
  press('Retry original submission');await new Promise(done=>setImmediate(done));assert.deepEqual(calls[0],calls[1]);
  assert(!nodes(h.render(),e=>e.type===CaptureQuestion).length);assert(JSON.stringify(h.render()).includes('Submission received'));
});
test('attempt player preserves raw buffers, confirms unsafe exit and hides questions on lost membership/session',async()=>{
  const item={...attemptItem,definition:{...attemptItem.definition,method:'identification',content:{}}};
  const h=hookHarness(AttemptPlayer,{initial:{...attemptRow,questions:[item]},api:{async save(){throw Object.assign(new Error('Membership ended'),{status:404});}}});
  const press=label=>nodes(h.render(),e=>e.props?.label===label)[0].props.onPress();
  nodes(h.render(),e=>e.type===CaptureQuestion)[0].props.onChange({text:'  ñ😀 e\u0301  '});
  assert.equal(nodes(h.render(),e=>e.type===CaptureQuestion)[0].props.answer.text,'  ñ😀 e\u0301  ');
  let repeated=0;assignmentNavigation.callback({repeat(){repeated++;}});press('Keep working');assert.equal(repeated,0);
  press('Save progress');await new Promise(done=>setImmediate(done));assert(!nodes(h.render(),e=>e.type===CaptureQuestion).length);
  assert(JSON.stringify(h.render()).includes('Protected question data is hidden'));
  assert.equal(render(AttemptPlayer,{initial:attemptRow,api:{},active:false}),'');
});
test('capture renderer uses existing choice/text/selection/arrangement/matching widgets and controlled flash reveal',()=>{
  const entries=[['multiple_choice',{options:[{id:'a',text:'A'},{id:'b',text:'B'}]}],['true_false',{}],['identification',{}],['fill_in_the_blank',{blank_ids:['gap']}],['multiple_select',{options:[{id:'a',text:'A'},{id:'b',text:'B'}]}],['error_identification',{tokens:[{id:'a',text:'A'},{id:'b',text:'B'}]}],['word_arrangement',{items:[{id:'a',text:'A'},{id:'b',text:'B'}]}],['sentence_arrangement',{items:[{id:'a',text:'A'},{id:'b',text:'B'}]}],['matching_type',{left:[{id:'a',text:'A'},{id:'b',text:'B'}],right:[{id:'a',text:'A'},{id:'b',text:'B'}]}],['flashcards',{cue:'Synthetic cue'}]];
  for(const [method,content] of entries){const html=render(CaptureQuestion,{item:{...attemptItem,definition:{...attemptItem.definition,method,content}},answer:undefined,back:null,disabled:false,onChange(){},onReveal(){}});assert(html.includes('Synthetic assignment item')&&!html.includes('could not be verified'));}
  let value={revealed:true,recall:'hard'};const front={id:'f',lesson_id:'l',method:'flashcards',prompt:'Fixture',instructions:null,cue:'Cue'},back={revision_id:'f',back:'Authorized back'};
  const tree=FlashcardQuestion({front,back,value,allowRecallRevision:true,onChange(next){value=next;}});
  nodes(tree,e=>e.props?.label==='Easy — recalled readily')[0].props.onPress();assert.equal(value.recall,'easy');
});
test('assignment editor saves controlled metadata, guards unsaved navigation and confirms archive',async()=>{
  let calls=0,archived=0,repeated=0;const api={async save(row,body){calls++;assert.equal(body.title,'Edited fixture');return {...row,title:body.title,revision:'b'.repeat(64)};},async archive(row){archived++;return{...row,status:'archived',editable:false};}};
  const h=hookHarness(AssignmentEditor,{initial:assignmentRow,classId:'fixture-class',api});
  const press=label=>nodes(h.render(),e=>e.props?.label===label)[0].props.onPress();
  nodes(h.render(),e=>e.props?.accessibilityLabel==='Assignment title')[0].props.onChangeText('Edited fixture');h.render();assert(assignmentNavigation.active);
  assignmentNavigation.callback({repeat(){repeated++;}});assert(nodes(h.render(),e=>e.props?.label==='Confirm').length);press('Keep current state');assert.equal(repeated,0);
  press('Save draft');await new Promise(resolve=>setImmediate(resolve));h.render();assert.equal(calls,1);assert(!assignmentNavigation.active);
  press('Archive draft');press('Confirm');await new Promise(resolve=>setImmediate(resolve));h.render();assert.equal(archived,1);
  assert.equal(nodes(h.render(),e=>e.props?.label==='Save draft')[0].props.disabled,true);
});
test('assignment item controls reorder/remove and published preview never renders a private key',()=>{
  const other={...assignmentItem,id:'other-revision',question_id:'other-question'};
  const h=hookHarness(AssignmentEditor,{initial:{...assignmentRow,questions:[assignmentItem,other]},classId:'fixture-class',api:{}});
  const press=label=>nodes(h.render(),e=>e.props?.label===label)[0].props.onPress();
  press('Move question 2 earlier');press('Remove question 2');press('Preview selected question 1');
  const preview=nodes(h.render(),e=>e.type===ItemPreview)[0];assert.equal(preview.props.row.id,other.id);
  const html=render(ItemPreview,{row:{...assignmentItem,definition:{...assignmentItem.definition,method:'flashcards',content:{cue:'Synthetic cue'},answer_key:{back:'PRIVATE'}}}});
  assert(html.includes('front only')&&!html.includes('PRIVATE'));
});
test('assignment picker ignores late reads after blur/unmount',async()=>{
  let resolve;const h=hookHarness(Picker,{fetch:()=>new Promise(done=>{resolve=done;}),render:()=>null},{effects:true});
  h.render();await new Promise(done=>setImmediate(done));h.cleanup();resolve({items:[assignmentRow],has_more:false,offset:0,limit:20});await new Promise(done=>setImmediate(done));
  assert(!JSON.stringify(h.render()).includes('Synthetic draft'));
});
test('publication confirms subject binding, retries the same request and freezes the saved view',async()=>{
  const seen=[];
  const api={async publish(row,key){seen.push({row,key});if(seen.length===1)throw new Error('Interrupted response');return{...row,status:'published',editable:false,requires_subject:false};}};
  const h=hookHarness(AssignmentEditor,{initial:assignmentRow,classId:'fixture-class',api});
  const press=label=>nodes(h.render(),e=>e.props?.label===label)[0].props.onPress();
  press('Review and publish');assert(JSON.stringify(h.render()).includes('explicitly binds the class subject to Filipino'));
  assert.equal(seen.length,0);press('Confirm');await new Promise(done=>setImmediate(done));
  assert.equal(nodes(h.render(),e=>e.props?.label==='Save draft')[0].props.disabled,true);
  press('Retry original publication');press('Confirm');await new Promise(done=>setImmediate(done));
  assert.equal(seen.length,2);assert.deepEqual(seen[0],seen[1]);
  assert.equal(nodes(h.render(),e=>e.props?.label==='Save draft')[0].props.disabled,true);
  assert(!nodes(h.render(),e=>e.props?.label==='Review and publish').length);
  assert(JSON.stringify(h.render()).includes('No notifications were sent'));
});
test('published student presentation is metadata-only and empty/error/loading states support retry',async()=>{
  const html=render(PublishedDetails,{row:{...assignmentRow,title:'<script>Fixture</script>',published_at:'2026-10-19T00:00:00Z',question_count:2,methods:['true_false','flashcards'],questions:[{prompt:'PRIVATE CONTENT'}],answer_key:'PRIVATE KEY'}});
  assert(html.includes('&lt;script&gt;')&&!html.includes('PRIVATE')&&html.includes('One resumable unscored attempt'));
  const empty=hookHarness(Picker,{fetch:async()=>({items:[],has_more:false,offset:0,limit:20}),render:()=>null,emptyTitle:'No published assignments',emptyDescription:'Refresh to check again.'},{effects:true});
  assert(!JSON.stringify(empty.render()).includes('No published assignments'));
  await new Promise(done=>setImmediate(done));assert(JSON.stringify(empty.render()).includes('No published assignments'));
  const failed=hookHarness(Picker,{fetch:async()=>{throw new Error('Offline fixture');},render:()=>null},{effects:true});failed.render();
  await new Promise(done=>setImmediate(done));assert(JSON.stringify(failed.render()).includes('Offline fixture'));
  assert(nodes(failed.render(),e=>e.props?.label==='Retry loading').length);
});
const flashFront={id:'fixture-flashcard',lesson_id:'fixture-lesson',method:'flashcards',prompt:'Synthetic directions',instructions:null,cue:'Repeated ñ😀 e\u0301'};
const flashBack={revision_id:flashFront.id,back:'PRIVATE revealed fixture'};
test('native flashcard hides the back/rating until reveal, validates version and blocks repeated/disabled actions',()=>{
  let value={revealed:false,recall:null};
  const tree=disabled=>FlashcardQuestion({front:flashFront,back:flashBack,value,disabled,onChange(next){value=next;}});
  const press=(label,disabled=false)=>nodes(tree(disabled),e=>e.props?.label===label)[0].props.onPress();
  assert(!render(FlashcardQuestion,{front:flashFront,back:flashBack,value,onChange(){}}).includes('PRIVATE'));
  press('Reveal back',true);assert(!value.revealed);press('Reveal back');assert(value.revealed);
  const revealed=render(FlashcardQuestion,{front:flashFront,back:flashBack,value,onChange(){}});assert(revealed.includes('PRIVATE') && revealed.includes('could not recall'));
  press('Good — recalled with some effort');assert.equal(value.recall,'good');press('Easy — recalled readily');assert.equal(value.recall,'good');
  const mismatch=render(FlashcardQuestion,{front:flashFront,back:{...flashBack,revision_id:'another'},value,onChange(){},onRetry(){}});
  assert(!mismatch.includes('PRIVATE') && mismatch.includes('Retry card') && mismatch.includes('Back hidden'));
});
// Hook harness executes actual component handlers and re-renders state; no renderer dependency.
function hookHarness(Component,props,{effects=false}={}){
  const slots=[], cleanups=[];let cursor=0, effectRan=false;
  return {render(){cursor=0;const saved={useState:React.useState,useRef:React.useRef,useEffect:React.useEffect,useCallback:React.useCallback};
    React.useCallback=callback=>callback;
    React.useState=initial=>{const index=cursor++;if(!(index in slots))slots[index]=typeof initial==='function'?initial():initial;
      return [slots[index],next=>{slots[index]=typeof next==='function'?next(slots[index]):next;}];};
    React.useRef=initial=>{const index=cursor++;return slots[index]??(slots[index]={current:initial});};
    React.useEffect=callback=>{if(effects&&!effectRan){const cleanup=callback();if(cleanup)cleanups.push(cleanup);effectRan=true;}};
    try{return Component(props);}finally{Object.assign(React,saved);}},cleanup(){cleanups.forEach(fn=>fn());}};
}
test('practice navigation resets visits, single-flight rating and explicit exit discard local state',()=>{
  const cards=[{front:flashFront,back:flashBack},{front:{...flashFront,id:'second'},back:{...flashBack,revision_id:'second'}}];
  let exits=0,responses=0;const host=FlashcardPractice({cards,onExit(){exits++;},onResponse(){responses++;}});
  const harness=hookHarness(host.type,host.props);
  const press=label=>nodes(harness.render(),e=>e.props?.label===label)[0].props.onPress();
  const card=()=>nodes(harness.render(),e=>e.type===FlashcardQuestion)[0].props;
  assert(!card().value.revealed);card().onChange({revealed:true,recall:'good'});card().onChange({revealed:true,recall:'good'});assert.equal(responses,1);
  press('Next card');assert.equal(card().front.id,'second');assert.deepEqual(card().value,{revealed:false,recall:null});
  press('Previous card');assert.equal(card().front.id,flashFront.id);assert(!card().value.revealed);
  press('Exit practice');assert.equal(nodes(harness.render(),e=>e.type===FlashcardQuestion).length,0);
  press('Keep practicing');assert(card());press('Exit practice');const exit=nodes(harness.render(),e=>e.props?.label==='Exit and discard')[0];exit.props.onPress();exit.props.onPress();assert.equal(exits,1);
  assert.equal(nodes(harness.render(),e=>e.type===FlashcardQuestion).length,0);
});
test('practice phase/identity/session boundaries hide old card content and reject duplicate versions',()=>{
  const props={cards:[{front:flashFront,back:flashBack}],onExit(){}};
  for(const extra of [{phase:'loading'},{phase:'error',onRetry(){}},{cards:[]},{active:false}])assert(!render(FlashcardPractice,{...props,...extra}).includes(flashFront.cue));
  assert(render(FlashcardPractice,{...props,cards:[...props.cards,...props.cards]}).includes('could not be verified'));
  assert.notEqual(FlashcardPractice({...props,resetKey:1}).key,FlashcardPractice({...props,resetKey:2}).key);
});
test('Android hardware Back opens exit confirmation and removes its listener on unmount',()=>{
  const rn=local('react-native-web'),before=Object.getOwnPropertyDescriptor(rn.Platform,'OS'),originalHandler=rn.BackHandler.addEventListener;
  let callback,removed=false;
  Object.defineProperty(rn.Platform,'OS',{configurable:true,value:'android'});
  rn.BackHandler.addEventListener=(event,fn)=>{assert.equal(event,'hardwareBackPress');callback=fn;return{remove(){removed=true;}};};
  try{
    const host=FlashcardPractice({cards:[{front:flashFront,back:flashBack}],onExit(){}}),harness=hookHarness(host.type,host.props,{effects:true});
    harness.render();assert.equal(callback(),true);assert(nodes(harness.render(),e=>e.props?.label==='Exit and discard').length===1);
    harness.cleanup();assert(removed);
  }finally{Object.defineProperty(rn.Platform,'OS',before);rn.BackHandler.addEventListener=originalHandler;}
});
test('browser flashcard reveal is deliberate and optional self-report stays local',()=>{
  const definition={...flashFront,content:{cue:flashFront.cue},answer_key:'SHOULD-NOT-RENDER',explanation:'SHOULD-NOT-RENDER'};
  const harness=hookHarness(FlashcardPreview,{definition,back:'PRIVATE revealed fixture'});
  const click=text=>nodes(harness.render(),e=>!!e.props?.onClick&&React.Children.toArray(e.props.children).join('')===text)[0].props.onClick();
  const text=()=>JSON.stringify(harness.render());assert(!text().includes('PRIVATE'));click('Reveal back');assert(text().includes('PRIVATE'));
  click('Hard — recalled with difficulty');assert(text().includes('Local only'));click('Restart card preview');assert(!text().includes('PRIVATE'));
  const readOnly=render(FlashcardPreview,{definition});assert(readOnly.includes('editor access') && !readOnly.includes('PRIVATE') && !readOnly.includes('SHOULD-NOT-RENDER'));
});
test('mobile radios expose checked/disabled semantics, preserve order and never display keys', () => {
  const html = render(ChoiceQuestion, { item: { ...item, answer_key: { correct_option_id: 'b' }, explanation: 'PRIVATE' },
    value: { method: 'multiple_choice', answer: { option_id: 'b' } }, disabled: true, onChange() {} });
  assert(html.includes('role="radiogroup"') && html.includes('role="radio"'));
  assert(html.includes('aria-checked="true"') && html.includes('aria-disabled="true"'));
  assert(html.indexOf('Synthetic A') < html.indexOf('Synthetic B'));
  assert(!html.includes('PRIVATE') && !html.includes('correct_option_id'));
});
test('actual option handlers replace selection, ignore repeated taps and block disabled actions', () => {
  let value = null, calls = 0;
  const tree = disabled => ChoiceQuestion({ item, value, disabled, onChange(next) { calls++; value = next; } });
  nodes(tree(false), e => e.props?.accessibilityRole === 'radio')[1].props.onPress();
  assert.equal(value.answer.option_id, 'b');
  nodes(tree(false), e => e.props?.accessibilityRole === 'radio')[1].props.onPress(); assert.equal(calls, 1);
  nodes(tree(true), e => e.props?.accessibilityRole === 'radio')[0].props.onPress(); assert.equal(calls, 1);
  nodes(tree(false), e => e.props?.accessibilityRole === 'radio')[0].props.onPress(); assert.equal(value.answer.option_id, 'a');
});
test('false radio is selected using a strict boolean without truthiness errors', () => {
  const html = render(ChoiceQuestion, { item: { ...item, method: 'true_false', content: {} },
    value: { method: 'true_false', answer: { value: false } }, onChange() {} });
  assert(html.includes('False') && html.includes('aria-checked="true"')); assert(html.includes('not scored'));
});
test('loading/error/empty/away states hide prior question content; reset identity remounts interaction', () => {
  for (const props of [{ phase: 'loading' }, { phase: 'error', onRetry() {} }, { item: null }, { active: false }]) {
    const html = render(UnscoredChoicePreview, { item, ...props }); assert(!html.includes('Synthetic prompt'));
  }
  assert(render(UnscoredChoicePreview, { item, phase: 'error', onRetry() {} }).includes('Retry preview'));
  const first = UnscoredChoicePreview({ item, resetKey: 1 }), next = UnscoredChoicePreview({ item, resetKey: 2 });
  assert.notEqual(first.key, next.key); assert.equal(UnscoredChoicePreview({ item, active: false }), null);
  assert(render(UnscoredChoicePreview, { item }).includes('Reset selection'));
});
test('administrator editor has labeled field errors, one correct-answer group and ordered controls', () => {
  const html = render(QuestionEditor, { draft: newDraft('multiple_choice'), errors: { prompt: 'Enter a prompt.', correct: 'Choose one answer.' },
    busy: false, mode: 'Create', onChange() {}, onSave() {}, onPreview() {}, onCancel() {} });
  for (const text of ['Enter a prompt.', 'aria-invalid="true"', 'name="correct-option"', 'Move option 1 down', 'Stable ID:', 'Private explanation']) assert(html.includes(text), text);
  const tf = render(QuestionEditor, { draft: newDraft('true_false'), errors: {}, busy: false, mode: 'Create', onChange() {}, onSave() {}, onPreview() {}, onCancel() {} });
  assert(tf.includes('correct-boolean') && !tf.includes('Add option'));
});
test('browser preview renders public fields and unscored radios only', () => {
  const html = render(ChoicePreview, { definition: { ...item, answer_key: { correct_option_id: 'b' }, explanation: 'PRIVATE' } });
  assert(html.includes('UNSCORED') && html.includes('No answer selected.'));
  assert(!html.includes('PRIVATE') && !html.includes('correct_option_id'));
});

const textItem = { id: 'synthetic-text-revision', method: 'fill_in_the_blank', prompt: 'Synthetic {{a}} then {{b}}.', instructions: null,
  content: { blank_ids: ['a', 'b'], template_syntax: 'double-brace-v1', input_max_length: 2 } };
test('mobile text inputs label gaps, preserve raw buffers and display limits without truncation or keys', () => {
  const html = render(TextQuestion, { item: { ...textItem, answer_key: 'PRIVATE-KEY' }, value: { a: '  ñ 😀\n', b: 'B' }, disabled: true, onChange() {} });
  for (const text of ['Gap 1', 'Gap 2', 'exceeds', 'Unicode code points', 'aria-invalid="true"', 'aria-disabled="true"']) {
    if (text === 'exceeds') assert(html.includes('Your text is kept for correction')); else assert(html.includes(text), text);
  }
  assert(!html.includes('PRIVATE-KEY') && !html.includes('maxLength') && !html.includes('maxlength'));
  assert(html.includes('ñ 😀'));
});
test('actual text handlers preserve raw Unicode, ignore disabled writes and move next focus', () => {
  const previous = React.useRef;
  const ref = { current: Object.create(null) }; React.useRef = () => ref;
  try {
    let value = {}, calls = 0, focused = 0;
    const inputs = disabled => nodes(TextQuestion({ item: textItem, value, disabled, onChange(next) { value = next; calls++; } }), e => !!e.props?.onChangeText);
    let fields = inputs(false);
    fields[0].props.onChangeText('  Pag-ibig e\u0301! 😀\n'); assert.equal(value.a, '  Pag-ibig e\u0301! 😀\n');
    fields = inputs(false); fields[1].props.ref({ focus() { focused++; } }); fields[0].props.onSubmitEditing(); assert.equal(focused, 1);
    assert.equal(fields[0].props.enterKeyHint, 'next'); assert.equal(fields[0].props.submitBehavior, 'submit');
    assert.equal(fields[1].props.enterKeyHint, 'done'); assert.equal(fields[1].props.submitBehavior, 'blurAndSubmit');
    assert.equal(fields[0].props.autoCorrect, false); assert.equal(fields[0].props.autoCapitalize, 'none');
    inputs(true)[0].props.onChangeText('blocked'); assert.equal(calls, 1);
    inputs(true)[0].props.onSubmitEditing(); assert.equal(focused, 1);
    inputs(false)[0].props.onChangeText(''); assert.equal(value.a, '');
  } finally { React.useRef = previous; }
});
test('text preview replaces interaction during loading/error/away/empty and reset identity changes', () => {
  for (const extra of [{ phase: 'loading' }, { phase: 'error', onRetry() {} }, { item: null }, { active: false }])
    assert(!render(UnscoredTextPreview, { item: textItem, ...extra }).includes('Synthetic'));
  assert(render(UnscoredTextPreview, { item: textItem, phase: 'error', onRetry() {} }).includes('Retry preview'));
  assert.notEqual(UnscoredTextPreview({ item: textItem, resetKey: 1 }).key, UnscoredTextPreview({ item: textItem, resetKey: 2 }).key);
  assert(render(UnscoredTextPreview, { item: textItem }).includes('Reset answers'));
});
test('text editors expose private metadata errors and safe previews render plain text only', () => {
  for (const method of ['identification', 'fill_in_the_blank']) {
    const html = render(QuestionEditor, { draft: newDraft(method), errors: { inputLimit: 'Invalid limit', acceptedAnswers: 'Expected answer required', blank_0: 'Gap required' },
      busy: false, mode: 'Create', onChange() {}, onSave() {}, onPreview() {}, onCancel() {} });
    assert(html.includes('Invalid limit') && html.includes('aria-invalid="true"') && html.includes('Private expected answers'));
    assert(!html.includes('correct-option') && !html.includes('correct-boolean'));
  }
  const html = render(TextPreview, { definition: { ...textItem, prompt: '<script>alert(1)</script> {{a}} {{b}}', answer_key: 'PRIVATE-KEY', explanation: 'PRIVATE-EXPLANATION' } });
  assert(html.includes('&lt;script&gt;') && !html.includes('<script>')); assert(html.includes('[Gap 1]') && html.includes('Gap 2'));
  assert(!html.includes('PRIVATE-') && html.includes('UNSCORED'));
  const legacy = render(TextPreview, { definition: { ...textItem, content: { blank_ids: ['__proto__'] }, prompt: 'Legacy {{literal}}' } });
  assert(legacy.includes('Legacy {{literal}}') && legacy.includes('Gap 1'));
});

const multiItem = { ...item, method: 'multiple_select' };
test('native multi-checkbox handlers toggle independently and disabled inputs are inert', () => {
  for (const method of ['multiple_select', 'error_identification']) {
    const model = method === 'multiple_select' ? multiItem : { ...item, method, content: { tokens: item.content.options } };
    let value = null, calls = 0;
    const tree = disabled => MultiSelectionQuestion({ item: model, value, disabled, onChange(next) { value = next; calls++; } });
    const checkboxes = disabled => nodes(tree(disabled), e => e.props?.accessibilityRole === 'checkbox');
    checkboxes(false)[1].props.onPress(); checkboxes(false)[0].props.onPress();
    assert.deepEqual(method === 'multiple_select' ? value.answer.option_ids : value.answer.selected_token_ids, ['a', 'b']);
    checkboxes(true)[0].props.onPress(); assert.equal(calls, 2);
    checkboxes(false)[1].props.onPress(); assert.equal(calls, 3);
    const html = render(MultiSelectionQuestion, { item: { ...model, answer_key: 'PRIVATE' }, value, disabled: true, onChange() {} });
    assert(html.includes('role="checkbox"') && html.includes('aria-checked="true"') && html.includes('aria-disabled="true"'));
    assert(!html.includes('PRIVATE') && !html.includes('correction'));
    if (method === 'error_identification') assert(html.includes('Segment 1: Synthetic A'));
  }
});
test('multi-selection loading/error/empty/away/reset boundaries hide old content', () => {
  for (const extra of [{ phase: 'loading' }, { phase: 'error', onRetry() {} }, { item: null }, { active: false }])
    assert(!render(UnscoredMultiPreview, { item: multiItem, ...extra }).includes('Synthetic prompt'));
  assert(render(UnscoredMultiPreview, { item: multiItem, phase: 'error', onRetry() {} }).includes('Retry preview'));
  assert.notEqual(UnscoredMultiPreview({ item: multiItem, resetKey: 1 }).key, UnscoredMultiPreview({ item: multiItem, resetKey: 2 }).key);
  assert(render(UnscoredMultiPreview, { item: multiItem }).includes('Reset selections'));
});
test('shared editors render private target sets, correction errors and stable segment controls', () => {
  for (const method of ['multiple_select', 'error_identification']) {
    const html = render(QuestionEditor, { draft: newDraft(method), errors: { correct: 'Select targets', corrections: 'Invalid correction map' },
      busy: false, mode: 'Create', onChange() {}, onSave() {}, onPreview() {}, onCancel() {} });
    assert(html.includes('type="checkbox"') && html.includes('Select targets') && html.includes('Stable ID:'));
    assert(!html.includes('type="radio"'));
    if (method === 'error_identification') assert(html.includes('Add segment') && html.includes('Invalid correction map'));
  }
});
test('browser multi preview exposes checkboxes and escaped whole segments only', () => {
  const definition = { ...item, method: 'error_identification', content: { tokens: [{ id: 'a', text: '<b>ñ😀</b>' }] }, answer_key: 'PRIVATE' };
  const html = render(MultiPreview, { definition });
  assert(html.includes('type="checkbox"') && html.includes('&lt;b&gt;ñ😀&lt;/b&gt;') && html.includes('Unfinished preview'));
  assert(!html.includes('PRIVATE') && !html.includes('textarea'));
});

const arrangementItem = { ...item, method: 'word_arrangement', content: { items: [{ id: 'a', text: 'Repeated ñ😀' }, { id: 'b', text: 'Repeated ñ😀' }] } };
test('native arrangement handlers append once, move, remove/reset, and gate disabled actions', () => {
  let value = [], calls = 0;
  const controls = disabled => nodes(ArrangementQuestion({ item: arrangementItem, value, disabled, onChange(next) { value = next; calls++; } }), e => typeof e.props?.label === 'string');
  const press = (label, disabled = false) => { const node = controls(disabled).find(row => row.props.label === label); assert(node, label); node.props.onPress(); };
  press('Append unit 2: Repeated ñ😀'); press('Append unit 2: Repeated ñ😀'); assert.equal(calls, 1);
  press('Append unit 1: Repeated ñ😀'); assert.deepEqual(value, ['b', 'a']);
  press('Move position 2 earlier'); assert.deepEqual(value, ['a', 'b']);
  press('Remove position 1 from sequence', true); assert.deepEqual(value, ['a', 'b']);
  press('Remove position 1 from sequence'); assert.deepEqual(value, ['b']);
  press('Reset sequence'); assert.deepEqual(value, []);
});
test('native arrangement labels/readiness distinguish repeated text and state transitions hide prior data', () => {
  const html = render(ArrangementQuestion, { item: { ...arrangementItem, answer_key: 'PRIVATE' }, value: ['b', 'a'], disabled: true, onChange() {} });
  assert(html.includes('Ready; not submitted or scored.') && html.includes('Unit 2: Repeated') && html.includes('disabled'));
  assert(!html.includes('PRIVATE'));
  for (const extra of [{ phase: 'loading' }, { phase: 'error', onRetry() {} }, { item: null }, { active: false }])
    assert(!render(UnscoredArrangementPreview, { item: arrangementItem, ...extra }).includes('Synthetic prompt'));
  assert.notEqual(UnscoredArrangementPreview({ item: arrangementItem, resetKey: 1 }).key, UnscoredArrangementPreview({ item: arrangementItem, resetKey: 2 }).key);
  assert(render(UnscoredArrangementPreview, { item: arrangementItem, phase: 'error', onRetry() {} }).includes('Retry preview'));
});
test('browser sequence controls support keyboard buttons and escaped public preview without private order', () => {
  let order = [];
  const controls = () => nodes(SequenceControls({ items: arrangementItem.content.items, order, onChange(next) { order = next; } }), e => !!e.props?.onClick);
  controls().find(row => row.props['aria-label']?.startsWith('Append unit 2')).props.onClick(); assert.deepEqual(order, ['b']);
  controls().find(row => row.props['aria-label']?.startsWith('Append unit 1')).props.onClick(); assert.deepEqual(order, ['b', 'a']);
  controls().find(row => row.props['aria-label'] === 'Move sequence position 2 earlier').props.onClick(); assert.deepEqual(order, ['a', 'b']);
  const html = render(ArrangementPreview, { definition: { ...arrangementItem, prompt: '<script>fixture</script>', answer_key: { ordered_ids: ['b','a'] }, explanation: 'PRIVATE' } });
  assert(html.includes('&lt;script&gt;') && !html.includes('<script>') && !html.includes('PRIVATE') && !html.includes('ordered_ids'));
  assert(html.includes('Sequence unfinished') && html.includes('Append unit 2'));
});
test('arrangement editor separates unit order from required private permutation and reports missing IDs', () => {
  for (const method of ['word_arrangement', 'sentence_arrangement']) {
    const html = render(QuestionEditor, { draft: newDraft(method), errors: { order: 'Every unit required' }, busy: false, mode: 'Create', onChange() {}, onSave() {}, onPreview() {}, onCancel() {} });
    assert(html.includes('Private expected sequence') && html.includes('Every unit required') && html.includes('Add unit'));
    assert(!html.includes('correct-option') && !html.includes('correct-targets'));
  }
});

const { ClassOverview, AssignmentSummary, StudentSummary, MonitoringBrowser } = require('../apps/mobile/src/features/monitoring/MonitoringBrowser.tsx');
const monitorResults={awaiting_evaluation:1,awaiting_manual_review:1,withheld:1,released:1,not_applicable:1};
const monitorAssignment={id:'a',version_id:'v',title:'Synthetic monitored assignment',context:historyFixture.context,published_at:progressFixture.as_of,counts:{available:6,not_started:0,in_progress:1,submitted:5,pending:1},results:monitorResults,mean:{status:'available',eligible_results:1,mean_points:'0.00',max_points:'9.00',engine_version:'v1',policy_version:'p1'}};
test('monitoring summaries label denominators, released means and exclusions without private keys',()=>{
 const html=render(AssignmentSummary,{row:{...monitorAssignment,answer_key:'PRIVATE',mean:{...monitorAssignment.mean}}});
 for(const text of ['5 submitted / 6 current eligible students','Mean released objective points: 0.00 / 9.00','awaiting manual review: 1','withheld: 1','this assignment version only']) assert(html.includes(text),text);
 assert(!html.includes('PRIVATE')&&!html.includes('%'));
 const mixed=render(AssignmentSummary,{row:{...monitorAssignment,mean:{...monitorAssignment.mean,status:'not_comparable',mean_points:'999.00'}}});
 assert(mixed.includes('not comparable')&&!mixed.includes('999.00'));
 const empty=render(StudentSummary,{row:{username:'Synthetic student',counts:{available:0,not_started:0,in_progress:0,submitted:0,pending:0},results:monitorResults}});
 assert(empty.includes('No progress denominator'));
 const overview=render(ClassOverview,{row:{classroom:{class_name:'Synthetic class',grade:5,language:'tagalog'},eligible_students:2,available_assignments:3,counts:monitorAssignment.counts,results:monitorResults,as_of:progressFixture.as_of}});
 assert(overview.includes('2 current eligible students')&&overview.includes('3 available published assignments'));
});
test('monitoring uses roster/assignment scope and instructor history suppresses student attempt action',()=>{
 const html=render(MonitoringBrowser,{api:{},classId:'c'});
 assert(html.includes('Filter by assigned lesson')&&html.includes('Published assignments')&&html.includes('Search student usernames'));
 const detail=render(MonitoringBrowser,{api:{},classId:'c',studentId:'s'});
 assert(detail.includes('Submission filter')&&detail.includes('separately authorized instructor review'));
 assert(!render(HistoryCard,{row:historyFixture,onOpen:null}).includes('View permitted result'));
});
test('picker renders response headers on empty pages but hides them on failures and stale unmount',async()=>{
 const empty={items:[],limit:20,offset:0,has_more:false,summary:'Synthetic header'};
 const props={fetch:async()=>empty,render:()=>null,renderHeader:page=>React.createElement('span',null,page.summary)};
 const host=hookHarness(Picker,props,{effects:true});host.render();await new Promise(done=>setImmediate(done));
 assert(JSON.stringify(host.render()).includes('Synthetic header'));
 const failed=hookHarness(Picker,{...props,fetch:async()=>{throw Error('Offline monitoring');}},{effects:true});failed.render();await new Promise(done=>setImmediate(done));
 assert(!JSON.stringify(failed.render()).includes('Synthetic header')&&JSON.stringify(failed.render()).includes('Offline monitoring'));
 let resolve;const late=hookHarness(Picker,{...props,fetch:()=>new Promise(done=>{resolve=done;})},{effects:true});late.render();await new Promise(done=>setImmediate(done));late.cleanup();resolve(empty);await new Promise(done=>setImmediate(done));
 assert(!JSON.stringify(late.render()).includes('Synthetic header'));
});

const { MessageCard, MessageComposer, MessageHistory, ClassCommunication } = require('../apps/mobile/src/features/communications/CommunicationBrowser.tsx');
const commMessage={id:'m',class_id:'c',kind:'direct',sender:{id:'i',username:'Synthetic Instructor'},recipient_id:'s',content:'<script>literal ñ😀</script>',sent_at:'2026-10-19T00:00:00Z',read:false};
const commContext={classroom:{id:'c',class_name:'Synthetic class'},instructor:{id:'i',username:'Synthetic Instructor'},viewer:{id:'s',username:'Synthetic Student'},peer:{id:'i',username:'Synthetic Instructor'},role:'school_student'};
test('communication renders plain escaped text and only own read state, with approved compose boundaries',()=>{
 const html=render(MessageCard,{row:{...commMessage,answer_key:'PRIVATE',read_by:['PRIVATE']},onOpen(){}});
 assert(html.includes('&lt;script&gt;')&&!html.includes('<script>')&&!html.includes('PRIVATE')&&html.includes('Unread by you'));
 const announcement=render(ClassCommunication,{api:{},context:commContext});
 assert(announcement.includes('do not accept replies')&&!announcement.includes('Write a class announcement'));
 const direct=render(ClassCommunication,{api:{},context:commContext,initialMode:'direct'});
 assert(direct.includes('Write a direct message')&&direct.includes('No peer or personal-learner chat')&&direct.includes('Synthetic Instructor'));
 assert(direct.includes('No attachments')&&direct.includes('manual refresh')&&!direct.includes('Write a class announcement'));
});
test('composer retains text after offline sends, warns on removal, and blocks duplicate presses',async()=>{
 let finish,sends=0;const host=hookHarness(MessageComposer,{api:{send:()=>{sends++;return new Promise(done=>{finish=done;});}},classId:'c',onSent(){}},{effects:true});
 let tree=host.render();nodes(tree,e=>e.props?.accessibilityLabel==='Message body')[0].props.onChangeText(' ñ😀 ');
 tree=host.render();assert(assignmentNavigation.active);
 const button=nodes(tree,e=>e.props?.label==='Send message')[0];button.props.onPress();button.props.onPress();assert.equal(sends,1);
 let repeated=false;assignmentNavigation.callback({repeat(){repeated=true;}});tree=host.render();assert(JSON.stringify(tree).includes('Unsaved text'));
 nodes(tree,e=>e.props?.label==='Keep composing')[0].props.onPress();assert(!repeated);
 finish(commMessage);await new Promise(done=>setImmediate(done));assert(JSON.stringify(host.render()).includes('Message saved on the server'));
 host.cleanup();
});
test('message history reads only after explicit open and freezes its paging anchor',async()=>{
 let reads=0;const seen=[];const api={history:async(c,s,offset,before)=>{seen.push(before);return{items:[commMessage],limit:20,offset,has_more:false,as_of:commMessage.sent_at};},detail:async()=>commMessage,read:async()=>{reads++;return {...commMessage,read:true};}};
 const host=hookHarness(MessageHistory,{api,classId:'c',studentId:'s',refresh:0});
 let picker=nodes(host.render(),e=>e.type===Picker)[0];await picker.props.fetch(0);await picker.props.fetch(20);assert.deepEqual(seen,[undefined,commMessage.sent_at]);assert.equal(reads,0);
 const card=picker.props.render(commMessage);card.props.onOpen();picker=nodes(host.render(),e=>e.type===Picker)[0];const page=await picker.props.fetch(0);assert.equal(reads,1);assert.equal(page.items[0].read,true);
});
