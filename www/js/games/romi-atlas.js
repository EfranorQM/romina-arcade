// GENERADO por tools/romina-atlas.py -- no se edita a mano.
//
// Romina, dibujada a mano: "FemaleKnight" de retsuto
// (retsuto.itch.io/femaleknight), con el pelo y los ojos negros, mirando
// a la derecha y doblada con Scale2x. 40 colores.
//
// Cada fotograma: [x, y, ancho, alto, ox, oy] -- su rectangulo en
// img/romina.png y donde cae su esquina respecto a la RAIZ (entre los
// pies, en el suelo), mirando a la DERECHA.
export const HOJA_W = 1024, HOJA_H = 1925;

// Lo que el ARMARIO puede teñir, de oscuro a claro: la capa (con el lazo
// del pecho), la falda, su ribete y la estela del tajo (con sus propios
// blancos: ver marca_estela en tools/romina-atlas.py).
export const TINTES = {
  capa: ['#243c90', '#3060c0', '#4878d8'],
  falda: ['#84240c', '#9c3018', '#b43c24', '#d83018', '#f04830'],
  ribete: ['#d87830', '#f09048'],
  estela: ['#eaeae9', '#f0f0ef', '#fffffe'],
};

export const FRAMES = {
  // Idle 0, Idle 1, Idle 2, Idle 3, Idle 4, Idle 5, Idle 6, Idle 7, Idle 8
  idle: [
    [525,709,168,176,-78,-176],
    [694,709,172,176,-82,-176],
    [0,922,172,176,-82,-176],
    [173,922,172,176,-82,-176],
    [346,922,172,176,-82,-176],
    [519,922,168,176,-78,-176],
    [688,922,166,176,-76,-176],
    [0,1099,172,176,-82,-176],
    [173,1099,172,176,-82,-176]],
  // Running 0, Running 1, Running 2, Running 3, Running 4, Running 5
  run: [
    [209,1276,124,174,-78,-174],
    [346,1453,140,170,-84,-170],
    [809,1453,122,166,-84,-166],
    [334,1276,122,174,-80,-174],
    [487,1453,122,170,-84,-170],
    [0,1628,126,166,-82,-166]],
  // Jump 0, Jump 1, Jump 2, Jump 3, Jump 4, Jump 5, Fall 0, Fall 1, Crouch 0
  jump: [
    [455,1628,122,158,-78,-158],
    [457,1276,118,174,-72,-174],
    [830,1628,130,152,-84,-174],
    [701,1628,128,154,-82,-176],
    [831,255,112,220,-68,-232],
    [113,488,98,218,-54,-230],
    [0,488,112,220,-68,-232],
    [212,488,98,218,-54,-230],
    [0,1795,152,130,-102,-130]],
  // Attack1 0, Attack1 1, Attack1 2, Attack1 3, Attack1 4, Attack1 5
  atk: [
    [346,1099,126,176,-82,-176],
    [473,1099,126,176,-82,-176],
    [684,488,204,212,-60,-212],
    [0,709,186,212,-42,-212],
    [187,709,146,212,-42,-212],
    [311,488,136,218,-40,-218]],
  // Attack2 0, Attack2 1, Attack2 2, Attack2 3, Attack2 4, Attack2 5, Attack2 6, Attack2 7
  atk2: [
    [448,488,136,218,-40,-218],
    [207,0,90,252,-48,-252],
    [478,255,102,230,-60,-230],
    [505,0,196,246,-62,-246],
    [702,0,188,238,-54,-238],
    [127,1628,118,164,-54,-164],
    [576,1276,98,174,-56,-174],
    [600,1099,108,176,-66,-176]],
  // Attack3 0, Attack3 1, Attack3 2, Attack3 3, Attack3 4, Attack3 5, Attack3 6, Attack3 7, Attack3 8, Attack3 9, Attack3 10
  atk3: [
    [675,1276,108,174,-66,-174],
    [784,1276,98,174,-56,-174],
    [709,1099,100,176,-58,-176],
    [810,1099,140,176,-96,-176],
    [708,255,122,222,-78,-222],
    [581,255,126,226,-82,-226],
    [0,0,206,254,-60,-252],
    [298,0,206,250,-60,-248],
    [578,1628,122,158,-66,-158],
    [883,1276,140,174,-48,-174],
    [0,1453,142,174,-48,-174]],
  // AirAttack 0, AirAttack 1, AirAttack 2, AirAttack 3
  air: [
    [585,488,98,218,-54,-230],
    [0,255,234,232,-86,-252],
    [235,255,242,232,-94,-252],
    [334,709,190,200,-82,-220]],
  // Guard 0, Guard 2, Guard 1, Guard 3
  block: [
    [0,1276,208,176,-82,-176],
    [610,1453,198,168,-86,-168],
    [143,1453,202,172,-90,-172],
    [246,1628,208,164,-92,-164]],
  // Crouch 3
  dead: [
    [153,1795,152,130,-102,-130]],
};
