import { getNftsForUser, normalizeIpfsUri } from "./wallet";
import { apiUrl } from "./constants";

let leaderboardBtn,
  leaderboardModal,
  leaderboardList,
  storeBtn,
  storeModal,
  storeList;

// Initialize modals when DOM is ready
function initModals() {
  leaderboardBtn = document.getElementById("leaderboardBtn");
  leaderboardModal = document.getElementById("leaderboardModal");
  leaderboardList = document.getElementById("leaderboardList");
  storeBtn = document.getElementById("storeBtn");
  storeModal = document.getElementById("storeModal");
  storeList = document.getElementById("storeList");

  console.log("Modal elements:", { storeBtn, storeModal, storeList });

  if (!storeBtn || !storeModal || !storeList) {
    console.error("Store modal elements not found");
    return false;
  }

  if (!leaderboardBtn || !leaderboardModal || !leaderboardList) {
    console.error("Leaderboard modal elements not found");
    return false;
  }

  storeBtn.replaceWith(storeBtn.cloneNode(true));
  leaderboardBtn.replaceWith(leaderboardBtn.cloneNode(true));

  storeBtn = document.getElementById("storeBtn");
  leaderboardBtn = document.getElementById("leaderboardBtn");

  storeBtn.addEventListener("click", handleStoreClick);
  leaderboardBtn.addEventListener("click", handleLeaderboardClick);

  console.log("Modal event listeners attached");
  return true;
}

// Separate handler functions
async function handleStoreClick(e) {
  console.log(
    "Store clicked - modal visible:",
    !storeModal.classList.contains("hidden")
  );
  e.preventDefault();
  e.stopPropagation();

  if (storeModal.classList.contains("hidden")) {
    console.log("Showing store modal");
    showModal(storeModal, storeList, "Loading NFTs...");

    try {
      const nfts = await getNftsForUser(window.currentWallet?.accountId);
      console.log("NFTs loaded:", nfts);
      populateList(storeList, nfts, createNftTemplate);
    } catch (err) {
      console.error("Error loading NFTs:", err);
      storeList.innerHTML = "<li>Error loading NFTs</li>";
    }
  } else {
    console.log("Hiding store modal");
    storeModal.classList.add("hidden");
  }
}

async function handleLeaderboardClick(e) {
  console.log(
    "Leaderboard clicked - modal visible:",
    !leaderboardModal.classList.contains("hidden")
  );
  e.preventDefault();
  e.stopPropagation();

  if (leaderboardModal.classList.contains("hidden")) {
    console.log("Showing leaderboard modal");
    showModal(leaderboardModal, leaderboardList, "Loading leaderboard...");

    const leaders = await loadLeaderboard();

    populateList(leaderboardList, leaders, createLeaderTemplate);
  } else {
    console.log("Hiding leaderboard modal");
    leaderboardModal.classList.add("hidden");
  }
}

// Utility functions
function showModal(modal, contentElement, loadingText = "Loading...") {
  closeAllModals();
  modal.classList.remove("hidden");
  contentElement.innerHTML = `<li>${loadingText}</li>`;
  console.log("Modal shown:", modal.id);
}

function populateList(listElement, items, itemTemplate) {
  if (!listElement) {
    console.error("List element not found");
    return;
  }

  listElement.innerHTML =
    items && items.length > 0
      ? items.map((item, index) => itemTemplate(item, index)).join("")
      : "<li>No items found</li>";
}

function closeAllModals() {
  if (storeModal) storeModal.classList.add("hidden");
  if (leaderboardModal) leaderboardModal.classList.add("hidden");
}

function createNftTemplate(nft) {
  return `
    <li class="flex items-center gap-2">
      <img src="${normalizeIpfsUri(nft?.image) || "/dino.png"}"
           alt="${nft?.name || "NFT"}"
           class="w-6 h-6 pixel-border object-cover" />
      <span>${nft?.name || "Unnamed NFT"}</span>
    </li>
  `;
}

function createLeaderTemplate(leader, idx) {
  return `
    <li class="flex justify-between">
      <span>${idx + 1}. ${leader.name}</span>
      <span>${leader.score}</span>
    </li>
  `;
}

async function loadLeaderboard() {
  try {
    const response = await fetch(apiUrl + "/leader");
    const leaders = await response.json();
    return leaders;
  } catch (error) {
    console.error("Failed to load leaderboard:", error);
    leaderboardList.innerHTML = "<li>Error loading leaderboard</li>";
  }
}

// Close modals when clicking outside
document.addEventListener("click", (e) => {
  if (
    storeModal &&
    !storeModal.classList.contains("hidden") &&
    !storeModal.contains(e.target) &&
    storeBtn &&
    !storeBtn.contains(e.target)
  ) {
    console.log("Closing store modal via outside click");
    storeModal.classList.add("hidden");
  }
  if (
    leaderboardModal &&
    !leaderboardModal.classList.contains("hidden") &&
    !leaderboardModal.contains(e.target) &&
    leaderboardBtn &&
    !leaderboardBtn.contains(e.target)
  ) {
    console.log("Closing leaderboard modal via outside click");
    leaderboardModal.classList.add("hidden");
  }
});

// Waiting for DOM to be ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    setTimeout(initModals, 100); // Small delay to ensure everything is ready
  });
} else {
  setTimeout(initModals, 100);
}

window.reinitModals = initModals;
