import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, onSnapshot, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getDatabase, ref, onValue, push, set, child } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

/*

Contains all local state simulation systems, countdown algorithms, canvas-free interactive hover-mapping, administrative simulations, 
and directly orchestrates the dynamic connection to Firebase services over standard Web CDN ES Modules.

*/
// --- MOCK / OFFLINE ARCHITECTURE SYSTEM ---
let currentEra = "classic_1999"; 
let isFirebaseLive = false;
let db = null; // Firestore
let rtdb = null; // Realtime DB
let auth = null; // Firebase Auth
let rawMockData = null; // Memory fallback

// --- CACHE & DOM REFERENCES ---
const eraClassicBtn = document.getElementById("era-classic-btn");
const eraDreamBtn = document.getElementById("era-dream-btn");
const gameSelect = document.getElementById("game-select");
const knicksRosterDiv = document.getElementById("knicks-roster");
const spursRosterDiv = document.getElementById("spurs-roster");
const statsBarsDiv = document.getElementById("stats-bars");
const chatMessagesDiv = document.getElementById("chat-messages");
const chatForm = document.getElementById("chat-form");
const chatInput = document.getElementById("chat-input");
const chatUsername = document.getElementById("chat-username");
const tickerFeedDiv = document.getElementById("ticker-feed");
const connectionBadge = document.getElementById("connection-badge");
const connectionStatusText = document.getElementById("connection-status-text");
const countdownEl = document.getElementById("countdown");

const settingsModal = document.getElementById("settings-modal");
const openSettingsBtn = document.getElementById("open-settings-btn");
const closeSettingsBtn = document.getElementById("close-settings-btn");
const firebaseToggle = document.getElementById("firebase-toggle");
const firebaseConfigWrapper = document.getElementById("firebase-config-wrapper");
const firebaseConfigInput = document.getElementById("firebase-config-input");
const saveConfigBtn = document.getElementById("save-config-btn");

const customEventInput = document.getElementById("custom-event-input");
const broadcastEventBtn = document.getElementById("broadcast-event-btn");
const playerBuffSelect = document.getElementById("player-buff-select");
const buffStatBtn = document.getElementById("buff-stat-btn");

// Tooltip Dom
const tooltip = document.getElementById("hover-tooltip");
const tooltipName = document.getElementById("tooltip-name");
const tooltipMeta = document.getElementById("tooltip-meta");
const tooltipNumber = document.getElementById("tooltip-number");
const tooltipFG = document.getElementById("tooltip-fg");
const tooltipFGBar = document.getElementById("tooltip-fg-bar");
const tooltip3P = document.getElementById("tooltip-3p");
const tooltip3PBar = document.getElementById("tooltip-3p-bar");
const tooltipBio = document.getElementById("tooltip-bio");

// --- INITIALIZE BOOTSTRAP ---
document.addEventListener("DOMContentLoaded", async () => {
  await loadDataset();
  loadSavedFirebaseConfig();
  setupEventListeners();
  startCountdownTimer();
  startMockGameTicker();
  renderApp();
});

// --- LOAD STATIC LOCAL DATASET ---
async function loadDataset() {
  try {
    const res = await fetch("seed-data.json");
    rawMockData = await res.json();
  } catch (err) {
    showToast("Error loading seed-data.json locally. See console.", "error");
    console.error("Local data seed failure:", err);
  }
}

