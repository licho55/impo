// Config Firebase
// ¡¡¡ RECUERDA USAR TU PROPIA CONFIGURACIÓN DE FIREBASE!!!
const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "TU_AUTH_DOMAIN",
  databaseURL: "TU_DATABASE_URL",
  projectId: "TU_PROJECT_ID",
  storageBucket: "TU_STORAGE_BUCKET",
  messagingSenderId: "TU_MESSAGING_SENDER_ID",
  appId: "TU_APP_ID"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// Variables
let playerName = "";
let roomCode = "";
let isHost = false;
let myId = Math.random().toString(36).substring(2, 8);
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

// --- Nuevos elementos del DOM ---
const eliminatedDiv = document.getElementById("eliminated");
const remainingPlayersList = document.getElementById("remainingPlayersList");
const roundSummary = document.getElementById("roundSummary");

// --- Funciones del Menú (Crear y Unirse) ---

document.getElementById("createRoom").onclick = function() {
  playerName = document.getElementById("playerName").value.trim();
  if (!playerName) return alert("Poné tu nombre");
  roomCode = Math.random().toString(36).substring(2, 6).toUpperCase();
  isHost = true;

  firebase.database().ref("rooms/" + roomCode).set({
    players: { [myId]: playerName }, // Lista de TODOS los que entraron
    host: myId,
    started: false,
    votes: {}
  });

  joinLobby();
}

document.getElementById("joinRoom").onclick = function() {
  playerName = document.getElementById("playerName").value.trim();
  roomCode = document.getElementById("roomCodeInput").value.trim().toUpperCase();
  if (!playerName || !roomCode) return alert("Completá los campos");

  firebase.database().ref("rooms/" + roomCode).once("value", (snapshot) => {
    if (snapshot.exists()) {
      if(snapshot.val().started) {
        return alert("La partida ya ha comenzado.");
      }
      firebase.database().ref("rooms/" + roomCode + "/players").update({
        [myId]: playerName
      });
      joinLobby();
    } else {
      alert("La sala no existe.");
    }
  });
}

// --- Lógica del Lobby ---

function joinLobby() {
  menu.classList.add("hidden");
  lobby.classList.remove("hidden");
  roomDisplay.textContent = roomCode;

  // Listener 1: Actualizar lista de jugadores en el lobby
  firebase.database().ref("rooms/" + roomCode + "/players").on("value", snap => {
    playerList.innerHTML = "";
    const players = snap.val() || {};
    for (const id in players) {
      const li = document.createElement("li");
      li.textContent = players[id];
      if (id === myId) li.textContent += " (Tú)";
      playerList.appendChild(li);
    }
  });

  // Listener 2: Escuchar cambios de estado de la sala (inicio, eliminación, etc.)
  firebase.database().ref("rooms/" + roomCode).on("value", snap => {
    const data = snap.val();
    if (!data) {
        alert("La sala fue cerrada por el host.");
        location.reload();
        return;
    }

    // Comprobar si HE SIDO ELIMINADO
    if (data.started && data.alivePlayers && !data.alivePlayers[myId] && resultDiv.classList.contains("hidden")) {
      showEliminatedScreen(data.alivePlayers);
    }

    // Iniciar la partida por primera vez
    if (data.started && game.classList.contains("hidden") && !eliminatedDiv.classList.contains("hidden")) {
      lobby.classList.add("hidden");
      game.classList.remove("hidden");

      if (myId === data.impostor) {
        playerRole.textContent = "Eres el IMPOSTOR 😈";
        wordInfo.textContent = "Fingí saber la palabra...";
      } else {
        playerRole.textContent = "Eres un ciudadano 🧠";
        wordInfo.textContent = "La palabra es: " + data.word;
      }
    }
  });

  // Manejar desconexión
  const myPlayerRef = firebase.database().ref("rooms/" + roomCode + "/players/" + myId);
  myPlayerRef.onDisconnect().remove();
  const myAliveRef = firebase.database().ref("rooms/" + roomCode + "/alivePlayers/" + myId);
  myAliveRef.onDisconnect().remove();

  if (isHost) {
    startBtn.classList.remove("hidden");
    waitingText.classList.add("hidden");
    // Si el host se va, se borra toda la sala
    firebase.database().ref("rooms/" + roomCode).onDisconnect().remove();
  }
}

// --- PANTALLA DE ELIMINADO ---
function showEliminatedScreen(alivePlayers) {
    game.classList.add("hidden");
    lobby.classList.add("hidden");
    voteDiv.classList.add("hidden");
    resultDiv.classList.add("hidden");
    eliminatedDiv.classList.remove("hidden");

    remainingPlayersList.innerHTML = "";
    for (const id in alivePlayers) {
        const li = document.createElement("li");
        li.textContent = alivePlayers[id];
        remainingPlayersList.appendChild(li);
    }
}


// --- Iniciar partida ---
startBtn.onclick = function() {
  firebase.database().ref("rooms/" + roomCode + "/players").once("value").then(snap => {
    const players = snap.val();
    const playerKeys = Object.keys(players);

    if (playerKeys.length < 3) {
      alert("Necesitas al menos 3 jugadores para empezar.");
      return;
    }
    
    const impostorId = playerKeys[Math.floor(Math.random() * playerKeys.length)];
    const chosenWord = words[Math.floor(Math.random() * words.length)];

    firebase.database().ref("rooms/" + roomCode).update({
      started: true,
      word: chosenWord,
      impostor: impostorId,
      alivePlayers: players, // <-- NUEVO: Lista de jugadores vivos
      votes: {}
    });
  });
}

