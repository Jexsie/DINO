import {
  AllocatorCharacterArray,
  Character,
  CharacterAllocator,
  CharacterMeta,
} from "./character";
import {
  dino_layout,
  stone_layout,
  themes,
  cloud_layout,
  pit_layout,
  bird_layout,
  cactus_layout,
  retry_layout,
  star_layout,
} from "./layouts";
import {
  applyVelocityToPosition,
  isCollided,
  Position,
  Velocity,
} from "./physics";
import {
  playCelebrate,
  playGameOver, // should play "game over" SFX; audio module should then play the voice automatically
  playJump,
  startTrack,
  stopTrack,
} from "./audio";

// === CANVASES ===
const canvas = document.getElementById("board");
const canvas_ctx = canvas.getContext("2d");

// FX overlay (for confetti)
const fx = document.getElementById("fx");
const fxCtx = fx.getContext("2d");

// === GAME CONSTANTS ===
const CELL_SIZE = 2;
const ROWS = 300;
let COLUMNS = 1000;
const FLOOR_VELOCITY = new Velocity(0, -7);
let CACTUS_MIN_GAP = 20;

if (screen.width < COLUMNS) {
  COLUMNS = screen.width;
  FLOOR_VELOCITY.add(new Velocity(0, 2));
  CACTUS_MIN_GAP = 50;
}

const DINO_INITIAL_TRUST = new Velocity(-11, 0);
const ENVIRONMENT_GRAVITY = new Velocity(-0.6, 0);

// y, x
const DINO_FLOOR_INITIAL_POSITION = new Position(200, 20);

// === GAME STATE ===
let dino_current_trust = new Velocity(0, 0);
let dino_ready_to_jump = true;
let game_over = null;
let is_first_time = true;
let game_score = null;
let game_score_step = 0;
let game_hi_score = null;
let step_velocity = new Velocity(0, -0.1);
let cumulative_velocity = null;
let current_theme = null;

let harmless_characters_pool = null;
let harmfull_characters_pool = null;

// pending celebrate flag to fire SFX after voice
let pendingCelebrate = false;
let celebrateFallbackTimer = null;

// Optionally listen for a custom event fired by your audio module when the
// game-over voice finishes. In your ./audio module, after the voice ends,
// do: window.dispatchEvent(new Event('gameovervoiceended'));
window.addEventListener("gameovervoiceended", () => {
  if (pendingCelebrate) {
    try {
      playCelebrate();
    } catch {}
    pendingCelebrate = false;
    if (celebrateFallbackTimer) {
      clearTimeout(celebrateFallbackTimer);
      celebrateFallbackTimer = null;
    }
  }
});

// === ALLOCATORS ===
let harmless_character_allocator = [
  new CharacterAllocator(
    new AllocatorCharacterArray()
      .add_character(
        new CharacterMeta(
          [stone_layout.large],
          0,
          new Position(240, COLUMNS),
          FLOOR_VELOCITY
        ),
        0.9
      )
      .add_character(
        new CharacterMeta(
          [stone_layout.medium],
          0,
          new Position(243, COLUMNS),
          FLOOR_VELOCITY
        ),
        0.75
      )
      .add_character(
        new CharacterMeta(
          [stone_layout.small],
          0,
          new Position(241, COLUMNS),
          FLOOR_VELOCITY
        ),
        0.6
      ),
    2,
    0
  ),
  new CharacterAllocator(
    new AllocatorCharacterArray()
      .add_character(
        new CharacterMeta(
          [cloud_layout],
          0,
          new Position(100, COLUMNS),
          new Velocity(0, -1)
        ),
        0.9
      )
      .add_character(
        new CharacterMeta(
          [cloud_layout],
          0,
          new Position(135, COLUMNS),
          new Velocity(0, -1)
        ),
        0.85
      )
      .add_character(
        new CharacterMeta(
          [cloud_layout],
          0,
          new Position(150, COLUMNS),
          new Velocity(0, -1)
        ),
        0.8
      ),
    350,
    300
  ),
  new CharacterAllocator(
    new AllocatorCharacterArray()
      .add_character(
        new CharacterMeta(
          [star_layout.small_s1],
          0,
          new Position(90, COLUMNS),
          new Velocity(0, -0.3)
        ),
        0.9
      )
      .add_character(
        new CharacterMeta(
          [star_layout.small_s2],
          0,
          new Position(125, COLUMNS),
          new Velocity(0, -0.3)
        ),
        0.85
      )
      .add_character(
        new CharacterMeta(
          [star_layout.small_s1],
          0,
          new Position(140, COLUMNS),
          new Velocity(0, -0.3)
        ),
        0.8
      ),
    350,
    250
  ),
  new CharacterAllocator(
    new AllocatorCharacterArray()
      .add_character(
        new CharacterMeta(
          [pit_layout.large],
          0,
          new Position(223, COLUMNS),
          FLOOR_VELOCITY
        ),
        0.97
      )
      .add_character(
        new CharacterMeta(
          [pit_layout.up],
          0,
          new Position(227, COLUMNS),
          FLOOR_VELOCITY
        ),
        0.9
      )
      .add_character(
        new CharacterMeta(
          [pit_layout.down],
          0,
          new Position(230, COLUMNS),
          FLOOR_VELOCITY
        ),
        0.85
      ),
    100,
    50
  ),
];