// --- RENDERING ROUTINES ---
function renderApp() {
  if (!rawMockData) return;
  const activeEraData = rawMockData.eras[currentEra];
  
  // Render Hero Headers
  document.getElementById("knicks-subtitle").textContent = activeEraData.knicks.subtitle;
  document.getElementById("spurs-subtitle").textContent = activeEraData.spurs.subtitle;
  document.getElementById("series-score").textContent = activeEraData.seriesScore;
  document.getElementById("venue-text").textContent = activeEraData.venue;

  // Series Status Flag Styling
  const flag = document.getElementById("series-status-badge");
  flag.textContent = activeEraData.seriesStatus;

  // Render Game Dropdown Selection
  const savedVal = gameSelect.value;
  gameSelect.innerHTML = "";
  activeEraData.games.forEach(g => {
    const opt = document.createElement("option");
    opt.value = g.id;
    opt.textContent = g.name;
    gameSelect.appendChild(opt);
  });
  if (savedVal && activeEraData.games.find(g => g.id === savedVal)) {
    gameSelect.value = savedVal;
  } else {
    gameSelect.value = activeEraData.games[0].id;
  }

  // Render Team Matrix Progress Stats Bars
  renderStatsComparison();

  // Render Rosters
  renderRoster("knicks", knicksRosterDiv, activeEraData.knicks.roster);
  renderRoster("spurs", spursRosterDiv, activeEraData.spurs.roster);

  // Populates Admin Mod options
  populateBuffDropdown(activeEraData.knicks.roster, activeEraData.spurs.roster);
}

// Roster Mapping with hover listeners
function renderRoster(teamName, targetDiv, roster) {
  targetDiv.innerHTML = "";
  roster.forEach(player => {
    const card = document.createElement("div");
    card.className = "flex justify-between items-center bg-slate-950/75 border border-slate-800/80 hover:border-slate-700/80 px-4 py-3 rounded-xl cursor-pointer hover:bg-slate-900 transition-all shadow-sm";
    
    // Left: Name & Position
    const info = document.createElement("div");
    info.innerHTML = `
      <h4 class="text-xs font-bold text-slate-100 uppercase">${player.name}</h4>
      <p class="text-[10px] text-slate-500 font-bold uppercase tracking-wider">${player.position} • ${player.college}</p>
    `;
    
    // Right: Principal Stat Highlight (PPG)
    const stat = document.createElement("div");
    stat.className = "text-right";
    stat.innerHTML = `
      <span class="text-xs font-black ${teamName === 'knicks' ? 'text-knicks-orange' : 'text-slate-300'} font-oswald text-sm">${player.stats.ppg} PPG</span>
      <p class="text-[9px] text-slate-500 font-semibold tracking-wider uppercase">${player.stats.rpg} REB / ${player.stats.apg} AST</p>
    `;

    card.appendChild(info);
    card.appendChild(stat);

    // Mouse hover listeners coordinate the tooltip fly-away
    card.addEventListener("mouseenter", (e) => showTooltip(player, e));
    card.addEventListener("mousemove", (e) => updateTooltipPosition(e));
    card.addEventListener("mouseleave", () => hideTooltip());

    targetDiv.appendChild(card);
  });
}

// Hover Tooltip coordinates
function showTooltip(player, event) {
  tooltipName.textContent = player.name;
  tooltipMeta.textContent = `${player.position}  |  Ht: ${player.height}  |  ${player.college}`;
  tooltipNumber.textContent = `#${player.jersey}`;
  
  // Custom Color Styling based on team
  if (currentEra === "classic_1999" && ["Tim Duncan", "David Robinson", "Avery Johnson", "Sean Elliott", "Mario Elie"].includes(player.name) ||
      currentEra === "dream_2026" && ["Victor Wembanyama", "Devin Vassell", "Jeremy Sochan", "Stephon Castle", "Tre Jones"].includes(player.name)) {
    tooltipNumber.className = "text-lg font-black font-oswald text-slate-300";
    tooltipFGBar.className = "h-full bg-slate-400 rounded-full transition-all duration-300";
  } else {
    tooltipNumber.className = "text-lg font-black font-oswald text-knicks-orange";
    tooltipFGBar.className = "h-full bg-knicks-orange rounded-full transition-all duration-300";
  }

  tooltipFG.textContent = player.stats.fgPct;
  tooltipFGBar.style.width = player.stats.fgPct;
  tooltip3P.textContent = player.stats.threePct;
  tooltip3PBar.style.width = player.stats.threePct;
  tooltipBio.textContent = player.bio;

  tooltip.style.opacity = "1";
  tooltip.style.transform = "scale(1)";
  updateTooltipPosition(event);
}

