// Config Firebase
// ¡¡¡ RECUERDA USAR TU PROPIA CONFIGURACIÓN DE FIREBASE!!!
const firebaseConfig = {
    apiKey: "AIzaSyAlj1iNqWqtI8j9KXWsrLMpk4NBpHV6KjI",
    authDomain: "impostor-681a4.firebaseapp.com",
    databaseURL: "https://impostor-681a4-default-rtdb.firebaseio.com",
    projectId: "impostor-681a4",
    storageBucket: "impostor-681a4.firebasestorage.app",
    messagingSenderId: "190634294699",
    appId: "1:190634294699:web:f07b18db1e01231b2f26ee",
    measurementId: "G-S02DGT01CQ"
  };

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// Variables globales
let playerName = "";
let roomCode = "";
let isHost = false;
let myId = Math.random().toString(36).substring(2, 8);
let roomRef = null; // Referencia a la sala en la DB
const words = ["Pizza", "Playa", "Cine", "Escuela", "Hospital", "Helado", "Fútbol"];

// DOM
const menu = document.getElementById("menu");
const lobby = document.getElementById("lobby");
const playerList = document.getElementById("playerList");
const startBtn = document.getElementById("startGame");
const waitingText = document.getElementById("waitingText");
const roomDisplay = document.getElementById("roomCode");
const game = document.getElementById("game");
const playerRole = document.getElementById("playerRole");
const wordInfo = document.getElementById("wordInfo");
const goToVote = document.getElementById("goToVote");
const voteDiv = document.getElementById("vote");
const voteButtons = document.getElementById("voteButtons");
const resultDiv = document.getElementById("result");
const resultText = document.getElementById("resultText");
const eliminatedDiv = document.getElementById("eliminated");
const remainingPlayersList = document.getElementById("remainingPlayersList");
const roundSummary = document.getElementById("roundSummary");
const voteStatus = document.getElementById("voteStatus"); // Div para el recuento

// --- Funciones del Menú (Crear y Unirse) ---

document.getElementById("createRoom").onclick = function() {
  playerName = document.getElementById("playerName").value.trim();
  if (!playerName) return alert("Poné tu nombre");
  roomCode = Math.random().toString(36).substring(2, 6).toUpperCase();
  isHost = true;

  roomRef = db.ref("rooms/" + roomCode);
  roomRef.set({
    players: { [myId]: playerName },
    host: myId,
    started: false
  });

  joinLobby();
}

document.getElementById("joinRoom").onclick = function() {
  playerName = document.getElementById("playerName").value.trim();
  roomCode = document.getElementById("roomCodeInput").value.trim().toUpperCase();
  if (!playerName || !roomCode) return alert("Completá los campos");

  roomRef = db.ref("rooms/" + roomCode);
  roomRef.once("value", (snapshot) => {
    if (snapshot.exists()) {
      if(snapshot.val().started) {
        return alert("La partida ya ha comenzado.");
      }
      roomRef.child("players").update({ [myId]: playerName });
      joinLobby();
    } else {
      alert("La sala no existe.");
    }
  });
}

// --- Lógica del Lobby ---

function joinLobby() {
  menu.classList.add("hidden");
  
  // Conectarse al listener principal del juego
  // ¡Esta es la única función .on() que usaremos!
  roomRef.on("value", mainGameListener);

  // Manejar desconexión
  const myPlayerRef = roomRef.child("players").child(myId);
  myPlayerRef.onDisconnect().remove();
  const myAliveRef = roomRef.child("alivePlayers").child(myId);
  myAliveRef.onDisconnect().remove();

  if (isHost) {
    // Si el host se va, se borra toda la sala
    roomRef.onDisconnect().remove();
  }
}

// --- EL LISTENER PRINCIPAL (Máquina de Estados) ---

