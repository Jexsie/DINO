# 🦖 Dino – A Blockchain-Powered Endless Runner

Dino is a retro-style endless runner game inspired by the Chrome offline dinosaur game – but with a twist: **your high scores earn NFTs on Hedera** 🎉.
[DEMO](https://dino.open-elements.cloud/)

Built for the **Hedera Africa Hackathon 2025**, Dino combines fun gameplay, blockchain tokenization, and NFT-based theming into one experience.

---

## ✨ Features

- 🎮 **Classic endless runner** gameplay (jump obstacles, survive as long as possible).
- 🪙 **Hedera NFT Rewards** – hit a new high score and automatically mint an NFT as proof of achievement.
- 🎨 **NFT-Themed Gameplay** – select NFT skins to customize the Dino environment (backgrounds, colors, effects).
- 📱 **Wallet Integration** – connect your Hedera wallet to store your NFT rewards.
- 🎉 **Celebrations** – confetti + modal popup when you achieve a new high score.
- 📊 **Leaderboard** – see top players and your rank.
- 🛒 **NFT Store Modal** – quick view of NFTs owned by the connected wallet.

---

## 🛠️ Tech Stack

- **Frontend:** Vanilla JS, Canvas API, TailwindCSS
- **Bundler:** Vite
- **Blockchain:** [Hedera Hashgraph](https://hedera.com) (HTS + Smart Contracts)
- **Wallet Integration:** `@hashgraph/hedera-wallet-connect`
- **Backend (optional):** Node.js + Express (for NFT minting via contract execution)
- **Hosting:** Coolify / Static deployment

---

## 📂 Project Structure

```
dino/
├── src/
│   ├── index.js           # Main game logic
│   ├── layouts.js         # Pixel art layouts (dino, cactus, bird, etc.)
│   ├── character.js       # Character + allocator system
│   ├── physics.js         # Collision detection + physics helpers
│   ├── audio.js           # Sound effects + music
│   ├── wallet.js          # Hedera wallet + NFT integration
│   ├── bootstrap.js       # Vite/Webpack bootstrap file
│   └── index.html         # Game UI
├── assets/                # Images, placeholder NFTs, etc.
├── dist/                  # Production build output
├── package.json
├── vite.config.js
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js 20+
- npm or yarn

### Installation

```bash
# Clone repo
git clone https://github.com/yourname/dino.git
cd dino

# Install dependencies
npm install

# Start dev server
npm run dev

Open http://localhost:8080 in your browser.

```