let harmfull_character_allocator = [
  new CharacterAllocator(
    new AllocatorCharacterArray()
      .add_character(
        new CharacterMeta(
          [cactus_layout.small_d1],
          0,
          new Position(201, COLUMNS),
          FLOOR_VELOCITY
        ),
        0.8
      )
      .add_character(
        new CharacterMeta(
          [cactus_layout.small_s1],
          0,
          new Position(201, COLUMNS),
          FLOOR_VELOCITY
        ),
        0.7
      )
      .add_character(
        new CharacterMeta(
          [cactus_layout.small_s2],
          0,
          new Position(201, COLUMNS),
          FLOOR_VELOCITY
        ),
        0.6
      )
      .add_character(
        new CharacterMeta(
          [cactus_layout.medium_d1],
          0,
          new Position(193, COLUMNS),
          FLOOR_VELOCITY
        ),
        0.5
      )
      .add_character(
        new CharacterMeta(
          [cactus_layout.medium_s1],
          0,
          new Position(193, COLUMNS),
          FLOOR_VELOCITY
        ),
        0.4
      )
      .add_character(
        new CharacterMeta(
          [cactus_layout.medium_s2],
          0,
          new Position(193, COLUMNS),
          FLOOR_VELOCITY
        ),
        0.3
      ),
    CACTUS_MIN_GAP,
    100
  ),
  new CharacterAllocator(
    new AllocatorCharacterArray()
      .add_character(
        new CharacterMeta(
          bird_layout.fly,
          0,
          new Position(170, COLUMNS),
          FLOOR_VELOCITY.clone().add(new Velocity(0, -1))
        ),
        0.98
      )
      .add_character(
        new CharacterMeta(
          bird_layout.fly,
          0,
          new Position(190, COLUMNS),
          FLOOR_VELOCITY.clone().add(new Velocity(0, -1))
        ),
        0.9
      ),
    500,
    50
  ),
];

// === INIT ===
function initialize() {
  current_theme = themes.colorful;
  cumulative_velocity = new Velocity(0, 0);
  game_over = false;
  game_score = 0;

  // reset any pending celebrates
  pendingCelebrate = false;
  if (celebrateFallbackTimer) {
    clearTimeout(celebrateFallbackTimer);
    celebrateFallbackTimer = null;
  }

  // ensure bg track is off at run start
  stopTrack();

  // Load saved high score as a number
  game_hi_score = Number(
    localStorage.getItem("project.github.chrome_dino.high_score") || 0
  );

  resizeCanvas();

  harmless_characters_pool = [];
  harmfull_characters_pool = [
    new Character(
      new CharacterMeta(
        dino_layout.run,
        4,
        DINO_FLOOR_INITIAL_POSITION.clone(),
        new Velocity(0, 0)
      )
    ),
  ];

  function handleStartOrJump() {
    if (game_over && Date.now() - game_over > 1000) {
      main();
      return;
    }
    if (dino_ready_to_jump) {
      dino_ready_to_jump = false;
      dino_current_trust = DINO_INITIAL_TRUST.clone();

      // start gameplay music on first actual jump
      startTrack();

      // play jump sfx
      playJump();
    }
  }

  // Remove legacy global handlers
  document.ontouchstart = null;
  document.body.onclick = null;

  // Canvas-only mouse/touch
  canvas.addEventListener("click", handleStartOrJump);
  canvas.addEventListener(
    "touchstart",
    (e) => {
      e.preventDefault(); // avoid double events / scrolling
      handleStartOrJump();
    },
    { passive: false }
  );

  // Space key
  document.body.onkeydown = (event) => {
    if (event.key === " " || event.keyCode === 32) {
      event.preventDefault(); // prevent page scroll
      handleStartOrJump();
    }
  };
}