function mainGameListener(snapshot) {
  const data = snapshot.val();

  // 1. Si la sala no existe (host la cerró), volver al menú.
  if (!data) {
    alert("La sala fue cerrada.");
    location.reload();
    return;
  }

  // 2. Si el juego terminó (hay un resultText), mostrar resultado final.
  if (data.resultText) {
    showScreen("result");
    resultText.textContent = data.resultText;
    roomRef.off(); // Desconectar el listener
    return;
  }

  // 3. Si no estoy vivo (fui eliminado), mostrar pantalla de eliminado.
  if (data.started && data.alivePlayers && !data.alivePlayers[myId]) {
    showScreen("eliminated");
    remainingPlayersList.innerHTML = "";
    for (const id in data.alivePlayers) {
        const li = document.createElement("li");
        li.textContent = data.players[id];
        remainingPlayersList.appendChild(li);
    }
    return;
  }

  // 4. Si el juego no ha empezado, mostrar Lobby.
  if (!data.started) {
    showScreen("lobby");
    roomDisplay.textContent = roomCode;
    playerList.innerHTML = "";
    const players = data.players || {};
    for (const id in players) {
      const li = document.createElement("li");
      li.textContent = players[id];
      if (id === myId) li.textContent += " (Tú)";
      playerList.appendChild(li);
    }
    // Mostrar botón de start solo al host
    startBtn.className = isHost ? "btn-primary" : "btn-primary hidden";
    waitingText.className = isHost ? "hidden" : "";
    return;
  }

  // 5. Si el juego SÍ ha empezado...
  
  // Asignar rol (solo la primera vez)
  if (playerRole.textContent === "") {
    if (myId === data.impostor) {
      playerRole.textContent = "Eres el IMPOSTOR 😈";
      wordInfo.textContent = "Fingí saber la palabra...";
    } else {
      playerRole.textContent = "Eres un ciudadano 🧠";
      wordInfo.textContent = "La palabra es: "."...".";
    }
  }

  // 6. Decidir qué pantalla de juego mostrar (Discusión o Votación)
  if (data.roomState === "voting") {
    // ESTADO: VOTANDO
    showScreen("vote");
    updateVoteUI(data);
  } else {
    // ESTADO: DISCUTIENDO (default)
    showScreen("game");
    roundSummary.textContent = data.roundSummary || "Discutan la palabra...";
  }

  // 7. TAREAS DEL HOST: El host comprueba si debe procesar los votos
  if (isHost) {
    checkHostDuties(data);
  }
}

// --- Funciones de Pantalla ---

function showScreen(screenId) {
  // Ocultar todas las pantallas
  [menu, lobby, game, vote, eliminatedDiv, resultDiv].forEach(div => {
    div.classList.add("hidden");
  });
  // Mostrar solo la deseada
  document.getElementById(screenId).classList.remove("hidden");
}

function updateVoteUI(data) {
  const votes = data.votes || {};
  const allPlayers = data.players || {};
  const alivePlayers = data.alivePlayers || {};

  // --- 1. Lógica de tu nueva función: Mostrar recuento de votos ---
  voteStatus.innerHTML = "<h3>Votos en vivo:</h3>";
  const counts = {};
  Object.values(votes).forEach(id => { counts[id] = (counts[id] || 0) + 1; });
  
  for (const id in alivePlayers) {
    const name = allPlayers[id];
    const numVotes = counts[id] || 0;
    voteStatus.innerHTML += `<p>${name}: ${numVotes} voto(s)</p>`;
  }
  voteStatus.innerHTML += `<hr><p>Total: ${Object.keys(votes).length} / ${Object.keys(alivePlayers).length}</p>`;

  // --- 2. Lógica de botones: ¿Ya voté? ---
  if (votes[myId]) {
    // Ya voté
    voteButtons.innerHTML = "<p>Voto enviado ✅. Esperando a los demás...</p>";
  } else {
    // No he votado
    voteButtons.innerHTML = "";
    for (const id in alivePlayers) {
      const btn = document.createElement("button");
      btn.textContent = "Votar a " + alivePlayers[id];
      btn.onclick = function() {
        // Enviar mi voto
        roomRef.child("votes").child(myId).set(id);
      }
      voteButtons.appendChild(btn);
    }
  }
}

// --- Funciones de Botones (Acciones) ---

