// Recepción Web Push. El envío requiere un servicio autenticado configurado.
(function(){
  const key='casa-push-enabled';
  function supported(){return 'serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window}
  function decode(value){const s=value.replace(/-/g,'+').replace(/_/g,'/');return Uint8Array.from(atob(s+'='.repeat((4-s.length%4)%4)),c=>c.charCodeAt(0))}
  window.CasaPush={
    supported,
    async enable({publicKey,register}){
      if(!supported())throw new Error('Este navegador no permite notificaciones. En iPhone, abre CASA desde la pantalla de inicio.');
      if(!publicKey||typeof register!=='function')throw new Error('El servicio de envío todavía no está configurado.');
      const perm=await Notification.requestPermission();if(perm!=='granted')throw new Error(perm==='denied'?'Las notificaciones están bloqueadas para Casa en este móvil.':'No se ha dado permiso para las notificaciones (puede que el navegador lo haya bloqueado sin preguntar).');
      // Si el componente de avisos de Casa no está listo, se intenta arrancar; nunca se queda esperando sin decir nada
      if(!(await navigator.serviceWorker.getRegistration()))await navigator.serviceWorker.register('sw.js',{updateViaCache:'none'}).catch(()=>{});
      const sw=await Promise.race([navigator.serviceWorker.ready,new Promise((_,no)=>setTimeout(()=>no(new Error('Casa no ha podido prepararse para los avisos. Cierra Casa del todo, vuelve a abrirla y pulsa otra vez.')),12000))]);
      let subscription=await sw.pushManager.getSubscription(),created=false;
      if(!subscription){subscription=await sw.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:decode(publicKey)});created=true}
      try{await register(subscription.toJSON());localStorage.setItem(key,'1')}
      catch(error){
        // Sin conexión con el servicio (red, compañía…): el móvil se queda suscrito y el alta se reintenta sola
        if(error&&(error.name==='TypeError'||/fetch|network|red/i.test(error.message))){localStorage.setItem(key,'1');error.pending=true;throw error}
        if(created)await subscription.unsubscribe();throw error}
      return subscription;
    },
    async disable(unregister){
      const sw=await navigator.serviceWorker.ready,subscription=await sw.pushManager.getSubscription();
      if(subscription){if(typeof unregister!=='function')throw new Error('Falta la conexión segura para desactivar los envíos.');await unregister(subscription.toJSON());await subscription.unsubscribe()}
      localStorage.removeItem(key);
    },
    async test(){
      if(!supported()||Notification.permission!=='granted')throw new Error('Activa primero los permisos en este móvil.');
      const sw=await navigator.serviceWorker.ready;
      await sw.showNotification('📬 Tienes un mensaje de Casa',{body:'Este móvil puede mostrar avisos. El envío remoto se comprueba por separado.',icon:'icons/icon-192.png',tag:'casa-test',data:{url:new URL('./',location.href).href}});
    }
  };
})();
