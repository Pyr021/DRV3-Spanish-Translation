// ortografia.mjs — detector (y corrector conservador) de faltas tipicas en la traduccion.
//
// Gravedad de cada aviso:
//   seguro   : error casi con certeza (palabra que NUNCA va sin tilde, "he echo",
//              "haber si", falta un ¿ o ¡). Se puede corregir automaticamente.
//   probable : depende del contexto, pero el patron es muy sospechoso
//              ("esta bien" -> "esta" con tilde, "para el." -> "el" con tilde).
//   dudoso   : solo para revisar a mano (texto sin traducir, frase partida...).
//
// API: analizar(texto, {original, anterior}) -> [avisos]
//      corregir(texto, {probables, anterior}) -> { texto, cambios }

import { arreglarSignos } from './anadir_signos_apertura.mjs';

// ---------------------------------------------------------------- listas
// Palabras que en espanol actual no existen sin tilde (o su variante sin tilde es
// rarisima en dialogo). Clave: forma sin tilde en minusculas.
const SIEMPRE = Object.fromEntries(`
también después aquí allí ahí así además jamás quizás detrás atrás según algún ningún común
allá acá fácil fáciles difícil difíciles rápido rápida rápidos rápidas rápidamente
último última últimos últimas único única únicos únicas número números página páginas música
teléfono teléfonos cámara cámaras método métodos lógico lógica básico básica técnico técnica
próximo próxima próximos próximas mínimo mínima máximo máxima sábado miércoles árbol árboles
lápiz ángel débil débiles útil útiles inútil inútiles móvil jóvenes exámenes órdenes imágenes
policía energía teoría fantasía alegría compañía tecnología biología psicología filosofía
día días tío tía tíos tías mío mía míos mías vía vías láctea
había habían podía podían quería querían decía decían tenía tenían venía venían veía veían
creía creían oía leía hacían parecía parecían conocía sentía vivía salía
estaría estarían tendría tendrían habría habrían podría podrían querría debería deberían
sabría haría harían diría dirían vendría saldría pondría
será serán estará estarán tendrá tendrán habrá habrán podrá podrán hará harán dirá dirán
vendrá vendrán saldrá querrá sabrá sabrán pondrá
están estén
salió murió ocurrió sucedió vivió perdió apareció desapareció decidió entendió recibió
consiguió siguió pidió sintió mintió eligió escribió abrió descubrió rompió corrió comió
bebió conoció creció nació ofreció huyó cayó leyó oyó debió metió prometió respondió volvió
movió resolvió devolvió mordió vendió aprendió comprendió sorprendió encendió defendió
corazón razón montón millón jamón ratón ladrón salón balón botón cajón rincón limón dragón
perdón bastón opinión unión región religión avión camión legión japón
`.trim().split(/\s+/).map(w => [w.normalize('NFD').replace(/[\u0301]/g, '').normalize('NFC'), w]));
// (quitar la tilde con NFD conserva la ñ y la ü)