// === RENDER HELPERS ===
function paint_layout(character_layout, character_position) {
  for (let j = 0; j < character_layout.length; j++) {
    for (let k = 0; k < character_layout[j].length; k++) {
      if (current_theme.layout[character_layout[j][k]]) {
        canvas_ctx.fillStyle = current_theme.layout[character_layout[j][k]];
        let x_pos = character_position[1] + k * CELL_SIZE;
        let y_pos = character_position[0] + j * CELL_SIZE;
        canvas_ctx.fillRect(x_pos, y_pos, CELL_SIZE, CELL_SIZE);
      }
    }
  }
}

// === GAME LOOP ===
function event_loop() {
  game_score_step += 0.15;

  if (game_score_step > 1) {
    game_score_step -= 1;
    game_score++;
  }

  if (game_score !== 0 && game_score % 300 === 0) {
    game_score++;
    if (current_theme.id == 1) {
      current_theme = themes.dark;
    } else {
      current_theme = themes.classic;
    }
  }

  canvas_ctx.clearRect(0, 0, canvas.width, canvas.height);
  canvas_ctx.fillStyle = current_theme.background;
  canvas_ctx.fillRect(0, 0, canvas.width, canvas.height);
  canvas_ctx.beginPath();

  // Road
  canvas_ctx.fillStyle = current_theme.road;
  canvas_ctx.fillRect(0, 232, canvas.width, CELL_SIZE * 0.2);

  // score card update
  canvas_ctx.font = "20px 'Press Start 2P'";
  canvas_ctx.fillStyle = current_theme.score_text;
  canvas_ctx.fillText(
    `H I     ${Math.floor(game_hi_score)
      .toString()
      .padStart(4, "0")
      .split("")
      .join(" ")}     ${game_score
      .toString()
      .padStart(4, "0")
      .split("")
      .join(" ")}`,
    canvas.width - 200,
    20
  );

  // first time screen
  if (is_first_time) {
    is_first_time = false;
    paint_layout(
      dino_layout.stand,
      harmfull_characters_pool[0].get_position().get()
    );
    game_over = Date.now();

    canvas_ctx.textBaseline = "middle";
    canvas_ctx.textAlign = "center";
    canvas_ctx.font = "25px 'Press Start 2P'";
    canvas_ctx.fillStyle = current_theme.info_text;
    canvas_ctx.fillText(
      "J U M P   T O   S T A R T",
      canvas.width / 2,
      canvas.height / 2 - 50
    );
    return;
  }

  // characters: generate new
  [
    [harmless_character_allocator, harmless_characters_pool],
    [harmfull_character_allocator, harmfull_characters_pool],
  ].forEach((character_allocator_details) => {
    for (let i = 0; i < character_allocator_details[0].length; i++) {
      const ALLOCATOR = character_allocator_details[0][i];
      ALLOCATOR.tick();
      const RANDOM_CHARACTER = ALLOCATOR.get_character();
      if (RANDOM_CHARACTER) {
        RANDOM_CHARACTER.get_velocity().add(cumulative_velocity);
        character_allocator_details[1].push(RANDOM_CHARACTER);
      }
    }
  });

  // increase velocity
  if (game_score % 100 == 0) {
    cumulative_velocity.add(step_velocity);
  }

  // draw characters
  [harmless_characters_pool, harmfull_characters_pool].forEach(
    (characters_pool, index) => {
      for (let i = characters_pool.length - 1; i >= 0; i--) {
        // Increase velocity on each cycle (except dino)
        if (!(index == 1 && i == 0) && game_score % 100 == 0) {
          characters_pool[i].get_velocity().add(step_velocity);
        }

        characters_pool[i].tick();
        let CHARACTER_LAYOUT = characters_pool[i].get_layout();

        // dino jump special-case
        if (!dino_ready_to_jump && index == 1 && i == 0) {
          CHARACTER_LAYOUT = dino_layout.stand;
        }

        const CHARACTER_POSITION = characters_pool[i].get_position().get();

        if (CHARACTER_POSITION[1] < -150) {
          characters_pool.splice(i, 1);
          continue;
        }

        paint_layout(CHARACTER_LAYOUT, CHARACTER_POSITION);
      }
    }
  );

  // collisions (harmful only)
  let dino_character = harmfull_characters_pool[0];
  let dino_current_position = dino_character.get_position();
  let dino_current_layout = dino_character.get_layout();
  for (let i = harmfull_characters_pool.length - 1; i > 0; i--) {
    const HARMFULL_CHARACTER_POSITION =
      harmfull_characters_pool[i].get_position();
    const HARMFULL_CHARACTER_LAYOUT = harmfull_characters_pool[i].get_layout();

    if (
      isCollided(
        dino_current_position.get()[0],
        dino_current_position.get()[1],
        dino_current_layout.length,
        dino_current_layout[0].length,
        HARMFULL_CHARACTER_POSITION.get()[0],
        HARMFULL_CHARACTER_POSITION.get()[1],
        HARMFULL_CHARACTER_LAYOUT.length,
        HARMFULL_CHARACTER_LAYOUT[0].length
      )
    ) {
      // GAME OVER UI
      canvas_ctx.textBaseline = "middle";
      canvas_ctx.textAlign = "center";
      canvas_ctx.font = "20px 'Press Start 2P'";
      canvas_ctx.fillStyle = current_theme.info_text;
      canvas_ctx.fillText(
        "G A M E  O V E R",
        canvas.width / 2,
        canvas.height / 2 - 50
      );

      paint_layout(
        retry_layout,
        new Position(
          canvas.height / 2 - retry_layout.length,
          canvas.width / 2 - retry_layout[0].length
        ).get()
      );
      paint_layout(
        dino_layout.dead,
        harmfull_characters_pool[0].get_position().get()
      );
      game_over = Date.now();

      // Stop background music now that run ended
      stopTrack();

      // === Celebrate only when beating saved high score ===
      const prevHi = Number(
        localStorage.getItem("project.github.chrome_dino.high_score") || 0
      );
      const isNewHi = game_score > prevHi;

      if (isNewHi) {
        // Persist new high score
        localStorage.setItem(
          "project.github.chrome_dino.high_score",
          String(game_score)
        );
        game_hi_score = game_score;

        // Badge
        canvas_ctx.textBaseline = "middle";
        canvas_ctx.textAlign = "center";
        canvas_ctx.font = "14px 'Press Start 2P'";
        canvas_ctx.fillStyle = "#22c55e";
        canvas_ctx.fillText(
          "NEW HIGH SCORE!",
          canvas.width / 2,
          canvas.height / 2 - 80
        );

        // Confetti celebration immediately
        celebrateCenter();

        // Defer celebrate SFX until after voice ends
        pendingCelebrate = true;

        // Fallback in case the audio module doesn't dispatch the event:
        // tweak this duration to roughly match your game-over + voice total.
        celebrateFallbackTimer = setTimeout(() => {
          if (pendingCelebrate) {
            try {
              playCelebrate();
            } catch {}
            pendingCelebrate = false;
            celebrateFallbackTimer = null;
          }
        }, 2500);
      }

      // Play game over SFX (your audio module should auto-play the voice afterwards)
      try {
        playGameOver();
      } catch {}

      return;
    }
  }

  // dino physics (jump/fall)
  dino_character.set_position(
    applyVelocityToPosition(dino_character.get_position(), dino_current_trust)
  );

  if (
    dino_character.get_position().get()[0] >
    DINO_FLOOR_INITIAL_POSITION.get()[0]
  ) {
    dino_character.set_position(DINO_FLOOR_INITIAL_POSITION.clone());
    dino_ready_to_jump = true;
  }

  dino_current_trust.sub(ENVIRONMENT_GRAVITY);

  requestAnimationFrame(event_loop);
}

