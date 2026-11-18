// Prompts control prose; the UI controls attribution and quote length. Never invent fields or change a model's answer to make it fit.
const formats={
  historian:['Answer','Evidence','Unknown'],critic:['Grade','Missing','Blast radius','Size'],notes:['Decided','Still open','Next action'],research:['Finding','Source','Unknown'],
};
export function template(name){return formats[String(name).toLowerCase()]??['Finding','Basis','Next step'];}
// Support agents are quick visual support for the person talking to Main (John, 2026-11-07): dense, rated,
// glanceable, and every finding numbered so one piece can be sent to Main on its own (/agent send main #2).
const VOCAB={
 critic:'Grade the request in the verdict (🟢 A / 🟡 B / 🟠 C / 🔴 D, then a 3–8 word reason; 🟢 A means Main can finish it without guessing). Items: ❓ missing information Main would have to guess, phrased as the exact question for the person (say what Main assumed); 💥 blast radius: something else the change touches that the person may not expect, such as existing records, other pages or other people, asked as the question of whether it should change too; ✂️ too big for one step: say so and name the first smaller step. Never list what is fine or settled, and never call Main’s choice clear or good. End with one item starting ➡️: the next step for the person.',
 notes:'Verdict: your answer or what you kept, in a few words. Items: 💡 a kept thought, ✅ decided (say who decided), ❓ still open, ⏭️ next action. Never invent an owner or deadline.',
 research:'Verdict: the answer in a few words. Items: 🔎 a finding with its source (URL or file path) and trust ★★★ / ★★☆ / ★☆☆; ❔ what is still unknown.',
 historian:'Verdict: the answer. Items: 📜 evidence with its entry ID and speaker; ❔ what the history does not show.',
};
const JOB={
 critic:'Be adversarial, not agreeable. You have three jobs. 1) Completeness: does the prompt give Main enough to finish the whole task, or will Main have to guess? 2) Blast radius: make sure the person knows what else the change touches. 3) Size: if the task is bigger than one reviewable step, say so and name the first smaller one. Read the actual files with your tools before asserting a problem; never just speculate. Never decide a missing answer yourself, and never praise. When the request is complete, small and its reach is stated, say so in one line.',
 notes:'Record decisions as decisions only when someone actually settles them.',
 research:'Use web search and fetch tools for outside facts, and read local files for project facts, before answering. Separate what you verified from what was merely said; if no source is available, label the gap.',
};
export function responseGuide(name,project){
 const key=String(name).toLowerCase(),job=JOB[key]??'Do your assigned job.';
 const vocab=VOCAB[key]??project?.vocab??'Verdict: your result, led by a status emoji (🟢 / 🟡 / 🔴). Items: one finding each, led by a fitting emoji (✅ ❓ ⚠️ 🔎 ⏭️).';
 return `You are quick visual support for the person working in Main, shown in a narrow pane. They glance at you between prompts, so be dense and scannable, never conversational. ${job}\n`+
  'Format every substantive reply exactly like this:\n- First line: a single # heading that is the verdict, led by a status emoji.\n- Then a numbered Markdown list (1. 2. 3.), one line per item, each starting with its emoji. At most 6 items of about 12 words. Put the decisive words in **bold**.\n- Nothing else: no paragraphs, preamble, recap, tables or sign-off. Each item must stand alone, because the person may send just that item to Main.\n'+
  `${vocab}\nIf there is nothing new, reply with one line: 🟢 Nothing new. Never invent facts or ratings you can't support. Honor an explicitly requested format.`+
  (key==='critic'?'\nShape example about a DIFFERENT problem (use its shape, not its subject):\n\n# 🟠 C · checkout redesign hides three changes\n\n1. ❓ Which **payment methods** must the new checkout keep?\n2. 💥 Should **saved carts** and order emails change too?\n3. ✂️ Too big for one step: start with **the address form** alone\n4. ➡️ Answer 1, then ask Main for the address form only':'');
}
// The numbered items of a reply: the pieces a person can send to Main on their own.
export function items(text){
 const out=[];
 for(const line of String(text).split('\n')){const m=/^\s{0,3}(\d{1,2})[.)]\s+(\S.*)$/.exec(line);if(m)out.push({n:Number(m[1]),text:m[2].trim()});}
 return out;
}
// "#2" or "#1,3" typed in an agent pane names those items of its latest reply, labeled with the agent.
export function pickItems(text,ref,name){
 const m=/^#\s*(\d{1,2}(?:\s*,\s*\d{1,2})*)\s*$/.exec(String(ref).trim());if(!m)return null;
 const list=items(text);if(!list.length)throw Error('The latest reply has no numbered items. Send its words instead.');
 const want=m[1].split(',').map(v=>Number(v.trim())),miss=want.filter(n=>!list.some(i=>i.n===n));
 if(miss.length)throw Error(`No item ${miss.join(', ')} in the latest reply; it has ${list.map(i=>i.n).join(', ')}.`);
 return want.map(n=>`${name} ${n}: ${list.find(i=>i.n===n).text}`).join('\n');
}
export function watchText(text,from){
 let body=text;const skills=[];
 if(from==='user')for(;;){
   const match=/^\s*<skill name="([\w.-]+)"(?: location="[^"\n]+")?\s*>\n[\s\S]*?\n<\/skill>[ \t]*(?:\n|$)/.exec(body);
   if(!match)break;skills.push(match[1]);body=body.slice(match[0].length);
 }
 body=body.trim();
 const suffix=skills.length?'\n[Attached skills: '+skills.join(', ')+']':'';
 const value=((body||'(No accompanying request.)')+suffix).trim();
 return value.length<=4000?value:value.slice(0,1790)+'\n[… middle trimmed …]\n'+value.slice(-2160);
}
// The underlying custom message still carries the whole bounded excerpt; expanding shows it as Markdown.
export function excerpt(content){
 const body=content.slice(content.indexOf('\n')+1),plain=body.replace(/^Main’s (?:prompt|reply):\s*/, '').replace(/\n\[Attached skills: [^\n]+\]$/, '').replace(/\s+/g,' ').trim();
 const origin=/^Main’s reply:/.test(body)?'reply':/^Main’s prompt:/.test(body)?'prompt':null;
 return {body,plain,origin};
}