// ---------------------------------------------------------------- condicional e imperfecto
// Formas verbales en -ía (condicional de todos los verbos e imperfecto de -er/-ir) generadas
// a partir de una lista EXPLÍCITA de infinitivos. No se usa una regex general -aria -> -aría
// porque hay muchos adjetivos y sustantivos en -aria/-arias SIN tilde (extraordinaria, varias,
// necesaria, diaria, secundaria, secretaria, funcionaria, legendaria, plegarias...).
const INF_AR = `
gustar encantar importar interesar preocupar molestar quedar dar estar ayudar hablar pensar llegar
llevar dejar llamar tomar tratar mirar esperar buscar entrar trabajar jugar pasar matar ganar
cambiar explicar contar encontrar mostrar probar intentar acabar terminar empezar comenzar usar
gastar cerrar sacar tocar olvidar recordar lograr necesitar aceptar salvar escapar ocultar
investigar sospechar acusar votar castigar asesinar confesar negar demostrar preguntar contestar
engañar dudar imaginar considerar aprovechar arriesgar robar guardar cuidar viajar volar nadar
caminar andar bailar cantar cocinar limpiar preparar organizar planear funcionar costar durar
sobrar faltar bastar parar continuar quitar echar mandar enviar regresar tirar lanzar golpear
disparar apuñalar envenenar ahogar colgar equivocar alegrar enfadar odiar amar adorar besar
abrazar casar confiar obligar evitar asegurar arreglar solucionar comprobar revisar examinar
analizar revelar resultar notar fijar observar vigilar escuchar despertar acostar levantar sentar
mudar celebrar regalar comprar pagar cobrar prestar aguantar controlar ajustar emocionar desmayar
significar acercar alejar atacar atrapar avisar bajar cargar causar cazar charlar chocar
colaborar comentar completar contratar crear cruzar culpar curar decorar desear destrozar dibujar
disfrutar disculpar empujar enamorar encargar enseñar entregar entrenar estudiar explotar
expulsar fallar firmar formar fracasar grabar gritar hallar heredar honrar ignorar imitar
informar inventar invitar juntar jurar justificar juzgar lamentar liberar llenar llorar luchar
manejar marcar meditar mejorar mencionar montar narrar operar optar ordenar participar pasear
patear pegar pelear perdonar pescar picar pintar plantar practicar presentar presionar provocar
quemar rechazar recuperar reemplazar renunciar reparar representar rescatar respetar respirar
retirar retrasar rezar saltar saludar secuestrar señalar separar soltar soñar soportar superar
suplicar tardar temblar tranquilizar trasladar triunfar utilizar vengar visitar vomitar acompañar
adivinar afectar agotar alcanzar almorzar animar apostar apoyar apuntar arrastrar arrepentir
asustar aterrorizar avanzar borrar calmar cenar centrar comunicar concentrar conectar conservar
contaminar copiar desactivar descansar descifrar detectar dominar eliminar encajar enfrentar
engordar enterar entrevistar escalar estallar fiar flotar forzar fumar girar gobernar
identificar iluminar implicar indicar intercambiar lavar masacrar mojar multiplicar nombrar
ocupar pisar programar quejar recomendar reconciliar registrar reinar relajar repasar resucitar
retar rodar rogar rozar sonar tapar tumbar arrepentir
`;
const INF_ER_IR = `
comer beber leer creer correr vender aprender comprender entender responder romper meter temer
deber coger recoger conocer crecer nacer morir vivir escribir subir recibir existir insistir
sufrir cumplir dormir pedir repetir reir sonreir conseguir convertir divertir preferir sugerir
traer caer atraer distraer ofrecer merecer desaparecer aparecer agradecer obedecer pertenecer
reconocer mover llover doler oler volver devolver envolver resolver ser ver ir oir abrir
descubrir decidir ocurrir suceder parecer sentir mentir servir seguir elegir escoger proteger
permitir prohibir admitir hundir rendir reunir sorprender defender perder encender atender
ceder poseer prometer cometer someter invadir herir huir destruir construir incluir concluir
excluir sustituir distribuir unir fingir dirigir exigir corregir medir mantener tener poner
venir salir valer poder saber caber haber querer hacer decir sostener obtener detener contener
retener entretener proponer suponer componer oponer exponer imponer disponer deshacer rehacer
satisfacer prevenir convenir intervenir predecir contradecir compartir discutir asistir
resistir persistir describir inscribir transmitir omitir repartir partir sobrevivir revivir
`;
const IRREG = { tener: 'tendr', sostener: 'sostendr', mantener: 'mantendr', obtener: 'obtendr',
  detener: 'detendr', contener: 'contendr', retener: 'retendr', entretener: 'entretendr',
  poner: 'pondr', proponer: 'propondr', suponer: 'supondr', componer: 'compondr', oponer: 'opondr',
  exponer: 'expondr', imponer: 'impondr', disponer: 'dispondr', venir: 'vendr', prevenir: 'prevendr',
  convenir: 'convendr', intervenir: 'intervendr', salir: 'saldr', valer: 'valdr', poder: 'podr',
  saber: 'sabr', caber: 'cabr', haber: 'habr', querer: 'querr', hacer: 'har', deshacer: 'deshar',
  rehacer: 'rehar', satisfacer: 'satisfar', decir: 'dir', predecir: 'predir', contradecir: 'contradir' };
const TERM = ['ía', 'ías', 'íamos', 'íais', 'ían'];
// Nunca se tocan (sustantivos y adjetivos que se escriben igual sin ser verbos). Incluye la
// lista pedida expresamente.
export const EXCLUIDAS = new Set(`
miseria materia serie series historia categoria memoria victoria gloria armonia ironia sinfonia
compania policia energia alegria filosofia fotografia biografia melancolia hipocresia democracia
aristocracia burocracia estrategia tecnologia biologia geologia astronomia economia ceremonia
arteria histeria bacteria feria ferias periferia iberia siberia valeria siria
hacia sabia sabias media medias seria serias
extraordinaria varias necesaria necesarias diaria diarias secundaria secretaria secretarias
funcionaria funcionarias legendaria plegaria plegarias luminaria destinataria revolucionaria
`.trim().split(/\s+/));
const VERBO_IA = {};
const sinTilde = (s) => s.normalize('NFD').replace(/\u0301/g, '').normalize('NFC');
for (const inf of INF_AR.split(/\s+/).filter(x => x && !x.endsWith('?')).concat(INF_ER_IR.split(/\s+/).filter(Boolean))) {
  const base = IRREG[inf] ?? inf;
  for (const t of TERM) VERBO_IA[sinTilde(base + t)] = base + t;                 // condicional
  if (/[ei]r$/.test(inf) && !['ser', 'ir'].includes(inf)) {                         // imperfecto -er/-ir
    const raiz = inf === 'ver' ? 've' : inf.slice(0, -2); // ver -> veía (no "vía")
    for (const t of TERM) VERBO_IA[sinTilde(raiz + t)] = raiz + t;
  }
}
for (const x of EXCLUIDAS) delete VERBO_IA[x];
// los demas tiempos de "ser" en condicional (seria/serias van aparte, por contexto)
Object.assign(VERBO_IA, { seriamos: 'seríamos', seriais: 'seríais', serian: 'serían' });
// Sustantivos en -ería (estantería, tontería, cacería, porquería...) y verbos -er/-ir que se
// escapen de la lista: -eri(a|as|amos|ais|an) / -iri(...) llevan tilde salvo las excluidas.
const RE_ERIA = /^\p{L}{2,}([ei])ri(a|as|amos|ais|an)$/u;
// "seria" adjetivo: tras estas palabras o tras un sustantivo femenino (persona seria)
const ANTES_ADJ = /^(?:muy|tan|más|mas|menos|bastante|demasiado|algo|poco|es|era|eres|soy|está|estás|estaba|estaban|parece|parecía|pareces|pareció|puso|pone|una|la|esa|esta|tu|su|mi|cara|voz|mirada|expresión|persona|chica|mujer|cosa|situación|actitud|conversación|pregunta|amenaza|herida|acusación|razón|forma|manera|gente)$/;

