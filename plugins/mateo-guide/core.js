
export const BASE="https://intelligence-ahead.vercel.app/mateo";
export const CHAPTERS=[["Portada",1],["Dedicatoria",2],["Cómo usar este libro",3],["Quién soy",4],["Índice",5],["Acto I · Nacer",8],["Acto II · Aprender",33],["Acto III · Cerrar el mundo",44],["Acto IV · Dos realidades",54],["Acto V · Recuperar el control",64],["Acto VI · Proteger tu pensamiento crítico",74],["Acto VII · Entender el sistema",84],["Acto VIII · Practicar la libertad",94],["Acto IX · Compartir lo aprendido",104],["Acto X · Tu criterio en acción",114],["Contraportada",124]];
const TOPICS={
  "algorithms":["Algoritmos e instrucciones",84,["Elige una tarea cotidiana, como dibujar una casa.","Da cinco instrucciones precisas a otra persona o a un robot imaginario.","Cambia el orden de dos pasos y compara los resultados.","Pregunta quién decidió las reglas y cómo mejorarlas."],"¿Qué ocurre si una instrucción es ambigua?"],
  "recommendations":["Recomendaciones en internet",54,["Dibuja tres tipos de contenidos que te gustan sin abrir redes.","Imagina una máquina que solo observa qué seleccionas.","Predice qué te ofrecería después y qué contenidos quedarían fuera.","Busca una forma de descubrir algo distinto."],"¿Quién elige el menú de opciones que vemos?"],
  "attention":["Atención y decisiones",64,["Dibuja una actividad que disfrutas sin pantallas.","Identifica tres cosas que la interrumpen.","Diseña una pausa antes de abrir una notificación.","Compara cómo cambia la experiencia cuando decides parar."],"¿Quién decide el momento de cambiar de actividad?"],
  "critical-thinking":["Pensamiento crítico",74,["Escribe una afirmación que veas en internet.","Separa hechos, suposiciones y dudas.","Busca información que pudiera contradecirla.","Reescribe la conclusión con cuidado."],"¿Qué evidencia te haría cambiar de opinión?"]
};
export function listChapters(){return {book:"Mateo y el Algoritmo",total_pages:124,chapters:CHAPTERS.map(([title,page])=>({title,page,url:BASE+"/leer?p="+page})),note:"Índice verificado. No se transcribe texto de las páginas ilustradas."};}
export function getPage(page){if(!Number.isInteger(page)||page<1||page>124)throw Error("La página debe ser un entero entre 1 y 124.");return {book:"Mateo y el Algoritmo",page,chapter:CHAPTERS.filter(x=>x[1]<=page).at(-1)[0],read_url:BASE+"/leer?p="+page,share_url:BASE};}
export function planActivity(topic,audience,duration){
  if(!TOPICS[topic])throw Error("Tema inválido");
  if(!["ages-7-9","ages-10-12","ages-13-plus","adults"].includes(audience))throw Error("Público inválido");
  if(!["5-min","15-min"].includes(duration))throw Error("Duración inválida");
  const a=TOPICS[topic];
  return {title:a[0],audience,duration,instructions:duration==="5-min"?a[2].slice(0,3):a[2],reflection:a[3],book_page_url:BASE+"/leer?p="+a[1],note:"Actividad divulgativa original, no certificada como material curricular. Una persona adulta debe comprobar su adecuación."};
}
export function getMaterials(){return {title:"Mateo y el Algoritmo",author:"Alejandro Baratas",publisher:"The Intelligence Ahead",pages:124,book:BASE,reader:BASE+"/leer",pdf:BASE+"/mateo-y-el-algoritmo.pdf",sample:BASE+"/muestra.pdf",cover:BASE+"/portada.jpg",social_image:BASE+"/og-mateo.jpg",press:BASE+"/prensa",use:"Lectura y enlace gratuitos. Solicitar autorización para reproducción o adaptación de ilustraciones."};}
