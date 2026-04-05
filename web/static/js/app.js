/* EmberMux Admin Panel — SPA */
(function () {
    'use strict';

    const TOKEN_KEY = 'embermux_token';

    // ── API helper ──
    async function api(path, opts = {}) {
        const token = localStorage.getItem(TOKEN_KEY);
        const resp = await fetch('/admin/api' + path, {
            ...opts,
            headers: {
                'Content-Type': 'application/json',
                'X-Emby-Token': token || '',
                ...(opts.headers || {})
            }
        });
        if (resp.status === 401) {
            localStorage.removeItem(TOKEN_KEY);
            showLogin();
            return null;
        }
        return resp;
    }

    // ── Toast ──
    function toast(msg, type = 'info') {
        const c = document.getElementById('toast-container');
        const el = document.createElement('div');
        el.className = 'toast toast-' + type;
        el.textContent = msg;
        c.appendChild(el);
        setTimeout(() => { el.classList.add('toast-out'); setTimeout(() => el.remove(), 200); }, 3000);
    }

    // ── Modal ──
    function openModal(title, bodyHTML, footerHTML) {
        document.getElementById('modal-title').textContent = title;
        document.getElementById('modal-body').innerHTML = bodyHTML;
        document.getElementById('modal-footer').innerHTML = footerHTML || '';
        document.getElementById('modal-overlay').classList.remove('hidden');
    }
    function closeModal() {
        document.getElementById('modal-overlay').classList.add('hidden');
    }

    // ── Confirm dialog ──
    function confirm(msg) {
        return new Promise(resolve => {
            openModal('确认操作',
                '<p style="color:var(--text-secondary)">' + escapeHTML(msg) + '</p>',
                '<button class="btn btn-ghost" id="confirm-no">取消</button><button class="btn btn-danger" id="confirm-yes">确认</button>'
            );
            document.getElementById('confirm-yes').onclick = () => { closeModal(); resolve(true); };
            document.getElementById('confirm-no').onclick = () => { closeModal(); resolve(false); };
        });
    }

    function escapeHTML(s) {
        const d = document.createElement('div');
        d.textContent = s;
        return d.innerHTML;
    }

    // ── Auth ──
    function isLoggedIn() { return !!localStorage.getItem(TOKEN_KEY); }

    function showLogin() {
        document.getElementById('login-page').classList.remove('hidden');
        document.getElementById('app').classList.add('hidden');
    }

    function showApp() {
        document.getElementById('login-page').classList.add('hidden');
        document.getElementById('app').classList.remove('hidden');
    }

    async function doLogin(username, password) {
        const resp = await fetch('/Users/AuthenticateByName', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Emby-Authorization': 'MediaBrowser Client="EmberMux Admin", Device="Browser", DeviceId="admin-panel", Version="1.0"'
            },
            body: JSON.stringify({ Username: username, Pw: password })
        });
        if (!resp.ok) throw new Error('认证失败');
        const data = await resp.json();
        if (!data.AccessToken) throw new Error('未获取到 Token');
        localStorage.setItem(TOKEN_KEY, data.AccessToken);
    }

    async function doLogout() {
        await api('/logout', { method: 'POST' }).catch(() => {});
        localStorage.removeItem(TOKEN_KEY);
        showLogin();
    }

    // ── Playback mode labels ──
    const playbackLabels = { proxy: '代理中转', direct: '直连分流', redirect: '重定向跟随' };
    function playbackLabel(mode) { return playbackLabels[mode] || mode || '默认'; }
    function playbackBadge(mode) {
        const cls = mode === 'proxy' ? 'blue' : mode === 'direct' ? 'green' : mode === 'redirect' ? 'yellow' : 'gray';
        return '<span class="badge badge-' + cls + '">' + escapeHTML(playbackLabel(mode)) + '</span>';
    }

    // ── Spoof client labels ──
    const spoofLabels = { infuse: 'Infuse', web: 'Web', client: 'Client', custom: '自定义', passthrough: '透传' };
    function spoofLabel(v) { return spoofLabels[v] || v || '透传'; }

    // ── Dashboard ──
    async function loadDashboard() {
        const resp = await api('/status');
        if (!resp) return;
        const d = await resp.json();
        const grid = document.getElementById('stats-grid');
        grid.innerHTML = [
            statCard('服务名称', d.serverName, ''),
            statCard('监听端口', d.port, 'blue'),
            statCard('全局播放模式', playbackLabel(d.playbackMode), ''),
            statCard('ID 映射数', d.idMappings, 'yellow'),
            statCard('上游总数', d.upstreamCount, 'blue'),
            statCard('在线上游', d.upstreamOnline, 'green'),
        ].join('');

        const sg = document.getElementById('upstream-status-grid');
        if (!d.upstream || d.upstream.length === 0) {
            sg.innerHTML = '<div class="empty-state"><p>暂无上游服务器</p></div>';
            return;
        }
        sg.innerHTML = d.upstream.map(u => `
            <div class="card">
                <div class="card-header">
                    <span class="card-title"><span class="dot ${u.online ? 'dot-online' : 'dot-offline'}"></span>${escapeHTML(u.name)}</span>
                    ${playbackBadge(u.playbackMode)}
                </div>
                <div class="card-body"><p>${escapeHTML(u.host)}</p></div>
            </div>
        `).join('');
    }

    function statCard(label, value, color) {
        return `<div class="stat-card"><div class="stat-label">${escapeHTML(label)}</div><div class="stat-value ${color}">${escapeHTML(String(value))}</div></div>`;
    }

    // ── Upstreams ──
    async function loadUpstreams() {
        const resp = await api('/upstream');
        if (!resp) return;
        const list = await resp.json();
        const container = document.getElementById('upstream-list');
        if (!list || list.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>暂无上游服务器，点击右上角添加</p></div>';
            return;
        }
        container.innerHTML = list.map(u => `
            <div class="card" data-index="${u.index}">
                <div class="card-header">
                    <span class="card-title"><span class="dot ${u.online ? 'dot-online' : 'dot-offline'}"></span>${escapeHTML(u.name)}</span>
                    ${playbackBadge(u.playbackMode)}
                </div>
                <div class="card-body">
                    <p>地址：${escapeHTML(u.url)}</p>
                    <p>认证：${u.authType === 'apiKey' ? 'API Key' : '用户名/密码'} ${u.username ? '(' + escapeHTML(u.username) + ')' : ''}</p>
                    <p>UA 伪装：${escapeHTML(spoofLabel(u.spoofClient))}</p>
                </div>
                <div class="card-footer">
                    <button class="btn btn-ghost btn-sm" onclick="FR.editUpstream(${u.index})">编辑</button>
                    <button class="btn btn-ghost btn-sm" onclick="FR.reconnectUpstream(${u.index})">重连</button>
                    <button class="btn btn-ghost btn-sm" onclick="FR.toggleDiag(this, ${u.index})">诊断</button>
                    <button class="btn btn-danger btn-sm" onclick="FR.deleteUpstream(${u.index})">删除</button>
                </div>
            </div>
        `).join('');
    }

    function upstreamFormHTML(data) {
        const d = data || {};
        const isEdit = !!data;
        const modes = [['proxy', '代理中转'], ['direct', '直连分流'], ['redirect', '重定向��随']];
        const spoofs = [['passthrough', '透传'], ['infuse', 'Infuse'], ['web', 'Web'], ['client', 'Client'], ['custom', '自定义']];
        return `
            <div class="form-group"><label>名称</label><input id="uf-name" value="${escapeHTML(d.name || '')}"></div>
            <div class="form-group"><label>上游地址</label><input id="uf-url" placeholder="https://emby.example.com" value="${escapeHTML(d.url || '')}"></div>
            <div class="form-group"><label>播放回源地址</label><input id="uf-streamingUrl" placeholder="留空则使用上游地址" value="${escapeHTML(d.streamingUrl || '')}"></div>
            <div class="form-group"><label>播放模式</label>
                <select id="uf-playbackMode">${modes.map(m => `<option value="${m[0]}"${d.playbackMode === m[0] ? ' selected' : ''}>${m[1]}</option>`).join('')}</select>
                <div class="hint">代理中转：流量经 EmberMux；直连分流：302 跳转；重定向跟随：服务端跟随</div>
            </div>
            <div class="form-group"><label>认证方式</label>
                <select id="uf-authType" onchange="FR.toggleAuthFields()">
                    <option value="password"${(!d.authType || d.authType === 'password') ? ' selected' : ''}>用户名/密码</option>
                    <option value="apiKey"${d.authType === 'apiKey' ? ' selected' : ''}>API Key</option>
                </select>
            </div>
            <div id="uf-password-fields">
                <div class="form-row">
                    <div class="form-group"><label>用户名</label><input id="uf-username" value="${escapeHTML(d.username || '')}"></div>
                    <div class="form-group"><label>密码</label><input type="password" id="uf-password" placeholder="${isEdit ? '留空保持不变' : ''}"></div>
                </div>
            </div>
            <div id="uf-apikey-fields" class="hidden">
                <div class="form-group"><label>API Key</label><input id="uf-apiKey" value=""></div>
            </div>
            <div class="form-group"><label>UA 伪装</label>
                <select id="uf-spoofClient" onchange="FR.toggleCustomUA()">${spoofs.map(s => `<option value="${s[0]}"${d.spoofClient === s[0] ? ' selected' : ''}>${s[1]}</option>`).join('')}</select>
            </div>
            <div id="uf-custom-ua" class="${d.spoofClient === 'custom' ? '' : 'hidden'}">
                <div class="form-row">
                    <div class="form-group"><label>User-Agent</label><input id="uf-customUserAgent" value="${escapeHTML(d.customUserAgent || '')}"></div>
                    <div class="form-group"><label>Client</label><input id="uf-customClient" value="${escapeHTML(d.customClient || '')}"></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label>Version</label><input id="uf-customClientVersion" value="${escapeHTML(d.customClientVersion || '')}"></div>
                    <div class="form-group"><label>DeviceName</label><input id="uf-customDeviceName" value="${escapeHTML(d.customDeviceName || '')}"></div>
                </div>
                <div class="form-group"><label>DeviceId</label><input id="uf-customDeviceId" value="${escapeHTML(d.customDeviceId || '')}"></div>
            </div>
            <div class="form-group form-group-inline"><input type="checkbox" id="uf-priorityMetadata"${d.priorityMetadata ? ' checked' : ''}><label for="uf-priorityMetadata">元数据优先</label></div>
            <div class="form-group form-group-inline"><input type="checkbox" id="uf-followRedirects"${d.followRedirects !== false ? ' checked' : ''}><label for="uf-followRedirects">跟随重定向</label></div>
            <div class="form-group"><label>代理 ID（可选，关联网络代理）</label><input id="uf-proxyId" value="${escapeHTML(d.proxyId || '')}"></div>
        `;
    }

    function collectUpstreamForm() {
        const authType = document.getElementById('uf-authType').value;
        const body = {
            name: document.getElementById('uf-name').value,
            url: document.getElementById('uf-url').value,
            playbackMode: document.getElementById('uf-playbackMode').value,
            spoofClient: document.getElementById('uf-spoofClient').value,
            followRedirects: document.getElementById('uf-followRedirects').checked,
            priorityMetadata: document.getElementById('uf-priorityMetadata').checked,
            proxyId: document.getElementById('uf-proxyId').value || '',
        };
        const streaming = document.getElementById('uf-streamingUrl').value;
        if (streaming) body.streamingUrl = streaming;
        if (authType === 'password') {
            body.username = document.getElementById('uf-username').value;
            const pw = document.getElementById('uf-password').value;
            if (pw) body.password = pw;
        } else {
            body.apiKey = document.getElementById('uf-apiKey').value;
        }
        if (body.spoofClient === 'custom') {
            body.customUserAgent = document.getElementById('uf-customUserAgent').value;
            body.customClient = document.getElementById('uf-customClient').value;
            body.customClientVersion = document.getElementById('uf-customClientVersion').value;
            body.customDeviceName = document.getElementById('uf-customDeviceName').value;
            body.customDeviceId = document.getElementById('uf-customDeviceId').value;
        }
        return body;
    }

    function showAddUpstream() {
        openModal('添加上游', upstreamFormHTML(), '<button class="btn btn-ghost" onclick="FR.closeModal()">取消</button><button class="btn btn-primary" id="uf-save">保存</button>');
        FR.toggleAuthFields();
        document.getElementById('uf-save').onclick = async () => {
            const body = collectUpstreamForm();
            const resp = await api('/upstream', { method: 'POST', body: JSON.stringify(body) });
            if (!resp) return;
            if (!resp.ok) { const e = await resp.json(); toast(e.error || '添加失败', 'error'); return; }
            closeModal();
            toast('上游添加成功', 'success');
            loadUpstreams();
            loadDashboard();
        };
    }

    async function editUpstream(index) {
        const resp = await api('/upstream');
        if (!resp) return;
        const list = await resp.json();
        const u = list.find(x => x.index === index);
        if (!u) { toast('未找到上游', 'error'); return; }
        openModal('编辑上游', upstreamFormHTML(u), '<button class="btn btn-ghost" onclick="FR.closeModal()">取消</button><button class="btn btn-primary" id="uf-save">保存</button>');
        FR.toggleAuthFields();
        FR.toggleCustomUA();
        document.getElementById('uf-save').onclick = async () => {
            const body = collectUpstreamForm();
            const resp = await api('/upstream/' + index, { method: 'PUT', body: JSON.stringify(body) });
            if (!resp) return;
            if (!resp.ok) { const e = await resp.json(); toast(e.error || '保存失败', 'error'); return; }
            closeModal();
            toast('上游更新成功', 'success');
            loadUpstreams();
            loadDashboard();
        };
    }

    async function deleteUpstream(index) {
        if (!await confirm('确定删除此上游？此操作不可恢复。')) return;
        const resp = await api('/upstream/' + index, { method: 'DELETE' });
        if (!resp) return;
        toast('上游已删除', 'success');
        loadUpstreams();
        loadDashboard();
    }

    async function reconnectUpstream(index) {
        const resp = await api('/upstream/' + index + '/reconnect', { method: 'POST' });
        if (!resp) return;
        toast('已触发重连', 'success');
        setTimeout(() => { loadUpstreams(); loadDashboard(); }, 1500);
    }

    function toggleAuthFields() {
        const sel = document.getElementById('uf-authType');
        if (!sel) return;
        const isPW = sel.value === 'password';
        document.getElementById('uf-password-fields').classList.toggle('hidden', !isPW);
        document.getElementById('uf-apikey-fields').classList.toggle('hidden', isPW);
    }

    function toggleCustomUA() {
        const sel = document.getElementById('uf-spoofClient');
        if (!sel) return;
        document.getElementById('uf-custom-ua').classList.toggle('hidden', sel.value !== 'custom');
    }

    function toggleDiag(btn, index) {
        const card = btn.closest('.card');
        let panel = card.querySelector('.diag-panel');
        if (panel) { panel.remove(); return; }
        const dot = card.querySelector('.dot');
        const isOnline = dot && dot.classList.contains('dot-online');
        const spoofSel = card.querySelector('.card-body').textContent;
        panel = document.createElement('div');
        panel.className = 'diag-panel';
        panel.innerHTML = `<dl>
            <dt>上游状态</dt><dd>${isOnline ? '<span style="color:var(--green)">在线</span>' : '<span style="color:var(--red)">离线</span>'}</dd>
            <dt>诊断提示</dt><dd>${isOnline ? '上游连接正常，服务可用。' : '上游离线，请检查地址和认证信息。'}</dd>
        </dl>`;
        card.appendChild(panel);
    }

    // ── Proxies ──
    async function loadProxies() {
        const resp = await api('/proxies');
        if (!resp) return;
        const list = await resp.json();
        const container = document.getElementById('proxy-list');
        if (!list || list.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>暂无网络代理，点击右上角添加</p></div>';
            return;
        }
        container.innerHTML = list.map(p => `
            <div class="card" data-id="${escapeHTML(p.id)}">
                <div class="card-header"><span class="card-title">${escapeHTML(p.name)}</span></div>
                <div class="card-body"><p>地址：${escapeHTML(p.url)}</p></div>
                <div class="card-footer">
                    <button class="btn btn-ghost btn-sm" onclick="FR.testProxy('${escapeHTML(p.id)}')">测试</button>
                    <button class="btn btn-danger btn-sm" onclick="FR.deleteProxy('${escapeHTML(p.id)}')">删除</button>
                </div>
            </div>
        `).join('');
    }

    function showAddProxy() {
        openModal('添加代理',
            '<div class="form-group"><label>名称</label><input id="pf-name" placeholder="My Proxy"></div>' +
            '<div class="form-group"><label>代理地址</label><input id="pf-url" placeholder="http://127.0.0.1:7890"></div>',
            '<button class="btn btn-ghost" onclick="FR.closeModal()">取消</button><button class="btn btn-primary" id="pf-save">保存</button>'
        );
        document.getElementById('pf-save').onclick = async () => {
            const body = { name: document.getElementById('pf-name').value, url: document.getElementById('pf-url').value };
            const resp = await api('/proxies', { method: 'POST', body: JSON.stringify(body) });
            if (!resp) return;
            if (!resp.ok) { const e = await resp.json(); toast(e.error || '添加失败', 'error'); return; }
            closeModal();
            toast('代理添加成功', 'success');
            loadProxies();
        };
    }

    async function deleteProxy(id) {
        if (!await confirm('确定删除此代理？')) return;
        const resp = await api('/proxies/' + id, { method: 'DELETE' });
        if (!resp) return;
        toast('代理已删除', 'success');
        loadProxies();
    }

    async function testProxy(id) {
        const target = prompt('输入测试目标地址：', 'https://emby.media');
        if (!target) return;
        toast('正在测试...', 'info');
        const resp = await api('/proxies/test', { method: 'POST', body: JSON.stringify({ proxyId: id, targetUrl: target }) });
        if (!resp) return;
        const r = await resp.json();
        if (r.success) {
            toast(`连通成功，延迟 ${r.latency}ms，状态码 ${r.statusCode}`, 'success');
        } else {
            toast('连通失败：' + (r.error || '未知错误'), 'error');
        }
    }

    // ── Settings ──
    async function loadSettings() {
        const resp = await api('/settings');
        if (!resp) return;
        const s = await resp.json();
        const modes = [['proxy', '代理中转'], ['direct', '直连分流'], ['redirect', '重定向跟随']];
        const t = s.timeouts || {};
        document.getElementById('settings-form-container').innerHTML = `
            <div class="form-group"><label>服务名称</label><input id="sf-serverName" value="${escapeHTML(s.serverName || '')}"></div>
            <div class="form-group"><label>全局播放模式</label>
                <select id="sf-playbackMode">${modes.map(m => `<option value="${m[0]}"${s.playbackMode === m[0] ? ' selected' : ''}>${m[1]}</option>`).join('')}</select>
            </div>
            <div class="form-group"><label>管理员用户名</label><input id="sf-adminUsername" value="${escapeHTML(s.adminUsername || '')}"></div>
            <h4 style="color:var(--text-secondary);margin:1rem 0 0.5rem;font-size:0.9rem">修改密码</h4>
            <div class="form-group"><label>当前密码</label><input type="password" id="sf-currentPassword" placeholder="不修改请留空"></div>
            <div class="form-group"><label>新密码</label><input type="password" id="sf-newPassword" placeholder="不修改请留空"></div>
            <h4 style="color:var(--text-secondary);margin:1rem 0 0.5rem;font-size:0.9rem">超时设置</h4>
            <div class="form-row">
                <div class="form-group"><label>API 超时 (ms)</label><input type="number" id="sf-timeout-api" value="${t.api || 30000}"></div>
                <div class="form-group"><label>聚合超时 (ms)</label><input type="number" id="sf-timeout-global" value="${t.global || 15000}"></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label>登录超时 (ms)</label><input type="number" id="sf-timeout-login" value="${t.login || 10000}"></div>
                <div class="form-group"><label>健康检查超时 (ms)</label><input type="number" id="sf-timeout-healthCheck" value="${t.healthCheck || 10000}"></div>
            </div>
            <div class="form-group"><label>检查间隔 (ms)</label><input type="number" id="sf-timeout-healthInterval" value="${t.healthInterval || 60000}"></div>
            <div style="margin-top:1.25rem"><button class="btn btn-primary" id="sf-save">保存设置</button></div>
        `;
        document.getElementById('sf-save').onclick = saveSettings;
    }

    async function saveSettings() {
        const body = {
            serverName: document.getElementById('sf-serverName').value,
            playbackMode: document.getElementById('sf-playbackMode').value,
            adminUsername: document.getElementById('sf-adminUsername').value,
            timeouts: {
                api: Number(document.getElementById('sf-timeout-api').value),
                global: Number(document.getElementById('sf-timeout-global').value),
                login: Number(document.getElementById('sf-timeout-login').value),
                healthCheck: Number(document.getElementById('sf-timeout-healthCheck').value),
                healthInterval: Number(document.getElementById('sf-timeout-healthInterval').value),
            }
        };
        const curPw = document.getElementById('sf-currentPassword').value;
        const newPw = document.getElementById('sf-newPassword').value;
        if (newPw) {
            body.currentPassword = curPw;
            body.adminPassword = newPw;
        }
        const resp = await api('/settings', { method: 'PUT', body: JSON.stringify(body) });
        if (!resp) return;
        if (!resp.ok) { const e = await resp.json(); toast(e.error || '保存失败', 'error'); return; }
        toast('设置已保存', 'success');
        loadSettings();
    }

    // ── Logs ──
    let logsRaw = '';

    async function loadLogs() {
        const resp = await api('/logs');
        if (!resp) return;
        logsRaw = await resp.text();
        renderLogs();
    }

    function renderLogs() {
        const search = (document.getElementById('log-search').value || '').toLowerCase();
        const level = document.getElementById('log-filter').value;
        const viewer = document.getElementById('log-viewer');
        const lines = logsRaw.split('\n');
        let html = '';
        for (const line of lines) {
            if (search && !line.toLowerCase().includes(search)) continue;
            if (level && !line.includes(level)) continue;
            let cls = 'log-debug';
            if (line.includes('ERROR')) cls = 'log-error';
            else if (line.includes('WARN')) cls = 'log-warn';
            else if (line.includes('INFO')) cls = 'log-info';
            html += '<span class="log-line ' + cls + '">' + escapeHTML(line) + '</span>\n';
        }
        viewer.innerHTML = html || '<span style="color:var(--text-muted)">暂无日志</span>';
        viewer.scrollTop = viewer.scrollHeight;
    }

    async function downloadLogs() {
        const token = localStorage.getItem(TOKEN_KEY);
        window.open('/admin/api/logs/download?token=' + encodeURIComponent(token), '_blank');
    }

    async function clearLogs() {
        if (!await confirm('确定清空所有日志？')) return;
        const resp = await api('/logs', { method: 'DELETE' });
        if (!resp) return;
        toast('日志已清空', 'success');
        loadLogs();
    }

    // ── Router ──
    const pages = ['dashboard', 'upstreams', 'proxies', 'settings', 'logs', 'about'];
    const loaders = { dashboard: loadDashboard, upstreams: loadUpstreams, proxies: loadProxies, settings: loadSettings, logs: loadLogs };

    function navigate(page) {
        if (!pages.includes(page)) page = 'dashboard';
        pages.forEach(p => {
            document.getElementById('page-' + p).classList.toggle('hidden', p !== page);
        });
        document.querySelectorAll('.nav-item').forEach(el => {
            el.classList.toggle('active', el.dataset.page === page);
        });
        // Close mobile sidebar
        document.getElementById('sidebar').classList.remove('open');
        if (loaders[page]) loaders[page]();
    }

    function onHashChange() {
        const hash = location.hash.replace('#', '') || 'dashboard';
        navigate(hash);
    }

    // ── Init ──
    function init() {
        // Login form
        document.getElementById('login-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('login-btn');
            const errEl = document.getElementById('login-error');
            btn.disabled = true;
            btn.textContent = '登录中...';
            errEl.classList.add('hidden');
            try {
                await doLogin(
                    document.getElementById('login-username').value,
                    document.getElementById('login-password').value
                );
                showApp();
                onHashChange();
            } catch (err) {
                errEl.textContent = err.message;
                errEl.classList.remove('hidden');
            } finally {
                btn.disabled = false;
                btn.textContent = '登录';
            }
        });

        // Logout
        document.getElementById('logout-btn').addEventListener('click', doLogout);

        // Modal close
        document.getElementById('modal-close').addEventListener('click', closeModal);
        document.getElementById('modal-overlay').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) closeModal();
        });

        // Mobile menu
        document.getElementById('menu-toggle').addEventListener('click', () => {
            document.getElementById('sidebar').classList.toggle('open');
        });

        // Upstream buttons
        document.getElementById('add-upstream-btn').addEventListener('click', showAddUpstream);

        // Proxy buttons
        document.getElementById('add-proxy-btn').addEventListener('click', showAddProxy);

        // Log controls
        document.getElementById('logs-refresh-btn').addEventListener('click', loadLogs);
        document.getElementById('logs-download-btn').addEventListener('click', downloadLogs);
        document.getElementById('logs-clear-btn').addEventListener('click', clearLogs);
        document.getElementById('log-search').addEventListener('input', renderLogs);
        document.getElementById('log-filter').addEventListener('change', renderLogs);

        // Router
        window.addEventListener('hashchange', onHashChange);

        // Check auth
        if (isLoggedIn()) {
            showApp();
            onHashChange();
        } else {
            showLogin();
        }
    }

    // Expose needed functions globally for inline onclick handlers
    window.FR = {
        editUpstream, deleteUpstream, reconnectUpstream, toggleDiag,
        toggleAuthFields, toggleCustomUA,
        deleteProxy, testProxy,
        closeModal,
    };

    document.addEventListener('DOMContentLoaded', init);
})();
