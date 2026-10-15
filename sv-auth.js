(function(){var o=window.fetch.bind(window);window.fetch=function(u,opt){opt=opt||{};opt.headers=Object.assign({},opt.headers||{},{"X-Requested-With":"sv"});return o(u,opt);};})();
(function () {
  const API = '/api';
  function strongPassword(pw) {
    return pw.length >= 8 && /[a-z]/.test(pw) && /[A-Z]/.test(pw) && /\d/.test(pw) && /[^A-Za-z0-9]/.test(pw);
  }
  function redirectIfSession(e) {
    fetch(API + '/auth/me', { credentials: 'include' })
      .then(function (r) { if (r.ok) { if (e) { e.preventDefault(); e.stopImmediatePropagation(); } window.location.href = 'portal de clientes.html'; } })
      .catch(function () {});
  }
  var openAuth = document.getElementById('open-auth-btn');
  if (openAuth) {
    openAuth.addEventListener('click', function (e) {
      e.preventDefault();
      if (typeof showAuthModal === 'function') showAuthModal();
    }, false);
  }
  var pocket = document.getElementById('btn-pocket-start');
  if (pocket) pocket.addEventListener('click', function (e) {
    redirectIfSession(e);
  }, true);

  var btnEmail = document.getElementById('btn-auth-email');
  if (!btnEmail) return;

  var card = document.getElementById('auth-modal-card');
  var box = document.createElement('div');
  box.style.cssText = 'width:100%;margin:0.5rem 0 1.1rem;display:none;';
  box.innerHTML =
    '<form id="svf" style="display:flex;flex-direction:column;gap:0.6rem">' +
      '<div id="svreg" style="display:none;flex-direction:column;gap:0.6rem">' +
        '<input name="first_name" placeholder="Nombre" style="min-height:2.6rem;padding:0 0.85rem;border-radius:0.75rem;border:1px solid var(--line);background:var(--accent-bg);color:var(--text)">' +
        '<input name="last_name" placeholder="Apellido" style="min-height:2.6rem;padding:0 0.85rem;border-radius:0.75rem;border:1px solid var(--line);background:var(--accent-bg);color:var(--text)">' +
        '<input name="phone" placeholder="Telefono/WhatsApp (opcional)" style="min-height:2.6rem;padding:0 0.85rem;border-radius:0.75rem;border:1px solid var(--line);background:var(--accent-bg);color:var(--text)">' +
        '<input name="dni" placeholder="DNI (opcional)" style="min-height:2.6rem;padding:0 0.85rem;border-radius:0.75rem;border:1px solid var(--line);background:var(--accent-bg);color:var(--text)">' +
      '</div>' +
      '<div id="svnormal">' +
        '<input name="email" type="email" placeholder="Email" style="width:100%;min-height:2.6rem;padding:0 0.85rem;border-radius:0.75rem;border:1px solid var(--line);background:var(--accent-bg);color:var(--text)">' +
        '<input name="password" type="password" placeholder="Contrasena" style="width:100%;min-height:2.6rem;padding:0 0.85rem;border-radius:0.75rem;border:1px solid var(--line);background:var(--accent-bg);color:var(--text)">' +
      '</div>' +
      '<div id="svchannel" style="display:none">' +
        '<input id="svchaninput" placeholder="Email o telefono" style="width:100%;min-height:2.6rem;padding:0 0.85rem;border-radius:0.75rem;border:1px solid var(--line);background:var(--accent-bg);color:var(--text)">' +
      '</div>' +
      '<button type="submit" id="svsubmit" class="btn btn-shimmer" style="width:100%;min-height:2.75rem">Entrar</button>' +
      '<p id="svmsg" style="color:#f87171;font-size:0.85rem;margin:0;display:none"></p>' +
      '<button type="button" id="svtoggle" style="background:none;border:none;color:var(--primary);font-size:0.85rem;cursor:pointer">No tenes cuenta? Registrate</button>' +
    '</form>' +
    '<div id="svotp" style="display:none;flex-direction:column;gap:0.6rem;margin-top:0.5rem">' +
      '<p id="svotpinfo" style="font-size:0.85rem;color:var(--muted);margin:0"></p>' +
      '<input id="svcode" placeholder="Codigo de 6 digitos" style="min-height:2.6rem;padding:0 0.85rem;border-radius:0.75rem;border:1px solid var(--line);background:var(--accent-bg);color:var(--text)">' +
      '<button id="svverify" style="min-height:2.75rem;border-radius:0.75rem;border:none;background:linear-gradient(135deg,#1E40AF,#2563EB);color:#fff;font-weight:700;cursor:pointer">Verificar codigo</button>' +
      '<p id="svotpmsg" style="color:#f87171;font-size:0.85rem;margin:0;display:none"></p>' +
      '<button id="svresendemail" style="background:none;border:none;color:var(--primary);font-size:0.8rem;cursor:pointer">Reenviar por email</button>' +
    '</div>';
  if (card) card.appendChild(box);

  var mode = 'login'; // login | register | google | whatsapp
  var reg = document.getElementById('svreg');
  var normal = document.getElementById('svnormal');
  var channel = document.getElementById('svchannel');
  var chanInput = document.getElementById('svchaninput');
  var toggle = document.getElementById('svtoggle');
  var msg = document.getElementById('svmsg');
  var form = document.getElementById('svf');
  var submit = document.getElementById('svsubmit');
  var otpDiv = document.getElementById('svotp');
  var otpInfo = document.getElementById('svotpinfo');
  var otpMsg = document.getElementById('svotpmsg');
  var currentIdentifier = '';
  var currentChannel = 'email';

  function setMode(m) {
    mode = m;
    otpDiv.style.display = 'none';
    form.style.display = 'flex';
    msg.style.display = 'none';
    if (mode === 'register') {
      reg.style.display = 'flex';
      normal.style.display = 'block';
      channel.style.display = 'none';
      toggle.textContent = 'Ya tenes cuenta? Iniciar sesion';
      submit.textContent = 'Crear cuenta';
    } else if (mode === 'google') {
      reg.style.display = 'none';
      normal.style.display = 'none';
      channel.style.display = 'block';
      chanInput.placeholder = 'Email de tu cuenta Google';
      toggle.textContent = 'Volver a email/contrasena';
      submit.textContent = 'Continuar con Google';
    } else if (mode === 'whatsapp') {
      reg.style.display = 'none';
      normal.style.display = 'none';
      channel.style.display = 'block';
      chanInput.placeholder = 'Telefono/WhatsApp registrado';
      toggle.textContent = 'Volver a email/contrasena';
      submit.textContent = 'Enviar codigo por WhatsApp';
    } else {
      reg.style.display = 'none';
      normal.style.display = 'block';
      channel.style.display = 'none';
      toggle.textContent = 'No tenes cuenta? Registrate';
      submit.textContent = 'Entrar';
    }
  }
  setMode('login');
  toggle.onclick = function () {
    if (mode === 'google' || mode === 'whatsapp') setMode('login');
    else setMode(mode === 'login' ? 'register' : 'login');
  };

  function showOtp(ch, identifier, devCode) {
    currentChannel = ch || 'email';
    currentIdentifier = identifier;
    form.style.display = 'none';
    otpDiv.style.display = 'flex';
    var hint = (currentChannel === 'whatsapp') ? 'WhatsApp' : 'email';
    otpInfo.textContent = 'Se envio un codigo de verificacion por ' + hint + ' a ' + identifier + '. (Modo demo: ' + devCode + ')';
    otpMsg.style.display = 'none';
  }

  form.onsubmit = async function (e) {
    e.preventDefault();
    msg.style.display = 'none';
    var fd = new FormData(form);
    if (mode === 'register') {
      var pw = fd.get('password');
      if (!strongPassword(pw)) {
        msg.textContent = 'Contrasena insegura: 8+ caracteres, mayuscula, minuscula, numero y simbodo.';
        msg.style.display = 'block';
        return;
      }
      var payload = {
        first_name: fd.get('first_name'),
        last_name: fd.get('last_name'),
        email: fd.get('email'),
        phone: fd.get('phone') || '',
        dni: fd.get('dni') || '',
        password: pw,
      };
      var r = await fetch(API + '/auth/register', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      var data = await r.json().catch(function () { return {}; });
      if (!r.ok) {
        msg.textContent = data.detail || 'No se pudo crear la cuenta.';
        msg.style.display = 'block';
        return;
      }
      if (data.need_verification) {
        msg.textContent = (data.emailSent === false)
          ? 'Cuenta creada, pero no pudimos enviar el email de verificación. Contactá al soporte o reintentá más tarde.'
          : 'Cuenta creada. Te enviamos un código de verificación por email. Ingresalo abajo.';
        msg.style.color = (data.emailSent === false) ? '#f87171' : '#34d399';
        msg.style.display = 'block';
        currentChannel = 'email';
        currentIdentifier = data.email || payload.email;
        form.style.display = 'none';
        otpDiv.style.display = 'flex';
        otpInfo.textContent = 'Ingresá el código de 6 dígitos que enviamos a ' + currentIdentifier + '.';
        return;
      }
      mode = 'login';
    }

    if (mode === 'google') {
      var email = chanInput.value.trim();
      if (!email) { msg.textContent = 'Ingresa tu email de Google.'; msg.style.display = 'block'; return; }
      var r = await fetch(API + '/auth/google', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email }),
      });
      var data = await r.json().catch(function () { return {}; });
      if (!r.ok) { msg.textContent = (data && data.detail) || 'Error con Google.'; msg.style.display = 'block'; return; }
      showOtp(data.channel, data.identifier, data.dev_code);
      return;
    }

    if (mode === 'whatsapp') {
      var phone = chanInput.value.trim();
      if (!phone) { msg.textContent = 'Ingresa tu telefono.'; msg.style.display = 'block'; return; }
      var r = await fetch(API + '/auth/request-code', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: 'whatsapp', identifier: phone }),
      });
      var data = await r.json().catch(function () { return {}; });
      if (!r.ok) { msg.textContent = (data && data.detail) || 'No se pudo enviar el codigo.'; msg.style.display = 'block'; return; }
      showOtp(data.channel, data.identifier, data.dev_code);
      return;
    }

    // normal email/password login
    var email2 = fd.get('email');
    var pw2 = fd.get('password');
    var lr = await fetch(API + '/auth/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email2, password: pw2, channel: 'email' }),
    });
    var data = await lr.json().catch(function () { return {}; });
    if (!lr.ok) {
      msg.textContent = (data && data.detail) || 'Credenciales invalidas.';
      msg.style.display = 'block';
      return;
    }
    if (data.need_otp) showOtp(data.channel, data.identifier, data.dev_code);
    else window.location.href = 'portal de clientes.html';
  };

  document.getElementById('svverify').onclick = async function () {
    var code = document.getElementById('svcode').value.trim();
    otpMsg.style.display = 'none';
    var isRegister = mode === 'register';
    var r = await fetch(API + '/auth/' + (isRegister ? 'verify-register' : 'verify-otp'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: currentIdentifier, identifier: currentIdentifier, channel: currentChannel, code: code }),
    });
    var data = await r.json().catch(function () { return {}; });
    if (!r.ok) {
      otpMsg.textContent = (data && data.detail) || 'Codigo incorrecto.';
      otpMsg.style.display = 'block';
      return;
    }
    if (isRegister) {
      window.location.href = 'index.html';
    } else {
      window.location.href = 'portal de clientes.html';
    }
  };

  document.getElementById('svresendemail').onclick = async function () {
    var email = (document.querySelector('#svf [name="email"]') || {}).value || '';
    if (chanInput.value.trim() && (mode === 'google' || mode === 'whatsapp')) email = chanInput.value.trim();
    if (!email) { alert('Ingresa tu email primero.'); return; }
    var endpoint = mode === 'register' ? '/auth/resend-verification' : '/auth/request-code';
    var body = mode === 'register'
      ? { email: email }
      : { channel: 'email', identifier: email };
    var r = await fetch(API + endpoint, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    var data = await r.json().catch(function () { return {}; });
    if (!r.ok) { alert((data && data.detail) || 'No se pudo enviar el codigo.'); return; }
    showOtp(data.channel || 'email', data.identifier || email, data.dev_code);
  };

  var googleOAuthEnabled = false;
  var googleDemoEnabled = false;
  fetch(API + '/config').then(function (r) { return r.json(); }).then(function (cfg) {
    if (cfg && cfg.googleOAuth) googleOAuthEnabled = true;
    if (cfg && cfg.demoEnabled) googleDemoEnabled = true;
    if (!googleOAuthEnabled && !googleDemoEnabled) {
      var gb = document.getElementById('btn-auth-google');
      if (gb) gb.style.display = 'none';
    }
  }).catch(function () {});

  var btnGoogle = document.getElementById('btn-auth-google');
  if (btnGoogle) {
    btnGoogle.addEventListener('click', function (e) {
      e.preventDefault();
      if (googleOAuthEnabled) { window.location.href = '/api/auth/google/start'; return; }
      if (googleDemoEnabled) {
        setMode('google');
        box.style.display = 'block';
        btnEmail.style.display = 'none';
      }
    });
  }
  var btnWa = document.getElementById('btn-auth-whatsapp');
  if (btnWa) {
    btnWa.addEventListener('click', function (e) {
      e.preventDefault();
      setMode('whatsapp');
      box.style.display = 'block';
      btnEmail.style.display = 'none';
    });
  }
  btnEmail.addEventListener('click', function (e) {
    e.preventDefault();
    setMode('login');
    box.style.display = 'block';
    btnEmail.style.display = 'none';
  });

  // Bloque "Olvide mi contraseña" -> pagina dedicada
  var forgotWrap = document.createElement('div');
  forgotWrap.style.cssText = 'margin-top:0.6rem;text-align:center;';
  var forgotLink = document.createElement('button');
  forgotLink.type = 'button';
  forgotLink.textContent = 'Olvide mi contraseña';
  forgotLink.style.cssText = 'background:none;border:none;color:var(--primary);font-size:0.8rem;cursor:pointer;text-decoration:underline;';
  forgotWrap.appendChild(forgotLink);
  if (card) card.appendChild(forgotWrap);

  forgotLink.addEventListener('click', function (e) {
    e.preventDefault();
    window.location.href = 'recuperar-contrasena.html';
  });
})();