startBtn.onclick = function() {
  if (!isHost) return;

  roomRef.once("value").then(snap => {
    const players = snap.val().players;
    const playerKeys = Object.keys(players);

    if (playerKeys.length < 3) {
      alert("Necesitas al menos 3 jugadores para empezar.");
      return;
    }
    
    const impostorId = playerKeys[Math.floor(Math.random() * playerKeys.length)];
    const chosenWord = words[Math.floor(Math.random() * words.length)];

    // Iniciar el juego
    roomRef.update({
      started: true,
      word: chosenWord,
      impostor: impostorId,
      alivePlayers: players, // Empezamos con todos vivos
      roomState: "discussing", // Primer estado: Discusión
      votes: {},
      roundSummary: "¡Empieza la partida! Discutan sobre la palabra."
    });
  });
}

goToVote.onclick = function() {
  // Cualquiera puede iniciar la votación, pero lo cambia para todos
  roomRef.update({
    roomState: "voting", // Cambiar a estado de votación
    votes: {}, // Limpiar votos
    roundSummary: ""
  });
}

// --- Lógica del Host (El "Director" del juego) ---

function checkHostDuties(data) {
  // Solo el host ejecuta esto
  if (!isHost) return;

  // Tarea 1: ¿Estamos votando y ya votaron todos?
  if (data.roomState === "voting") {
    const votes = data.votes || {};
    const alivePlayers = data.alivePlayers || {};
    const totalVotes = Object.keys(votes).length;
    const totalAlive = Object.keys(alivePlayers).length;

    // Si no hay jugadores vivos o los votos no están completos, no hacer nada
    if (totalAlive === 0 || totalVotes < totalAlive) {
      return;
    }
    
    // ¡TODOS VOTARON! El host procesa el resultado.
    processVotes(data);
  }
}

function processVotes(data) {
  // El host es el único que corre esta función
  if (!isHost) return;

  const { votes, alivePlayers, impostorId, players, word } = data;

  // 1. Contar votos
  const counts = {};
  Object.values(votes).forEach(id => { counts[id] = (counts[id] || 0) + 1; });

  let maxVotes = 0;
  let kickedId = "";
  let isTie = false;

  for (const id in counts) {
    const voteCount = counts[id];
    if (voteCount > maxVotes) {
      maxVotes = voteCount;
      kickedId = id;
      isTie = false; // Se rompió el empate
    } else if (voteCount === maxVotes) {
      isTie = true; // Hay un empate
    }
  }

  // 2. Determinar resultado

  // --- CASO A: EMPATE (o nadie votó a nadie) ---
  if (isTie || kickedId === "") {
    roomRef.update({
      roomState: "discussing",
      votes: {},
      roundSummary: "¡Hubo un empate! Nadie fue eliminado. Sigan discutiendo."
    });
    return;
  }

  // --- CASO B: ALGUIEN FUE ELIMINADO ---
  const kickedName = players[kickedId];
  const newAlivePlayers = { ...alivePlayers };
  delete newAlivePlayers[kickedId]; // Eliminarlo de los vivos

  // 3. Comprobar condiciones de victoria

  // --- Condición 1: ¿Era el impostor? ---
  if (kickedId === impostorId) {
    roomRef.update({
      resultText: `✅ ¡Atraparon al impostor (${kickedName})! La palabra era ${word}. ¡Ganaron los ciudadanos!`
    });
    return;
  }

  // --- Condición 2: No era. ¿Gana el impostor? (Quedan 2 vivos) ---
  if (Object.keys(newAlivePlayers).length <= 2) {
    roomRef.update({
      resultText: `❌ Sacaron a ${kickedName}, pero no era. El impostor (${players[impostorId]}) ha ganado.`
    });
    return;
  }

  // --- Condición 3: El juego continúa ---
  roomRef.update({
    roomState: "discussing",
    votes: {},
    alivePlayers: newAlivePlayers,
    roundSummary: `❌ ${kickedName} fue eliminado, pero no era el impostor. ¡La partida sigue!`
  });
}
