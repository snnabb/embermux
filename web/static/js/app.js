/* EmberMux Admin Panel — VisionOS Glass */
(function(){
'use strict';
const TK='embermux_token',TH='embermux_theme';
let cached=[];

// Theme
function initTheme(){const s=localStorage.getItem(TH);document.documentElement.dataset.theme=s||'light'}
function toggleTheme(){const t=document.documentElement.dataset.theme==='dark'?'light':'dark';document.documentElement.dataset.theme=t;localStorage.setItem(TH,t)}

// API
function api(p,o={}){const t=localStorage.getItem(TK);return fetch('/admin/api'+p,{...o,headers:{'Content-Type':'application/json','X-Emby-Token':t||'',...(o.headers||{})}}).then(r=>{if(r.status===401){localStorage.removeItem(TK);showLogin();return null}return r})}
function withLoading(b,fn){return async()=>{if(b.disabled)return;b.disabled=true;b.classList.add('btn-loading');const s=document.createElement('span');s.className='spinner';b.prepend(s);try{await fn()}finally{b.disabled=false;b.classList.remove('btn-loading');if(b.contains(s))s.remove()}}}

// UI
function toast(m,t='info'){const c=document.getElementById('toast-container'),e=document.createElement('div');e.className='toast toast-'+t;e.textContent=m;c.appendChild(e);setTimeout(()=>{e.classList.add('toast-out');setTimeout(()=>e.remove(),200)},3000)}
function openModal(t,bh,fh){document.getElementById('modal-title').textContent=t;document.getElementById('modal-body').innerHTML=bh;document.getElementById('modal-footer').innerHTML=fh||'';document.getElementById('modal-overlay').classList.remove('hidden')}
function closeModal(){document.getElementById('modal-overlay').classList.add('hidden')}
function confirm(m){return new Promise(r=>{openModal('确认操作','<p style="color:var(--text-secondary)">'+esc(m)+'</p>','<button class="btn btn-ghost" id="cn">取消</button><button class="btn btn-danger" id="cy">确认</button>');document.getElementById('cy').onclick=()=>{closeModal();r(true)};document.getElementById('cn').onclick=()=>{closeModal();r(false)}})}
function esc(s){const d=document.createElement('div');d.textContent=s;return d.innerHTML}
function isURL(s){try{const u=new URL(s);return u.protocol==='http:'||u.protocol==='https:'}catch{return false}}

// Validation
function valUp(){const e=[];if(!document.getElementById('uf-name').value.trim())e.push('名称不能为空');const u=document.getElementById('uf-url').value.trim();if(!u)e.push('上游地址不能为空');else if(!isURL(u))e.push('上游地址需以 http(s):// 开头');document.querySelectorAll('.pb-input').forEach((inp,i)=>{const v=inp.value.trim();if(v&&!isURL(v))e.push('播放回源 '+(i+1)+' 格式无效')});if(document.getElementById('uf-authType').value==='password'){if(!document.getElementById('uf-username').value.trim())e.push('用户名不能为空')}else{if(!document.getElementById('uf-apiKey').value.trim())e.push('API Key 不能为空')}return e}
function valPx(){const e=[];if(!document.getElementById('pf-name').value.trim())e.push('名称不能为空');const u=document.getElementById('pf-url').value.trim();if(!u)e.push('代理地址不能为空');else if(!isURL(u)&&!/^socks5?:\/\//i.test(u))e.push('格式无效');return e}
function valSet(){const e=[];if(!document.getElementById('sf-serverName').value.trim())e.push('服务名称不能为空');[['sf-timeout-api','API 超时'],['sf-timeout-global','聚合超时'],['sf-timeout-login','登录超时'],['sf-timeout-healthCheck','健康检查超时'],['sf-timeout-healthInterval','检查间隔']].forEach(([id,l])=>{const v=+document.getElementById(id).value;if(!v||v<=0)e.push(l+' 必须为正整数')});if(document.getElementById('sf-newPassword').value&&!document.getElementById('sf-currentPassword').value)e.push('修改密码需要当前密码');return e}
function showErr(e){if(e.length){toast(e[0],'error');return false}return true}

// Auth
function isLoggedIn(){return!!localStorage.getItem(TK)}
function showLogin(){document.getElementById('login-page').classList.remove('hidden');document.getElementById('app').classList.add('hidden')}
function showApp(){document.getElementById('login-page').classList.add('hidden');document.getElementById('app').classList.remove('hidden')}
async function doLogin(u,p){const r=await fetch('/Users/AuthenticateByName',{method:'POST',headers:{'Content-Type':'application/json','X-Emby-Authorization':'MediaBrowser Client="EmberMux Admin", Device="Browser", DeviceId="admin-panel", Version="1.0"'},body:JSON.stringify({Username:u,Pw:p})});if(!r.ok)throw new Error('认证失败');const d=await r.json();if(!d.AccessToken)throw new Error('未获取到 Token');localStorage.setItem(TK,d.AccessToken)}
async function doLogout(){await api('/logout',{method:'POST'}).catch(()=>{});localStorage.removeItem(TK);showLogin()}

// Labels
const PL={proxy:'代理中转',direct:'直连分流',redirect:'重定向跟随'};
function pLabel(m){return PL[m]||m||'默认'}
function pBadge(m){const c=m==='proxy'?'blue':m==='direct'?'green':m==='redirect'?'yellow':'gray';return'<span class="badge badge-'+c+'">'+esc(pLabel(m))+'</span>'}
const UL={infuse:'Infuse',web:'Web',client:'客户端'};
function uLabel(v){return UL[v]||v||'Infuse'}

// Dashboard
async function loadDash(){const r=await api('/status');if(!r)return;const d=await r.json();
  const mc=(d.idMappings&&typeof d.idMappings==='object')?(d.idMappings.MappingCount||0):(d.idMappings||0);
  document.getElementById('stats-grid').innerHTML=[sc('服务名称',d.serverName,''),sc('监听端口',d.port,'blue'),sc('播放模式',pLabel(d.playbackMode),''),sc('ID 映射',mc,'yellow'),sc('上游总数',d.upstreamCount,'blue'),sc('在线上游',d.upstreamOnline,'green')].join('');
  const sg=document.getElementById('upstream-status-grid');
  if(!d.upstream||!d.upstream.length){sg.innerHTML='<div class="empty-state"><p>暂无上游服务器</p></div>';return}
  sg.innerHTML=d.upstream.map(u=>'<div class="card glass-panel"><div class="card-header"><span class="card-title"><span class="dot '+(u.online?'dot-online':'dot-offline')+'"></span>'+esc(u.name)+'</span>'+pBadge(u.playbackMode)+'</div><div class="card-body"><p>'+esc(u.host)+'</p></div></div>').join('')}
function sc(l,v,c){return'<div class="stat-card glass-panel"><div class="stat-label">'+esc(l)+'</div><div class="stat-value '+c+'">'+esc(String(v))+'</div></div>'}

// Drag
let dragFrom=-1;
const DH='<span class="drag-handle" title="拖拽排序"><svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><path d="M7 2a2 2 0 100 4 2 2 0 000-4zm0 6a2 2 0 100 4 2 2 0 000-4zm0 6a2 2 0 100 4 2 2 0 000-4zm6-12a2 2 0 100 4 2 2 0 000-4zm0 6a2 2 0 100 4 2 2 0 000-4zm0 6a2 2 0 100 4 2 2 0 000-4z"/></svg></span>';
function bindDrag(el){
  el.addEventListener('dragstart',e=>{const c=e.target.closest('.card[data-index]');if(!c)return;dragFrom=+c.dataset.index;c.classList.add('dragging');e.dataTransfer.effectAllowed='move'});
  el.addEventListener('dragover',e=>{e.preventDefault();e.dataTransfer.dropEffect='move';const c=e.target.closest('.card[data-index]');el.querySelectorAll('.drag-over').forEach(x=>x.classList.remove('drag-over'));if(c)c.classList.add('drag-over')});
  el.addEventListener('dragleave',e=>{const c=e.target.closest('.card[data-index]');if(c)c.classList.remove('drag-over')});
  el.addEventListener('drop',e=>{e.preventDefault();el.querySelectorAll('.drag-over,.dragging').forEach(x=>x.classList.remove('drag-over','dragging'));const c=e.target.closest('.card[data-index]');if(!c)return;const to=+c.dataset.index;if(dragFrom>=0&&dragFrom!==to)doReorder(dragFrom,to);dragFrom=-1});
  el.addEventListener('dragend',()=>{el.querySelectorAll('.dragging,.drag-over').forEach(x=>x.classList.remove('dragging','drag-over'));dragFrom=-1})}
async function doReorder(f,t){const r=await api('/upstream/reorder',{method:'POST',body:JSON.stringify({fromIndex:f,toIndex:t})});if(!r||!r.ok){toast('排序失败','error');return}toast('排序已更新','success');loadUp();loadDash()}

// Upstreams
async function loadUp(){const r=await api('/upstream');if(!r)return;const list=await r.json();cached=list||[];const c=document.getElementById('upstream-list');
  if(!list||!list.length){c.innerHTML='<div class="empty-state"><p>暂无上游服务器，点击右上角添加</p></div>';return}
  c.innerHTML=list.map(u=>{const hosts=[u.streamingUrl||'',...(u.streamHosts||[])].filter(Boolean);let pb='';if(hosts.length===1)pb='<p>播放回源：'+esc(hosts[0])+'</p>';else if(hosts.length>1)pb='<p>播放回源：'+hosts.length+' 个地址</p>';
    return'<div class="card glass-panel" data-index="'+u.index+'" draggable="true"><div class="card-header"><span class="card-title">'+DH+'<span class="dot '+(u.online?'dot-online':'dot-offline')+'"></span>'+esc(u.name)+'</span>'+pBadge(u.playbackMode)+'</div><div class="card-body"><p>地址：'+esc(u.url)+'</p><p>认证：'+(u.authType==='apiKey'?'API Key':'用户名/密码')+(u.username?' ('+esc(u.username)+')':'')+'</p>'+pb+'<p>UA 伪装：'+esc(uLabel(u.spoofClient))+'</p><p>浏览库：'+(u.browseEnabled!==false?'开启':'仅播放')+'</p></div><div class="card-footer"><button class="btn btn-ghost btn-sm" onclick="EM.editUp('+u.index+')">编辑</button><button class="btn btn-ghost btn-sm" onclick="EM.reconUp('+u.index+')">重连</button><button class="btn btn-ghost btn-sm" onclick="EM.diag(this,'+u.index+')">诊断</button><button class="btn btn-danger btn-sm" onclick="EM.delUp('+u.index+')">删除</button></div></div>'}).join('')}

// Multi-playback list
function buildPBList(ctn,hosts){
  function render(){ctn.innerHTML=hosts.map((v,i)=>'<div class="pb-row"><input type="text" class="pb-input" value="'+esc(v)+'" placeholder="'+(i===0?'主播放回源地址':'额外播放回源地址')+'" style="width:100%;padding:12px 16px;font-size:15px;font-family:var(--font);font-weight:500;background:var(--bg-input);border:2px solid transparent;border-radius:var(--radius-sm);color:var(--text-primary);outline:none">'+(hosts.length>1?'<button type="button" class="btn btn-danger btn-sm pb-remove" data-i="'+i+'">删除</button>':'')+'</div>').join('');
    ctn.querySelectorAll('.pb-remove').forEach(b=>b.onclick=()=>{hosts.splice(+b.dataset.i,1);if(!hosts.length)hosts.push('');render()});
    ctn.querySelectorAll('.pb-input').forEach((inp,i)=>inp.oninput=()=>{hosts[i]=inp.value})}
  render();return{add(){hosts.push('');render();const ins=ctn.querySelectorAll('.pb-input');if(ins.length)ins[ins.length-1].focus()}}
}

function upForm(data){const d=data||{},isEdit=!!data;
  const modes=[['proxy','代理中转'],['direct','直连分流'],['redirect','重定向跟随']];
  const uas=[['infuse','Infuse'],['web','Web'],['client','客户端']];
  return`<div class="form-group"><label>名称 <span class="required">*</span></label><input id="uf-name" value="${esc(d.name||'')}"></div>
    <div class="form-group"><label>上游地址 <span class="required">*</span></label><input id="uf-url" placeholder="https://emby.example.com" value="${esc(d.url||'')}"></div>
    <div class="form-group"><label>播放回源列表（可选，留空跟随主地址）</label><div id="uf-pb-list"></div><button type="button" class="btn btn-ghost pb-add" id="uf-pb-add">+ 添加播放回源</button><div class="hint">播放、转码或直链资源的独立上游地址。可添加多个，用于多节点场景。留空则所有请求走上游主地址。</div></div>
    <div class="form-group"><label>播放模式</label><select id="uf-playbackMode">${modes.map(m=>'<option value="'+m[0]+'"'+(d.playbackMode===m[0]?' selected':'')+'>'+m[1]+'</option>').join('')}</select></div>
    <div class="form-group"><label>认证方式</label><select id="uf-authType" onchange="EM.togAuth()"><option value="password"${(!d.authType||d.authType==='password')?' selected':''}>用户名/密码</option><option value="apiKey"${d.authType==='apiKey'?' selected':''}>API Key</option></select></div>
    <div id="uf-pw"><div class="form-row"><div class="form-group"><label>用户名 <span class="required">*</span></label><input id="uf-username" value="${esc(d.username||'')}"></div><div class="form-group"><label>密码${isEdit?'':' <span class="required">*</span>'}</label><input type="password" id="uf-password" placeholder="${isEdit?'留空保持不变':''}"></div></div></div>
    <div id="uf-ak" class="hidden"><div class="form-group"><label>API Key <span class="required">*</span></label><input id="uf-apiKey"></div></div>
    <div class="form-group"><label>UA 伪装</label><select id="uf-spoofClient">${uas.map(s=>'<option value="'+s[0]+'"'+((d.spoofClient||'infuse')===s[0]?' selected':'')+'>'+s[1]+'</option>').join('')}</select></div>
    <div class="form-group form-group-inline"><input type="checkbox" id="uf-browseEnabled"${d.browseEnabled!==false?' checked':''}><label for="uf-browseEnabled">参与浏览库</label></div>
    <div class="form-group form-group-inline"><input type="checkbox" id="uf-followRedirects"${d.followRedirects!==false?' checked':''}><label for="uf-followRedirects">跟随重定向</label></div>
    <div class="form-group form-group-inline"><input type="checkbox" id="uf-priorityMeta"${d.priorityMetadata?' checked':''}><label for="uf-priorityMeta">元数据优先</label></div>
    <div class="form-group"><label>代理 ID（可选）</label><input id="uf-proxyId" value="${esc(d.proxyId||'')}"></div>`}

let pbCtrl=null;
function initPB(d){const dd=d||{};let hosts=[];if(dd.streamingUrl)hosts.push(dd.streamingUrl);if(dd.streamHosts&&dd.streamHosts.length)hosts=hosts.concat(dd.streamHosts);if(!hosts.length)hosts=[''];const ctn=document.getElementById('uf-pb-list');pbCtrl=buildPBList(ctn,hosts);document.getElementById('uf-pb-add').onclick=()=>pbCtrl.add()}

function collectUp(){const at=document.getElementById('uf-authType').value;
  const body={name:document.getElementById('uf-name').value,url:document.getElementById('uf-url').value,browseEnabled:document.getElementById('uf-browseEnabled').checked,playbackMode:document.getElementById('uf-playbackMode').value,spoofClient:document.getElementById('uf-spoofClient').value,followRedirects:document.getElementById('uf-followRedirects').checked,priorityMetadata:document.getElementById('uf-priorityMeta').checked,proxyId:document.getElementById('uf-proxyId').value||''};
  const allPB=[];document.querySelectorAll('.pb-input').forEach(inp=>{const v=inp.value.trim();if(v)allPB.push(v)});body.streamingUrl=allPB[0]||'';body.streamHosts=allPB.length>1?allPB.slice(1):[];
  if(at==='password'){body.username=document.getElementById('uf-username').value;const pw=document.getElementById('uf-password').value;if(pw)body.password=pw}else{body.apiKey=document.getElementById('uf-apiKey').value}return body}

function showAddUp(){openModal('添加上游',upForm(),'<button class="btn btn-ghost" onclick="EM.closeModal()">取消</button><button class="btn btn-primary" id="uf-save">保存</button>');EM.togAuth();initPB();const b=document.getElementById('uf-save');b.onclick=withLoading(b,async()=>{if(!showErr(valUp()))return;const r=await api('/upstream',{method:'POST',body:JSON.stringify(collectUp())});if(!r)return;if(!r.ok){const e=await r.json();toast(e.error||'添加失败','error');return}closeModal();toast('上游添加成功','success');loadUp();loadDash()})}

async function editUp(idx){const r=await api('/upstream');if(!r)return;cached=await r.json();const u=cached.find(x=>x.index===idx);if(!u){toast('未找到上游','error');return}openModal('编辑上游',upForm(u),'<button class="btn btn-ghost" onclick="EM.closeModal()">取消</button><button class="btn btn-primary" id="uf-save">保存</button>');EM.togAuth();initPB(u);const b=document.getElementById('uf-save');b.onclick=withLoading(b,async()=>{if(!showErr(valUp()))return;const r=await api('/upstream/'+idx,{method:'PUT',body:JSON.stringify(collectUp())});if(!r)return;if(!r.ok){const e=await r.json();toast(e.error||'保存失败','error');return}closeModal();toast('上游已更新','success');loadUp();loadDash()})}

async function delUp(idx){if(!await confirm('确定删除此上游？此操作不可恢复。'))return;await api('/upstream/'+idx,{method:'DELETE'});toast('上游已删除','success');loadUp();loadDash()}

async function reconUp(idx){const btn=event&&event.target&&event.target.closest('.btn');const fn=async()=>{await api('/upstream/'+idx+'/reconnect',{method:'POST'});toast('已触发重连','success');setTimeout(()=>{loadUp();loadDash()},1500)};if(btn)await withLoading(btn,fn)();else await fn()}

function togAuth(){const s=document.getElementById('uf-authType');if(!s)return;const pw=s.value==='password';document.getElementById('uf-pw').classList.toggle('hidden',!pw);document.getElementById('uf-ak').classList.toggle('hidden',pw)}

// Diagnostics
async function diag(btn,idx){const card=btn.closest('.card');let p=card.querySelector('.diag-panel');if(p){p.remove();return}let u=cached.find(x=>x.index===idx);if(!u){const r=await api('/upstream');if(!r)return;cached=await r.json();u=cached.find(x=>x.index===idx)}if(!u)return;
  const rows=[];rows.push(dr('连接状态',u.online?'<span style="color:var(--green)">● 在线</span>':'<span style="color:var(--red)">● 离线</span>'));
  rows.push(dr('认证方式',u.authType==='apiKey'?'API Key':'用户名/密码'));rows.push(dr('UA 伪装',esc(uLabel(u.spoofClient))));rows.push(dr('播放模式',esc(pLabel(u.playbackMode))));
  const hosts=[u.streamingUrl||'',...(u.streamHosts||[])].filter(Boolean);if(hosts.length)rows.push(dr('播放回源',hosts.map(h=>esc(h)).join('<br>')));
  rows.push(dr('浏览库',u.browseEnabled!==false?'开启':'仅播放'));rows.push(dr('跟随重定向',u.followRedirects!==false?'是':'否'));rows.push(dr('元数据优先',u.priorityMetadata?'是':'否'));
  if(u.proxyId)rows.push(dr('关联代理',esc(u.proxyId)));
  if(!u.online)rows.push(dr('建议','检查上游地址和认证信息，或尝试"重连"'));
  p=document.createElement('div');p.className='diag-panel';p.innerHTML='<dl>'+rows.join('')+'</dl>';card.appendChild(p)}
function dr(l,v){return'<dt>'+esc(l)+'</dt><dd>'+v+'</dd>'}

// Proxies
async function loadPx(){const r=await api('/proxies');if(!r)return;const list=await r.json();const c=document.getElementById('proxy-list');
  if(!list||!list.length){c.innerHTML='<div class="empty-state"><p>暂无网络代理，点击右上角添加</p></div>';return}
  c.innerHTML=list.map(p=>'<div class="card glass-panel"><div class="card-header"><span class="card-title">'+esc(p.name)+'</span></div><div class="card-body"><p>地址：'+esc(p.url)+'</p></div><div class="card-footer"><button class="btn btn-ghost btn-sm" onclick="EM.testPx(\''+esc(p.id)+'\')">测试</button><button class="btn btn-danger btn-sm" onclick="EM.delPx(\''+esc(p.id)+'\')">删除</button></div></div>').join('')}
function showAddPx(){openModal('添加代理','<div class="form-group"><label>名称 <span class="required">*</span></label><input id="pf-name" placeholder="My Proxy"></div><div class="form-group"><label>代理地址 <span class="required">*</span></label><input id="pf-url" placeholder="http://127.0.0.1:7890"></div>','<button class="btn btn-ghost" onclick="EM.closeModal()">取消</button><button class="btn btn-primary" id="pf-save">保存</button>');const b=document.getElementById('pf-save');b.onclick=withLoading(b,async()=>{if(!showErr(valPx()))return;const r=await api('/proxies',{method:'POST',body:JSON.stringify({name:document.getElementById('pf-name').value,url:document.getElementById('pf-url').value})});if(!r||!r.ok){const e=r?await r.json():{};toast(e.error||'添加失败','error');return}closeModal();toast('代理添加成功','success');loadPx()})}
async function delPx(id){if(!await confirm('确定删除此代理？'))return;await api('/proxies/'+id,{method:'DELETE'});toast('代理已删除','success');loadPx()}
async function testPx(id){const t=prompt('输入测试目标地址：','https://emby.media');if(!t)return;toast('正在测试...','info');const r=await api('/proxies/test',{method:'POST',body:JSON.stringify({proxyId:id,targetUrl:t})});if(!r)return;const d=await r.json();d.success?toast('连通成功，延迟 '+d.latency+'ms','success'):toast('连通失败：'+(d.error||'未知'),'error')}

// Settings
async function loadSet(){const r=await api('/settings');if(!r)return;const s=await r.json();const modes=[['proxy','代理中转'],['direct','直连分流'],['redirect','重定向跟随']];const t=s.timeouts||{};
  document.getElementById('settings-form-container').innerHTML=`
    <div class="form-group"><label>服务名称 <span class="required">*</span></label><input id="sf-serverName" value="${esc(s.serverName||'')}"></div>
    <div class="form-group"><label>全局播放模式</label><select id="sf-playbackMode">${modes.map(m=>'<option value="'+m[0]+'"'+(s.playbackMode===m[0]?' selected':'')+'>'+m[1]+'</option>').join('')}</select></div>
    <div class="form-group"><label>管理员用户名</label><input id="sf-adminUsername" value="${esc(s.adminUsername||'')}"></div>
    <h4 style="color:var(--text-secondary);margin:1.25rem 0 .5rem;font-size:.8rem;text-transform:uppercase;letter-spacing:.06em;font-weight:700">修改密码</h4>
    <div class="form-group"><label>当前密码</label><input type="password" id="sf-currentPassword" placeholder="不修改请留空"></div>
    <div class="form-group"><label>新密码</label><input type="password" id="sf-newPassword" placeholder="不修改请留空"></div>
    <h4 style="color:var(--text-secondary);margin:1.25rem 0 .5rem;font-size:.8rem;text-transform:uppercase;letter-spacing:.06em;font-weight:700">超时设置</h4>
    <div class="form-row"><div class="form-group"><label>API 超时 (ms)</label><input type="number" id="sf-timeout-api" value="${t.api||30000}" min="1000"></div><div class="form-group"><label>聚合超时 (ms)</label><input type="number" id="sf-timeout-global" value="${t.global||15000}" min="1000"></div></div>
    <div class="form-row"><div class="form-group"><label>登录超时 (ms)</label><input type="number" id="sf-timeout-login" value="${t.login||10000}" min="1000"></div><div class="form-group"><label>健康检查超时</label><input type="number" id="sf-timeout-healthCheck" value="${t.healthCheck||10000}" min="1000"></div></div>
    <div class="form-group"><label>检查间隔 (ms)</label><input type="number" id="sf-timeout-healthInterval" value="${t.healthInterval||60000}" min="5000"></div>
    <div style="margin-top:1.5rem"><button class="btn btn-primary" id="sf-save">保存设置</button></div>`;
  document.getElementById('sf-save').onclick=withLoading(document.getElementById('sf-save'),saveSet)}

async function saveSet(){if(!showErr(valSet()))return;const body={serverName:document.getElementById('sf-serverName').value,playbackMode:document.getElementById('sf-playbackMode').value,adminUsername:document.getElementById('sf-adminUsername').value,timeouts:{api:+document.getElementById('sf-timeout-api').value,global:+document.getElementById('sf-timeout-global').value,login:+document.getElementById('sf-timeout-login').value,healthCheck:+document.getElementById('sf-timeout-healthCheck').value,healthInterval:+document.getElementById('sf-timeout-healthInterval').value}};
  const cur=document.getElementById('sf-currentPassword').value,nw=document.getElementById('sf-newPassword').value;if(nw){body.currentPassword=cur;body.adminPassword=nw}
  const r=await api('/settings',{method:'PUT',body:JSON.stringify(body)});if(!r||!r.ok){const e=r?await r.json():{};toast(e.error||'保存失败','error');return}toast('设置已保存','success');loadSet()}

// Logs
let logsData=[];
async function loadLogs(){const r=await api('/logs');if(!r)return;try{logsData=await r.json()}catch{logsData=[]}if(!Array.isArray(logsData))logsData=[];renderLogs()}
function renderLogs(){const search=(document.getElementById('log-search').value||'').toLowerCase(),level=document.getElementById('log-filter').value,v=document.getElementById('log-viewer');let h='';
  for(const e of logsData){const ts=e.timestamp||'',lv=e.level||'',msg=e.message||'';const line=ts+' ['+lv+'] '+msg;if(search&&!line.toLowerCase().includes(search))continue;if(level&&lv!==level)continue;let c='log-debug';if(lv==='ERROR')c='log-error';else if(lv==='WARN')c='log-warn';else if(lv==='INFO')c='log-info';h+='<span class="log-line '+c+'"><span class="log-ts">'+esc(ts)+'</span> <span class="log-lv">['+esc(lv)+']</span> '+esc(msg)+'</span>\n'}
  v.innerHTML=h||'<span style="color:var(--text-muted)">暂无日志</span>';v.scrollTop=v.scrollHeight}
function dlLogs(){window.open('/admin/api/logs/download?token='+encodeURIComponent(localStorage.getItem(TK)),'_blank')}
async function clrLogs(){if(!await confirm('确定清空所有日志？'))return;await api('/logs',{method:'DELETE'});toast('日志已清空','success');loadLogs()}

// Router
const pages=['dashboard','upstreams','proxies','settings','logs','about'];
const loaders={dashboard:loadDash,upstreams:loadUp,proxies:loadPx,settings:loadSet,logs:loadLogs};
function nav(page){if(!pages.includes(page))page='dashboard';pages.forEach(p=>document.getElementById('page-'+p).classList.toggle('hidden',p!==page));document.querySelectorAll('.nav-item').forEach(el=>el.classList.toggle('active',el.dataset.page===page));document.getElementById('sidebar').classList.remove('open');if(loaders[page])loaders[page]()}
function onHash(){nav(location.hash.replace('#','')||'dashboard')}

// Init
function init(){
  initTheme();
  document.getElementById('theme-toggle').addEventListener('click',toggleTheme);
  document.getElementById('login-form').addEventListener('submit',async e=>{e.preventDefault();const btn=document.getElementById('login-btn'),err=document.getElementById('login-error');btn.disabled=true;btn.querySelector('.btn-text').textContent='登录中...';err.classList.add('hidden');try{await doLogin(document.getElementById('login-username').value,document.getElementById('login-password').value);showApp();onHash()}catch(ex){err.textContent=ex.message;err.classList.remove('hidden')}finally{btn.disabled=false;btn.querySelector('.btn-text').textContent='登录'}});
  document.getElementById('logout-btn').addEventListener('click',doLogout);
  document.getElementById('modal-close').addEventListener('click',closeModal);
  document.getElementById('menu-toggle').addEventListener('click',()=>document.getElementById('sidebar').classList.toggle('open'));
  document.getElementById('add-upstream-btn').addEventListener('click',showAddUp);
  document.getElementById('add-proxy-btn').addEventListener('click',showAddPx);
  document.getElementById('logs-refresh-btn').addEventListener('click',loadLogs);
  document.getElementById('logs-download-btn').addEventListener('click',dlLogs);
  document.getElementById('logs-clear-btn').addEventListener('click',clrLogs);
  document.getElementById('log-search').addEventListener('input',renderLogs);
  document.getElementById('log-filter').addEventListener('change',renderLogs);
  bindDrag(document.getElementById('upstream-list'));
  window.addEventListener('hashchange',onHash);
  if(isLoggedIn()){showApp();onHash()}else showLogin();
}

window.EM={editUp,delUp,reconUp,diag,togAuth,delPx,testPx,closeModal};
document.addEventListener('DOMContentLoaded',init);
})();
