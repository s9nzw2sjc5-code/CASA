/* Plan de limpieza por zonas, consejos y recomendaciones según el tiempo.
   Funciones puras: no guardan nada ni contienen datos de ninguna casa concreta.
   Las zonas las marca cada hogar en la app y la ubicación se guarda en sus datos privados. */
(function(root){
 'use strict';
 const norm=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
 const pad=n=>String(n).padStart(2,'0');
 const validDate=d=>/^\d{4}-\d{2}-\d{2}$/.test(d||'')&&Number.isFinite(Date.parse(d+'T12:00:00Z'))&&new Date(d+'T12:00:00Z').toISOString().slice(0,10)===d;
 const plus=(s,n)=>{const d=new Date(s+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)};
 const weekday=s=>(new Date(s+'T12:00:00Z').getUTCDay()+6)%7; // 0 = lunes
 const byDate=(a,b)=>(a.date||'9').localeCompare(b.date||'9');

 const ZONES=[
  ['cocina','Cocina'],['banoPrincipal','Baño principal'],['banoInvitados','Baño de invitados'],['aseo','Aseo o baño de la entrada'],
  ['dormitorio','Dormitorio principal'],['invitados','Cuarto de invitados'],['salon','Salón'],['estarSotano','Zona de estar del sótano'],
  ['patio','Patio'],['terraza','Terraza'],['gimnasio','Gimnasio'],['escaleras','Escaleras'],['taller','Taller'],
  ['ropa','Colada: lavadoras y ropa limpia'],['lavadero','Lavadero'],['secadora','Secadora'],['garaje','Garaje'],['almacen','Almacén'],
  ['ventanas','Ventanas y persianas'],['radiadores','Radiadores y caldera'],['aire','Aire acondicionado'],['chimenea','Chimenea'],
  ['entrada','Entrada y recibidor'],['mascota','Fuente de agua de Ringo']
 ];
 // Con dos lavadoras, cada una tiene su nombre para distinguirlas (se puede cambiar en el plan)
 const WASHER_NAMES=['Lavadora de arriba','Lavadora de abajo'];
 const washerNames=L=>{const n=(L&&Array.isArray(L.names)?L.names:[]).map(s=>String(s||'').trim().slice(0,40));return WASHER_NAMES.map((d,i)=>n[i]||d)};
 const lcFirst=s=>s.charAt(0).toLowerCase()+s.slice(1);
 // Lo que hay en casa para la colada (se guarda en los datos privados de la casa)
 const LAUNDRY=[['twoWashers','Dos lavadoras'],['dryer','Secadora'],['coveredLine','Tendedero cubierto en el exterior (patio, terraza…)'],['indoorLine','Tendedero dentro de casa (lavadero, sótano…)']];

 /* Consejos paso a paso. Se muestran en la tarea, en el rincón del día y en la biblioteca. */
 const TIPS={
  rieles:{title:'Rieles de las ventanas',steps:['Aspira primero la arena, los pelos y los bichitos con la boquilla estrecha de la aspiradora.','Rocía agua caliente con un chorrito de vinagre (o jabón neutro) y deja actuar 5 minutos para ablandar la suciedad pegada.','Frota las esquinas con un cepillo de dientes viejo. Para el fondo del riel, un palito o un cuchillo de untar envuelto en un paño.','Recoge con papel de cocina y seca bien: si queda húmedo, sale moho.','Si el alféizar es de mármol o piedra, nada de vinagre: solo agua y jabón neutro.','Truco: una vez limpio, pasa la aspiradora por los rieles cada semana al aspirar la habitación. Es un minuto y no se vuelve a acumular.']},
  persianas:{title:'Cintas de las persianas',steps:['Baja la persiana del todo para que quede fuera la mayor parte de la cinta.','Sujeta la cinta tensa con una mano y pásale un paño de microfibra apenas húmedo con agua y jabón neutro.','Sube la persiana poco a poco y repite tramo a tramo hasta llegar arriba.','Sécala con un paño seco antes de que se enrolle.','No la empapes ni uses lejía: se enrolla dentro del cajón y la humedad la estropea.','Si está deshilachada o negra del todo, cambiarla es barato: mide el ancho antes de comprarla.']},
  cristales:{title:'Cristales y marcos por dentro',steps:['Mejor en un día nublado o cuando no les dé el sol: con sol se secan antes de tiempo y quedan marcas.','Limpia primero los marcos con un paño húmedo y jabón neutro.','Para el cristal: agua templada con un chorrito de vinagre o alcohol, y un paño de microfibra.','Pasa en forma de «S» o «Z» de arriba abajo y seca enseguida con un segundo paño seco.']},
  ventanasFuera:{title:'Ventanas por fuera',steps:['Solo con tiempo seco y sin viento. Con sol directo quedan marcas: mejor a primera hora o por la tarde.','No te asomes ni te subas a sillas junto a la ventana: usa una mopa o un limpiacristales con mango extensible.','Quita primero el polvo y las telarañas del marco con una escoba suave.','Después agua con un chorrito de vinagre y seca con una rasqueta de goma de arriba abajo.']},
  radiadores:{title:'Purgar los radiadores',steps:['Hazlo con la calefacción apagada y los radiadores fríos.','Empieza por los de la planta más baja y sube hasta la más alta: el aire tiende a subir.','Pon un trapo y un vaso bajo la llave de purga (arriba, en un lateral) y ábrela un cuarto de vuelta con una moneda o la llave de purgar.','Primero sale aire (se oye un siseo). Cierra en cuanto salga solo agua.','Al terminar, mira la presión de la caldera en frío: suele ir entre 1 y 1,5 bar. Si ha bajado, rellena como indica el manual.','Señal de que hace falta: radiadores fríos por arriba y calientes por abajo, o ruido de agua.']},
  radiadoresPolvo:{title:'Quitar el polvo de radiadores y rejillas',steps:['Con la calefacción apagada y fría.','Usa un cepillo largo de radiador o un plumero fino entre las placas.','Truco: pon una toalla húmeda debajo y sopla con el secador de pelo en frío entre las aletas; el polvo cae en la toalla.','Termina con un paño húmedo por fuera y por las rejillas.']},
  caldera:{title:'Caldera',steps:['Mira el manómetro con la calefacción fría: suele ir entre 1 y 1,5 bar (compruébalo en el manual).','Si está por debajo, rellena con la llave de llenado poco a poco y ciérrala.','Pide la revisión periódica a un técnico autorizado, mejor antes del frío, cuando hay menos lista de espera.','Si la presión baja a menudo, avisa al técnico: puede haber una fuga.']},
  secadoraFiltro:{title:'Filtro de la secadora',steps:['Saca el filtro de pelusa después de cada secado y quita la pelusa con la mano.','Una vez al mes, acláralo bajo el grifo y déjalo secar del todo antes de ponerlo.','Si es de condensación, vacía el depósito de agua cada vez (o conecta el desagüe).','Un filtro limpio seca antes, gasta menos y evita riesgo de incendio.']},
  secadoraCondensador:{title:'Condensador y sensores de la secadora',steps:['Desenchufa la secadora.','Abre la tapa de abajo, saca el condensador (mira el manual) y acláralo con la ducha con agua templada por los dos lados.','No frotes las láminas con cepillos duros: se doblan.','Déjalo escurrir y secar antes de volver a ponerlo.','Limpia también las dos tiras metálicas del tambor (los sensores de humedad) con un paño con un poco de vinagre.']},
  secadoraGoma:{title:'Goma y desagüe de la secadora',steps:['Limpia la goma de la puerta con un paño húmedo y revisa que no esté rota.','Comprueba que el tubo de desagüe no esté doblado ni obstruido.','Si es de evacuación, revisa que el tubo de salida al exterior no tenga pelusa acumulada.']},
  lavadoraFiltro:{title:'Filtro y goma de la lavadora',steps:['Pon una toalla y una bandeja baja delante: va a salir agua.','Abre la tapa de abajo, saca el tubito de vaciado y deja salir el agua.','Desenrosca el filtro y quítale pelusas, monedas y horquillas. Acláralo y enróscalo bien.','Limpia los pliegues de la goma de la puerta con un paño con agua y jabón y sécalos.','Deja la puerta y el cajetín del detergente abiertos después de cada lavado para que no huela.','Una vez al mes, un lavado en vacío a 60 °C con limpialavadoras.']},
  lavar:{title:'Día de colada',steps:['La noche anterior, separa la ropa: blanca, color y oscura; toallas y sábanas aparte.','Con dos lavadoras, ponlas a la vez (por ejemplo, una de blanco y otra de color): en una mañana tienes hecha toda la colada.','Vacía los bolsillos y cierra cremalleras.','Programa el inicio diferido para que terminen cuando estés en casa y la ropa no se quede húmeda dentro.','Mira la tarjeta del tiempo: te dice si hoy conviene el tendedero de fuera, el de dentro o la secadora.','Dos días de colada entre semana evitan llegar al sábado con la cesta llena.']},
  tender:{title:'Dónde tender según el tiempo',steps:['Día seco y sin mucho viento: tendedero exterior. Al aire se seca antes y huele mejor.','Con lluvia, el tendedero cubierto sirve si no sopla viento, aunque tarda más en secarse.','Con viento fuerte, mucho frío o lluvia de lado: tendedero de dentro, con la ventana un poco abierta o el deshumidificador.','Secadora para toallas y sábanas cuando corre prisa o no hay forma de secar.','Tiende la ropa en cuanto termine la lavadora y bien estirada: se arruga menos y casi no hay que planchar.']},
  entrada:{title:'Entrada y recibidor',steps:['Sacude o aspira el felpudo: retiene casi toda la tierra que entra en casa.','Barre o aspira de dentro hacia la puerta.','Quita el polvo del mueble del recibidor, el espejo y los pomos.','Friega el suelo, sobre todo si ha llovido.']},
  fuente:{title:'Fuente de agua de Ringo',steps:['Desenchúfala y vacía el agua.','Desmonta todas las piezas, también la bomba (mira el manual).','Lávalas con agua caliente y jabón neutro. Un cepillo pequeño o un bastoncillo para la bomba y los rincones donde se forma la capa resbaladiza.','Aclara muy bien: no puede quedar ni rastro de jabón.','Monta, llena con agua fresca y comprueba que la bomba suena y el agua corre antes de dejarla.','Entre limpiezas, rellena con agua fresca cada día.']},
  fuenteFiltro:{title:'Filtro de la fuente de Ringo',steps:['Cámbialo cuando toque según el fabricante; si no lo dice, cada 2–4 semanas o antes si se ve sucio o el agua huele.','Aprovecha para lavar la fuente entera ese mismo día.','Aclara el filtro nuevo bajo el grifo antes de ponerlo para quitarle el polvillo del carbón.','Ten siempre uno de repuesto: así no se queda sin cambiar.']},
  doblar:{title:'Doblar y guardar la ropa limpia',steps:['Dóblala en cuanto la recojas: se arruga menos y te ahorras plancha.','Haz un montón por persona y otro de ropa de casa (toallas, sábanas).','Guárdala en el momento: si se queda en una silla, se acumula.','Las camisetas, dobladas en vertical en el cajón: se ve todo de un vistazo.']},
  campana:{title:'Filtros de la campana',steps:['Los filtros metálicos van en el lavavajillas, solos y a temperatura alta.','Sin lavavajillas: déjalos 15 minutos en agua muy caliente con lavavajillas y dos cucharadas de bicarbonato, frota con un cepillo y aclara.','Sécalos bien antes de ponerlos.','Los filtros de carbón no se lavan: se cambian cuando lo indique el manual.','Limpia también la carcasa de la campana con desengrasante.']},
  horno:{title:'Horno y microondas',steps:['Microondas: calienta 3–5 minutos un bol con agua y medio limón, espera 2 minutos sin abrir y pasa un paño: la suciedad sale sola.','Horno: con el horno frío, unta una pasta de bicarbonato y agua por dentro (no en la resistencia) y déjala toda la noche.','Al día siguiente retírala con un paño húmedo y una espátula de plástico.','Rocía un poco de vinagre para quitar los restos blancos y aclara.','Bandejas y rejillas, a remojo en agua caliente con lavavajillas.']},
  nevera:{title:'Nevera por dentro',steps:['Hazlo antes de la compra, cuando está más vacía. Lo perecedero, a una nevera portátil o bolsa térmica.','Tira lo caducado y lo que lleve días abierto.','Saca bandejas y cajones. Los de cristal, deja que cojan temperatura ambiente antes de lavarlos con agua caliente para que no se rajen.','Limpia el interior con agua templada y bicarbonato (una cucharada por litro). No uses lejía.','Seca todo antes de volver a colocarlo. Un vasito con bicarbonato quita los olores.']},
  juntas:{title:'Juntas, mampara y desagüe de la ducha',steps:['Juntas: pasta de bicarbonato y agua, deja 10 minutos y frota con un cepillo de dientes.','Si están negras de moho: producto antimoho con la ventana abierta y guantes.','Nunca mezcles lejía con vinagre, amoniaco ni otros limpiadores: desprende gases tóxicos.','Mampara: agua con vinagre y, a diario, una pasada de rasqueta después de ducharte.','Desagüe: quita los pelos con unas pinzas o una tira de plástico para desatascar y echa agua muy caliente.']},
  bano:{title:'Limpieza semanal del baño',steps:['Echa primero el producto en el inodoro y déjalo actuar mientras limpias lo demás.','De lo más limpio a lo más sucio: espejo, lavabo, grifos, ducha y, al final, el inodoro.','Usa un paño distinto (o de otro color) para el inodoro.','Seca los grifos para que no queden marcas de cal.','Termina con el suelo, de dentro hacia la puerta.']},
  cocina:{title:'Limpieza semanal de la cocina',steps:['Recoge y despeja la encimera antes de empezar.','Agua caliente con un poco de lavavajillas para la encimera y los frentes de los muebles; las asas, que se tocan mucho, con atención.','Vitrocerámica: rasqueta para lo pegado y limpiador específico.','Fregadero: bicarbonato y un poco de vinagre en el desagüe, y seca el grifo.','Saca la basura y pasa un paño por la tapa del cubo.']},
  aire:{title:'Filtros del aire acondicionado',steps:['Desenchufa el aparato o baja su interruptor.','Abre la tapa frontal y saca los filtros (suelen deslizarse hacia abajo).','Aspíralos y después lávalos con agua tibia y jabón neutro.','Déjalos secar a la sombra del todo antes de ponerlos: si van húmedos, sale moho y huele.','Pasa un paño húmedo por la carcasa y las lamas.']},
  aireExterior:{title:'Unidad exterior del aire acondicionado',steps:['Desconecta el aparato.','Quita hojas, plumas y suciedad alrededor de la unidad: necesita espacio para respirar.','Pasa un cepillo suave por las aletas en el sentido de las láminas, sin agua a presión porque se doblan.','Comprueba que el tubo de desagüe gotea libre y no está atascado.']},
  chimenea:{title:'Chimenea',steps:['Una vez al año, antes de la temporada, deshollinado por un profesional.','Saca la ceniza siempre fría (mejor al día siguiente) y guárdala en un cubo metálico con tapa, nunca de plástico.','Cristal: moja papel de periódico, mójalo en la propia ceniza y frota; luego un paño húmedo.','Quema solo leña seca: la húmeda ensucia más el tiro.']},
  canaletas:{title:'Canaletas y desagües antes de las lluvias',steps:['Con guantes y sin subirte a sitios inestables.','Retira hojas, tierra y nidos de las canaletas y de las rejillas de los desagües.','Echa un cubo de agua para comprobar que corre bien.','Revísalos también después de una tormenta o de días de viento.']},
  terraza:{title:'Terraza',steps:['Barre en seco las hojas y la tierra hacia fuera de los desagües, no hacia ellos.','Vacía los platos de las macetas para que no críen mosquitos.','Friega con agua y jabón neutro; en día seco se seca enseguida.','Revisa que la rejilla del desagüe esté limpia.']},
  burletes:{title:'Burletes de puertas y ventanas',steps:['Con la ventana cerrada, pasa la mano o una tira de papel por el borde: si notas aire, el burlete falla.','Limpia el marco y pega un burlete adhesivo nuevo (de espuma o goma) del grosor que necesites.','Para la parte de abajo de las puertas, un burlete bajo puerta.','Es de lo que más se nota en la factura de la calefacción.']},
  colchones:{title:'Colchones',steps:['Quita la ropa de cama y ventila el colchón un rato.','Espolvorea bicarbonato, déjalo una hora y aspíralo con la boquilla de tapicería.','Dale la vuelta o gíralo de pies a cabeza para que se desgaste igual (si el fabricante lo permite).','Lava el protector de colchón.']},
  humedades:{title:'Humedades y moho',steps:['Ventila 10 minutos cada día, también en invierno, sobre todo baños y dormitorios.','Revisa las esquinas del techo, detrás de los muebles y dentro de los armarios.','Si hay manchas de moho: producto antimoho o agua con un poco de lejía, con guantes y ventilando. Sin mezclar con otros productos.','Separa los muebles un par de dedos de las paredes frías.','Si vuelve una y otra vez en el mismo sitio, consulta con un profesional.']},
  cubos:{title:'Cubos de basura',steps:['Vacíalos y friégalos con agua caliente y jabón o bicarbonato.','Déjalos secar al aire, mejor al sol, antes de poner bolsa nueva.','Una cucharada de bicarbonato en el fondo evita olores.']},
  interruptores:{title:'Interruptores, pomos y mandos',steps:['Paño de microfibra con un poco de alcohol o desinfectante, nunca pulverizado directamente sobre el interruptor.','Repasa pomos de puertas, tiradores de armarios, mandos a distancia y barandillas.','Son lo que más se toca: con una vez al mes se nota mucho.']},
  lamparas:{title:'Lámparas y ventiladores',steps:['Siempre apagados y con las bombillas frías.','Pantallas de tela: rodillo quitapelusas o aspiradora con cepillo.','Aspas del ventilador: mete cada aspa en una funda de almohada vieja y tira hacia ti: el polvo se queda dentro.']},
  zocalos:{title:'Zócalos y marcos de puertas',steps:['Aspíralos con el cepillo de la aspiradora.','Paño húmedo con agua y jabón neutro y seca.','Truco: pasa después una toallita de suavizante seca; el polvo tarda más en volver a pegarse.']},
  escaleras:{title:'Escaleras',steps:['Siempre de arriba abajo: barre o aspira escalón a escalón, también las esquinas.','Friega empezando por arriba y espera a que seque antes de usarlas.','Pasamanos y barandilla con un paño húmedo: es lo que más se toca.']},
  cortinas:{title:'Lavar las cortinas',steps:['Mira la etiqueta: muchas van a la lavadora en programa delicado y en frío.','Quítales los ganchos o anillas antes de lavarlas.','Cuélgalas todavía un poco húmedas: se estiran solas y no hace falta planchar.','Aprovecha para limpiar la barra o el riel de la cortina.']},
  sofa:{title:'Sofá y bajo los muebles',steps:['Aspira el sofá con la boquilla de tapicería, también entre los cojines.','Para el pelo, un guante de goma húmedo pasado por la tela lo arrastra.','Bajo los muebles, el accesorio plano de la aspiradora o una mopa.']},
  sabanas:{title:'Dormitorio y sábanas',steps:['Al levantarte, abre la ventana 10 minutos y deja la cama destapada para que se airee.','Quita el polvo de arriba abajo: estantes, mesillas y, al final, el suelo.','Sábanas cada semana; las almohadas, a lavar o airear cada pocos meses.']},
  gimnasio:{title:'Gimnasio',steps:['Abre las ventanas para ventilar: si se usa poco, coge olor a cerrado.','Quita el polvo de las máquinas y limpia agarres y asientos con un paño con un poco de alcohol.','Revisa que no haya humedad en el suelo ni en las esterillas.']}
 };
 // Para tareas propias (no del plan): el primer patrón que coincide con el título
 const TIP_MATCH=[[/fuente.*filtro|filtro.*fuente/,'fuenteFiltro'],[/fuente/,'fuente'],[/\btender\b|tendedero/,'tender'],[/riel/,'rieles'],[/cinta.*persiana|persiana.*cinta/,'persianas'],[/purg.*radiador|radiador.*purg/,'radiadores'],[/radiador|rejilla/,'radiadoresPolvo'],[/caldera/,'caldera'],[/condensador/,'secadoraCondensador'],[/secadora/,'secadoraFiltro'],[/filtro.*lavadora|lavadora.*filtro/,'lavadoraFiltro'],[/lavadora|colada/,'lavar'],[/doblar|ropa limpia|guardar la ropa/,'doblar'],[/campana/,'campana'],[/horno|microondas/,'horno'],[/nevera|frigorifico/,'nevera'],[/junta|mampara|ducha/,'juntas'],[/por fuera/,'ventanasFuera'],[/cristal|ventana/,'cristales'],[/unidad exterior/,'aireExterior'],[/aire acondicionado|filtros? del aire/,'aire'],[/chimenea/,'chimenea'],[/canaleta|desague/,'canaletas'],[/terraza/,'terraza'],[/burlete/,'burletes'],[/colchon/,'colchones'],[/humedad|moho/,'humedades'],[/cubos? de (la )?basura/,'cubos'],[/interruptor|pomo/,'interruptores'],[/lampara|ventilador/,'lamparas'],[/zocalo/,'zocalos'],[/escalera/,'escaleras'],[/cortina/,'cortinas'],[/sofa/,'sofa'],[/bano|aseo|inodoro/,'bano'],[/entrada|recibidor/,'entrada'],[/sabana|dormitorio/,'sabanas'],[/cocina|encimera/,'cocina'],[/gimnasio/,'gimnasio']];

 // kind: week = cada semana · fortnight = cada 2 semanas · month4 = cada 4 semanas (rincón que rota)
 //       every = cada N meses desde hoy · year = una vez al año, en su temporada
 // day: 0 = lunes … 6 = domingo · week: semana del ciclo en la que toca · zone null = cualquier casa
 const ITEMS=[
  {key:'cocina-semanal',zone:'cocina',kind:'week',day:0,tip:'cocina',title:'Cocina: encimera, frente de los muebles y fregadero',notes:'10–15 minutos. Termina secando el grifo para que no queden marcas de cal.'},
  {key:'bano-principal',zone:'banoPrincipal',kind:'week',day:1,tip:'bano',title:'Baño principal: inodoro, lavabo, ducha y espejo',notes:'Deja actuar el producto en el inodoro mientras limpias el lavabo.'},
  {key:'aseo-entrada',zone:'aseo',kind:'week',day:1,tip:'bano',title:'Aseo de la entrada: repaso rápido',notes:'Lavabo, inodoro y espejo: 5 minutos.'},
  {key:'dormitorio',zone:'dormitorio',kind:'week',day:2,tip:'sabanas',title:'Dormitorio principal: polvo, ventilar y cambiar las sábanas',notes:'Ventila 10 minutos mientras quitas el polvo.'},
  {key:'salon',zone:'salon',kind:'week',day:3,tip:'sofa',title:'Salón: aspirar el sofá y bajo los muebles'},
  {key:'lavadero',zone:'lavadero',kind:'week',day:4,title:'Lavadero: limpiar la pila y el suelo'},
  {key:'secadora-filtro',zone:'secadora',kind:'week',day:4,tip:'secadoraFiltro',title:'Secadora: vaciar el filtro de pelusa y el depósito',notes:'Lo ideal es hacerlo después de cada secado: seca mejor, gasta menos y evita riesgo de incendio.'},
  {key:'escaleras',zone:'escaleras',kind:'week',day:5,tip:'escaleras',title:'Escaleras: barrer y fregar',notes:'De arriba abajo. El pasamanos, con un paño húmedo.'},
  {key:'repaso-semana',zone:null,kind:'week',day:6,title:'Repaso de la semana: mirar pendientes y reorganizar',notes:'5 minutos: en Tareas → Reorganizar pendientes, pasa lo atrasado a días con hueco.'},
  // Colada entre semana: dos lavadoras y dos días de doblar, para no llegar al fin de semana con la cesta llena
  {key:'lavadora-1',zone:'ropa',kind:'week',day:0,tip:'lavar',title:'Día de colada: poner lavadoras',notes:'La tarjeta del tiempo te dice dónde tender hoy.'},
  {key:'doblar-1',zone:'ropa',kind:'week',day:1,tip:'doblar',title:'Doblar y guardar la ropa limpia'},
  {key:'lavadora-2',zone:'ropa',kind:'week',day:3,tip:'lavar',title:'Segundo día de colada: poner lavadoras',notes:'La tarjeta del tiempo te dice dónde tender hoy.'},
  {key:'doblar-2',zone:'ropa',kind:'week',day:4,tip:'doblar',title:'Doblar y guardar la ropa limpia (2.ª vez)'},
  {key:'entrada',zone:'entrada',kind:'week',day:3,tip:'entrada',title:'Entrada: barrer y quitar el polvo del recibidor'},
  // La fuente de Ringo no se puede olvidar: van marcadas como urgentes (no se pueden posponer)
  {key:'fuente-limpiar',zone:'mascota',kind:'week',day:6,tip:'fuente',urgent:true,title:'Fuente de Ringo: lavarla y cambiar el agua'},
  {key:'fuente-filtro',zone:'mascota',kind:'month4',day:6,week:0,tip:'fuenteFiltro',urgent:true,title:'Fuente de Ringo: cambiar el filtro'},

  {key:'bano-invitados',zone:'banoInvitados',kind:'fortnight',day:1,week:1,tip:'bano',title:'Baño de invitados: repaso, abrir grifos y tirar de la cadena',notes:'Si casi no se usa, correr el agua evita que el sifón huela.'},
  {key:'cuarto-invitados',zone:'invitados',kind:'fortnight',day:2,week:1,tip:'sabanas',title:'Cuarto de invitados: ventilar y quitar el polvo'},
  {key:'patio',zone:'patio',kind:'fortnight',day:3,week:0,tip:'terraza',title:'Patio: barrer y regar las plantas'},
  {key:'estar-sotano',zone:'estarSotano',kind:'fortnight',day:3,week:1,tip:'sofa',title:'Zona de estar del sótano: polvo y aspirar'},
  {key:'garaje',zone:'garaje',kind:'fortnight',day:4,week:1,title:'Garaje: barrer y ordenar'},
  {key:'terraza',zone:'terraza',kind:'fortnight',day:5,week:0,tip:'terraza',title:'Terraza: barrer y revisar los desagües',notes:'Las hojas y la tierra atascan los desagües. Mejor con el suelo seco.'},

  {key:'nevera',zone:'cocina',kind:'month4',day:0,week:0,tip:'nevera',title:'Nevera: vaciar y limpiar por dentro',notes:'Aprovecha antes de hacer la compra, cuando está más vacía.'},
  {key:'juntas-bano',zone:'banoPrincipal',kind:'month4',day:1,week:0,tip:'juntas',title:'Baños: juntas, mampara y desagüe de la ducha'},
  {key:'interruptores',zone:null,kind:'month4',day:2,week:0,tip:'interruptores',title:'Interruptores, pomos y mandos: desinfectar'},
  {key:'lamparas',zone:null,kind:'month4',day:3,week:0,tip:'lamparas',title:'Lámparas y ventiladores: quitar el polvo'},
  {key:'lavadora-filtro',zone:'lavadero',kind:'month4',day:4,week:0,tip:'lavadoraFiltro',title:'Lavadora: limpiar el filtro y la goma de la puerta'},
  {key:'gimnasio',zone:'gimnasio',kind:'month4',day:5,week:0,tip:'gimnasio',title:'Gimnasio: ventilar, quitar el polvo y limpiar las máquinas'},
  {key:'rieles',zone:'ventanas',kind:'month4',day:0,week:1,tip:'rieles',title:'Rieles de las ventanas: aspirar y pasar un paño',notes:'Primero aspira la arena con la boquilla estrecha. Después, un cepillo de dientes o un bastoncillo con agua y un poco de vinagre, y seca.'},
  {key:'radiadores-polvo',zone:'radiadores',kind:'month4',day:3,week:1,tip:'radiadoresPolvo',title:'Radiadores y rejillas: quitar el polvo'},
  {key:'almacen',zone:'almacen',kind:'month4',day:4,week:1,title:'Almacén: ordenar y barrer'},
  {key:'taller',zone:'taller',kind:'month4',day:5,week:1,title:'Taller: ordenar y barrer'},
  {key:'campana',zone:'cocina',kind:'month4',day:0,week:2,tip:'campana',title:'Campana: lavar los filtros',notes:'En el lavavajillas o en agua caliente con desengrasante.'},
  {key:'cintas-persianas',zone:'ventanas',kind:'month4',day:2,week:2,tip:'persianas',title:'Cintas de las persianas: pasar un paño',notes:'Paño apenas húmedo con jabón neutro. Sube y baja la persiana para llegar a toda la cinta. No la empapes.'},
  {key:'zocalos',zone:null,kind:'month4',day:3,week:2,tip:'zocalos',title:'Zócalos y marcos de las puertas'},
  {key:'ventanas-fuera',zone:'ventanas',kind:'month4',day:5,week:2,tip:'ventanasFuera',title:'Ventanas por fuera',notes:'Solo en día seco y sin viento.'},
  {key:'horno',zone:'cocina',kind:'month4',day:0,week:3,tip:'horno',title:'Horno y microondas por dentro'},
  {key:'cristales-dentro',zone:'ventanas',kind:'month4',day:2,week:3,tip:'cristales',title:'Cristales y marcos de las ventanas por dentro'},
  {key:'cubos-basura',zone:null,kind:'month4',day:4,week:3,tip:'cubos',title:'Cubos de basura: lavar'},

  {key:'secadora-condensador',zone:'secadora',kind:'every',every:3,offset:10,tip:'secadoraCondensador',title:'Secadora: limpiar el condensador',notes:'Mira el manual: suele sacarse por la parte de abajo. Se aclara con agua y se deja secar antes de volver a ponerlo.'},
  {key:'secadora-goma',zone:'secadora',kind:'every',every:6,offset:24,tip:'secadoraGoma',title:'Secadora: revisar la goma de la puerta y el tubo de desagüe'},
  {key:'humedades',zone:null,kind:'every',every:3,offset:17,tip:'humedades',title:'Revisar humedades y moho en esquinas y armarios'},
  {key:'colchones',zone:'dormitorio',kind:'every',every:3,offset:31,tip:'colchones',title:'Colchones: aspirar y darles la vuelta'},

  {key:'radiadores-purgar',zone:'radiadores',kind:'year',month:10,mday:15,window:[10,11],tip:'radiadores',title:'Purgar los radiadores antes de encender la calefacción',notes:'Con la calefacción apagada y fría, abre la llave de purga con un trapo debajo hasta que salga agua sin aire. Después comprueba la presión de la caldera.'},
  {key:'caldera',zone:'radiadores',kind:'year',month:10,mday:1,window:[9,11],tip:'caldera',title:'Caldera: comprobar la presión y pedir la revisión anual',notes:'La presión en frío suele ir entre 1 y 1,5 bar. Mira la de tu caldera en el manual.'},
  {key:'chimenea',zone:'chimenea',kind:'year',month:9,mday:20,window:[9,11],tip:'chimenea',title:'Chimenea: deshollinar y revisar el tiro',notes:'Antes de la primera lumbre del año. La ceniza, siempre fría y en un cubo metálico.'},
  {key:'canaletas',zone:'terraza',kind:'year',month:10,mday:20,window:[10,11],tip:'canaletas',title:'Terraza: limpiar canaletas y desagües antes de las lluvias'},
  {key:'burletes',zone:'ventanas',kind:'year',month:11,mday:25,window:[11,12],tip:'burletes',title:'Revisar burletes de puertas y ventanas antes del frío'},
  {key:'aire-invierno',zone:'aire',kind:'year',month:11,mday:5,window:[11,11],tip:'aire',title:'Aire acondicionado: limpiar los filtros antes del invierno (si calienta con él)'},
  {key:'cortinas',zone:'ventanas',kind:'year',month:3,mday:15,window:[3,4],tip:'cortinas',title:'Lavar las cortinas'},
  {key:'terraza-primavera',zone:'terraza',kind:'year',month:4,mday:10,window:[3,4],tip:'terraza',title:'Terraza: limpieza general tras el invierno'},
  {key:'aire-exterior',zone:'aire',kind:'year',month:4,mday:25,window:[4,5],tip:'aireExterior',title:'Aire acondicionado: limpiar la unidad exterior'},
  {key:'persianas-revision',zone:'ventanas',kind:'year',month:5,mday:5,window:[5,5],tip:'persianas',title:'Persianas y toldos: revisar antes del verano'},
  {key:'aire-verano',zone:'aire',kind:'year',month:5,mday:15,window:[5,6],tip:'aire',title:'Aire acondicionado: limpiar los filtros antes del verano',notes:'Desenchúfalo, saca los filtros, lávalos con agua tibia y déjalos secar a la sombra.'},
  {key:'aire-mitad',zone:'aire',kind:'year',month:7,mday:20,window:[7,8],tip:'aire',title:'Aire acondicionado: limpiar los filtros a mitad del verano'}
 ];

 // Consejo de una tarea: el de su plantilla o, si es una tarea propia, por su título
 function tipFor(task){
  const item=task&&task.planKey&&ITEMS.find(i=>i.key===baseKey(task.planKey));if(item)return item.tip?{key:item.tip,...TIPS[item.tip]}:null;
  const title=norm(task&&task.title),hit=TIP_MATCH.find(([re])=>re.test(title));return hit?{key:hit[1],...TIPS[hit[1]]}:null;
 }

 // Primera fecha del ciclo a partir de hoy, alineada con el día de la semana y la semana del ciclo
 function cycleDate(today,day,week,period){let d=plus(plus(today,-weekday(today)),7*(week||0)+day);while(d<today)d=plus(d,7*period);return d}
 // Fecha de temporada: si estamos dentro de su temporada y la fecha ideal ya pasó, pronto (sin amontonar);
 // si no, la próxima fecha ideal
 function seasonDate(item,today,n){
  const y=Number(today.slice(0,4)),m=Number(today.slice(5,7)),ideal=y+'-'+pad(item.month)+'-'+pad(item.mday);
  if(ideal>=today)return ideal;
  if(m>=item.window[0]&&m<=item.window[1])return plus(today,2+(n%5)*2);
  return (y+1)+'-'+pad(item.month)+'-'+pad(item.mday);
 }
 function whoFor(opt,item,i){if(opt.who!=='alternar')return opt.who||'yo';const ids=(opt.people||[]).length?opt.people:['yo'];return ids[(item.day??i)%ids.length]}
 const KIND={week:'semanal',fortnight:'semanal',month4:'rincon',every:'rincon',year:'temporada'};

 // Fecha y repetición de una plantilla (n reparte las de temporada que caen ya)
 function scheduleFor(item,today,n){
  if(item.kind==='week')return {repeat:'weekly',date:cycleDate(today,item.day,0,1)};
  if(item.kind==='fortnight')return {repeat:'custom',every:2,unit:'w',date:cycleDate(today,item.day,item.week,2)};
  if(item.kind==='month4')return {repeat:'custom',every:4,unit:'w',date:cycleDate(today,item.day,item.week,4)};
  if(item.kind==='every')return {repeat:'custom',every:item.every,unit:'m',date:plus(today,item.offset)};
  return {repeat:'yearly',date:seasonDate(item,today,n||0)};
 }
 /* ---------- dos lavadoras con nombre ---------- */
 const PER_WASHER=new Set(['lavadora-1','lavadora-2','lavadora-filtro']);
 const baseKey=k=>String(k||'').split(':')[0];
 // Título de la tarea de cada lavadora: «Día de colada: lavadora de arriba», «Lavadora de abajo: limpiar el filtro…»
 function washerTitle(key,name){return key==='lavadora-1'?'Día de colada: '+lcFirst(name):key==='lavadora-2'?'Segundo día de colada: '+lcFirst(name):name+': limpiar el filtro y la goma de la puerta'}
 // Con dos lavadoras, las tareas de colada y del filtro se hacen una por lavadora (el filtro, en semanas distintas)
 function expandItems(laundry){
  if(!laundry||!laundry.twoWashers)return ITEMS;
  const names=washerNames(laundry);
  return ITEMS.flatMap(item=>PER_WASHER.has(item.key)?names.map((name,i)=>({...item,key:item.key+':'+(i+1),base:item.key,title:washerTitle(item.key,name),week:item.key==='lavadora-filtro'?(item.week||0)+2*i:item.week})):[item]);
 }
 // Al pasar a dos lavadoras (o cambiarles el nombre), las tareas que ya existen pasan a ser de la primera,
 // o se renombran; solo cambia el título si no se había cambiado a mano
 function washerUpdates(state,before,after){
  if(!after||!after.twoWashers)return [];
  const oldNames=before&&before.twoWashers?washerNames(before):null,newNames=washerNames(after),out=[];
  for(const t of state.tasks||[]){
   if(t.plan!=='casa'||!PER_WASHER.has(baseKey(t.planKey)))continue;
   const base=baseKey(t.planKey),n=t.planKey.includes(':')?Number(t.planKey.split(':')[1]):1,item=ITEMS.find(i=>i.key===base);
   const template=[item.title,...(LEGACY[base]||[]),...(oldNames?[washerTitle(base,oldNames[n-1])]:[])].map(norm);
   const upd={id:t.id,planKey:base+':'+n};if(template.includes(norm(t.title)))upd.title=washerTitle(base,newNames[n-1]);
   if(upd.planKey!==t.planKey||(upd.title&&upd.title!==t.title))out.push(upd);
  }
  return out;
 }
 function buildPlan(state,opt){
  const zones=new Set(opt.zones||[]),today=opt.today,existing=state.tasks||[];if(!validDate(today))throw Error('Fecha no válida.');
  // La tarea de la primera lavadora también cuenta si ya existe la de antes (sin lavadora concreta)
  const keys=item=>item.base&&item.key.endsWith(':1')?[item.key,item.base]:[item.key];
  const has=item=>{
   const first=!item.base||item.key.endsWith(':1'),olds=first?[...(LEGACY[item.base||item.key]||[]),...(item.base?[ITEMS.find(i=>i.key===item.base).title]:[])].map(norm):[];
   return existing.some(t=>keys(item).includes(t.planKey)||norm(t.title)===norm(item.title)||olds.includes(norm(t.title)));
  };
  const tasks=[],skipped=[];let inSeason=0;
  expandItems(opt.laundry).forEach((item,i)=>{
   if(item.zone&&!zones.has(item.zone))return;
   if(has(item)){skipped.push(item.key);return}
   const s=scheduleFor(item,today,inSeason);if(item.kind==='year'&&s.date<plus(today,30))inSeason++;
   const t={id:opt.uid(),title:item.title,time:'',who:whoFor(opt,item,i),notes:item.notes||'',done:false,plan:'casa',planKey:item.key,planKind:KIND[item.kind],...s};
   if(item.urgent)t.urgent=true;
   tasks.push(t);
  });
  return {tasks,skipped};
 }
 // Títulos de versiones anteriores del plan: si la tarea no se ha renombrado, se actualiza al nuevo
 const LEGACY={'lavadora-1':['Poner una lavadora'],'lavadora-2':['Poner otra lavadora']};
 function legacyTitles(state){return (state.tasks||[]).filter(t=>t.plan==='casa'&&(LEGACY[t.planKey]||[]).includes(t.title)).map(t=>({id:t.id,title:ITEMS.find(i=>i.key===t.planKey).title}))}

 /* ---------- unir tareas propias al plan ---------- */
 // Tarea propia → plantilla del plan que le corresponde (el primer patrón que coincide)
 const JOIN=[[/fuente.*filtro|filtro.*fuente/,'fuente-filtro'],[/fuente/,'fuente-limpiar'],[/riel/,'rieles'],[/persiana/,'cintas-persianas'],[/por fuera/,'ventanas-fuera'],[/cristal|ventana/,'cristales-dentro'],
  [/(bano|aseo).*invitad|invitad.*(bano|aseo)/,'bano-invitados'],[/(bano|aseo).*entrada|entrada.*(bano|aseo)/,'aseo-entrada'],[/junta|mampara/,'juntas-bano'],[/bano|aseo|inodoro|ducha/,'bano-principal'],
  [/invitad/,'cuarto-invitados'],[/sabana|dormitorio|cuarto|habitacion/,'dormitorio'],
  [/nevera|frigorifico/,'nevera'],[/horno|microondas/,'horno'],[/campana/,'campana'],[/cocina|encimera|fregadero/,'cocina-semanal'],
  [/planta|regar|patio/,'patio'],[/terraza/,'terraza'],[/escalera/,'escaleras'],[/entrada|recibidor|portal/,'entrada'],[/salon|sofa/,'salon'],
  [/filtro.*lavadora|lavadora.*filtro/,'lavadora-filtro'],[/secadora/,'secadora-filtro'],[/doblar|ropa limpia|guardar la ropa/,'doblar-1'],[/lavadora|colada/,'lavadora-1'],[/lavadero/,'lavadero'],
  [/garaje/,'garaje'],[/almacen|trastero/,'almacen'],[/taller/,'taller'],[/gimnasio/,'gimnasio'],[/purg.*radiador/,'radiadores-purgar'],[/radiador/,'radiadores-polvo'],[/caldera/,'caldera'],[/chimenea/,'chimenea'],
  [/aire acondicionado/,'aire-verano'],[/basura/,'cubos-basura'],[/humedad|moho/,'humedades'],[/colchon/,'colchones'],[/cortina/,'cortinas'],[/burlete/,'burletes'],[/interruptor|pomo/,'interruptores'],[/zocalo/,'zocalos'],[/lampara|ventilador/,'lamparas']];
 const suggestKey=t=>{const s=norm(t.title),hit=JOIN.find(([re])=>re.test(s));return hit?hit[1]:''};
 // Tareas propias programadas que se pueden unir al plan
 const joinCandidates=state=>(state.tasks||[]).filter(t=>!t.done&&!t.planKey&&validDate(t.date));
 // Cada tarea propia elegida toma el día y la frecuencia de su plantilla y sustituye a la del plan, si ya existe.
 // Conserva su id, título, responsable, hora, notas, historial y vínculos con rutinas.
 function integrate(state,picks,today){
  const tasks=(state.tasks||[]).map(t=>({...t})),byId=new Map(tasks.map(t=>[t.id,t])),removed=new Set(),changed=new Set(),byKey=new Map();
  const linked=new Set((state.routines||[]).filter(r=>r.linkedTasks&&!r.archived).flatMap(r=>r.taskIds||[]));
  for(const {id,key} of picks||[]){
   const t=byId.get(id),item=ITEMS.find(i=>i.key===key);if(!t||!item||t.done||t.planKey||changed.has(id))continue;
   let s=byKey.get(key);
   if(!s){
    const twin=tasks.find(x=>(x.planKey===key||x.planKey===key+':1')&&x.plan==='casa'&&!x.planJoined&&!x.done&&!removed.has(x.id)&&!changed.has(x.id));
    s=twin?{repeat:twin.repeat,date:twin.date,every:twin.every,unit:twin.unit}:scheduleFor(item,today,0);
    if(twin&&!linked.has(twin.id))removed.add(twin.id);
    byKey.set(key,s);
   }
   // Lo urgente que ya toca (hoy o atrasado) no se aplaza al unirlo: se queda en su fecha
   const keepDue=(item.urgent||t.urgent)&&validDate(t.date)&&t.date<=today;
   Object.assign(t,{date:keepDue?t.date:s.date,repeat:s.repeat,plan:'casa',planKey:key,planKind:KIND[item.kind],planJoined:true});
   if(s.repeat==='custom')Object.assign(t,{every:s.every,unit:s.unit});else{delete t.every;delete t.unit}
   if(item.urgent)t.urgent=true;
   changed.add(id);
  }
  return {tasks:tasks.filter(t=>!removed.has(t.id)),changed:[...changed],removed:[...removed]};
 }
 // Zonas marcadas por defecto: las que se eligieron la última vez y las que se han añadido después
 function defaultZones(saved){if(!saved||!Array.isArray(saved.chosen)||!Array.isArray(saved.known))return ZONES.map(z=>z[0]);const known=new Set(saved.known),chosen=new Set(saved.chosen);return ZONES.map(z=>z[0]).filter(id=>chosen.has(id)||!known.has(id))}

 /* ---------- calendario de temporada ---------- */
 const isSeasonal=t=>t.planKind==='temporada'||t.repeat==='yearly';
 // Lo que toca en un mes (aaaa-mm): pendiente en su fecha o ya hecho ese mes
 function monthItems(state,ym){
  const out=[];
  for(const t of state.tasks||[]){
   if(!isSeasonal(t))continue;
   const doneDay=t.done?t.doneAt:t.lastDone;
   if(validDate(doneDay)&&doneDay.slice(0,7)===ym){out.push({task:t,date:doneDay,done:true});continue}
   if(t.done||!validDate(t.date))continue;
   if(t.date.slice(0,7)===ym){out.push({task:t,date:t.date,done:false});continue}
   if(t.repeat==='yearly'&&t.date.slice(5,7)===ym.slice(5,7)&&ym>t.date.slice(0,7)){const d=ym+t.date.slice(7);if(validDate(d))out.push({task:t,date:d,done:false})}
  }
  return out.sort((a,b)=>a.date.localeCompare(b.date)||a.task.title.localeCompare(b.task.title,'es'));
 }
 function nextMonths(today,n){const y=Number(today.slice(0,4)),m=Number(today.slice(5,7))-1;return Array.from({length:n},(_,i)=>{const k=m+i;return (y+Math.floor(k/12))+'-'+pad(k%12+1)})}

 /* ---------- tiempo ---------- */
 const num=v=>v===null||v===undefined||v===''||!Number.isFinite(Number(v))?null:Number(v);
 function forecastDays(json){const d=json&&json.daily;if(!d||!Array.isArray(d.time))return [];return d.time.map((date,i)=>({date,code:num(d.weather_code?.[i]),max:num(d.temperature_2m_max?.[i]),min:num(d.temperature_2m_min?.[i]),rain:num(d.precipitation_probability_max?.[i]),mm:num(d.precipitation_sum?.[i]),wind:num(d.wind_speed_10m_max?.[i])})).filter(x=>validDate(x.date))}
 const isWet=d=>(d.rain??0)>=50||(d.mm??0)>=1;
 function sky(c){if(c===0)return['☀️','Despejado'];if(c===1||c===2)return['🌤️','Poco nuboso'];if(c===3)return['☁️','Nublado'];if(c===45||c===48)return['🌫️','Niebla'];if(c>=51&&c<=57)return['🌦️','Llovizna'];if(c>=61&&c<=67||c>=80&&c<=82)return['🌧️','Lluvia'];if(c>=71&&c<=77||c===85||c===86)return['🌨️','Nieve'];if(c>=95)return['⛈️','Tormenta'];return['🌡️','Previsión']}
 const OUTDOOR=/\b(tender|terraza|patio|por fuera|exterior|toldos?|canaletas?|jardin|balcon|fachada)\b/;
 const isOutdoor=t=>OUTDOOR.test(norm(t.title));
 const isWash=t=>['lavadora-1','lavadora-2'].includes(baseKey(t.planKey))||/\blavadoras?\b/.test(norm(t.title))&&/\bponer\b/.test(norm(t.title));
 const deg=v=>Math.round(v)+' °C';
 function findTask(state,key,re){const all=(state.tasks||[]).filter(t=>t.planKey===key||re.test(norm(t.title)));return all.find(t=>!t.done)||all[0]||null}

 // Recomendaciones del día: texto, acciones opcionales para mover una tarea y, si hay, su consejo (tip = id de tarea)
 function recommendations(state,days,today,h){
  const fmt=d=>h.relDate(d).toLowerCase(),recs=[],tasks=(state.tasks||[]).filter(t=>!t.done&&validDate(t.date));
  const i0=days.findIndex(d=>d.date===today);if(i0<0)return recs;
  const d0=days[i0],soon=days.slice(i0,i0+3),wetDays=new Set(days.filter(isWet).map(d=>d.date)),nextDry=days.slice(i0+1).find(d=>!isWet(d));
  const used=new Set(),act=(t,date,label)=>{used.add(t.id);return {id:t.id,date,label}};
  // Colada según lo que hay en casa (h.laundry); sin datos, consejos generales
  const L=h.laundry||{},setup=LAUNDRY.some(([k])=>L[k]),wet0=isWet(d0),windy0=(d0.wind??0)>=30,cold0=d0.max!==null&&d0.max<10;
  // Las coladas de hoy (con dos lavadoras, una tarea por lavadora): un solo aviso para todas
  const washes=tasks.filter(t=>t.date<=today&&isWash(t)),names=washerNames(L);
  const wash=washes.length?{id:washes[0].id,label:washes.length>1?'colada ('+washes.map(t=>lcFirst(t.title.replace(/^(segundo )?d[ií]a de colada:\s*/i,''))).join(' y ')+')':`«${washes[0].title}»`}:null;
  const rainSoon=wet0?null:days.slice(i0+1,i0+3).find(isWet),two=L.twoWashers?`Pon la ${lcFirst(names[0])} y la ${lcFirst(names[1])} a la vez. `:'';
  function dryingAdvice(){
   if(!setup)return wet0?'sécala en la secadora o tiéndela dentro, junto a una ventana abierta.':cold0?'mejor la secadora o tender dentro.':'tiéndela fuera en cuanto termine.';
   if(!wet0&&!cold0)return L.coveredLine?'tiéndela en el tendedero de fuera en cuanto termine: al aire se seca antes.':'tiéndela fuera en cuanto termine.';
   const parts=[];
   if(L.coveredLine)parts.push(windy0?'Con este viento, mejor no uses el tendedero de fuera.':wet0?'El tendedero cubierto sirve si no sopla viento, aunque tardará más en secarse.':'En el tendedero cubierto tardará más con este frío.');
   if(L.indoorLine)parts.push('El tendedero de dentro de casa es la opción segura.');
   if(L.dryer)parts.push('La secadora, para toallas y sábanas o si corre prisa.');
   return parts.join(' ')||'tiéndela dentro, junto a una ventana abierta.';
  }
  // Tras «Pon las dos lavadoras…», el consejo empieza en mayúscula
  const laundryAdvice=()=>{const a=dryingAdvice();return two?two+a.charAt(0).toUpperCase()+a.slice(1):a};
  // Lo de exterior que se puede pasar a otro día (nunca lo urgente; tender bajo techo sí se puede si no hay viento fuerte)
  const movable=t=>isOutdoor(t)&&!t.urgent&&!(L.coveredLine&&/\btender\b/.test(norm(t.title))&&(d0.wind??0)<40);
  // Primero, lo urgente que toca hoy o está atrasado: no se puede posponer
  for(const t of tasks.filter(t=>t.urgent&&t.date<=today).sort(byDate).slice(0,3))recs.push({icon:'❗',text:`Urgente${t.date<today?' y atrasada':''}: «${t.title}». No se puede posponer.`,actions:[],tip:t.id});
  if(wet0){
   recs.push({icon:'🌧️',text:!setup?`Hoy hay un ${d0.rain??0} % de probabilidad de lluvia: no tiendas fuera. Usa la secadora y vacía el filtro al terminar.`:`Hoy hay un ${d0.rain??0} % de probabilidad de lluvia: nada de tender al descubierto.${L.coveredLine?(windy0?' Con viento, tampoco en el tendedero cubierto.':' El tendedero cubierto sirve si no sopla viento.'):''}${L.dryer?' Si usas la secadora, vacía el filtro al terminar.':''}`,actions:[]});
   if(wash)recs.push({icon:'🧺',text:`Hoy toca ${wash.label} y llueve: ${laundryAdvice()}`,actions:[],tip:wash.id});
   for(const t of tasks.filter(t=>t.date<=today&&movable(t)).sort(byDate).slice(0,3))recs.push({icon:'↪️',text:`«${t.title}» mejor en un día seco.`,actions:nextDry?[act(t,nextDry.date,'Pasar a '+fmt(nextDry.date))]:[]});
  }else{
   if(rainSoon){
    recs.push({icon:'🧺',text:`Llueve ${fmt(rainSoon.date)} (${rainSoon.rain??0} %): ${wash?`hoy toca ${wash.label}${L.twoWashers?` (pon la ${lcFirst(names[0])} y la ${lcFirst(names[1])} a la vez)`:''}, así que tiende fuera en cuanto termine.`:'aprovecha hoy para tender fuera.'}`,actions:[],tip:wash?.id});
    for(const t of tasks.filter(t=>isOutdoor(t)&&t.date>today&&wetDays.has(t.date)).sort(byDate).slice(0,3))recs.push({icon:'☀️',text:`«${t.title}» cae en día de lluvia (${fmt(t.date)}): mejor hoy.`,actions:[act(t,today,'Hacer hoy')]});
   }else{
    if(wash)recs.push({icon:'🧺',text:`Hoy toca ${wash.label}${cold0?' y hace frío':' y no llueve'}: ${laundryAdvice()}`,actions:[],tip:wash.id});
    if(d0.max!==null&&d0.max>=12&&d0.max<=30&&(d0.wind??0)<30)recs.push({icon:'🪟',text:'Buen día para ventanas por fuera, la terraza y tender la ropa.',actions:[]});
   }
  }
  const cold=soon.filter(d=>d.min!==null).sort((a,b)=>a.min-b.min)[0];
  if(cold&&(cold.min<=6||(cold.max!==null&&cold.max<=14))){
   const t=findTask(state,'radiadores-purgar',/purgar.*radiador/),purged=t&&(t.done||(t.lastDone&&t.lastDone>=plus(today,-150)));
   const when=`Entra el frío (mínima de ${deg(cold.min)} ${fmt(cold.date)})`;
   if(purged)recs.push({icon:'🔥',text:`${when}: radiadores purgados ✓. Comprueba que la caldera marca su presión habitual antes de encenderla.`,actions:[]});
   else recs.push({icon:'🔥',text:`${when}: ¿has puesto ya la calefacción? Antes, purga los radiadores y revisa la presión de la caldera.`,actions:t&&!t.done&&t.date>today?[act(t,today,'Hacer hoy')]:[],tip:t?.id});
  }
  const frost=soon.find(d=>d.min!==null&&d.min<=0);
  if(frost)recs.push({icon:'❄️',text:`Riesgo de helada ${fmt(frost.date)} (${deg(frost.min)}): protege las plantas del patio y la terraza y no friegues fuera.`,actions:[]});
  const hot=soon.find(d=>d.max!==null&&d.max>=32);
  if(hot){const t=findTask(state,'aire-verano',/filtros? del aire/),clean=t&&t.lastDone&&t.lastDone>=plus(today,-60);recs.push({icon:'🥵',text:`Calor ${fmt(hot.date)} (${deg(hot.max)}): ventila temprano y baja las persianas al mediodía.${clean?'':' ¿Están limpios los filtros del aire acondicionado?'}`,actions:t&&!clean&&!t.done&&t.date>today?[act(t,today,'Hacer hoy')]:[],tip:clean?undefined:t?.id})}
  const windy=days.slice(i0,i0+2).find(d=>(d.wind??0)>=40);
  if(windy)recs.push({icon:'💨',text:`Viento fuerte ${fmt(windy.date)} (${Math.round(windy.wind)} km/h): recoge lo suelto de la terraza y no tiendas sábanas fuera.`,actions:[]});
  // Un «rincón» al día para que no se acumule la limpieza a fondo
  const corner=tasks.find(t=>t.planKind==='rincon'&&t.date===today);
  if(corner)recs.push({icon:'✨',text:`Rincón de hoy: «${corner.title}».`,actions:[],tip:corner.id});
  else{
   const next=tasks.filter(t=>t.planKind==='rincon'&&t.date>today&&t.date<=plus(today,7)&&!used.has(t.id)&&!(isOutdoor(t)&&isWet(d0))).sort(byDate)[0];
   if(next)recs.push({icon:'✨',text:isWet(d0)?`Día de interior: puedes adelantar «${next.title}» (toca ${fmt(next.date)}).`:`Si te sobran 10 minutos: «${next.title}» (toca ${fmt(next.date)}).`,actions:[act(next,today,'Hacer hoy')],tip:next.id});
  }
  return recs.slice(0,8);
 }
 // No se puede posponer una tarea urgente: solo adelantarla o dejarla para hoy
 const blocksPostpone=(t,date,today)=>!!t&&!!t.urgent&&!t.done&&!!date&&date>(validDate(t.date)&&t.date>today?t.date:today);

 const api={norm,ZONES,LAUNDRY,WASHER_NAMES,washerNames,washerUpdates,expandItems,ITEMS,TIPS,tipFor,buildPlan,legacyTitles,suggestKey,joinCandidates,integrate,defaultZones,isSeasonal,monthItems,nextMonths,forecastDays,isWet,isOutdoor,sky,recommendations,blocksPostpone};root.CasaHousePlan=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
