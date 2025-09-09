// === AUDIO ===
// Put these files where your server can serve them. If you're serving /assets as the static root,
// use "jump.mp3" directly; otherwise "assets/jump.mp3" etc.
const sJump = new Audio("jump.wav");
const sGameOver = new Audio("game-over.wav");
const sGameOverVoice = new Audio("game-over-voice.mp3");
const sCelebrate = new Audio("celebrate.mp3");
const sTrack = new Audio("background.mp3"); // background music
sTrack.loop = true;

// preload + comfy volume
[sJump, sGameOver, sGameOverVoice, sCelebrate, sTrack].forEach((a) => {
  a.preload = "auto";
  a.volume = 0.3;
});

sTrack.volume = 0.2;

// when gameover ends, play the voice
sGameOver.addEventListener("ended", () => {
  try {
    sGameOverVoice.currentTime = 0;
    sGameOverVoice.play();
  } catch (e) {}
});

// helpers
let trackPlaying = false;
function startTrack() {
  if (!trackPlaying) {
    trackPlaying = true;
    try {
      sTrack.currentTime = 0;
      sTrack.play();
    } catch (e) {}
  }
}
function stopTrack() {
  if (trackPlaying) {
    trackPlaying = false;
    sTrack.pause();
    sTrack.currentTime = 0;
  }
}
function playJump() {
  try {
    sJump.currentTime = 0;
    sJump.play();
  } catch (e) {}
}
function playGameOver() {
  try {
    sGameOver.currentTime = 0;
    sGameOver.play();
  } catch (e) {}
}
function playCelebrate() {
  try {
    sCelebrate.currentTime = 0;
    sCelebrate.play();
  } catch (e) {}
}

export { playCelebrate, playGameOver, playJump, startTrack, stopTrack };
