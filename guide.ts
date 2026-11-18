// All guidance is local to the pane. Completion values replace Pi's entire argument prefix.
const presets = [['Critic','Missing info, blast radius, task size'],['Notes','Scratchpad that knows Main'],['Research','Check claims against evidence'],['Historian','Search Main’s history on demand']];
const topics = {
  open: ['Open an agent', '/agent [NAME] [one-sentence job]', 'Choose an agent, then its model. The fast default (Haiku) is highlighted, because agents are quick visual support. /agent Notes --model fast takes it without a picker; --model main uses Main’s model; --model provider/model pins an exact choice. You can also name your own agent. The fork starts here and watches future Main prompts and answers.'],
  work: ['Allow workspace tools', '/agent --work Notes Keep decisions in notes.md', 'Opt in at creation. The agent can use the write, edit and shell tools in the same project, even when Main itself is read-only. Otherwise it only has inspection and messaging tools.'],
  send: ['Send a message', '/agent send TARGET MESSAGE', 'A direct request goes to the named agent. Its answer stays in its pane. Use all to broadcast. From a linked agent, send main queues a note; it never interrupts Main. There, /agent send main #2 sends finding 2 of the latest reply, and ↑ then Enter does the same from the keyboard.'],
  inbox: ['Read pending notes', '/agent inbox', 'Inspect notes without a model call. They join Main’s context on its next user prompt. Inspecting does not consume them.'],
  status: ['Inspect links', '/agent status', 'Opening means the new pane has not connected yet. Watching means its link is active. A stopped or disconnected pane is still an ordinary Pi conversation.'],
  stop: ['Disconnect a link', '/agent stop NAME', 'Disconnect without closing either pane. In an agent, /agent stop disconnects just that agent. A new link requires a fresh fork from Main.'],
};
// --help is the same guide: one flag that works on every command (/split --help, /lab --help, /agent --help).
export const commandAction=(word:string)=>{const a=word.toLowerCase();return a==='--help'||a==='-h'?'help':a;};
const mainTopics=Object.keys(topics), childTopics=['send','status','stop'];
const children=s=>s.roles.filter(r=>r.state==='watching'||r.state==='opening');
const linked=s=>s.state==='watching Main';
const all=s=>[...presets,...(s.projectPresets??[]).filter(([n]:[string,string])=>!presets.some(([p])=>p.toLowerCase()===n.toLowerCase()))];
const fresh=s=>all(s).filter(([n])=>!children(s).some(r=>r.name.toLowerCase()===n.toLowerCase()));
const names=s=>children(s).map(r=>[r.name,`${r.state==='opening'?'Opening':'Linked agent'} · ${r.name}`]);
function choices(prefix,items,head='') {
  const matches=items.filter(([v])=>v.toLowerCase().startsWith(prefix.toLowerCase()));
  // An exact word is already a valid draft. Don't make Enter select it instead of running it.
  if(!matches.length || matches.some(([v])=>v.toLowerCase()===prefix.toLowerCase()))return null;
  return matches.map(([label,description])=>({value:head+label,label,description}));
}
function roots(s){
  const common=[['status','Inspect this pane’s links'],['help','Show commands and examples']];
  if(s.mode==='role')return [...(linked(s)?[['send','Leave a note for Main'],['stop','Disconnect this agent']]:[]),...common];
  return [...fresh(s),['open','Give a named agent one job'],...(children(s).length?[['send','Address one agent or all'],['stop','Disconnect one agent']]:[]),['inbox',`Read pending notes (${s.inbox})`],...common,['--work','Opt in to workspace changes']];
}
export function roleCompletions(raw,s){
  if(/[\r\n]/.test(raw))return null;
  const words=raw.trimStart().split(/\s+/), lead=words.slice(0,-1).map(w=>w.toLowerCase()).join(' '), tail=words.at(-1), head=raw.slice(0,raw.length-tail.length);
  if(!lead)return choices(tail,roots(s),head);
  if(lead==='help')return choices(tail,(s.mode==='role'?childTopics:mainTopics).map(t=>[t,topics[t][0]]),head);
  if(lead==='send')return choices(tail,s.mode==='role'?(linked(s)?[['main','Queue a note without waking Main']]:[]):[...names(s),...(children(s).length?[['all','Broadcast to every linked agent']]:[])],head);
  if(s.mode==='role')return null;
  if(lead==='stop')return choices(tail,names(s),head);
  if(['open','--work','open --work'].includes(lead))return choices(tail,[...fresh(s),...(lead==='open'?[['--work','Allow workspace tools']]:[])],head);
  return null; // Never complete inside a free-form message or job.
}
export function roleHint(draft,s){
  const cmd=draft.match(/^\/(?:agent|role)(?=\s|$)/);if(!cmd)return null;
  const raw=draft.slice(cmd[0].length).trimStart(), [first='', second='']=raw.trimEnd().split(/\s+/), a=first.toLowerCase(), child=s.mode==='role', rows=children(s);
  if(!a)return child?['/agent help',linked(s)?'Send a note: /agent send main <message>':'Disconnected · chat here, or open a new agent from Main.']:['/agent [name] [job]', 'Default: Critic · choose an agent, then its model · Esc dismisses'];
  if(a==='help')return ['/agent help [topic]','Space for topics; Enter shows the guide.'];
  if(a==='send'){
    if(child&&!linked(s))return ['/agent status','Disconnected: no note can be sent.'];
    if(!child&&!rows.length)return ['/agent Critic','No linked agents yet. Open one before sending.'];
    const targets=child?['main']:[...rows.map(r=>r.name),'all'];const found=targets.find(t=>t.toLowerCase()===second.toLowerCase());
    return found?[`/agent send ${found} <message>`,child?'Queues a note; Main keeps working.':found==='all'?'Broadcast to every linked agent.':'Only this agent receives your message.']: [child?'/agent send main <message>':'/agent send <role | all> <message>',child?'Tab: main · Queues a note for Main.':`Tab: ${targets.join(', ')} · Choose a recipient.`];
  }
  if(a==='stop')return child?['/agent stop','Disconnect here; keep both panes.']:['/agent stop <linked agent>',rows.length?'Disconnect the link, not the pane.':'No active links to stop.'];
  if(a==='status'||(!child&&a==='inbox'))return [`/agent ${a}`,topics[a][0]+'. No model call.'];
  const match=roleCompletions(raw,s)?.[0];if(match && !/\s$/.test(raw))return [`/agent ${match.value}`,match.description+' · Tab to complete.'];
  if(child)return ['/agent help',linked(s)?'Send to main, inspect status, or stop the link.':'Not linked. Use /agent status.'];
  const work=/^(?:open\s+)?--work(?:\s|$)/i.test(raw);
  return [work?'/agent --work <name> [job]':'/agent <name> [one-sentence job]',work?'May edit files or run commands in this project.':'Opens beside Main; inspection tools only.'];
}
export function roleHelp(s,raw=''){
  const t=raw.trim().toLowerCase(),child=s.mode==='role';
  if(t){if(!Object.hasOwn(topics,t))return `Unknown help topic. Try /agent help ${child?'send':'open'}.`;
    if(child&&t==='send')return `/agent send main <message>\nExample: /agent send main Check the cancellation policy.\n/agent send main #2 sends finding 2 of the latest reply (#1,3 sends two). ↑ then Enter does the same.\n${linked(s)?'Main reads it on its next prompt. Your usual replies stay here.':'This agent is disconnected; open a new one from Main to send notes.'}`;
    if(child&&t==='stop')return '/agent stop\nDisconnect this agent. Its conversation stays open.';
    const [,usage,details]=topics[t];return `${usage}\n${details}${t==='send'?'\nExample: /agent send '+(children(s)[0]?.name||'Critic')+' What should I double-check?':''}`;}
  const list=child?[...(linked(s)?['↑ then Enter  ·  Send one numbered finding to Main','/agent send main #2  ·  Send finding 2 of the latest reply','/agent send main <message>  ·  Leave a note','/agent stop  ·  Disconnect this agent']:['No live link to Main. Open a fresh agent there to reconnect.']),'/agent status  ·  Check this link']:['/agent  ·  Open a Critic beside Main','/agent Notes  ·  Track decisions','/agent Research  ·  Check evidence','/historian QUESTION  ·  Answer here using Main’s history','/agent Historian  ·  Open a private history desk','/agent <name> [job]  ·  Give an agent your own job','/agent <name>  ·  Open a saved agent: the Job section of agents/<name>/agent.md','/agent --work <name> [job]  ·  Allow workspace changes','/agent send <name | all> <message>  ·  Address linked agents','/agent inbox  ·  Read pending notes','/agent status  ·  Inspect links','/agent stop <name>  ·  Disconnect, keep the pane'];
  return [...list,'','Choose an agent, then its model. Tab prepares a draft; Enter confirms. /agent Critic --model main skips the picker.','/agent help send  ·  Messaging examples'].join('\n');
}
