/*
 * Puente para usar la app fuera de Claude.
 *
 * Dentro de Claude, la app usa window.claude.use('db' | 'user' | 'downloads').
 * Aquí se recrea esa misma interfaz:
 *  - Sin configuración de Firebase (config.js vacío): todo se guarda en este dispositivo.
 *  - Con configuración: los datos se sincronizan entre vuestros móviles a través de
 *    Cloud Firestore, entrando con email y contraseña.
 */
(function(){
  if(window.claude&&window.claude.use)return; // dentro de Claude: no tocar nada

  const FB_VER='10.14.1';
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

  if(!cfg||!cfg.apiKey||!cfg.projectId){
    window.claude={use:async n=>n==='downloads'?downloads:null};
    return;
  }

  /* ---------- carga de Firebase ---------- */
  const load=src=>new Promise((ok,ko)=>{const s=document.createElement('script');s.src=src;s.onload=ok;s.onerror=ko;document.head.appendChild(s)});
  const base='https://www.gstatic.com/firebasejs/'+FB_VER+'/';
  const ready=load(base+'firebase-app-compat.js')
    .then(()=>Promise.all([load(base+'firebase-auth-compat.js'),load(base+'firebase-firestore-compat.js')]))
    .then(()=>{
      firebase.initializeApp(cfg);
      const fs=firebase.firestore(),auth=firebase.auth();
      try{fs.settings({ignoreUndefinedProperties:true,merge:true})}catch(e){}
      if(cfg.emulator){ // solo para pruebas en local con el emulador de Firebase
        auth.useEmulator('http://localhost:9099');fs.useEmulator('localhost',8080);
      }
      return{auth,fs};
    });

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

  /* ---------- pantalla de entrada ---------- */
  const css=`.casa-login{position:fixed;inset:0;z-index:60;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(10,16,30,.5)}
.casa-login form{background:var(--bg,#fff);color:var(--ink,#111);width:100%;max-width:380px;border-radius:24px;padding:22px;box-shadow:0 20px 50px rgba(0,0,0,.25)}
.casa-login h3{margin:0 0 6px;font-size:1.35rem;font-weight:800}
.casa-login p{margin:0 0 14px;color:var(--muted,#666);font-size:.92rem}
.casa-login input{display:block;width:100%;margin:0 0 10px}
.casa-login .err{color:var(--danger,#c00);min-height:1.2em;font-size:.88rem;margin:0 0 8px}
.casa-login .row2{display:flex;gap:10px;margin-top:6px}.casa-login .row2 .btn{flex:1}`;

  function askLogin(auth){
    return new Promise(resolve=>{
      const st=document.createElement('style');st.textContent=css;document.head.appendChild(st);
      const ov=document.createElement('div');ov.className='casa-login';
      ov.innerHTML=`<form autocomplete="on">
        <h3>Entrar en Casa</h3>
        <p>Entra con tu cuenta para compartir la casa con la otra persona. Solo hace falta la primera vez en cada móvil.</p>
        <input class="field" type="email" name="email" autocomplete="username" placeholder="Email" required>
        <input class="field" type="password" name="password" autocomplete="current-password" placeholder="Contraseña" required>
        <div class="err" role="alert"></div>
        <div class="row2"><button type="button" class="btn sec" data-skip>Ahora no</button><button type="submit" class="btn">Entrar</button></div>
      </form>`;
      const done=v=>{ov.remove();st.remove();resolve(v)};
      ov.querySelector('[data-skip]').onclick=()=>done(null);
      ov.querySelector('form').addEventListener('submit',async e=>{
        e.preventDefault();
        const f=e.target,err=ov.querySelector('.err');err.textContent='';
        try{const r=await auth.signInWithEmailAndPassword(f.email.value.trim(),f.password.value);done(r.user)}
        catch(x){err.textContent=/wrong-password|invalid-credential|user-not-found|invalid-email/.test(x.code||'')?'Email o contraseña incorrectos':'No se ha podido entrar ('+(x.code||'sin conexión')+')'}
      });
      document.body.appendChild(ov);
      ov.querySelector('input').focus();
    });
  }

  const session=ready.then(({auth,fs})=>new Promise(res=>{
    const off=auth.onAuthStateChanged(async u=>{
      off();
      if(!u)u=await askLogin(auth);
      res(u?{u,fs,auth}:null);
    });
  })).catch(()=>null);

  window.casaLogout=()=>session.then(s=>s&&s.auth.signOut()).then(()=>location.reload());

  window.claude={
    use:async name=>{
      if(name==='downloads')return downloads;
      const s=await session;if(!s)return null;
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
})();