function updateTooltipPosition(e) {
  const hoverMargin = 15;
  let left = e.clientX + hoverMargin;
  let top = e.clientY + hoverMargin;

  // Make sure tooltips don't clip bounds
  if (left + tooltip.offsetWidth > window.innerWidth) {
    left = e.clientX - tooltip.offsetWidth - hoverMargin;
  }
  if (top + tooltip.offsetHeight > window.innerHeight) {
    top = window.innerHeight - tooltip.offsetHeight - hoverMargin;
  }

  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
}

function hideTooltip() {
  tooltip.style.opacity = "0";
  tooltip.style.transform = "scale(0.95)";
}

// Stats comparisons logic
function renderStatsComparison() {
  if (!rawMockData) return;
  const activeEraData = rawMockData.eras[currentEra];
  const selectedGameId = gameSelect.value;
  const gameDetails = activeEraData.games.find(g => g.id === selectedGameId) || activeEraData.games[0];

  statsBarsDiv.innerHTML = "";

  const metrics = [
    { label: "Points", key: "pts", max: 130 },
    { label: "Field Goal %", key: "fgPct", max: 100 },
    { label: "Rebounds", key: "reb", max: 65 },
    { label: "Assists", key: "ast", max: 35 },
    { label: "Blocks", key: "blk", max: 15 }
  ];

  metrics.forEach(m => {
    let knicksVal = gameDetails.teamComparison.knicks[m.key];
    let spursVal = gameDetails.teamComparison.spurs[m.key];

    // Raw numbers formatted for progress parsing
    let knicksPct = (parseFloat(knicksVal) / m.max) * 100;
    let spursPct = (parseFloat(spursVal) / m.max) * 100;

    const row = document.createElement("div");
    row.className = "space-y-1.5";
    row.innerHTML = `
      <div class="flex justify-between items-center text-xs font-bold tracking-wide">
        <span class="text-knicks-orange">${knicksVal}</span>
        <span class="text-slate-400 uppercase text-[10px] tracking-widest">${m.label}</span>
        <span class="text-slate-300">${spursVal}</span>
      </div>
      <div class="flex h-3 rounded-full bg-slate-950 overflow-hidden relative">
        <!-- Center marker -->
        <div class="absolute left-1/2 top-0 bottom-0 w-[1px] bg-slate-800 z-10"></div>
        <!-- Knicks side (left-facing progress bar) -->
        <div class="w-1/2 flex justify-end bg-slate-950">
          <div class="bg-gradient-to-l from-knicks-orange to-knicks-blue h-full rounded-l-full transition-all duration-500" style="width: ${knicksPct}%"></div>
        </div>
        <!-- Spurs side (right-facing progress bar) -->
        <div class="w-1/2 bg-slate-950">
          <div class="bg-gradient-to-r from-slate-400 to-slate-100 h-full rounded-r-full transition-all duration-500" style="width: ${spursPct}%"></div>
        </div>
      </div>
    `;
    statsBarsDiv.appendChild(row);
  });
}

function populateBuffDropdown(knicksRoster, spursRoster) {
  playerBuffSelect.innerHTML = "";
  const allPlayers = [...knicksRoster, ...spursRoster];
  allPlayers.forEach(p => {
    const opt = document.createElement("option");
    opt.value = p.name;
    opt.textContent = p.name;
    playerBuffSelect.appendChild(opt);
  });
}

