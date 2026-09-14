// AHORCADO - las palabras.
//
// Doce categorias de cosas que cualquiera conoce: la gracia es adivinar, no
// saber vocabulario raro. Espanol latino (COMPUTADORA, CHOFER, ARETES), sin
// acentos -- CAMION se juega como CAMION, que es la convencion del ahorcado --
// y con la Ñ, que si se adivina (ARAÑA, PIÑA, CARIÑO). Se admiten frases de dos
// palabras (OSO PANDA, PAPAS FRITAS): el espacio se ve como hueco y no se
// adivina.
//
// NO IMPORTA NADA: tools/prueba-palabras.mjs lo carga por file:// y valida cada
// palabra (solo [A-ZÑ ], 4..14 caracteres, un espacio como mucho, sin
// repetidas) y hace jugar a dos bots por escalon de dificultad.

// ---------- NOSOTROS: las de ustedes dos ----------
// Anderson: aqui van las palabras que solo Romina y tu entienden -- el lugar de
// la primera cita, el apodo, la comida que siempre piden, la cancion. Con
// acentos si quieres (se quitan al cargar), mayusculas o minusculas, y frases
// de dos palabras. La categoria entra en la rotacion desde la segunda palabra
// de cada partida con un 25% de probabilidad, con la pista NOSOTROS, siempre
// que tenga al menos cinco.
// Maximo 14 caracteres contando espacios, que es lo que cabe en las casillas.
const NOSOTROS = [
  'PRIMERA CITA', 'TE AMO', 'ABRAZO FUERTE', 'CAFE JUNTOS', 'PARA SIEMPRE',
  'MI AMOR', 'CINE Y PIZZA', 'NUESTRA CASA',
];

