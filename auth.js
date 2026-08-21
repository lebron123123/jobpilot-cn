(() => {
  const root = document.createElement('div');
  root.id = 'auth-root';
  document.body.appendChild(root);
  let onReady = null;

  async function request(url, options = {}) {
    const response = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...options });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || '请求失败');
    return data;
  }

  function loginView(message = '') {
    root.className = 'auth-shell open';
    root.innerHTML = `<div class="auth-brand"><span>J</span><b>JobPilot CN</b><small>多人求职工作台</small></div><form class="auth-card" id="login-form"><span class="kicker">WELCOME BACK</span><h2>登录你的求职空间</h2><p>每位用户的简历、岗位、投递和面试记录独立保存。</p>${message ? `<div class="auth-message">${message}</div>` : ''}<label class="field"><span>手机号</span><input id="login-phone" inputmode="numeric" maxlength="11" autocomplete="tel" required></label><label class="field"><span>密码</span><input id="login-password" type="password" autocomplete="current-password" required></label><button class="primary auth-submit">登录</button><button class="link" type="button" id="show-register">没有账号？立即注册</button></form>`;
    document.getElementById('show-register').onclick = registerView;
    document.getElementById('login-form').onsubmit = async (event) => {
      event.preventDefault();
      try {
        await request('/api/auth/login', { method: 'POST', body: JSON.stringify({ phone: document.getElementById('login-phone').value, password: document.getElementById('login-password').value }) });
        await finish();
      } catch (error) { loginView(error.message); }
    };
  }

  function registerView(message = '', values = {}) {
    root.className = 'auth-shell open';
    root.innerHTML = `<div class="auth-brand"><span>J</span><b>JobPilot CN</b><small>创建独立求职空间</small></div><form class="auth-card" id="register-form"><span class="kicker">CREATE ACCOUNT</span><h2>手机号注册</h2><p>验证码有效期5分钟，密码至少8位。</p>${message ? `<div class="auth-message">${message}</div>` : ''}<label class="field"><span>姓名/昵称</span><input id="register-name" maxlength="30" value="${escapeHtml(values.name || '')}" required></label><label class="field"><span>手机号</span><input id="register-phone" inputmode="numeric" maxlength="11" autocomplete="tel" value="${escapeHtml(values.phone || '')}" required></label><div class="otp-row"><label class="field"><span>验证码</span><input id="register-code" inputmode="numeric" maxlength="6" required></label><button class="secondary" type="button" id="send-code">发送验证码</button></div><label class="field"><span>设置密码</span><input id="register-password" type="password" minlength="8" autocomplete="new-password" required></label><button class="primary auth-submit">注册并登录</button><button class="link" type="button" id="show-login">已有账号？返回登录</button></form>`;
    document.getElementById('show-login').onclick = () => loginView();
    document.getElementById('send-code').onclick = async () => {
      const phone = document.getElementById('register-phone').value;
      const name = document.getElementById('register-name').value;
      try {
        const result = await request('/api/auth/send-code', { method: 'POST', body: JSON.stringify({ phone }) });
        registerView(result.devCode ? `本地开发验证码：${result.devCode}（部署时接入短信供应商后将发送到手机）` : '验证码已发送，请查看手机短信。', { phone, name });
        if (result.devCode) document.getElementById('register-code').value = result.devCode;
      } catch (error) { registerView(error.message, { phone, name }); }
    };
    document.getElementById('register-form').onsubmit = async (event) => {
      event.preventDefault();
      const payload = { name: document.getElementById('register-name').value, phone: document.getElementById('register-phone').value, code: document.getElementById('register-code').value, password: document.getElementById('register-password').value };
      try { await request('/api/auth/register', { method: 'POST', body: JSON.stringify(payload) }); await finish(); }
      catch (error) { registerView(error.message, payload); }
    };
  }

  function escapeHtml(value) { return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char])); }
  async function finish() { const me = await request('/api/auth/me'); root.className = 'auth-shell'; root.innerHTML = ''; document.body.classList.remove('auth-locked'); setUser(me.user); if (onReady) await onReady(); }
  function setUser(user) { const label = document.getElementById('current-user'); if (label) label.textContent = user.name || user.phone; const eyebrow = document.getElementById('workspace-name'); if (eyebrow) eyebrow.textContent = `${user.name || '我的'}的求职空间`; }
  async function start(callback) { onReady = callback; document.body.classList.add('auth-locked'); try { const me = await request('/api/auth/me'); document.body.classList.remove('auth-locked'); setUser(me.user); await callback(); } catch { loginView(); } }
  async function logout() { await request('/api/auth/logout', { method: 'POST', body: '{}' }); document.body.classList.add('auth-locked'); loginView('你已安全退出。'); }
  window.JobPilotAuth = { start, logout, show: loginView };
})();
