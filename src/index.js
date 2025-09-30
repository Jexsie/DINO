import "./modalEvents";
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
  playGameOver,
  playJump,
  startTrack,
  stopTrack,
} from "./audio";
import {
  initWallet,
  connectWallet,
  disconnectWallet,
  onWalletEvents,
  mintForHighScore,
  getNftsForUser,
  normalizeIpfsUri,
} from "./wallet";

// === CANVASES ===
const canvas = document.getElementById("board");
const canvas_ctx = canvas.getContext("2d");

// FX overlay (for confetti)
const fx = document.getElementById("fx");
const fxCtx = fx.getContext("2d");

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
let game_over = false; // always boolean
let game_over_at = null; // timestamp for when game ended
let animationFrameId = null;
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
  const saved = localStorage.getItem("dino_theme");
  if (saved) {
    try {
      current_theme = JSON.parse(saved);
    } catch {
      current_theme = themes.colorful;
    }
  } else {
    current_theme = themes.colorful;
  }
  cumulative_velocity = new Velocity(0, 0);
  game_over = false;
  game_over_at = null;
  game_score = 0;

  pendingCelebrate = false;
  if (celebrateFallbackTimer) {
    clearTimeout(celebrateFallbackTimer);
    celebrateFallbackTimer = null;
  }

  stopTrack();

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
    if (game_over && game_over_at && Date.now() - game_over_at > 1000) {
      main();
      startTrack();
      return;
    }

    if (is_first_time) {
      startTrack();
    }

    if (dino_ready_to_jump) {
      dino_ready_to_jump = false;
      dino_current_trust = DINO_INITIAL_TRUST.clone();
      playJump();
    }
  }

  document.ontouchstart = null;
  document.body.onclick = null;

  // // ✅ Make click/touch behave like space (jump/start)
  // canvas.addEventListener("click", (e) => {
  //   e.preventDefault();
  //   document.body.dispatchEvent(new KeyboardEvent("keydown", { key: " " }));
  // });

  // canvas.addEventListener(
  //   "touchstart",
  //   (e) => {
  //     e.preventDefault();
  //     document.body.dispatchEvent(new KeyboardEvent("keydown", { key: " " }));
  //   },
  //   { passive: false }
  // );

  // document.body.onkeydown = (event) => {
  //   if (event.key === " " || event.keyCode === 32) {
  //     event.preventDefault();
  //     handleStartOrJump();
  //   }
  // };

  function showWalletModal() {
    const walletModal = document.getElementById("walletModal");
    if (walletModal) walletModal.classList.remove("hidden");
  }

  document.getElementById("walletModalClose")?.addEventListener("click", () => {
    document.getElementById("walletModal").classList.add("hidden");
  });

  canvas.addEventListener(
    "touchstart",
    (e) => {
      e.preventDefault();
      if (!window.currentWallet?.accountId) {
        showWalletModal();
        return;
      }
      document.body.dispatchEvent(new KeyboardEvent("keydown", { key: " " }));
    },
    { passive: false }
  );

  document.body.onkeydown = (event) => {
    if (event.key === " " || event.keyCode === 32) {
      event.preventDefault();
      if (!window.currentWallet?.accountId) {
        showWalletModal();
        return;
      }
      handleStartOrJump();
    }
  };
}

