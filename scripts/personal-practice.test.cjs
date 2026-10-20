// Actual practice screen handlers, API validation, and focus/session cleanup.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const mobile = path.resolve(__dirname, '../apps/mobile');
const local = Module.createRequire(path.join(mobile, 'package.json'));
const React = local('react');
const babel = local('@babel/core');
const original = Module._load;
let session;
const routes=[];
const utterances=[];
let voices=[{identifier:'en-test',language:'en-US'},{identifier:'tl-test',language:'fil-PH'}];
let speechStops=0;
const speechMock={async stop(){speechStops++;},async getAvailableVoicesAsync(){return voices;},speak(text,options){utterances.push({text,...options});options.onDone?.();}};
Module._load = function(name, parent, main) {
  if (name === 'react-native') return local('react-native-web');
  if (name === 'expo-speech') return speechMock;
  if (name === 'react-native-safe-area-context') return {SafeAreaView: local('react-native-web').View};
  if (name === 'expo-router') return {useFocusEffect: effect => React.useEffect(effect, [effect]), Redirect:()=>null, router: {push(){},replace:path=>routes.push(path),canGoBack(){return true;},back(){}}};
  if (name.endsWith('/session/provider')) return {useSession: () => session};
  return original.call(this,name,parent,main);
};
for (const ext of ['.ts','.tsx']) Module._extensions[ext] = function(module, filename) {
  module._compile(babel.transformSync(fs.readFileSync(filename,'utf8'), {filename,babelrc:false,configFile:false,plugins:[
    [local.resolve('@babel/plugin-transform-typescript'),{isTSX:ext === '.tsx',allExtensions:true}],
    [local.resolve('@babel/plugin-transform-react-jsx'),{runtime:'automatic'}],local.resolve('@babel/plugin-transform-modules-commonjs')]}).code,filename);
};
const Screen = local(path.join(mobile,'src/app/question-practice.tsx')).default;
const {createDemoPracticeApi} = local(path.join(mobile,'src/demo/personalPractice.ts'));
const {validatePracticeQuestion,validatePracticeLesson} = local(path.join(mobile,'src/services/api/practice.ts'));
const {routeAllowed} = local(path.join(mobile,'src/session/routing.ts'));
const {conversationLevel} = local(path.join(mobile,'src/features/conversation/levels.ts'));
const {CaptureQuestion} = local(path.join(mobile,'src/features/assignments/CaptureQuestion.tsx'));
const {FlashcardQuestion} = local(path.join(mobile,'src/features/questions/FlashcardQuestion.tsx'));
const Experience = local(path.join(mobile,'src/app/experience.tsx')).default;
const {startingDifficulty} = local(path.join(mobile,'src/services/api/identity.ts'));
const {BeginnerPractice,StarterExerciseView} = local(path.join(mobile,'src/features/learning/BeginnerPractice.tsx'));
const {starterLessons,starterMatches,starterReady,exercisesFor} = local(path.join(mobile,'src/features/learning/beginnerLessons.ts'));
const {voiceMatches} = local(path.join(mobile,'src/features/learning/useLessonSpeech.ts'));
const {SentenceCards,DraggableWordCard,placeSentenceCard,sentenceDropIndex} = local(path.join(mobile,'src/features/learning/SentenceCards.tsx'));
const {renderToStaticMarkup} = local('react-dom/server');
const next = () => new Promise(resolve => setImmediate(resolve));
function nodes(element, predicate) {
  if (!element || typeof element !== 'object') return [];
  return [...(predicate(element)?[element]:[]),...React.Children.toArray(element.props?.children).flatMap(child=>nodes(child,predicate))];
}
function harness(Component=Screen) {
  const slots=[],effects=[];let cursor;
  return {render() {
    cursor=0;const queue=[];
    const saved={useState:React.useState,useRef:React.useRef,useEffect:React.useEffect,useCallback:React.useCallback};
    React.useState=init=>{const i=cursor++;if(!(i in slots))slots[i]=typeof init==='function'?init():init;return[slots[i],v=>{slots[i]=typeof v==='function'?v(slots[i]):v;}];};
    React.useRef=init=>{const i=cursor++;return slots[i]??(slots[i]={current:init});};
    React.useCallback=(fn,deps)=>{const i=cursor++,prior=slots[i];if(!prior||deps.some((v,j)=>!Object.is(v,prior.deps[j])))slots[i]={deps,fn};return slots[i].fn;};
    React.useEffect=(fn,deps)=>{const i=cursor++,prior=effects[i];if(!prior||deps.some((v,j)=>!Object.is(v,prior.deps[j])))queue.push(()=>{prior?.cleanup?.();effects[i]={deps,cleanup:fn()};});};
    try {const tree=Component();queue.forEach(fn=>fn());return tree;}finally{Object.assign(React,saved);}
  },blur(){effects.forEach(effect=>effect?.cleanup?.());}};
}
const press=(h,label)=>{const node=nodes(h.render(),n=>n.props?.label===label)[0];assert.ok(node,label);node.props.onPress();};
function setup(practice=createDemoPracticeApi()) {session={profile:{id:'synthetic',role:'personal_student',language:'tagalog',experience:'some_words',learning_focus:{topics:['Vocabulary'],lessons:[]}},practice,isDemo:true};return harness();}
test('personal navigation permits only the personal practice role and cleans legacy grade labels',()=>{
  const h=setup();
  assert.equal(routeAllowed(session.profile,'question-practice'),true);
  for(const role of ['instructor','school_student'])assert.equal(routeAllowed({...session.profile,role},'question-practice'),false);
  assert.equal(routeAllowed(null,'question-practice'),false);
  assert.equal(conversationLevel('Grade 7 (Panimula)'),'Beginner');
  assert.equal(conversationLevel('Grade 8'),'All levels');h.blur();
});
test('topic/difficulty catalog and all ten sample question formats validate',async()=>{
  const api=createDemoPracticeApi(),catalog=await api.lessons();
  const methods=new Set();
  for(const row of catalog.items){validatePracticeLesson(row);for(const item of (await api.questions(row.id)).items){
    validatePracticeQuestion(item);methods.add(item.definition.method);
    const html=renderToStaticMarkup(React.createElement(CaptureQuestion,{item,practice:true,answer:undefined,back:null,disabled:false,onChange(){},onReveal(){}}));
    assert.ok(!html.includes('could not be verified'),item.definition.method);
  }}
  assert.equal(methods.size,10);
  assert.equal((await api.lessons('', 'hard')).items.length,1);
  const row=(await api.questions(catalog.items[0].id)).items[0];
  assert.throws(()=>validatePracticeQuestion({...row,definition:{...row.definition,answer_key:{secret:true}}}));
  assert.throws(()=>validatePracticeLesson({...catalog.items[0],grade:7}));
});
test('answer/previous/next/finish work and another lesson clears local answers',async()=>{
  const h=setup();h.render();await next();press(h,'All difficulties');h.render();await next();press(h,'Practise Everyday words');h.render();await next();
  let question=nodes(h.render(),n=>n.props?.practice===true)[0];assert.ok(question);question.props.onChange({selected_option_id:'opt-1'});
  press(h,'Next question');press(h,'Previous question');
  question=nodes(h.render(),n=>n.props?.practice===true)[0];assert.deepEqual(question.props.answer,{selected_option_id:'opt-1'});
  press(h,'Next question');press(h,'Next question');press(h,'Next question');
  question=nodes(h.render(),n=>n.props?.practice===true)[0];assert.equal(question.props.item.definition.method,'flashcards');
  question.props.onReveal();await next();assert.ok(nodes(h.render(),n=>n.props?.practice===true)[0].props.back);
  press(h,'Finish practice');assert.ok(nodes(h.render(),n=>n.props?.label==='Choose another lesson').length);
  press(h,'Choose another lesson');h.render();await next();press(h,'Practise Everyday words');h.render();await next();
  assert.equal(nodes(h.render(),n=>n.props?.practice===true)[0].props.answer,undefined);h.blur();
});
test('late protected responses after blur are discarded',async()=>{
  let resolve;const h=setup({lessons:()=>new Promise(done=>{resolve=done;})});session.profile.experience='simple_conversations';h.render();h.blur();
  resolve({items:[{id:'late',title:'Stale secret lesson',topic:'Old',difficulties:['easy']}],has_more:false,offset:0});await next();
  assert.equal(nodes(h.render(),n=>n.props?.label==='Practise Stale secret lesson').length,0);
});
test('reference-style personal recall allows one local rating without a score or schedule',()=>{
  const front={id:'synthetic-card',lesson_id:'synthetic-lesson',method:'flashcards',prompt:'Sample word',instructions:null,cue:'Marikit'};
  const back={revision_id:front.id,back:'A synthetic meaning'};
  let value={revealed:true,recall:null};
  const render=()=>FlashcardQuestion({front,back,value,practice:true,onChange:next=>{value=next;}});
  nodes(render(),node=>node.props?.label==='Good')[0].props.onPress();
  assert.equal(value.recall,'good');
  for(const label of ['Again','Hard','Good','Easy'])assert.equal(nodes(render(),node=>node.props?.label===label)[0].props.disabled,true);
  const html=renderToStaticMarkup(React.createElement(FlashcardQuestion,{front,back,value,practice:true,onChange(){}}));
  assert.ok(html.includes('Nothing is scheduled or saved'));
  assert.ok(!html.includes('Use Save progress'));
});
test('Easy starts with listening and sentence activities without a question-bank request',async()=>{
  let calls=0;const h=setup({lessons:async()=>{calls++;throw new Error('should not load');}});
  h.render();await next();assert.equal(calls,0);
  assert.equal(nodes(h.render(),n=>n.type===BeginnerPractice).length,1);h.blur();
});
test('Listen & Choose has ten progressive exercises per language and finishes after the tenth',()=>{
  for(const language of ['english','tagalog']){
    const items=exercisesFor(language,'word');
    assert.equal(items.length,10);
    assert.equal(new Set(items.map(item=>item.id)).size,10);
    assert.deepEqual(items.map(item=>item.spoken.split(' ').length),[1,1,1,1,2,2,2,3,3,3]);
    for(const item of items){
      assert.equal(item.options.filter(option=>option.text===item.spoken).length,1);
      assert.equal(item.options.find(option=>option.id===item.target).text,item.spoken);
      assert.equal(new Set(item.options.map(option=>option.text)).size,item.options.length);
      assert.ok(item.options.every(option=>option.text.split(' ').length===item.spoken.split(' ').length));
    }
    const h=harness(()=>BeginnerPractice({language}));
    press(h,'Start listening practice');
    for(let index=0;index<10;index++){
      const player=nodes(h.render(),node=>node.type===StarterExerciseView)[0];
      assert.equal(player.props.item.id,items[index].id);
      assert.equal(player.props.last,index===9);player.props.onNext();
    }
    assert.ok(nodes(h.render(),node=>node.props?.label==='Choose another activity').length);h.blur();
  }
});
test('starter word playback, slow replay, retry, correct feedback, and speech cleanup work',async()=>{
  const item=exercisesFor('english','word')[0];let nextCalls=0;utterances.length=0;
  const h=harness(()=>StarterExerciseView({item,language:'english',last:true,onNext(){nextCalls++;}}));
  assert.equal(nodes(h.render(),n=>n.props?.label==='Check answer')[0].props.disabled,true);
  press(h,'Play word');await next();assert.equal(utterances[0].text,'hello');assert.equal(utterances[0].voice,'en-test');
  press(h,'Play slowly');await next();assert.equal(utterances[1].rate,0.65);
  nodes(h.render(),n=>n.props?.accessibilityLabel==='water')[0].props.onPress();press(h,'Check answer');
  assert.ok(nodes(h.render(),n=>String(n.props?.children).includes('Not quite.')).length);
  nodes(h.render(),n=>n.props?.accessibilityLabel==='hello')[0].props.onPress();press(h,'Check answer');
  press(h,'Finish activity');assert.equal(nextCalls,1);const before=speechStops;h.blur();assert.ok(speechStops>before);
});
test('sentence tiles retain authored jumble, can be cleared, and match exact authored order',async()=>{
  const item=exercisesFor('tagalog','sentence')[0];utterances.length=0;
  assert.notDeepEqual(item.tokens.map(t=>t.id),item.orderedIds);
  const h=harness(()=>StarterExerciseView({item,language:'tagalog',last:false,onNext(){}}));
  const cards=harness(()=>SentenceCards(nodes(h.render(),node=>node.type===SentenceCards)[0].props));
  const add=id=>nodes(cards.render(),node=>node.type===DraggableWordCard&&node.props.label===`Add word: ${item.tokens.find(token=>token.id===id).text}`)[0].props.onTap();
  press(h,'Play sentence');await next();assert.equal(utterances[0].voice,'tl-test');assert.equal(utterances[0].text,item.spoken);
  for(const id of item.orderedIds)add(id);
  press(cards,'Clear sentence');assert.equal(nodes(h.render(),n=>n.props?.label==='Check answer')[0].props.disabled,true);
  for(const id of item.orderedIds)add(id);
  press(h,'Check answer');assert.ok(nodes(h.render(),n=>n.props?.label==='Next exercise').length);h.blur();
  for(const language of ['english','tagalog'])for(const row of starterLessons[language]){
    const correct=row.kind==='word'?[row.target]:row.orderedIds;
    assert.equal(starterReady(row,correct),true);assert.equal(starterMatches(row,correct),true);
    assert.equal(starterMatches(row,[]),false);
  }
});
test('sentence library adds ten per language, with unused distractors and exact duplicate-word identities',()=>{
  for(const language of ['english','tagalog']){
    const items=exercisesFor(language,'sentence');assert.equal(items.length,13);
    assert.equal(new Set(items.map(item=>item.id)).size,13);
    for(const item of items){
      assert.ok(item.tokens.every(token=>typeof token.text==='string'&&token.text.length));
      assert.equal(new Set(item.tokens.map(token=>token.id)).size,item.tokens.length);
      assert.notDeepEqual(item.tokens.map(token=>token.id).slice(0,item.orderedIds.length),item.orderedIds);
      assert.equal(item.orderedIds.map(id=>item.tokens.find(token=>token.id===id).text).join(' '),item.spoken);
      assert.equal(starterMatches(item,item.orderedIds),true);
    }
    for(const item of items.slice(3)){
      assert.equal(item.tokens.length,item.orderedIds.length+1);
      const extra=item.tokens.find(token=>!item.orderedIds.includes(token.id)).id;
      const wrong=[extra,...item.orderedIds.slice(1)];
      assert.equal(starterReady(item,wrong),true);assert.equal(starterMatches(item,wrong),false);
      assert.equal(starterReady(item,item.tokens.map(token=>token.id)),false);
    }
    const h=harness(()=>BeginnerPractice({language}));press(h,'Start sentence practice');
    for(let index=0;index<13;index++){
      const player=nodes(h.render(),node=>node.type===StarterExerciseView)[0];
      assert.equal(player.props.item.id,items[index].id);assert.equal(player.props.last,index===12);player.props.onNext();
    }
    assert.ok(nodes(h.render(),node=>node.props?.label==='Choose another activity').length);h.blur();
  }
});
test('sentence drag/drop inserts, reorders, removes, cancels outside drops and respects capacity',()=>{
  const item=exercisesFor('english','sentence')[3];let answer=[];
  const h=harness(()=>SentenceCards({item,answer,locked:false,onChange:value=>{answer=value;}}));
  const measured=rect=>({measureInWindow(callback){callback(rect.x,rect.y,rect.width,rect.height);}});
  function prepare(id){
    const tree=h.render();
    nodes(tree,node=>node.props?.accessibilityLabel==='Sentence drop area')[0].props.ref.current=measured({x:0,y:0,width:300,height:120});
    nodes(tree,node=>node.props?.accessibilityLabel==='Word card bank')[0].props.ref.current=measured({x:0,y:200,width:300,height:100});
    nodes(tree,node=>typeof node.props?.ref==='function').forEach(node=>{
      const child=nodes(node,value=>value.type===DraggableWordCard)[0];
      if(child?.props.label.startsWith('Sentence word'))node.props.ref(measured({x:(Number(child.props.label.match(/Sentence word (\d+)/)[1])-1)*60,y:20,width:50,height:46}));
    });
    return nodes(tree,node=>node.type===DraggableWordCard&&node.props.text===item.tokens.find(token=>token.id===id).text)[0];
  }
  const first=item.orderedIds[0],second=item.orderedIds[1];
  let card=prepare(first);card.props.onLift();card.props.onDrop(100,50);assert.deepEqual(answer,[first]);
  card=prepare(second);card.props.onLift();card.props.onDrop(290,50);assert.deepEqual(answer,[first,second]);
  card=prepare(second);card.props.onLift();card.props.onDrop(0,10);assert.deepEqual(answer,[second,first]);
  card=prepare(second);card.props.onLift();card.props.onDrop(400,400);assert.deepEqual(answer,[second,first]);
  card=prepare(second);card.props.onLift();card.props.onDrop(100,250);assert.deepEqual(answer,[first]);
  assert.deepEqual(placeSentenceCard([first,second],first,1,2),[second,first]);
  assert.deepEqual(placeSentenceCard([first,second],'extra',0,2),[first,second]);
  const rows=[{x:0,y:0,width:50,height:40},{x:60,y:0,width:50,height:40},{x:0,y:50,width:50,height:40}];
  assert.equal(sentenceDropIndex(rows,30,55),3);assert.equal(sentenceDropIndex(rows,5,55),2);
  h.blur();
});
test('a missing Tagalog voice stays explicit and transcript reading remains available',async()=>{
  const previous=voices;voices=[{identifier:'en-test',language:'en-US'}];utterances.length=0;
  const h=harness(()=>StarterExerciseView({item:exercisesFor('tagalog','word')[0],language:'tagalog',last:true,onNext(){}}));
  press(h,'Play word');await next();assert.equal(utterances.length,0);
  assert.ok(nodes(h.render(),n=>String(n.props?.message).includes('No Tagalog voice')).length);
  press(h,'Show transcript');assert.ok(nodes(h.render(),n=>n.props?.children==='kumusta').length);
  assert.equal(voiceMatches('tagalog','tl_PH'),true);assert.equal(voiceMatches('tagalog','en-PH'),false);h.blur();voices=previous;
});
test('language is followed by experience, with explicit editable starting difficulty',async()=>{
  setup();session.profile.language=null;session.profile.experience=null;
  const {destination}=local(path.join(mobile,'src/session/routing.ts'));
  assert.equal(destination(session.profile),'/language');
  session.profile.language='english';assert.equal(destination(session.profile),'/experience');
  assert.deepEqual(['starting_fresh','some_words','simple_conversations','comfortable'].map(startingDifficulty),['easy','easy','medium','hard']);
  let saved;session.save=async body=>{saved=body;session.profile.experience=body.experience;};routes.length=0;
  const h=harness(Experience);assert.equal(nodes(h.render(),n=>n.props?.label==='Start learning')[0].props.disabled,true);
  nodes(h.render(),n=>n.props?.accessibilityLabel==='I can have simple conversations')[0].props.onPress();
  press(h,'Start learning');await next();assert.deepEqual(saved,{language:'english',experience:'simple_conversations'});
  assert.equal(destination(session.profile),'/student');assert.deepEqual(routes,['/student']);h.blur();
});
test('experienced English learners start with hard activities and English sample questions',async()=>{
  const h=setup(createDemoPracticeApi('english'));session.profile.language='english';session.profile.experience='comfortable';
  h.render();await next();
  assert.equal(nodes(h.render(),n=>n.props?.label==='Practise Everyday words').length,0);
  press(h,'Practise Reading and meaning');h.render();await next();
  const item=nodes(h.render(),n=>n.props?.practice===true)[0].props.item;
  assert.equal(item.definition.difficulty,'hard');assert.equal(item.definition.prompt,'Select the part that needs correction.');h.blur();
});