const COMPUESTOS = { osea: 'o sea', enserio: 'en serio', aveces: 'a veces', derrepente: 'de repente',
  porfavor: 'por favor', almenos: 'al menos', apesar: 'a pesar' };

const INTERROG = { que: 'qué', quien: 'quién', quienes: 'quiénes', como: 'cómo', donde: 'dónde',
  adonde: 'adónde', cuando: 'cuándo', cual: 'cuál', cuales: 'cuáles', cuanto: 'cuánto',
  cuanta: 'cuánta', cuantos: 'cuántos', cuantas: 'cuántas' };

// ---------------------------------------------------------------- ñ perdida (banos -> baños)
// Se escriben con la forma CORRECTA; la clave se genera cambiando ñ -> n (y quitando tildes).
// SOLO van aquí palabras cuya version sin ñ NO es una palabra espanola real.
// Prohibidas a proposito: una/unas (uña), cana (caña), pena (peña), cono (coño), mono (moño),
// cena, campana, ordenar (ordeñar), sonar/sonaba/sonando (soñar), tenido (teñido).
const CON_ENE = `
años añadir añade añado añadió antaño
bañar bañarse baño baños bañera bañeras bañado
cariño cariños cariñoso cariñosa ceñir ceñido
compañero compañeros compañera compañeras compañerismo compañía compañías
daño daños dañar dañado dañino dañina desengaño desempeño
diseño diseños diseñar diseñado dueño dueña dueños dueñas
empeño empeñar empeñado engaño engaños engañar engaña engañas engañado engañada engañoso
enseñar enseña enseñó enseñaba enseñado enseñanza
españa español española españoles españolas
extraño extraña extraños extrañas extrañar extrañado extrañas
guiño guiños mañana mañanas montaña montañas montañoso
muñeca muñecas muñeco muñecos muñón
niño niña niños niñas niñez niñera otoño
pañuelo pañuelos paño paños pequeño pequeña pequeños pequeñas
puñal puñales puñalada puñaladas puño puños puñetazo puñetazos puñado
rebaño refunfuñar regañar regaña regañó reñir riña riñas retoño
señor señora señores señoras señorita señoritas
señal señales señalar señaló señala señalado
sueño sueños soñé soñador soñadora
tacaño tacaña tamaño tamaños
acompañar acompaña acompañó acompañado acompañante
araña arañas arañar arañazo arañazos castaño castaña estaño
`;
// Riesgo real de falso positivo -> solo "probable" (ano/anos tambien son palabras).
const CON_ENE_PROB = `año cañón cañones leña seña señas`;
const sinEne = (s) => sinTilde(s).replace(/ñ/g, 'n');
const ENE = {}, ENE_PROB = {};
for (const w of CON_ENE.trim().split(/\s+/)) if (w) ENE[sinEne(w)] = w;
for (const w of CON_ENE_PROB.trim().split(/\s+/)) if (w) ENE_PROB[sinEne(w)] = w;
for (const k of ['una', 'unas', 'cana', 'canas', 'pena', 'penas', 'cono', 'conos', 'mono', 'monos',
  'cena', 'cenar', 'campana', 'ordenar', 'sonar', 'sonaba', 'sonando', 'sonado', 'tenido', 'tino',
  'nono', 'lena']) { delete ENE[k]; delete ENE_PROB[k]; }

// ---------------------------------------------------------------- futuro simple (limpiara -> limpiará)
// Para -er/-ir no hay ambiguedad (el imperfecto de subjuntivo es -iera/-iese): "comera" no existe.
// Para -ar SI la hay ("limpiara" puede ser subjuntivo), asi que solo se marca "probable"
// salvo que vaya detras de un interrogativo ("quien limpiara" -> "quién limpiará").
const FUT_TERM = ['é', 'ás', 'á', 'éis', 'án'];
const FUT_SEG = {}, FUT_AMB = {};
// claves que tambien son sustantivos/palabras corrientes: NO se tocan nunca
const FUT_NO = new Set(['ira', 'iras', 'cabra', 'cabras', 'vera', 'veras', 'mara', 'tara',
  'mentira', 'mentiras', 'pera', 'peras', 'cera', 'ceras', 'manera', 'maneras', 'bandera',
  'banderas', 'madera', 'maderas', 'frontera', 'carrera', 'barrera', 'basura', 'figura',
  'factura', 'locura', 'pintura', 'lectura', 'obra', 'obras', 'sombra', 'sombras', 'libra',
  'libras', 'palabra', 'palabras', 'cara', 'caras', 'para', 'hora', 'horas', 'tira', 'tiras']);
for (const [lista, destino] of [[INF_AR, FUT_AMB], [INF_ER_IR, FUT_SEG]]) {
  for (const inf of lista.split(/\s+/).filter(Boolean)) {
    const base = IRREG[inf] ?? inf;
    for (const t of FUT_TERM) {
      const f = base + t, k = sinTilde(f);
      if (!FUT_NO.has(k) && !EXCLUIDAS.has(k) && k !== f) destino[k] = f;
    }
  }
}
for (const k of Object.keys(FUT_SEG)) delete FUT_AMB[k];
// contextos que piden subjuntivo: ahi "limpiara" esta bien escrito
const SUBJUNTIVO = /\b(?:si|como\s+si|ojal[aá]|aunque|quiz[aá]s?|tal\s+vez|acaso|mientras|antes\s+de\s+que|sin\s+que|para\s+que|hasta\s+que|a\s+menos\s+que|en\s+caso\s+de\s+que|hubiera|hubiese|quisiera|quisiese|esperaba|esperaban|quer[ií]a|quer[ií]an|pidi[oó]|ped[ií]a|orden[oó]|mand[oó]|rog[oó]|sugiri[oó]|dese[oó]|deseaba|gustar[ií]a|dej[oó]|permiti[oó]|evit[oó]|impidi[oó])\b/i;
// OJO: aqui NO puede entrar "que" ni "alguien"/"nadie"/"despues": "pedi que inventara",
// "antes de que robara", "si alguien acabara" son SUBJUNTIVO, no futuro.
const TRAS_INTERROG = /^(?:qui[eé]n|qui[eé]nes|qué|cu[aá]ndo|d[oó]nde|ad[oó]nde|c[oó]mo|cu[aá]l|cu[aá]les|cu[aá]nto|cu[aá]nta|cu[aá]ntos|cu[aá]ntas)$/;