// --- Ir a votación ---
goToVote.onclick = function() {
  game.classList.add("hidden");
  voteDiv.classList.remove("hidden");
  voteButtons.innerHTML = "<p>¿Quién es el impostor?</p>";

  // Solo mostrar botones de jugadores VIVOS
  firebase.database().ref("rooms/" + roomCode + "/alivePlayers").once("value").then(snap => {
    const alivePlayers = snap.val();
    for (const id in alivePlayers) {
      const btn = document.createElement("button");
      btn.textContent = "Votar a " + alivePlayers[id];
      btn.onclick = function() {
        firebase.database().ref("rooms/" + roomCode + "/votes/" + myId).set(id);
        voteButtons.innerHTML = "<p>Voto enviado ✅. Esperando a los demás...</p>";
      }
      voteButtons.appendChild(btn);
    }
  });
}

// --- LÓGICA DE VOTACIÓN Y RESULTADO (LA MÁS CAMBIADA) ---
firebase.database().ref("rooms/" + roomCode + "/votes").on("value", snap => {
  const votes = snap.val();
  
  // Si no hay votos (p.ej. se reinició la ronda) o el juego ya terminó, no hacer nada.
  if (!votes || !resultDiv.classList.contains("hidden")) return;

  // 1. Obtener el estado actual de la sala (quién está vivo, quién es impostor)
  firebase.database().ref("rooms/" + roomCode).once("value").then(roomSnap => {
    const roomData = roomSnap.val();
    if (!roomData || !roomData.started) return; // La partida no ha empezado

    const alivePlayers = roomData.alivePlayers || {};
    const impostorId = roomData.impostor;
    const allPlayers = roomData.players || {}; // Nombres de todos
    
    const alivePlayerIds = Object.keys(alivePlayers);
    const totalAlive = alivePlayerIds.length;
    const totalVotes = Object.keys(votes).length;

    // 2. Esperar a que todos los jugadores VIVOS hayan votado
    if (totalVotes === totalAlive) {
      
      // 3. Contar votos
      const counts = {};
      Object.values(votes).forEach(id => counts[id] = (counts[id] || 0) + 1);

      let maxVotes = 0;
      let tied = false;
      let kickedId = ""; // ID del jugador a eliminar

      for (const id in counts) {
        const voteCount = counts[id];
        if (voteCount > maxVotes) {
          maxVotes = voteCount;
          kickedId = id;
          tied = false; // Se rompió el empate
        } else if (voteCount === maxVotes) {
          tied = true; // Hay un empate
        }
      }
      
      // Si el más votado tiene un empate con otro, nadie es kickeado
      if (tied) {
         const tiedPlayers = Object.keys(counts).filter(id => counts[id] === maxVotes);
         if(tiedPlayers.length > 1) {
            kickedId = ""; // Es un empate real, nadie es eliminado
         }
      }

      // 4. Procesar el resultado de la votación
      const dbRef = firebase.database().ref("rooms/" + roomCode);

      // --- CASO A: EMPATE O NADIE VOTADO ---
      if (kickedId === "") {
        // Nadie es eliminado. El juego vuelve a la discusión.
        voteDiv.classList.add("hidden");
        game.classList.remove("hidden");
        roundSummary.textContent = "¡Hubo un empate! Nadie fue eliminado. Sigan discutiendo.";
        
        // Limpiar votos para la siguiente ronda (solo el host)
        if (isHost) {
          dbRef.child("votes").set({});
        }
        return; // Fin
      }

      // --- CASO B: ALGUIEN FUE ELIMINADO ---
      const kickedName = allPlayers[kickedId] || "Alguien";
      
      // Eliminar al jugador de la lista de vivos (solo el host lo hace)
      if (isHost) {
        dbRef.child("alivePlayers").child(kickedId).remove();
      }

      // 5. Comprobar condiciones de victoria
      
      // --- Condición 1: ¿Era el impostor? ---
      if (kickedId === impostorId) {
        // ¡Ganan los inocentes!
        resultDiv.classList.remove("hidden");
        voteDiv.classList.add("hidden");
        game.classList.add("hidden");
        eliminatedDiv.classList.add("hidden");
        resultText.textContent = `✅ ¡Atraparon al impostor (${kickedName})! La palabra era ${roomData.word}. ¡Ganaron los ciudadanos!`;
        return; // Fin del juego
      }

      // --- Condición 2: No era el impostor. ¿Gana el impostor? ---
      // El impostor gana si quedan 2 jugadores (él y 1 inocente)
      const remainingAlive = totalAlive - 1;
      if (remainingAlive <= 2) {
        // ¡Gana el impostor!
        resultDiv.classList.remove("hidden");
        voteDiv.classList.add("hidden");
        game.classList.add("hidden");
        eliminatedDiv.classList.add("hidden");
        resultText.textContent = `❌ Sacaron a ${kickedName}, pero no era. El impostor (${allPlayers[impostorId]}) ha ganado.`;
        return; // Fin del juego
      }

      // --- Condición 3: El juego continúa ---
      // Volver a la pantalla de juego
      voteDiv.classList.add("hidden");
      game.classList.remove("hidden");
      roundSummary.textContent = `❌ ${kickedName} fue eliminado, pero no era el impostor. ¡La partida sigue!`;
      
      // Limpiar votos (solo el host)
      if (isHost) {
        dbRef.child("votes").set({});
      }
    }
  });
});