// --- EVENT ROUTER & STREAM BINDERS ---
function setupEventListeners() {
  // Era Toggles
  eraClassicBtn.addEventListener("click", () => {
    setEra("classic_1999");
  });
  eraDreamBtn.addEventListener("click", () => {
    setEra("dream_2026");
  });

  // Game selector changes stats
  gameSelect.addEventListener("change", renderStatsComparison);

  // Settings Modal controls
  openSettingsBtn.addEventListener("click", () => {
    settingsModal.classList.remove("hidden");
  });
  closeSettingsBtn.addEventListener("click", () => {
    settingsModal.classList.add("hidden");
  });
  
  firebaseToggle.addEventListener("change", (e) => {
    if (e.target.checked) {
      firebaseConfigWrapper.classList.remove("hidden");
    } else {
      firebaseConfigWrapper.classList.add("hidden");
      disconnectFromFirebase();
    }
  });

  saveConfigBtn.addEventListener("click", () => {
    saveFirebaseConfigAndConnect();
  });

  // Chat Submissions
  chatForm.addEventListener("submit", (e) => {
    e.preventDefault();
    submitChatMessage();
  });

  // Admin broadcast simulation
  broadcastEventBtn.addEventListener("click", () => {
    const text = customEventInput.value.trim();
    if (text) {
      addTickerMessage(text);
      customEventInput.value = "";
      showToast("Live Play-by-Play Event Streamed!", "success");
    }
  });

  // Admin Stats boost simulation
  buffStatBtn.addEventListener("click", () => {
    const pName = playerBuffSelect.value;
    const activeEraData = rawMockData.eras[currentEra];
    const player = [...activeEraData.knicks.roster, ...activeEraData.spurs.roster].find(p => p.name === pName);
    
    if (player) {
      let numericPPG = parseFloat(player.stats.ppg);
      player.stats.ppg = (numericPPG + 10).toFixed(1);
      renderApp();
      showToast(`Power Up! Added +10 PPG to ${player.name}`, "success");
    }
  });
}

function setEra(eraKey) {
  currentEra = eraKey;
  if (eraKey === "classic_1999") {
    eraClassicBtn.className = "px-4 py-1.5 rounded-lg text-xs font-bold uppercase transition-all bg-gradient-to-r from-slate-800 to-slate-700 text-white shadow-md";
    eraDreamBtn.className = "px-4 py-1.5 rounded-lg text-xs font-bold uppercase transition-all text-slate-400 hover:text-slate-200";
  } else {
    eraDreamBtn.className = "px-4 py-1.5 rounded-lg text-xs font-bold uppercase transition-all bg-gradient-to-r from-slate-800 to-slate-700 text-white shadow-md";
    eraClassicBtn.className = "px-4 py-1.5 rounded-lg text-xs font-bold uppercase transition-all text-slate-400 hover:text-slate-200";
  }
  renderApp();
  showToast(`Transitioned to ${eraKey === 'classic_1999' ? '1999 Classic Finals' : '2026 Dream Matchup'}`, "info");
}

// --- COUNTDOWN SCHEDULER ---
function startCountdownTimer() {
  const g5Date = new Date();
  g5Date.setHours(g5Date.getHours() + 48); // Set live countdown to 2 days out

  function updateClock() {
    const diff = g5Date - new Date();
    if (diff <= 0) {
      countdownEl.textContent = "GAME LIVE NOW";
      return;
    }
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const mins = Math.floor((diff / 1000 / 60) % 60);
    const secs = Math.floor((diff / 1000) % 60);

    const pad = (n) => String(n).padStart(2, "0");
    countdownEl.textContent = `${pad(days)}d : ${pad(hours)}h : ${pad(mins)}m : ${pad(secs)}s`;
  }
  updateClock();
  setInterval(updateClock, 1000);
}

// --- MOCK PLAY TICKER & CHAT CONSOLE FLOWS ---
const simulatedPlays = [
  "Latrell Sprewell slashes inside and drills a tough floating baseline bank-shot!",
  "Victor Wembanyama blocks a driving layup off the backboard in transition!",
  "Jalen Brunson commands the floor, drawing a deep shooting foul beyond the arc.",
  "Tim Duncan anchors the low block, turning for a classic off-glass bank jumper.",
  "Marcus Camby grabs the defensive rebound, throwing a long transition outlet!",
  "Sean Elliott steps into a corner three-pointer and swishes it! MSG goes quiet."
];