const CATEGORIAS = {
  "ANIMALES": ["PERRO","GATO","LEON","TIGRE","ELEFANTE","JIRAFA","CABALLO","VACA","CERDO","OVEJA","CONEJO","RATON","ARAÑA","MARIPOSA","DELFIN","BALLENA","TIBURON","TORTUGA","COCODRILO","SERPIENTE","PINGUINO","MURCIELAGO","HIPOPOTAMO","RINOCERONTE","OSO PANDA","OSO POLAR","CANGURO","KOALA","ZORRO","LOBO","MONO","GORILA","AGUILA","LORO","PATO","GALLINA","CAMELLO","CEBRA","HORMIGA","ABEJA","CARACOL","PULPO","CANGREJO","PAVO REAL","COLIBRI"],
  "COMIDA": ["PIZZA","TACOS","HAMBURGUESA","EMPANADA","AREPA","TAMAL","ARROZ","FRIJOLES","SOPA","ENSALADA","CEVICHE","POLLO","PESCADO","QUESO","HUEVO","PASTEL","CHOCOLATE","HELADO","GALLETA","PANQUEQUE","SANDWICH","ESPAGUETI","LASAÑA","PAPAS FRITAS","PERRO CALIENTE","DONA","CHURROS","FLAN","GELATINA","TORTILLA","PALOMITAS","MANTEQUILLA","MERMELADA","CHOCLO","YOGUR","CEREAL","ALMUERZO","DESAYUNO","POSTRE","CARAMELO","PAN DULCE"],
  "FRUTAS": ["MANZANA","PERA","PLATANO","BANANA","NARANJA","MANDARINA","LIMON","FRESA","FRUTILLA","SANDIA","MELON","PIÑA","MANGO","PAPAYA","GUAYABA","MARACUYA","COCO","CEREZA","DURAZNO","CIRUELA","KIWI","GRANADA","HIGO","MORA","FRAMBUESA","ARANDANO","AGUACATE","PALTA","TAMARINDO","GUANABANA","CHIRIMOYA","TORONJA","DATIL"],
  "PAISES": ["MEXICO","COLOMBIA","PERU","CHILE","ARGENTINA","BRASIL","ECUADOR","BOLIVIA","URUGUAY","PARAGUAY","VENEZUELA","PANAMA","COSTA RICA","GUATEMALA","HONDURAS","NICARAGUA","EL SALVADOR","CUBA","CANADA","ESTADOS UNIDOS","ESPAÑA","FRANCIA","ITALIA","ALEMANIA","PORTUGAL","INGLATERRA","GRECIA","RUSIA","TURQUIA","EGIPTO","CHINA","JAPON","COREA","INDIA","AUSTRALIA"],
  "PROFESIONES": ["MEDICO","DOCTORA","ENFERMERA","DENTISTA","MAESTRA","PROFESOR","ABOGADO","INGENIERO","ARQUITECTO","BOMBERO","POLICIA","PILOTO","CHOFER","MECANICO","COCINERO","PANADERO","CARPINTERO","PLOMERO","ELECTRICISTA","PINTOR","ACTOR","ACTRIZ","CANTANTE","BAILARINA","FOTOGRAFO","PERIODISTA","ESCRITOR","VETERINARIO","PSICOLOGA","FARMACEUTICO","CIENTIFICO","ASTRONAUTA","AGRICULTOR","PESCADOR","JARDINERO","PELUQUERO","MESERO","VENDEDOR","CONTADOR","SECRETARIA","PROGRAMADOR","DISEÑADOR","SOLDADO"],
  "DEPORTES": ["FUTBOL","BASQUETBOL","VOLEIBOL","TENIS","NATACION","CICLISMO","ATLETISMO","BOXEO","KARATE","JUDO","TAEKWONDO","GIMNASIA","BEISBOL","SURF","PATINAJE","ESQUI","MARATON","YOGA","ZUMBA","AJEDREZ","EQUITACION","ESGRIMA","BUCEO","ESCALADA","BOLICHE","BILLAR","PING PONG","SALTO ALTO","LUCHA LIBRE","CARRERA","PORTERO","ARQUERO","GOLEADOR"],
  "LA CASA": ["COCINA","BAÑO","COMEDOR","DORMITORIO","GARAJE","JARDIN","BALCON","TERRAZA","AZOTEA","ESCALERA","PUERTA","VENTANA","SOFA","SILLON","MESA","SILLA","CAMA","ALMOHADA","COBIJA","ARMARIO","ROPERO","ESPEJO","LAMPARA","CORTINA","ALFOMBRA","REFRIGERADOR","ESTUFA","MICROONDAS","LICUADORA","LAVADORA","TELEVISOR","COMPUTADORA","INODORO","REGADERA","LAVAMANOS","CHIMENEA","PASILLO","TIMBRE","BUZON"],
  "NATURALEZA": ["ARBOL","BOSQUE","SELVA","DESIERTO","MONTAÑA","VOLCAN","LAGO","LAGUNA","CASCADA","PLAYA","OCEANO","ISLA","CUEVA","NUBE","LLUVIA","TORMENTA","RELAMPAGO","TRUENO","ARCOIRIS","NIEVE","VIENTO","HURACAN","TERREMOTO","AMANECER","ATARDECER","ESTRELLA","PLANETA","ARENA","CACTUS","GIRASOL","PALMERA","GLACIAR"],
  "ROPA": ["CAMISA","CAMISETA","BLUSA","PANTALON","FALDA","VESTIDO","SUETER","CHAQUETA","CHAMARRA","ABRIGO","CHALECO","SUDADERA","PIJAMA","TRAJE","CORBATA","BUFANDA","GUANTES","GORRA","SOMBRERO","GORRO","CALCETINES","MEDIAS","ZAPATOS","BOTAS","SANDALIAS","PANTUFLAS","TACONES","CINTURON","BOLSO","MOCHILA","CARTERA","LENTES","RELOJ","COLLAR","PULSERA","ARETES","ANILLO","BIKINI","UNIFORME","DELANTAL"],
  "MUSICA": ["GUITARRA","PIANO","BATERIA","VIOLIN","FLAUTA","TROMPETA","SAXOFON","ACORDEON","TAMBOR","MARACAS","ARPA","MICROFONO","AUDIFONOS","CANCION","MELODIA","RITMO","CONCIERTO","ORQUESTA","BANDA","CUMBIA","SALSA","MERENGUE","BACHATA","REGGAETON","VALLENATO","MARIACHI","TANGO","ROCK","JAZZ","BALADA","RANCHERA","KARAOKE","SERENATA","PARTITURA","ESTRIBILLO"],
  "CUERPO": ["CABEZA","CABELLO","CEJA","PESTAÑA","OJOS","NARIZ","BOCA","LABIOS","DIENTE","LENGUA","OREJA","MEJILLA","BARBILLA","CUELLO","HOMBRO","BRAZO","CODO","MUÑECA","MANO","DEDO","ESPALDA","CINTURA","CADERA","PIERNA","RODILLA","TOBILLO","CORAZON","PULMON","ESTOMAGO","CEREBRO","SANGRE","COLUMNA","COSTILLA","RIÑON","GARGANTA","OMBLIGO"],
  "AMOR": ["BESO","ABRAZO","CITA","NOVIOS","CARIÑO","PROMESA","ETERNIDAD","TERNURA","PASION","ROMANCE","AMISTAD","PAREJA","NOVIA","NOVIO","ESPOSA","ESPOSO","BODA","ANIVERSARIO","COMPROMISO","CONFIANZA","SONRISA","CARICIA","POEMA","FLORES","REGALO","CORAZONES","FLECHAZO","MARIPOSAS","DULZURA","MEDIA NARANJA","ALMA GEMELA","PRIMER BESO","ENAMORADOS"]
};

