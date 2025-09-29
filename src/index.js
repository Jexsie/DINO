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
const fx = document.getElementById("fx");
const fxCtx = fx.getContext("2d");

// === CONSTANTS ===
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
const DINO_FLOOR_INITIAL_POSITION = new Position(200, 20);

// =================================================================
// === GAME STATE MACHINE
// =================================================================
const GAME_STATES = {
  READY: "ready",
  RUNNING: "running",
  OVER: "over",
};
let gameState = GAME_STATES.READY;
let lastGameOverAt = 0; // cooldown marker

// === GAME VARIABLES ===
let dino_current_trust = new Velocity(0, 0);
let dino_ready_to_jump = true;
let animationFrameId = null;
let game_score = 0;
let game_score_step = 0;
let game_hi_score = 0;
let step_velocity = new Velocity(0, -0.1);
let cumulative_velocity = new Velocity(0, 0);
let current_theme = themes.colorful;

let harmless_characters_pool = [];
let harmfull_characters_pool = [];

let pendingCelebrate = false;
let celebrateFallbackTimer = null;

// === CELEBRATE LISTENER ===
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

// === GAME LIFECYCLE ===
function initializeNewGame() {
  cumulative_velocity = new Velocity(0, 0);
  game_score = 0;
  game_score_step = 0;
  dino_current_trust = new Velocity(0, 0);
  dino_ready_to_jump = true;

  // reset pools 🔑
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

  pendingCelebrate = false;
  if (celebrateFallbackTimer) {
    clearTimeout(celebrateFallbackTimer);
    celebrateFallbackTimer = null;
  }
}

function setup() {
  const saved = localStorage.getItem("dino_theme");
  try {
    current_theme = saved ? JSON.parse(saved) : themes.colorful;
  } catch {
    current_theme = themes.colorful;
  }

  game_hi_score = Number(
    localStorage.getItem("project.github.chrome_dino.high_score") || 0
  );

  canvas.addEventListener("click", handleInput);
  canvas.addEventListener(
    "touchstart",
    (e) => {
      e.preventDefault();
      handleInput();
    },
    { passive: false }
  );
  document.body.addEventListener("keydown", (event) => {
    if (event.key === " " || event.keyCode === 32) {
      event.preventDefault();
      handleInput();
    }
  });

  window.addEventListener("resize", resizeCanvas);
  resizeCanvas();
}