// ---------------------------------------------------------------- interrogativas indirectas
// "Me pregunto quien limpiara..." -> "quién". Detras de estos verbos el interrogativo va con tilde.
const PREG_FUERTE = /^(?:pregunto|preguntó|preguntaba|preguntaban|pregunta|preguntas|preguntan|preguntar|preguntarme|preguntarte|preguntarse|preguntarnos|preguntado|preguntándome|preguntandome|dime|dinos|díganme|diganme|dígame|digame|cuéntame|cuentame|cuéntanos|cuentanos|explícame|explicame|explícanos|explicanos|adivina|adivinad|adivinen|averigua|averiguad|imagínate|imaginate|fíjate|fijate)$/;
const PREG_DEBIL = /^(?:sé|se|sabes|sabe|saben|sabemos|sabía|sabia|sabían|sabian|sabré|sabre|sabrás|sabras|saber|supe|supo|supimos|veo|ves|ve|vemos|veremos|verás|veras|ver|mira|mirad|miren|miro|entiendo|entiendes|entender|entiende|comprendo|comprender|decidir|decide|decidido|decidí|decidi|olvidé|olvide|olvidado|olvidar|recuerdo|recuerdas|recordar|recuerda|importa|importaba|depende|dependía|dependia|dudo|duda|dudaba|descubrir|descubre|descubrí|descubri|descubrió|descubrio|comprobar|comprueba|averiguar|averiguado|imagina|imaginar|imagino|notar|nota|noté|note|decidimos|cuenta|contar|señala|senala|indica|indicar)$/;
// verbos que llevan "que" completivo (no interrogativo): "¿Crees que vendrá?"
const COMPLETIVO = /^(?:creo|crees|cree|creen|creemos|creía|creia|creías|creias|pensaba|piensas|piensa|pienso|supones|supongo|supone|dices|dice|digo|dicen|dijo|dije|dijiste|parece|parecía|parecia|espero|esperas|espera|esperaba|temes|temo|teme|opinas|opino|recuerdas|recuerdo|sabes|sabías|sabias|entiendes|entiendo|imaginas|imagino|notas|noto|juras|juro|admites|admito|niegas|niego|significa|quiere|quieres|quiero|olvidas|olvido)$/;
// palabras que detras de "que" lo convierten en interrogativo: "¿Que hora es?" -> "¿Qué hora es?"
const SIG_QUE = /^(?:hace|haces|hacemos|hacen|hago|hacía|hacia|hacías|hacias|pasa|pasó|paso|pasaba|ocurre|ocurrió|ocurrio|ocurría|ocurria|sucede|sucedió|sucedio|significa|significan|quieres|quiere|quieren|quería|queria|querías|querias|piensas|piensa|piensan|opinas|crees|dices|dice|dicen|propones|sugieres|buscas|busca|necesitas|necesita|harás|haras|harías|harias|vas|vamos|va|van|es|era|son|fue|será|sera|hay|había|habia|tal|hora|día|dia|clase|tipo|parte|cosa|cosas|demonios|diablos|narices|cojones|mierda|coño|cono|más|mas|te|le|me|nos|os|lo|la|los|las|se|importa|importaba|puedo|puedes|puede|pueden|debo|debes|debe|tengo|tienes|tiene|tienen|hiciste|hizo|hicimos|hicieron|dijiste|pretendes|pretende|esperas|esperabas|sentiste|sentías|sentias)$/;
const SIG_COMO = /^(?:es|era|fue|son|eran|está|esta|estás|estas|estoy|están|estan|puede|puedes|puedo|pueden|podría|podria|podrías|podrias|vamos|voy|va|van|vas|se|lo|la|le|te|me|nos|sabes|sabías|sabias|llamas|llama|llaman|llamo|hago|haces|hace|hacen|pudo|pudiste|quieres|quiere|demonios|diablos|narices|coño|cono|mierda|diablo)$/;
// "¿...?" -> para saber si una palabra esta dentro de una pregunta
function enPregunta(m, i) {
  const antes = m.slice(0, i), desp = m.slice(i);
  const abre = antes.lastIndexOf('¿');
  if (abre < 0) return false;
  const corta = Math.max(antes.lastIndexOf('?'), antes.lastIndexOf('.'), antes.lastIndexOf('!'), antes.lastIndexOf('\n'));
  if (corta > abre) return false;
  const cierra = desp.indexOf('?'), otra = desp.indexOf('¿');
  return cierra >= 0 && (otra < 0 || cierra < otra);
}
// "solo" -> "sólo": la RAE (2010/2023) ya NO lo tilda nunca. Pon true si lo quieres igualmente.
const TILDAR_SOLO = false;