// === BOOT ===
function main() {
  initialize();
  event_loop();
}

document.fonts.load('25px "Press Start 2P"').then(() => {
  main();
});

// === RESIZE ===
function resizeCanvas() {
  const parent = canvas.parentElement;
  canvas.width = parent.clientWidth; // full width of parent
  canvas.height = ROWS; // fixed height
  COLUMNS = canvas.width; // update game logic columns

  // Match FX overlay to game canvas
  fx.width = canvas.width;
  fx.height = canvas.height;
}

window.addEventListener("resize", resizeCanvas);

// === NFT → THEME ===
const traitToColor = {
  purple: "#a855f7",
  blue: "#3b82f6",
  green: "#22c55e",
  yellow: "#facc15",
  red: "#ef4444",
  black: "#111827",
  white: "#ffffff",
};

// Called by HTML button: <button onclick="useNFT()">Use my nft</button>
async function useNFT() {
  try {
    // Adjust path if needed based on your devServer config
    const response = await fetch("2.json");
    const metadata = await response.json();

    const bgAttr = metadata.attributes.find(
      (attr) => attr.trait_type === "background"
    );
    const clothingAttr = metadata.attributes.find(
      (attr) => attr.trait_type === "clothing"
    );

    const backgroundColor = traitToColor[bgAttr?.value] || "#ffffff";
    const clothingColor =
      traitToColor[clothingAttr?.value.split(" ")[0]] || "#535353";

    current_theme = {
      id: 99,
      background: backgroundColor,
      road: "#7c3aed",
      score_text: "#000000",
      info_text: "#000000",
      layout: [
        false, // 0 transparent
        clothingColor, // 1 Dino color
        "#333333", // 2 secondary
        "#ffffff", // 3 detail
        "#ff0000", // 4 accent
        false,
      ],
    };

    console.log("NFT theme applied:", current_theme);
  } catch (err) {
    console.error("Failed to load NFT:", err);
  }
}
window.useNFT = useNFT;

