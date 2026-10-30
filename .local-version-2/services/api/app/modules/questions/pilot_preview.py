"""Loopback-only educator review of the content pack, independent of learner APIs."""
import argparse
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from app.modules.questions.pilot_content import LESSONS, definitions

HTML = r'''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Fluentt · Pilot lesson review</title><style>
*{box-sizing:border-box}body{margin:0;background:#FAFBF7;color:#173E3B;font:17px/1.6 system-ui,sans-serif}main{max-width:500px;margin:auto;padding:22px 18px 60px}header{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:28px}header strong{font-size:27px;letter-spacing:-1px}.caption{font-size:14px;color:#63766D}h1{font-size:30px;line-height:1.2;letter-spacing:-1px}h2{font-size:21px;line-height:1.3}.card{background:white;border:1px solid #E4EBE5;border-radius:22px;padding:22px;margin:16px 0}.hero{background:#E8F2DC}button,a{font:inherit}button{cursor:pointer;border:1px solid #E4EBE5;border-radius:15px;padding:13px 17px;color:#173E3B;background:white;min-height:48px}button:focus-visible,a:focus-visible{outline:3px solid #176556;outline-offset:3px}button:disabled{opacity:.5;cursor:default}.primary{background:#C64A2C;color:white;border-color:#C64A2C;width:100%;font-weight:650}.secondary{width:100%;margin-top:10px}.option{display:block;width:100%;text-align:left;margin:10px 0}.selected{background:#E8F2DC;border-color:#176556}.tiles{display:flex;flex-wrap:wrap;gap:8px}.answer{min-height:70px;border:1px dashed #176556;border-radius:15px;padding:12px;margin:16px 0}.success{color:#176556}.error{color:#A83A24}progress{width:100%;accent-color:#176556;height:10px}a{color:#176556}#feedback{min-height:32px}.row{display:flex;gap:10px;flex-wrap:wrap}.row button{flex:1}small{display:block}p{overflow-wrap:anywhere}</style>
<main><header><button id="back" aria-label="Back to lesson list">‹</button><strong>fluentt</strong><span class="caption">Lesson review</span></header>
<div id="root"></div></main><script>
const lessons=__LESSONS__;let lesson=null,position=-1,answer=null,revealed=false,checked=false;
const root=document.getElementById('root');
function el(tag,text,cls){const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(cls)node.className=cls;return node}
function button(text,fn,cls){const node=el('button',text,cls);node.onclick=fn;return node}
function move(index){position=index;answer=null;revealed=false;checked=false;render();window.scrollTo(0,0)}
document.getElementById('back').onclick=()=>{lesson=null;move(-1)};
function render(){root.replaceChildren();
 if(!lesson){root.append(el('h1','Let’s practice!'),el('p','Three English lessons ready for educator review.','caption'));
 lessons.forEach(row=>{const card=el('section',undefined,'card');card.append(el('h2',row.title),el('p',row.topic,'caption'),el('p',row.items.length+' activities · English'),button('Review lesson',()=>{lesson=row;move(-1)},'primary'));root.append(card)});
 root.append(el('p','Draft review only. Answers and completion are not saved.','caption'));return}
 root.append(el('p',lesson.topic,'caption'),el('h1',lesson.title));
 if(position===-1){const card=el('section',undefined,'card hero');card.append(el('h2','Before you start'),el('p',lesson.introduction),button('Start lesson',()=>move(0),'primary'));root.append(card);
 const source=el('a','View source video');source.href=lesson.source_url;source.target='_blank';source.rel='noopener noreferrer';root.append(source,el('p','Original activities based on the supplied topic summary. Video transcript verification is pending. Video audio is excluded.','caption'));return}
 if(position>=lesson.items.length){root.append(el('h2','Nice practice!'),el('p','You finished this lesson review.'),button('Practice again',()=>move(-1),'primary'),button('Choose another lesson',()=>{lesson=null;move(-1)},'secondary'));return}
 const item=lesson.items[position];root.append(el('p','Question '+(position+1)+' of '+lesson.items.length,'caption'));const progress=el('progress');progress.max=lesson.items.length;progress.value=position+1;root.append(progress);
 const tip=el('details',undefined,'card');tip.append(el('summary','Lesson tip'),el('p',lesson.introduction));root.append(tip);
 const card=el('section',undefined,'card');card.append(el('h2',item.prompt));if(item.instructions)card.append(el('p',item.instructions,'caption'));
 if(item.method==='multiple_choice'){const group=el('div');group.setAttribute('role','radiogroup');group.setAttribute('aria-label','Choose an answer');item.content.options.forEach(option=>{const node=button(option.text,()=>{answer=option.id;checked=false;render()},'option'+(answer===option.id?' selected':''));node.setAttribute('role','radio');node.setAttribute('aria-checked',String(answer===option.id));group.append(node)});card.append(group)}
 if(item.method==='word_arrangement'){if(!answer)answer=[];const area=el('div',undefined,'tiles answer');area.setAttribute('aria-label','Your sentence');answer.forEach(id=>{const token=item.content.items.find(x=>x.id===id);area.append(button(token.text,()=>{answer=answer.filter(x=>x!==id);checked=false;render()}))});card.append(area);const bank=el('div',undefined,'tiles');item.content.items.filter(x=>!answer.includes(x.id)).forEach(token=>bank.append(button(token.text,()=>{answer.push(token.id);checked=false;render()})));card.append(bank,button('Clear sentence',()=>{answer=[];checked=false;render()},'secondary'))}
 if(item.method==='flashcards'){card.append(el('h2',item.content.cue));if(revealed)card.append(el('p',item.answer_key.back));else card.append(button('Reveal card',()=>{revealed=true;render()},'primary'))}
 if(item.method!=='flashcards'){const check=button('Check answer',()=>{checked=true;render()},'primary');check.disabled=item.method==='multiple_choice'?!answer:answer.length!==item.content.items.length;card.append(check);const feedback=el('p');feedback.id='feedback';feedback.setAttribute('aria-live','polite');if(checked){const correct=item.method==='multiple_choice'?answer===item.answer_key.correct_option_id:JSON.stringify(answer)===JSON.stringify(item.answer_key.ordered_ids);feedback.textContent=correct?'You got it! '+item.explanation:'Not quite. Read the lesson tip and try again.';feedback.className=correct?'success':'error'}card.append(feedback)}
 root.append(card);const nav=el('div',undefined,'row');const previous=button('Previous',()=>move(position-1));previous.disabled=position===0;nav.append(previous,button(position===lesson.items.length-1?'Finish lesson':'Next',()=>move(position+1)));root.append(nav)
}render();</script></html>'''


def page():
    # Review page is deliberately separate from learner delivery; it contains author keys.
    rows = [{**lesson, "items": [item.model_dump(mode="json") for item in definitions(lesson)]} for lesson in LESSONS]
    return HTML.replace("__LESSONS__", json.dumps(rows, ensure_ascii=False).replace("<", "\\u003c")).encode()


def main():
    parser = argparse.ArgumentParser(description="Open the local educator review server (no database writes).")
    parser.add_argument("--port", type=int, default=8084)
    args = parser.parse_args()
    content = page()

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            if self.path not in {"/", "/favicon.ico"}:
                self.send_error(404); return
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Frame-Options", "DENY")
            self.end_headers()
            self.wfile.write(content)

        def log_message(self, *_):
            pass

    print(f"Educator draft review: http://localhost:{args.port}", flush=True)
    ThreadingHTTPServer(("127.0.0.1", args.port), Handler).serve_forever()


if __name__ == "__main__":
    main()