const TRAS_ESTA = /^(?:muy|tan|llen[oa]s?|vac[ií][oa]s?|sol[oa]s?|encima|debajo|detrás|detras|delante|bien|mal|aquí|aqui|ahí|ahi|allí|alli|claro|muert[oa]|viv[oa]|loc[oa]|segur[oa]|list[oa]|cansad[oa]|herid[oa]|enfadad[oa]|equivocad[oa]|pasando|haciendo|siendo|intentando|diciendo|en|con|lejos|cerca|dentro|fuera|hecho|hecha|roto|rota|cerrad[oa]|abiert[oa])$/i;
const PREP = /^(?:para|con|de|a|por|sin|sobre|contra|entre|hacia|según|segun|que|como|ante|tras|desde|hasta)$/i;

// ---------------------------------------------------------------- utilidades
const PALABRA = /\p{L}+/gu;
function enmascarar(t) { // las etiquetas <CLT=...> no se analizan, pero se conservan las posiciones
  return t.replace(/<[^>]*>/g, m => '\u0000'.repeat(m.length));
}
function conCaso(orig, nueva) {
  if (orig === orig.toUpperCase() && orig.length > 1) return nueva.toUpperCase();
  if (orig[0] === orig[0].toUpperCase()) return nueva[0].toUpperCase() + nueva.slice(1);
  return nueva;
}
function contexto(t, i, j) {
  return (t.slice(Math.max(0, i - 25), i) + '[' + t.slice(i, j) + ']' + t.slice(j, j + 25)).replace(/\n/g, ' ').replace(/<[^>]*>/g, '');
}
function palabras(t) {
  const m = enmascarar(t);
  return [...m.matchAll(PALABRA)].map(x => ({ w: x[0], i: x.index, j: x.index + x[0].length }));
}