// ===== CONFETTI (FX overlay) =====
const CONFETTI_COLORS = [
  "#F59E0B",
  "#10B981",
  "#3B82F6",
  "#EC4899",
  "#F43F5E",
  "#A855F7",
  "#22C55E",
  "#EAB308",
];
let confetti = [];
let confettiAnimating = false;

function spawnConfettiBurst({
  x = canvas.width / 2,
  y = canvas.height / 2,
  count = 80,
  speed = 5,
  spread = Math.PI,
}) {
  for (let i = 0; i < count; i++) {
    const angle = (Math.random() - 0.5) * spread + -Math.PI / 2; // mostly upward
    const v = speed * (0.5 + Math.random());
    confetti.push({
      x,
      y,
      vx: Math.cos(angle) * v,
      vy: Math.sin(angle) * v,
      g: 0.18 + Math.random() * 0.1,
      size: 3 + Math.random() * 3,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.2,
      color:
        CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      life: 90 + Math.random() * 40, // frames
    });
  }
  if (!confettiAnimating) {
    confettiAnimating = true;
    requestAnimationFrame(confettiLoop);
  }
}

function confettiLoop() {
  fxCtx.clearRect(0, 0, fx.width, fx.height);

  for (let i = confetti.length - 1; i >= 0; i--) {
    const p = confetti[i];
    p.vy += p.g;
    p.x += p.vx;
    p.y += p.vy;
    p.rot += p.vr;
    p.life--;

    fxCtx.save();
    fxCtx.translate(p.x, p.y);
    fxCtx.rotate(p.rot);
    fxCtx.fillStyle = p.color;
    fxCtx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
    fxCtx.restore();

    if (p.life <= 0 || p.y > fx.height + 20) confetti.splice(i, 1);
  }

  if (confetti.length > 0) {
    requestAnimationFrame(confettiLoop);
  } else {
    confettiAnimating = false;
  }
}

function celebrateCenter() {
  spawnConfettiBurst({
    x: canvas.width / 2,
    y: canvas.height / 3,
    count: 120,
    speed: 6,
    spread: Math.PI * 1.5,
  });
}