// ---------- Normalizacion ----------
// Mayusculas, fuera acentos y dieresis, la Ñ protegida (NFD la partiria en N +
// tilde y se perderia). Devuelve null si queda algo que el teclado no tiene.
export function normalizar(s) {
  // NFC primero: una ñ pegada de otra app puede venir como n + tilde suelta y
  // sin componerla se convertiria en N. El centinela es un caracter de control
  // que no puede venir en un texto, no '#'.
  let t = String(s).normalize('NFC').toUpperCase().replace(/Ñ/g, '\u0001').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\u0001/g, 'Ñ');
  t = t.replace(/\s+/g, ' ').trim();
  if (!/^[A-ZÑ]+( [A-ZÑ]+){0,2}$/.test(t)) return null;
  return t;
}

// Dificultad POR LETRAS, no por largo: PIÑA es mas dificil que ELEFANTE. Pocas
// letras distintas dan pocas pistas, y las raras no salen probando por
// frecuencia.
export function dificultad(w) {
  const letras = new Set(w.replace(/ /g, ''));
  let d = 10 / letras.size;
  for (const L of letras) {
    if ('JKÑQWXYZ'.includes(L)) d += 2;
    else if ('BFGHV'.includes(L)) d += 1;
  }
  return d;
}

// La lista plana con su categoria, normalizada y con su dificultad. Se arma
// una vez al cargar el modulo.
export const LISTA = [];
for (const cat in CATEGORIAS) for (const w of CATEGORIAS[cat]) {
  const n = normalizar(w);
  if (n) LISTA.push({ w: n, cat, d: dificultad(n) });
}
export const NUESTRAS = NOSOTROS.map(normalizar).filter(w => w && w.length <= 14);

// Tercios por dificultad: FACIL, MEDIO, DIFICIL.
const ordenada = LISTA.slice().sort((a, b) => a.d - b.d);
const t1 = ordenada[Math.floor(ordenada.length / 3)].d, t2 = ordenada[Math.floor(ordenada.length * 2 / 3)].d;
export function tercio(x) { return x.d < t1 ? 0 : x.d < t2 ? 1 : 2; }

// Categorias donde la pista mas ayuda: para empezar.
const SUAVES = ['ANIMALES', 'FRUTAS', 'COMIDA', 'CUERPO'];
const DURAS = ['LA CASA', 'PROFESIONES', 'DEPORTES', 'NATURALEZA', 'PAISES'];

// Las ultimas 40 de la SESION (no solo de la partida): jugar tres partidas
// seguidas y ver ELEFANTE en las tres mata la gracia.
const recientes = [];
function marcar(w) { recientes.push(w); if (recientes.length > 40) recientes.shift(); }

// Elige la palabra n-esima (1 = la primera) de la partida.
//   1-2: tercio facil, categorias suaves.   3-5: facil o medio, cualquiera.
//   6-9: medio o dificil, con prioridad a las duras.   10+: cualquiera.
// Nunca repite la categoria de la anterior, ni una palabra de las recientes.
export function elegir(rnd, n, catAnterior) {
  if (n >= 2 && NUESTRAS.length >= 5 && catAnterior !== 'NOSOTROS' && rnd() < 0.25) {
    const libres = NUESTRAS.filter(w => !recientes.includes(w));
    if (libres.length) { const w = libres[Math.floor(rnd() * libres.length)]; marcar(w); return { w, cat: 'NOSOTROS' }; }
  }
  let filtro;
  if (n <= 2) filtro = x => tercio(x) === 0 && SUAVES.includes(x.cat);
  else if (n <= 5) filtro = x => tercio(x) <= 1;
  else if (n <= 9) filtro = x => tercio(x) >= 1 && (DURAS.includes(x.cat) || rnd() < 0.4);
  else filtro = () => true;
  let pool = LISTA.filter(x => filtro(x) && x.cat !== catAnterior && !recientes.includes(x.w));
  if (!pool.length) pool = LISTA.filter(x => x.cat !== catAnterior && !recientes.includes(x.w));
  if (!pool.length) pool = LISTA;
  const x = pool[Math.floor(rnd() * pool.length)];
  marcar(x.w);
  return { w: x.w, cat: x.cat };
}

export const NOMBRES = Object.keys(CATEGORIAS);