// ---------------------------------------------------------------- analisis
export function analizar(texto, { original = null, anterior = null } = {}) {
  const av = [];
  const add = (gravedad, tipo, i, j, sugerencia, mensaje) =>
    av.push({ gravedad, tipo, i, j, palabra: texto.slice(i, j), sugerencia, mensaje, contexto: contexto(texto, i, j) });
  const ws = palabras(texto);
  const m = enmascarar(texto);

  for (let k = 0; k < ws.length; k++) {
    const { w, i, j } = ws[k];
    const lw = w.toLowerCase();
    const sig = ws[k + 1]?.w.toLowerCase();
    const ant = ws[k - 1]?.w.toLowerCase();
    const despues = m.slice(j, j + 3);
    const antes = m.slice(Math.max(0, i - 3), i);

    // 1. palabras que siempre llevan tilde
    if (SIEMPRE[lw] && SIEMPRE[lw] !== lw) { add('seguro', 'tilde', i, j, conCaso(w, SIEMPRE[lw]), `"${w}" siempre lleva tilde`); continue; }
    // 1a. ñ perdida (banos -> baños, manana -> mañana)
    if (ENE[lw] && ENE[lw] !== lw) { add('seguro', 'ñ', i, j, conCaso(w, ENE[lw]), `falta la ñ: "${ENE[lw]}"`); continue; }
    if (ENE_PROB[lw] && ENE_PROB[lw] !== lw) { add('probable', 'ñ', i, j, conCaso(w, ENE_PROB[lw]), `seguramente falta la ñ: "${ENE_PROB[lw]}"`); continue; }
    // 1b. formas verbales en -ía (condicional / imperfecto) y sustantivos en -ería
    if (lw === 'seria' || lw === 'serias') {
      if (!(ant && ANTES_ADJ.test(ant))) add('probable', 'tilde', i, j, conCaso(w, lw === 'seria' ? 'sería' : 'serías'), `condicional de "ser" (el adjetivo "seria" va tras sustantivo o "muy/tan/es...")`);
      continue;
    }
    if (!EXCLUIDAS.has(lw)) {
      if (VERBO_IA[lw]) { add('seguro', 'tilde', i, j, conCaso(w, VERBO_IA[lw]), `forma verbal en -ía: lleva tilde`); continue; }
      if (RE_ERIA.test(lw)) { add('seguro', 'tilde', i, j, conCaso(w, lw.replace(/([ei])ri(a|as|amos|ais|an)$/, '$1rí$2')), `-ería / -iría lleva tilde`); continue; }
      if (/^\p{L}{2,}ari(amos|ais|an)$/u.test(lw)) { add('seguro', 'tilde', i, j, conCaso(w, lw.replace(/ari(amos|ais|an)$/, 'arí$1')), `condicional: lleva tilde`); continue; }
      if (/^\p{L}{3,}arias?$/u.test(lw) && ant && /^(?:me|te|se|nos|os|le|les|no|yo|tú|él|ella|nosotros|vosotros|ellos|ellas|quién|quien|nunca|jamás|también|tambien)$/.test(ant)) {
        add('probable', 'tilde', i, j, conCaso(w, lw.replace(/aria(s?)$/, 'aría$1')), `tras pronombre o "no" es un condicional: lleva tilde`); continue;
      }
    }
    // 1c. futuro simple (limpiara -> limpiará, comera -> comerá)
    if (!EXCLUIDAS.has(lw)) {
      if (lw === 'veras' && ant !== 'de') { add('probable', 'tilde', i, j, conCaso(w, 'verás'), `"verás" (verbo ver) lleva tilde; "de veras" no`); continue; }
      if (FUT_SEG[lw]) { add('seguro', 'tilde', i, j, conCaso(w, FUT_SEG[lw]), `futuro: lleva tilde`); continue; }
      if (FUT_AMB[lw]) {
        // Solo se toca si va detras de un interrogativo REAL: "¿Quién limpiara?" / "Me pregunto
        // quien limpiara". Fuera de ahi, "-ara/-aran" es casi siempre imperfecto de subjuntivo
        // ("pedi que inventara", "antes de que robara"), que se escribe SIN tilde.
        const ant2f = ws[k - 2]?.w.toLowerCase();
        const pIni = ws[k - 1]?.i ?? 0;
        const traeSigno = /[¿¡]["«\s\u0000]*$/.test(m.slice(Math.max(0, pIni - 6), pIni));
        if (ant && TRAS_INTERROG.test(ant) && (traeSigno || (ant2f && PREG_FUERTE.test(ant2f)))) {
          add('seguro', 'tilde', i, j, conCaso(w, FUT_AMB[lw]), `futuro tras interrogativo: lleva tilde`);
        }
        continue;
      }
    }
    // 2. -cion / -sion  (y el error contrario: -ciónes)
    if (/^\p{L}{2,}[cs]ion$/u.test(lw)) { add('seguro', 'tilde', i, j, conCaso(w, lw.replace(/ion$/, 'ión')), `las palabras en -ción/-sión llevan tilde`); continue; }
    if (/[cs]iónes$/.test(lw)) { add('seguro', 'tilde', i, j, conCaso(w, lw.replace(/iónes$/, 'iones')), `el plural -ciones no lleva tilde`); continue; }
    // 3. palabras pegadas
    if (COMPUESTOS[lw]) { add('seguro', 'separado', i, j, conCaso(w, COMPUESTOS[lw]), `se escribe separado`); continue; }
    if (/^iva(s|mos|n)?$/.test(lw)) { add('seguro', 'b/v', i, j, conCaso(w, lw.replace('iva', 'iba')), `"iba" se escribe con b`); continue; }

    // 4. interrogativos justo tras ¿ o ¡ (o tras "¿Y", "¿Pero", "¿Entonces")
    const abre = /[¿¡]["«\s\u0000]*$/.test(m.slice(Math.max(0, i - 6), i));
    const abreConNexo = ant && /^(?:y|pero|entonces|e|o|ah|eh|de|para|con|a|por|desde|hasta|en|sin|sobre|hacia|y)$/.test(ant) && /[¿¡]["«\s\u0000]*$/.test(m.slice(Math.max(0, ws[k - 1].i - 6), ws[k - 1].i));
    if (INTERROG[lw] && (abre || abreConNexo)) { add(abre ? 'seguro' : 'probable', 'tilde', i, j, conCaso(w, INTERROG[lw]), `interrogativo/exclamativo: lleva tilde`); continue; }
    // 4b. interrogativa indirecta: "Me pregunto quien...", "No se donde...", "Dime como..."
    if (INTERROG[lw]) {
      const ant2 = ws[k - 2]?.w.toLowerCase();
      if (ant && PREG_FUERTE.test(ant)) {
        add('seguro', 'tilde', i, j, conCaso(w, INTERROG[lw]), `interrogativa indirecta tras "${ant}": lleva tilde`); continue;
      }
      // "No sé dónde está", "No sabes quién es". Exige el "no" delante: sin el, "cuando"
      // y "quien" casi siempre son relativos ("ya sabes, cuando me enteré...") -> falso positivo.
      if (ant2 === 'no' && ant && PREG_DEBIL.test(ant) && lw !== 'que' && lw !== 'como') {
        add('probable', 'tilde', i, j, conCaso(w, INTERROG[lw]), `interrogativa indirecta tras "no ${ant}": lleva tilde`); continue;
      }
      // "¿...que?" / "¿...por que?" al final de la pregunta
      if (enPregunta(m, i) && /^[\s\u0000"»]*\?/.test(m.slice(j)) && !(ant && COMPLETIVO.test(ant))) {
        add('probable', 'tilde', i, j, conCaso(w, INTERROG[lw]), `interrogativo al final de la pregunta: lleva tilde`); continue;
      }
      // NOTA: no se marcan los interrogativos sueltos dentro de "¿...?" porque casi siempre
      // son relativos ("¿No fue Kokichi quien hizo el plan?") y daban muchos falsos positivos.
    }
    const abreP = /¿["«\s\u0000]*$/.test(m.slice(Math.max(0, i - 6), i)); // solo pregunta, no "¡Porque...!"
    if (lw === 'porque' && abreP) { add('seguro', 'porque', i, j, conCaso(w, 'por qué'), `en pregunta directa es "por qué"`); continue; }
    if (lw === 'por' && sig === 'que' && abreP) { add('seguro', 'porque', ws[k + 1].i, ws[k + 1].j, 'qué', `en pregunta directa es "por qué"`); continue; }
    if (lw === 'porque' && ant && /^(?:el|un|los|del)$/.test(ant)) { add('probable', 'porque', i, j, conCaso(w, 'porqué'), `sustantivo: "el porqué"`); continue; }

    // 5. tildes diacriticas por contexto
    const finFrase = /^["»\u0000]*[\s]*[.,;:!?…)]/.test(despues) || j >= m.replace(/[\s\u0000]+$/, '').length;
    if ((lw === 'esta' || lw === 'estas') && ((sig && TRAS_ESTA.test(sig)) || finFrase)) {
      add('probable', 'tilde', i, j, conCaso(w, lw === 'esta' ? 'está' : 'estás'), `verbo estar: "${lw === 'esta' ? 'está' : 'estás'}"`); continue;
    }
    if (lw === 'el' && finFrase && (!ant || PREP.test(ant) || /^(?:fue|era|es|sea|ser|sido|será|sería|solo|incluso|ni|y|o)$/.test(ant))) { add('probable', 'tilde', i, j, conCaso(w, 'él'), `pronombre: "él"`); continue; }
    if (lw === 'tu' && (finFrase || /^(?:eres|tienes|sabes|estás|estas|puedes|quieres|haces|dices|crees|mismo|misma|también|tambien|no|lo|la|me|nos|te|y|solo)$/.test(sig || ''))) {
      add('probable', 'tilde', i, j, conCaso(w, 'tú'), `pronombre: "tú"`); continue;
    }
    if (lw === 'mi' && finFrase && ant && PREP.test(ant)) { add('probable', 'tilde', i, j, conCaso(w, 'mí'), `pronombre tras preposición: "mí"`); continue; }
    if (lw === 'se' && ((ant && /^(?:no|yo|ya|lo|la|te|le|os|bien)$/.test(ant) && (finFrase || /^(?:si|qué|que|cómo|como|dónde|donde|nada|por|cuándo|cuando|quién|quien)$/.test(sig || ''))))) {
      add('probable', 'tilde', i, j, conCaso(w, 'sé'), `verbo saber: "sé"`); continue;
    }
    // "Sí" afirmativo:
    //   seguro   - el bloque es solo "Si" (opción de respuesta Sí/No)
    //            - "Si" al inicio de frase (o tras ¡ ¿ o tartamudeo "S-") seguido de , . ! ?
    //            - "Si..." seguido de mayúscula o fin de bloque ("Si... Gonta pensaba eso")
    //   probable - en mitad de frase tras "que/eso/claro/creo..." y seguido de signo ("Creo que si.")
    //   nunca    - "Si quieres venir", "Si él dice eso", "¿Y si...?", "como si,", "Si... si lo hubiera"
    if (lw === 'si') {
      const tras = m.slice(j);
      const previo = m.slice(0, i);
      const soloBloque = /^[\s\u0000¡¿"«]*(?:S-)*$/i.test(previo) && /^[\s\u0000]*[.!?…,]*[\s\u0000"»]*$/.test(tras);
      const inicio = /(?:^|[.!?…]\s+|\n)[\s\u0000"«¡¿]*(?:S-)*$/i.test(previo) || /[¡¿]\s*$/.test(previo) || /(?:^|\s)(?:\p{L}-)+$/u.test(previo);
      const conSigno = /^[,!?]|^\.(?!\.)/.test(tras);
      const puntos = /^(?:\.\.\.|…)/.test(tras);
      const traspuntos = tras.replace(/^(?:\.\.\.|…)[\s\u0000]*/, '');
      const nexoCond = ant && /^(?:y|e|o|u|ni|como|pero)$/.test(ant) && !inicio;
      if (soloBloque) { add('seguro', 'tilde', i, j, conCaso(w, 'sí'), `afirmación (respuesta "Sí"): lleva tilde`); continue; }
      if (!nexoCond && inicio && (conSigno || (puntos && (traspuntos === '' || /^["«]?\p{Lu}/u.test(traspuntos))))) {
        add('seguro', 'tilde', i, j, conCaso(w, 'sí'), `afirmación: "Sí"`); continue;
      }
      if (!nexoCond && !inicio && (conSigno || puntos) && ant && /^(?:que|eso|claro|pues|creo|ah|oh|bueno|también|tambien|ella|él|yo|tú|nosotros|vosotros|ellos|ellas|porque|digo|dije|dijo)$/.test(ant)) {
        add('probable', 'tilde', i, j, conCaso(w, 'sí'), `afirmación: "sí"`); continue;
      }
      continue;
    }
    if (lw === 'mas' && sig !== 'bien') { add('probable', 'tilde', i, j, conCaso(w, 'más'), `"mas" (= pero) casi no se usa: seguramente es "más"`); continue; }
    if (lw === 'aun') {
      // "aun así", "aun cuando", "aun siendo" = incluso -> SIN tilde
      if (sig && /^(?:as[ií]|cuando|siendo|sabiendo|teniendo|estando|a|los|las|el|la|m[aá]s\u0000*$)$/.test(sig)) { continue; }
      if ((sig && /^(?:no|sigo|sigue|sigues|siguen|seguimos|est[aá]|est[aá]s|estoy|estamos|est[aá]n|estaba|queda|quedan|quedaba|tengo|tienes|tiene|tienen|ten[ií]a|hay|hab[ií]a|falta|faltan|puedo|puede|puedes|pueden|me|te|se|nos|lo|la|le|les|m[aá]s|mejor|peor|as[ií]\u0000*\?)$/.test(sig)) || finFrase) {
        add('probable', 'tilde', i, j, conCaso(w, 'aún'), `"aún" (= todavía) lleva tilde`); continue;
      }
      add('dudoso', 'tilde', i, j, null, `"aún" (= todavía) lleva tilde; "aun" (= incluso) no`); continue;
    }
    // "solo": la RAE ya no lo tilda. Solo se avisa (o se corrige) si TILDAR_SOLO = true.
    if (lw === 'solo' && TILDAR_SOLO && sig && /^(?:quiero|quería|queria|quiere|queremos|necesito|necesita|falta|faltan|queda|quedan|hay|puedo|puede|pueden|s[eé]|digo|dije|pensaba|pienso|intento|intentaba|estaba|estoy|era|fue|un|una|unos|unas|dos|tres|si|cuando|por|para|en|a|me|te|se|lo|la|le|nos)$/.test(sig)) {
      add('probable', 'tilde', i, j, conCaso(w, 'sólo'), `"sólo" (= solamente); la RAE ya no lo exige`); continue;
    }
  }

  // 6. confusiones de varias palabras
  const reglas = [
    [/\bhaber si\b/giu, 'seguro', 'a ver si', '"a ver si" (de mirar)'],
    [/\bvamos haber\b/giu, 'seguro', 'vamos a ver', '"vamos a ver"'],
    [/\ba ver (sido|estado|tenido|hecho|dicho|visto|ido|podido|querido|sabido|\p{L}+[ai]do)\b/giu, 'seguro', null, 'ante participio es "haber"'],
    [/\b(he|has|ha|hemos|habéis|habeis|han|había|habia|habían|habrá|habría|haya|hubiera) echo\b/giu, 'seguro', null, '"hecho" (de hacer) lleva h'],
    [/\bhecho de menos\b/giu, 'seguro', 'echo de menos', '"echar de menos" va sin h'],
    [/\bhech(ar|ado|aba|aste|amos|aron)\b/giu, 'seguro', null, '"echar" va sin h'],
    [/\bay que\b/giu, 'seguro', 'hay que', '"hay que" (de haber)'],
    [/¡\s*hay(?=[,!.…])/giu, 'seguro', '¡Ay', 'queja: "¡Ay!"'], // "¡Hay!" / "¡Hay," pero no "¡Hay que...!"
    [/\bhay (está|estaba|estás|estaban|tienes|va|viene)\b/giu, 'probable', null, 'lugar: "ahí"'],
    [/\btubo que\b/giu, 'seguro', 'tuvo que', '"tuvo" (de tener)'],
    [/¡\s*valla\b/giu, 'seguro', '¡Vaya', '"¡Vaya!" con y'],
    [/\bsi no que\b/giu, 'probable', 'sino que', '"sino que"'],
    [/ {2,}/g, 'probable', ' ', 'doble espacio'],
    [/(?<=\p{L}) +(?=[,.;:!?](?!\.))/gu, 'probable', '', 'espacio antes de signo de puntuación'],
  ];
  const mm = enmascarar(texto);
  for (const [re, g, sug, msg] of reglas) {
    for (const x of mm.matchAll(re)) {
      let s = sug;
      if (s === null) {
        const t = x[0];
        if (/^a ver/i.test(t)) s = t.replace(/^a ver/i, v => conCaso(v, 'haber'));
        else if (/ echo$/i.test(t)) s = t.replace(/echo$/i, e => conCaso(e, 'hecho'));
        else if (/^hech/i.test(t)) s = t.replace(/^h/i, '');
        else if (/^hay /i.test(t)) s = t.replace(/^hay/i, v => conCaso(v, 'ahí'));
      } else if (/^\p{L}/u.test(s)) s = conCaso(x[0], s);
      av.push({ gravedad: g, tipo: 'confusión', i: x.index, j: x.index + x[0].length, palabra: x[0], sugerencia: s, mensaje: msg, contexto: contexto(texto, x.index, x.index + x[0].length) });
    }
  }

  // 7. signos de apertura (mismo algoritmo que anadir_signos_apertura.mjs)
  const r = arreglarSignos(texto, anterior);
  for (const c of r.cambios) av.push({ gravedad: 'seguro', tipo: 'signo', palabra: '', sugerencia: null, mensaje: `falta ${c}`, contexto: '' });
  for (const d of r.dudosos) av.push({ gravedad: 'dudoso', tipo: 'signo', palabra: '', sugerencia: null, mensaje: d, contexto: '' });

  // 8. texto sin traducir / restos en ingles
  if (original != null) {
    const limpio = (s) => s.replace(/<[^>]*>/g, '').trim();
    if (limpio(texto) && limpio(texto) === limpio(original) && (limpio(original).match(/\p{L}+/gu) || []).length >= 3) {
      av.push({ gravedad: 'dudoso', tipo: 'sin traducir', palabra: '', sugerencia: null, mensaje: 'idéntico al original inglés', contexto: limpio(texto).slice(0, 60) });
    }
  }
  const ingles = texto.replace(/<[^>]*>/g, '').match(/\b(?:the|and|you|what|this|that|with|have|is|are|was|were|it's|don't|I'm)\b/g);
  if (ingles && ingles.length >= 2) av.push({ gravedad: 'dudoso', tipo: 'inglés', palabra: '', sugerencia: null, mensaje: `palabras en inglés: ${[...new Set(ingles)].join(', ')}`, contexto: texto.replace(/<[^>]*>/g, '').slice(0, 60) });
  return av;
}

// ---------------------------------------------------------------- correccion
export function corregir(texto0, { probables = false, anterior = null } = {}) {
  // primero los signos (asi "¿De donde" ya tiene su ¿ y se detecta el interrogativo)
  const pre = arreglarSignos(texto0, anterior);
  const texto = pre.texto;
  const av = analizar(texto, { anterior }).filter(a => a.sugerencia != null && a.i != null &&
    (a.gravedad === 'seguro' || (probables && a.gravedad === 'probable')));
  // aplicar de derecha a izquierda sin solapes
  av.sort((a, b) => b.i - a.i);
  let s = texto, limite = Infinity;
  const cambios = [];
  for (const a of av) {
    if (a.j > limite) continue;
    s = s.slice(0, a.i) + a.sugerencia + s.slice(a.j);
    cambios.push(`${a.palabra} -> ${a.sugerencia}`);
    limite = a.i;
  }
  for (const c of pre.cambios) cambios.push(`signo: ${c}`);
  // garantia: las etiquetas no cambian
  const tags = (x) => (x.match(/<[^>]*>/g) || []).join('|');
  if (tags(s) !== tags(texto0)) return { texto: texto0, cambios: [] };
  return { texto: s, cambios };
}
