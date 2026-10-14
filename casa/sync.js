/*
 * Puente para usar la app fuera de Claude.
 *
 * Dentro de Claude, la app usa window.claude.use('db' | 'user' | 'downloads').
 * Aquí se recrea esa misma interfaz con Firebase (Cloud Firestore + inicio de
 * sesión con email y contraseña).
 *
 * La app es privada: no se muestra nada hasta que se entra con una cuenta que
 * tenga acceso a los datos de la casa (lo deciden las reglas de Firestore).
 */
(function(){
  if(window.claude&&window.claude.use)return; // dentro de Claude: no tocar nada

  const FB_VER='10.14.1';
  const LS='casa-app-v1';
  const cfg=window.CASA_FIREBASE;

  /* ---------- descargas (copias de seguridad en archivo) ---------- */
  const downloads={
    save:async({filename,data,mimeType})=>{
      const blob=data instanceof Blob?data:new Blob([data],{type:mimeType||'application/json'});
      const url=URL.createObjectURL(blob);
      const a=document.createElement('a');a.href=url;a.download=filename||'casa.json';
      document.body.appendChild(a);a.click();a.remove();
      setTimeout(()=>URL.revokeObjectURL(url),10000);
    }
  };

  /* ---------- pantalla de bloqueo: la app no se ve hasta entrar ---------- */
  const st=document.createElement('style');
  st.textContent=`body.casa-locked>:not(.casa-gate){visibility:hidden!important}
.casa-gate{position:fixed;inset:0;z-index:60;display:flex;align-items:center;justify-content:center;padding:18px;background:var(--bg,#F6F5FB)}
.casa-gate .box{background:var(--surface,#fff);color:var(--ink,#111);width:100%;max-width:380px;border-radius:24px;padding:22px;box-shadow:0 14px 40px rgba(26,21,48,.14)}
.casa-gate img{width:64px;height:64px;border-radius:16px;display:block;margin:0 0 14px}
.casa-gate h3{margin:0 0 6px;font-size:1.35rem;font-weight:800}
.casa-gate p{margin:0 0 14px;color:var(--muted,#666);font-size:.92rem}
.casa-gate input{display:block;width:100%;margin:0 0 10px}
.casa-gate .err{color:var(--danger,#c00);min-height:1.2em;font-size:.88rem;margin:0 0 8px}
.casa-gate .btn{width:100%}`;
  document.head.appendChild(st);
  document.body.classList.add('casa-locked');
  let gate=null;
  function showGate(html){
    if(!gate){gate=document.createElement('div');gate.className='casa-gate';document.body.appendChild(gate)}
    gate.innerHTML=`<div class="box"><img src="icons/icon-192.png" alt="">${html}</div>`;
    return gate;
  }
  function unlock(){if(gate){gate.remove();gate=null}document.body.classList.remove('casa-locked')}
  function clearLocal(){
    try{Object.keys(localStorage).filter(k=>k.startsWith(LS)).forEach(k=>localStorage.removeItem(k))}catch(e){}
  }

  let resolveSession;
  const session=new Promise(r=>resolveSession=r);
  window.claude={
    use:async name=>{
      if(name==='downloads')return downloads;
      const s=await session;
      if(name==='db')return{
        doc:p=>wrapDoc(s.fs.doc(p)),
        collection:p=>wrapCol(s.fs.collection(p))
      };
      if(name==='user')return{
        id:async()=>s.u.uid,
        email:async()=>s.u.email,
        can:async()=>true
      };
      return null;
    }
  };

  if(!cfg||!cfg.apiKey||!cfg.projectId){
    showGate(`<h3>Casa</h3><p>Esta app es privada y todavía no tiene configurado el acceso. Sigue el paso «Acceso privado» del README para activarlo.</p>`);
    return;
  }

  /* ---------- errores con los mismos códigos que espera la app ---------- */
  const mapErr=e=>{
    const c=e&&e.code||'';
    const out=new Error(e&&e.message||'error');
    out.code=c==='permission-denied'?'invalid_argument':c.replace(/-/g,'_');
    return out;
  };
  const wrapDoc=ref=>({
    id:ref.id,
    get:()=>ref.get().catch(e=>{throw mapErr(e)}),
    set:d=>ref.set(d).catch(e=>{throw mapErr(e)}),
    delete:()=>ref.delete().catch(e=>{throw mapErr(e)}),
    onSnapshot:(next,err)=>ref.onSnapshot(next,e=>err&&err(mapErr(e)))
  });
  const wrapCol=col=>({
    doc:id=>wrapDoc(col.doc(id)),
    get:()=>col.get().catch(e=>{throw mapErr(e)})
  });

  /* ---------- entrar ---------- */
  function showLogin(auth,msg){
    const g=showGate(`<form autocomplete="on">
      <h3>Entrar en Casa</h3>
      <p>App privada. Entra con tu cuenta; solo hace falta la primera vez en cada móvil.</p>
      <input class="field" type="email" name="email" autocomplete="username" placeholder="Email" required>
      <input class="field" type="password" name="password" autocomplete="current-password" placeholder="Contraseña" required>
      <div class="err" role="alert">${msg||''}</div>
      <button type="submit" class="btn">Entrar</button>
      <button type="button" class="link" data-reset style="display:block;margin:14px auto 0">¿Has olvidado la contraseña?</button>
    </form>`);
    g.querySelector('[data-reset]').onclick=async()=>{
      const em=g.querySelector('input[type=email]'),err=g.querySelector('.err');
      if(!em.value.trim()){err.textContent='Escribe primero tu email';em.focus();return}
      try{await auth.sendPasswordResetEmail(em.value.trim());err.textContent='Te hemos enviado un correo para cambiar la contraseña (mira también en Spam)'}
      catch(x){err.textContent=x.code==='auth/invalid-email'?'El email no es válido':'No se ha podido enviar el correo ('+(x.code||'sin conexión')+')'}
    };
    g.querySelector('form').addEventListener('submit',async e=>{
      e.preventDefault();
      const f=e.target,err=g.querySelector('.err');err.textContent='';
      try{await auth.signInWithEmailAndPassword(f.email.value.trim(),f.password.value)}
      catch(x){const c=x.code||'';err.textContent=/too-many-requests/.test(c)?'Demasiados intentos seguidos: Firebase ha bloqueado el acceso un rato. Espera unos 15-30 minutos o cambia la contraseña con «¿Has olvidado la contraseña?»':/wrong-password|invalid-credential|user-not-found|invalid-email|user-disabled/.test(c)?'Email o contraseña incorrectos':'No se ha podido entrar ('+(c||'sin conexión')+')'}
    });
    g.querySelector('input').focus();
  }

  /* ---------- carga de Firebase ---------- */
  const load=src=>new Promise((ok,ko)=>{const s=document.createElement('script');s.src=src;s.onload=ok;s.onerror=ko;document.head.appendChild(s)});
  const base='https://www.gstatic.com/firebasejs/'+FB_VER+'/';
  showGate(`<h3>Casa</h3><p>Abriendo…</p>`);
  load(base+'firebase-app-compat.js')
    .then(()=>Promise.all([load(base+'firebase-auth-compat.js'),load(base+'firebase-firestore-compat.js')]))
    .then(()=>{
      firebase.initializeApp(cfg);
      const fs=firebase.firestore(),auth=firebase.auth();
      try{fs.settings({ignoreUndefinedProperties:true,merge:true})}catch(e){}
      if(cfg.emulator){ // solo para pruebas en local con el emulador de Firebase
        auth.useEmulator('http://localhost:9099');fs.useEmulator('localhost',8080);
      }
      let opened=false;
      window.casaLogout=async()=>{await auth.signOut()};
      auth.onAuthStateChanged(async u=>{
        if(!u){
          // Sesión cerrada: se borra lo guardado en este dispositivo
          clearLocal();
          if(opened){location.reload();return}
          let msg='';try{msg=sessionStorage.getItem('casa-denied')||'';sessionStorage.removeItem('casa-denied')}catch(e){}
          showLogin(auth,msg);return;
        }
        // Comprobar que esta cuenta tiene acceso a los datos de la casa
        try{await fs.doc('hogar/estado').get()}
        catch(e){
          if(e&&e.code==='permission-denied'){
            try{sessionStorage.setItem('casa-denied','Esta cuenta no tiene acceso a la casa')}catch(x){}
            opened=true;await auth.signOut();return;
          }
          // sin conexión: se deja entrar con lo guardado en el dispositivo
        }
        opened=true;unlock();resolveSession({u,fs,auth});
      });
    })
    .catch(()=>{
      const g=showGate(`<h3>Casa</h3><p>No hay conexión para comprobar tu cuenta.</p><button type="button" class="btn">Reintentar</button>`);
      g.querySelector('button').onclick=()=>location.reload();
    });
})();