// === RENDER HELPERS ===
function paint_layout(character_layout, character_position) {
  for (let j = 0; j < character_layout.length; j++) {
    for (let k = 0; k < character_layout[j].length; k++) {
      // Look up the color from the theme palette
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
async function event_loop() {
  if (game_over) return;

  game_score_step += 0.15;
  if (game_score_step > 1) {
    game_score_step -= 1;
    game_score++;
  }

  canvas_ctx.clearRect(0, 0, canvas.width, canvas.height);
  canvas_ctx.fillStyle = current_theme.background;
  canvas_ctx.fillRect(0, 0, canvas.width, canvas.height);
  canvas_ctx.beginPath();

  // Road
  canvas_ctx.fillStyle = current_theme.road;
  canvas_ctx.fillRect(0, 232, canvas.width, CELL_SIZE * 0.2);

  // score card
  const scoreText = `H I     ${Math.floor(game_hi_score)
    .toString()
    .padStart(4, "0")
    .split("")
    .join(" ")}     ${game_score
    .toString()
    .padStart(4, "0")
    .split("")
    .join(" ")}`;

  canvas_ctx.font = "20px 'Press Start 2P'";
  canvas_ctx.fillStyle = current_theme.score_text;
  const textWidth = canvas_ctx.measureText(scoreText).width;
  canvas_ctx.fillText(scoreText, canvas.width - textWidth - 20, 30);

  // first time screen
  if (is_first_time) {
    is_first_time = false;
    paint_layout(
      dino_layout.stand,
      harmfull_characters_pool[0].get_position().get()
    );
    game_over = true;
    game_over_at = Date.now();

    canvas_ctx.textBaseline = "middle";
    canvas_ctx.textAlign = "center";
    canvas_ctx.font = "15px 'Press Start 2P'";
    canvas_ctx.fillStyle = current_theme.info_text;
    canvas_ctx.fillText(
      "PRESS SPACE TO START AND JUMP",
      canvas.width / 2,
      canvas.height / 2 - 50
    );
    return;
  }

  // characters
  [
    [harmless_character_allocator, harmless_characters_pool],
    [harmfull_character_allocator, harmfull_characters_pool],
  ].forEach(([allocators, pool]) => {
    for (let i = 0; i < allocators.length; i++) {
      const ALLOCATOR = allocators[i];
      ALLOCATOR.tick();
      const RANDOM_CHARACTER = ALLOCATOR.get_character();
      if (RANDOM_CHARACTER) {
        RANDOM_CHARACTER.get_velocity().add(cumulative_velocity);
        pool.push(RANDOM_CHARACTER);
      }
    }
  });

  if (game_score % 100 == 0) {
    cumulative_velocity.add(step_velocity);
  }

  [harmless_characters_pool, harmfull_characters_pool].forEach(
    (pool, index) => {
      for (let i = pool.length - 1; i >= 0; i--) {
        if (!(index == 1 && i == 0) && game_score % 100 == 0) {
          pool[i].get_velocity().add(step_velocity);
        }
        pool[i].tick();
        let layout = pool[i].get_layout();
        if (!dino_ready_to_jump && index == 1 && i == 0) {
          layout = dino_layout.stand;
        }
        const pos = pool[i].get_position().get();
        if (pos[1] < -150) {
          pool.splice(i, 1);
          continue;
        }
        paint_layout(layout, pos);
      }
    }
  );

  // collisions
  let dino_character = harmfull_characters_pool[0];
  let dino_current_position = dino_character.get_position();
  let dino_current_layout = dino_character.get_layout();
  for (let i = harmfull_characters_pool.length - 1; i > 0; i--) {
    const otherPos = harmfull_characters_pool[i].get_position();
    const otherLayout = harmfull_characters_pool[i].get_layout();

    if (
      isCollided(
        dino_current_position.get()[0],
        dino_current_position.get()[1],
        dino_current_layout.length,
        dino_current_layout[0].length,
        otherPos.get()[0],
        otherPos.get()[1],
        otherLayout.length,
        otherLayout[0].length
      )
    ) {
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

      game_over = true;
      game_over_at = Date.now();

      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }

      stopTrack();

      const prevHi = Number(
        localStorage.getItem("project.github.chrome_dino.high_score") || 0
      );
      const isNewHi = game_score > prevHi;

      if (isNewHi) {
        localStorage.setItem(
          "project.github.chrome_dino.high_score",
          String(game_score)
        );
        const modal = document.getElementById("highScoreModal");
        if (modal) {
          modal.classList.remove("hidden");
          const closeModalButton = document.getElementById(
            "closeHighScoreModal"
          );

          // Resize modal canvas
          const modalFx = document.getElementById("modalFx");
          if (modalFx) {
            modalFx.width = modal.offsetWidth;
            modalFx.height = modal.offsetHeight;
            modalConfettiBurst({}); // 🎉 trigger confetti
          }

          closeModalButton.onclick = () => {
            modal.classList.add("hidden");
          };
        }

        canvas_ctx.textBaseline = "middle";
        canvas_ctx.textAlign = "center";
        canvas_ctx.font = "14px 'Press Start 2P'";
        canvas_ctx.fillStyle = "#22c55e";
        canvas_ctx.fillText(
          "NEW HIGH SCORE!",
          canvas.width / 2,
          canvas.height / 2 - 80
        );

        celebrateCenter();
        pendingCelebrate = true;
        celebrateFallbackTimer = setTimeout(() => {
          if (pendingCelebrate) {
            try {
              playCelebrate();
            } catch {}
            pendingCelebrate = false;
            celebrateFallbackTimer = null;
          }
        }, 2500);

        mintForHighScore(game_hi_score)
          .then(() => console.log("NFT minted successfully!"))
          .catch(console.error);
      }

      try {
        playGameOver();
      } catch {}
      return;
    }
  }

  // dino physics
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

  // animationFrameId = requestAnimationFrame(event_loop);

  if (!game_over) {
    animationFrameId = requestAnimationFrame(event_loop);
  }
}

const modalFx = document.getElementById("modalFx");
const modalFxCtx = modalFx ? modalFx.getContext("2d") : null;

function modalConfettiBurst({
  x = modalFx.width / 2,
  y = modalFx.height / 2,
  count = 80,
  speed = 5,
  spread = Math.PI,
}) {
  if (!modalFxCtx) return;
  let particles = [];
  for (let i = 0; i < count; i++) {
    const angle = (Math.random() - 0.5) * spread + -Math.PI / 2;
    const v = speed * (0.5 + Math.random());
    particles.push({
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
      life: 90 + Math.random() * 40,
    });
  }

  function loop() {
    modalFxCtx.clearRect(0, 0, modalFx.width, modalFx.height);
    particles.forEach((p, i) => {
      p.vy += p.g;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      p.life--;

      modalFxCtx.save();
      modalFxCtx.translate(p.x, p.y);
      modalFxCtx.rotate(p.rot);
      modalFxCtx.fillStyle = p.color;
      modalFxCtx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      modalFxCtx.restore();
    });
    particles = particles.filter(
      (p) => p.life > 0 && p.y < modalFx.height + 20
    );
    if (particles.length > 0) requestAnimationFrame(loop);
  }

  loop();
}

// === BOOT ===
function main() {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  game_over = false;
  game_over_at = null;
  pendingCelebrate = false;
  if (celebrateFallbackTimer) {
    clearTimeout(celebrateFallbackTimer);
    celebrateFallbackTimer = null;
  }

  initialize();
  event_loop();
}

document.fonts.load('25px "Press Start 2P"').then(() => {
  main();
});

// === RESIZE ===
function resizeCanvas() {
  const parent = canvas.parentElement;
  canvas.width = parent.clientWidth;
  canvas.height = ROWS;
  COLUMNS = canvas.width;

  fx.width = canvas.width;
  fx.height = canvas.height;

  repaintOnce();
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

async function useNFT() {
  try {
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
      layout: [false, clothingColor, "#333333", "#ffffff", "#ff0000", false],
    };

    console.log("NFT theme applied:", current_theme);
    localStorage.setItem("dino_theme", JSON.stringify(current_theme));
    repaintOnce();
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
    const angle = (Math.random() - 0.5) * spread + -Math.PI / 2;
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
      life: 90 + Math.random() * 40,
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

// Footer UI sync
function updateWalletUI(accountId) {
  const wrap = document.getElementById("walletStatus");
  const idSpan = document.getElementById("walletId");
  const connectBtn = document.getElementById("connectWalletBtn");

  if (!wrap || !idSpan) return;

  if (accountId) {
    wrap.classList.remove("hidden");
    window.currentWallet = { accountId };
    idSpan.textContent = accountId;
    if (connectBtn) connectBtn.classList.add("hidden");
  } else {
    wrap.classList.add("hidden");
    idSpan.textContent = "";
    if (connectBtn) connectBtn.classList.remove("hidden");
  }
}

(async function initUI() {
  console.log("initUI running…");

  const existing = await initWallet();
  updateWalletUI(existing);

  onWalletEvents({ onChange: updateWalletUI });

  const connectBtn = document.getElementById("connectWalletBtn");
  if (connectBtn) {
    connectBtn.addEventListener("click", async () => {
      const acct = await connectWallet();
      updateWalletUI(acct);
    });
  }

  if (existing) {
    await populateThemeSlots();
  }

  const disBtn = document.getElementById("walletDisconnect");
  if (disBtn) {
    disBtn.addEventListener("click", async () => {
      await disconnectWallet();
      updateWalletUI(null);
    });
  }

  if (window.reinitModals) {
    setTimeout(() => {
      console.log("Re-initializing modals after wallet setup");
      window.reinitModals();
    }, 500);
  }
})();

function repaintOnce() {
  if (!canvas || !canvas_ctx || !current_theme) return;

  canvas_ctx.clearRect(0, 0, canvas.width, canvas.height);
  canvas_ctx.fillStyle = current_theme.background;
  canvas_ctx.fillRect(0, 0, canvas.width, canvas.height);

  canvas_ctx.fillStyle = current_theme.road;
  canvas_ctx.fillRect(0, 232, canvas.width, CELL_SIZE * 0.2);

  const scoreText = `H I     ${Math.floor(game_hi_score)
    .toString()
    .padStart(4, "0")
    .split("")
    .join(" ")}     ${game_score
    .toString()
    .padStart(4, "0")
    .split("")
    .join(" ")}`;
  canvas_ctx.font = "20px 'Press Start 2P'";
  canvas_ctx.fillStyle = current_theme.score_text;
  const textWidth = canvas_ctx.measureText(scoreText).width;
  canvas_ctx.fillText(scoreText, canvas.width - textWidth - 20, 30);

  [harmless_characters_pool, harmfull_characters_pool].forEach(
    (pool, index) => {
      if (!pool) return;
      for (let i = 0; i < pool.length; i++) {
        let layout = pool[i].get_layout();
        if (!dino_ready_to_jump && index === 1 && i === 0) {
          layout = dino_layout.stand;
        }
        const pos = pool[i].get_position().get();
        paint_layout(layout, pos);
      }
    }
  );

  if (is_first_time) {
    if (harmfull_characters_pool?.[0]) {
      paint_layout(
        dino_layout.stand,
        harmfull_characters_pool[0].get_position().get()
      );
    }
    canvas_ctx.textBaseline = "middle";
    canvas_ctx.textAlign = "center";
    canvas_ctx.font = "15px 'Press Start 2P'";
    canvas_ctx.fillStyle = current_theme.info_text;
    canvas_ctx.fillText(
      "PRESS SPACE TO START AND JUMP",
      canvas.width / 2,
      canvas.height / 2 - 50
    );
    return;
  }

  if (game_over) {
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
    if (harmfull_characters_pool?.[0]) {
      paint_layout(
        dino_layout.dead,
        harmfull_characters_pool[0].get_position().get()
      );
    }
  }
}

function applyNFTTheme(metadata) {
  const bgAttr = metadata.attributes.find((a) => a.trait_type === "background");
  const clothingAttr = metadata.attributes.find(
    (a) => a.trait_type === "clothing"
  );

  const backgroundColor = traitToColor[bgAttr?.value] || "#ffffff";
  const clothingColor =
    traitToColor[clothingAttr?.value?.split(" ")[0]] || "#535353";

  current_theme = {
    id: Date.now(),
    background: backgroundColor,
    road: "#7c3aed",
    score_text: "#000000",
    info_text: "#000000",
    layout: [false, clothingColor, "#333333", "#ffffff", "#ff0000", false],
  };

  console.log("NFT theme applied:", current_theme);
  localStorage.setItem("dino_theme", JSON.stringify(current_theme));
  repaintOnce();
}

async function populateThemeSlots() {
  try {
    const nfts = await getNftsForUser(window.currentWallet.accountId);

    const slots = document.querySelectorAll(".theme-slot");

    slots.forEach((slot, index) => {
      const nft = nfts[index];
      const img = slot.querySelector("img");
      const label = slot.querySelector("p");

      if (nft) {
        img.src = normalizeIpfsUri(nft.image) || "/dino.png";
        img.alt = nft.name || "NFT";
        label.textContent = nft.name || "Unnamed NFT";

        slot.dataset.metadata = JSON.stringify(nft);
        slot.onclick = () => applyNFTTheme(nft);
      } else {
        img.src = "/dino.png";
        img.alt = "Empty Slot";
        slot.onclick = null;
      }
    });
  } catch (err) {
    console.error("Failed to populate theme slots:", err);
  }
}