function startMockGameTicker() {
  // Feed starting plays
  addTickerMessage("Arena announcer: Welcome to the high stakes NBA Finals Arena!");
  addTickerMessage("Tip-off begins! Team captains shaking hands at halfcourt.");

  let tickerCount = 0;
  setInterval(() => {
    const randomPlay = simulatedPlays[tickerCount % simulatedPlays.length];
    addTickerMessage(randomPlay);
    tickerCount++;
  }, 25000); // Send ticker event every 25 seconds
}

function addTickerMessage(text) {
  const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const row = document.createElement("div");
  row.className = "bg-slate-950/45 border border-slate-900 px-3 py-2 rounded-xl text-slate-300 leading-normal animate-fadeIn";
  row.innerHTML = `<span class="font-bold text-[10px] text-slate-500 block mb-0.5">${timeStr}</span> ${text}`;
  
  tickerFeedDiv.appendChild(row);
  tickerFeedDiv.scrollTop = tickerFeedDiv.scrollHeight;
  
  // Limits count
  if (tickerFeedDiv.childElementCount > 20) {
    tickerFeedDiv.removeChild(tickerFeedDiv.firstChild);
  }
}

// --- MOCK CHAT SYSTEMS ---
function submitChatMessage() {
  const user = chatUsername.value.trim() || "Fan";
  const text = chatInput.value.trim();
  if (!text) return;

  if (isFirebaseLive && rtdb) {
    // If Firebase Live, push directly to RTDB chat collection
    const chatRef = ref(rtdb, `chats/${currentEra}`);
    push(chatRef, {
      user: user,
      text: text,
      timestamp: Date.now()
    }).catch(err => {
      showToast("Firebase write blocked. Check security rules.", "error");
    });
  } else {
    // Local memory sync fallback
    appendLocalChatMessage(user, text);
    
    // Simulate opposing fan response in Mock Mode
    setTimeout(() => {
      const isKnicksMsg = text.toLowerCase().includes("knicks") || text.toLowerCase().includes("new york");
      let botReply = "Spurs defense will hold strong! Go silver and black!";
      if (isKnicksMsg) {
        botReply = "MSG is rocking but Duncan and Robinson are locked in! Spurs in 5!";
      } else if (text.toLowerCase().includes("spurs") || text.toLowerCase().includes("duncan") || text.toLowerCase().includes("wemby")) {
        botReply = "Sprewell and Allan Houston are about to turn up! NY will protect the home floor!";
      }
      appendLocalChatMessage("SpursFan99", botReply, true);
    }, 1500);
  }
  
  chatInput.value = "";
}

function appendLocalChatMessage(user, text, isBot = false) {
  const msg = document.createElement("div");
  msg.className = `p-2.5 rounded-xl text-xs flex flex-col gap-0.5 ${isBot ? 'bg-slate-800/40 border border-slate-800/60' : 'bg-knicks-blue/10 border border-knicks-blue/20'}`;
  msg.innerHTML = `
    <span class="font-extrabold ${isBot ? 'text-slate-400' : 'text-knicks-orange'} text-[10px] uppercase">${user}</span>
    <span class="text-slate-200 leading-normal">${text}</span>
  `;
  chatMessagesDiv.appendChild(msg);
  chatMessagesDiv.scrollTop = chatMessagesDiv.scrollHeight;

  if (chatMessagesDiv.childElementCount > 30) {
    chatMessagesDiv.removeChild(chatMessagesDiv.firstChild);
  }
}