function handleInput() {
  switch (gameState) {
    case GAME_STATES.READY:
    case GAME_STATES.OVER:
      if (Date.now() - lastGameOverAt > 1000) {
        // 🔑 restart cooldown
        gameState = GAME_STATES.RUNNING;
        initializeNewGame();
        startTrack();
      }
      break;
    case GAME_STATES.RUNNING:
      if (dino_ready_to_jump) {
        dino_ready_to_jump = false;
        dino_current_trust = DINO_INITIAL_TRUST.clone();
        playJump();
      }
      break;
  }
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

function drawScore() {
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
}

// === GAME LOOP ===
function event_loop() {
  canvas_ctx.clearRect(0, 0, canvas.width, canvas.height);
  canvas_ctx.fillStyle = current_theme.background;
  canvas_ctx.fillRect(0, 0, canvas.width, canvas.height);
  canvas_ctx.beginPath();
  canvas_ctx.fillStyle = current_theme.road;
  canvas_ctx.fillRect(0, 232, canvas.width, CELL_SIZE * 0.2);

  switch (gameState) {
    case GAME_STATES.READY:
      drawScore();
      paint_layout(dino_layout.stand, DINO_FLOOR_INITIAL_POSITION.get());
      canvas_ctx.textBaseline = "middle";
      canvas_ctx.textAlign = "center";
      canvas_ctx.font = "25px 'Press Start 2P'";
      canvas_ctx.fillStyle = current_theme.info_text;
      canvas_ctx.fillText(
        "J U M P   T O   S T A R T",
        canvas.width / 2,
        canvas.height / 2 - 50
      );
      break;

    case GAME_STATES.RUNNING:
      updateGameLogic();
      break;

    case GAME_STATES.OVER:
      drawGameOverScreen();
      break;
  }

  animationFrameId = requestAnimationFrame(event_loop);
}

function updateGameLogic() {
  if (gameState !== GAME_STATES.RUNNING) return; // 🔑

  // increment score
  game_score_step += 0.15;
  if (game_score_step > 1) {
    game_score_step -= 1;
    game_score++;
  }

  if (game_score > 0 && game_score % 100 == 0) {
    cumulative_velocity.add(step_velocity);
  }

  [
    [harmless_character_allocator, harmless_characters_pool],
    [harmfull_character_allocator, harmfull_characters_pool],
  ].forEach(([allocators, pool]) => {
    allocators.forEach((allocator) => {
      allocator.tick();
      const newChar = allocator.get_character();
      if (newChar) {
        newChar.get_velocity().add(cumulative_velocity);
        pool.push(newChar);
      }
    });
  });

  [harmless_characters_pool, harmfull_characters_pool].forEach(
    (pool, poolIndex) => {
      for (let i = pool.length - 1; i >= 0; i--) {
        if (
          !(poolIndex === 1 && i === 0) &&
          game_score > 0 &&
          game_score % 100 == 0
        ) {
          pool[i].get_velocity().add(step_velocity);
        }
        pool[i].tick();
        if (pool[i].get_position().get()[1] < -150) {
          pool.splice(i, 1);
          continue;
        }
        let layout = pool[i].get_layout();
        if (poolIndex === 1 && i === 0 && !dino_ready_to_jump) {
          layout = dino_layout.stand;
        }
        paint_layout(layout, pool[i].get_position().get());
      }
    }
  );

  const dino = harmfull_characters_pool[0];
  dino.set_position(
    applyVelocityToPosition(dino.get_position(), dino_current_trust)
  );
  if (dino.get_position().get()[0] > DINO_FLOOR_INITIAL_POSITION.get()[0]) {
    dino.set_position(DINO_FLOOR_INITIAL_POSITION.clone());
    dino_ready_to_jump = true;
  }
  dino_current_trust.sub(ENVIRONMENT_GRAVITY);

  const dino_pos = dino.get_position();
  const dino_layout_val = dino.get_layout();
  let has_collided = false;
  for (let i = harmfull_characters_pool.length - 1; i > 0; i--) {
    const obstacle = harmfull_characters_pool[i];
    if (
      isCollided(
        dino_pos.get()[0],
        dino_pos.get()[1],
        dino_layout_val.length,
        dino_layout_val[0].length,
        obstacle.get_position().get()[0],
        obstacle.get_position().get()[1],
        obstacle.get_layout().length,
        obstacle.get_layout()[0].length
      )
    ) {
      has_collided = true;
      break;
    }
  }

  if (has_collided) {
    gameState = GAME_STATES.OVER;
    lastGameOverAt = Date.now(); // 🔑 cooldown marker
    stopTrack();
    playGameOver();

    if (game_score > game_hi_score) {
      game_hi_score = game_score;
      localStorage.setItem(
        "project.github.chrome_dino.high_score",
        String(game_hi_score)
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

      mintForHighScore()
        .then(() => console.log("NFT minted successfully!"))
        .catch(console.error);
    }
  }
  drawScore();
}

function drawGameOverScreen() {
  drawScore();
  harmfull_characters_pool[0].set_position(DINO_FLOOR_INITIAL_POSITION.clone());
  paint_layout(
    dino_layout.dead,
    harmfull_characters_pool[0].get_position().get()
  );
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
}

// === BOOT ===
function main() {
  if (animationFrameId) cancelAnimationFrame(animationFrameId);
  setup();
  event_loop();
}

document.fonts.load('25px "Press Start 2P"').then(main);

// === RESIZE ===
function resizeCanvas() {
  const parent = canvas.parentElement;
  canvas.width = parent.clientWidth;
  canvas.height = ROWS;
  COLUMNS = canvas.width;
  fx.width = canvas.width;
  fx.height = canvas.height;
}

// === THEME + NFT ===
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
  } catch (err) {
    console.error("Failed to load NFT:", err);
  }
}
window.useNFT = useNFT;

// === CONFETTI ===
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

// === WALLET UI ===
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
})();

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