// --- TOAST NOTIFICATIONS HELPER ---
function showToast(message, type = "info") {
  const toast = document.createElement("div");
  toast.className = `px-4 py-3 rounded-2xl shadow-2xl border flex items-center gap-2.5 text-xs font-semibold select-none transform transition-all duration-300 translate-y-2 pointer-events-auto cursor-pointer`;
  
  if (type === "success") {
    toast.className += " bg-emerald-950/95 border-emerald-500/30 text-emerald-300";
  } else if (type === "error") {
    toast.className += " bg-rose-950/95 border-rose-500/30 text-rose-300";
  } else {
    toast.className += " bg-slate-900/95 border-slate-700/80 text-slate-300";
  }

  toast.innerHTML = `
    <svg class="w-4.5 h-4.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
    <span>${message}</span>
  `;

  document.getElementById("toast-container").appendChild(toast);
  setTimeout(() => { toast.classList.remove("translate-y-2"); }, 10);
  
  // Remove element after delay
  const removeTimeout = setTimeout(() => {
    toast.classList.add("opacity-0", "translate-y-2");
    setTimeout(() => { toast.remove(); }, 300);
  }, 4000);

  toast.addEventListener("click", () => {
    clearTimeout(removeTimeout);
    toast.remove();
  });
}

// --- LOCAL STORAGE & FIREBASE CONFIG HANDLERS ---
function loadSavedFirebaseConfig() {
  const saved = localStorage.getItem("firebase_web_config");
  if (saved) {
    firebaseConfigInput.value = saved;
    firebaseToggle.checked = true;
    firebaseConfigWrapper.classList.remove("hidden");
    connectToFirebase(JSON.parse(saved));
  }
}

function saveFirebaseConfigAndConnect() {
  const rawText = firebaseConfigInput.value.trim();
  if (!rawText) {
    showToast("Config JSON cannot be empty", "error");
    return;
  }
  try {
    const parsed = JSON.parse(rawText);
    localStorage.setItem("firebase_web_config", rawText);
    showToast("Firebase Config Saved in browser!", "success");
    connectToFirebase(parsed);
  } catch (err) {
    showToast("Invalid JSON syntax. Double check braces.", "error");
    console.error(err);
  }
}

// --- CONNECT LIVE FIREBASE INSTANCES ---
async function connectToFirebase(config) {
  try {
    // Reset any previous application instances
    const app = initializeApp(config);
    db = getFirestore(app);
    rtdb = getDatabase(app);
    auth = getAuth(app);

    // Silently log in anonymously to grant access to secured data rules
    await signInAnonymously(auth);
    isFirebaseLive = true;

    // Adjust badge styles to green
    connectionBadge.className = "flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-3 py-1.5 rounded-full text-xs font-semibold";
    connectionStatusText.textContent = "Firebase Suite Online";
    document.getElementById("chat-mode").textContent = "RTDB Live Sync";

    showToast("Successfully Authenticated Anonymously & Synced Live!", "success");

    // Bind real-time RTDB stream listener to chat
    listenForChatsLive();
    listenForTickerLive();

  } catch (err) {
    showToast("Firebase connection failed. Reverting to Offline Mock Mode.", "error");
    console.error("Firebase startup issue: ", err);
    disconnectFromFirebase();
  }
}

function disconnectFromFirebase() {
  isFirebaseLive = false;
  db = null;
  rtdb = null;
  auth = null;
  
  // Revert UI indicators to yellow mock indicators
  connectionBadge.className = "flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 text-amber-400 px-3 py-1.5 rounded-full text-xs font-semibold";
  connectionStatusText.textContent = "Standalone Mock Mode";
  document.getElementById("chat-mode").textContent = "Local Cache";
}

// --- RTDB LIVE LISTENERS ---
function listenForChatsLive() {
  if (!rtdb) return;
  const chatRef = ref(rtdb, `chats/${currentEra}`);
  onValue(chatRef, (snapshot) => {
    chatMessagesDiv.innerHTML = "";
    const data = snapshot.val();
    if (data) {
      Object.values(data).forEach(msg => {
        appendLocalChatMessage(msg.user, msg.text, msg.user === "SpursFan99");
      });
    }
  });
}

function listenForTickerLive() {
  if (!rtdb) return;
  const tickerRef = ref(rtdb, `ticker/${currentEra}`);
  onValue(tickerRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
      tickerFeedDiv.innerHTML = "";
      Object.values(data).forEach(item => {
        addTickerMessage(item.text);
      });
    }
  });
}