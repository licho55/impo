// Config Firebase
// ¡¡¡ REEMPLAZA ESTO CON TU NUEVA CONFIGURACIÓN DE FIREBASE !!!
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

// Variables
let playerName = "";
let roomCode = "";
let isHost = false;
let myId = Math.random().toString(36).substring(2, 8);
let chosenWord = "";
let impostorId = "";
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

// Crear sala
document.getElementById("createRoom").onclick = function() {
  console.log("Botón crear sala presionado");
  playerName = document.getElementById("playerName").value.trim();
  if (!playerName) return alert("Poné tu nombre");
  roomCode = Math.random().toString(36).substring(2, 6).toUpperCase();
  isHost = true;

  firebase.database().ref("rooms/" + roomCode).set({
    players: { [myId]: playerName },
    host: myId,
    started: false,
    votes: {}
  });

  joinLobby();
}

// Unirse a sala
document.getElementById("joinRoom").onclick = function() {
  playerName = document.getElementById("playerName").value.trim();
  roomCode = document.getElementById("roomCodeInput").value.trim().toUpperCase();
  if (!playerName || !roomCode) return alert("Completá los campos");

  firebase.database().ref("rooms/" + roomCode).once("value", (snapshot) => {
    if (snapshot.exists()) {
      firebase.database().ref("rooms/" + roomCode + "/players").update({
        [myId]: playerName
      });
      joinLobby();
    } else {
      alert("La sala no existe.");
    }
  });
}

// Lobby
function joinLobby() {
  menu.classList.add("hidden");
  lobby.classList.remove("hidden");
  roomDisplay.textContent = roomCode;

  // Escuchar cambios en los jugadores
  firebase.database().ref("rooms/" + roomCode + "/players").on("value", snap => {
    playerList.innerHTML = "";
    const players = snap.val() || {};
    for (const id in players) {
      const li = document.createElement("li");
      li.textContent = players[id];
      if(id === myId) li.textContent += " (Tú)";
      playerList.appendChild(li);
    }
  });

  // Escuchar cambios en la sala (para el inicio)
  firebase.database().ref("rooms/" + roomCode).on("value", snap => {
    const data = snap.val();
    if (!data) return; // La sala fue eliminada

    if (data.started && game.classList.contains("hidden")) {
      // La partida comenzó
      lobby.classList.add("hidden");
      game.classList.remove("hidden");
      chosenWord = data.word;
      impostorId = data.impostor;
      if (myId === impostorId) {
        playerRole.textContent = "Eres el IMPOSTOR 😈";
        wordInfo.textContent = "Fingí saber la palabra...";
      } else {
        playerRole.textContent = "Eres un ciudadano 🧠";
        wordInfo.textContent = "La palabra es: " + chosenWord;
      }
    }
  });

  // Escuchar si el host se desconecta
  firebase.database().ref("rooms/" + roomCode + "/host").on("value", snap => {
    const hostId = snap.val();
    firebase.database().ref("rooms/" + roomCode + "/players/" + hostId).on("value", playerSnap => {
      if(!playerSnap.exists() && !isHost) {
        alert("El host se desconectó. Volviendo al menú.");
        location.reload();
      }
    });
  });

  if (isHost) {
    startBtn.classList.remove("hidden");
    waitingText.classList.add("hidden");
    // Manejar desconexión del host
    const myRef = firebase.database().ref("rooms/" + roomCode + "/players/" + myId);
    myRef.onDisconnect().remove();
    const hostRef = firebase.database().ref("rooms/" + roomCode + "/host");
    hostRef.onDisconnect().remove();

  } else {
    // Manejar desconexión de jugador normal
    const myRef = firebase.database().ref("rooms/" + roomCode + "/players/" + myId);
    myRef.onDisconnect().remove();
  }
}

// Iniciar partida
startBtn.onclick = function() {
  firebase.database().ref("rooms/" + roomCode + "/players").once("value").then(snap => {
    const players = Object.keys(snap.val());
    if (players.length < 3) { // Necesitas al menos 3 para jugar
      alert("Necesitas al menos 3 jugadores para empezar.");
      return;
    }
    impostorId = players[Math.floor(Math.random() * players.length)];
    chosenWord = words[Math.floor(Math.random() * words.length)];

    firebase.database().ref("rooms/" + roomCode).update({
      started: true,
      word: chosenWord,
      impostor: impostorId,
      votes: {} // Limpiar votos
    });
  });
}

// Ir a votación
goToVote.onclick = function() {
  game.classList.add("hidden");
  voteDiv.classList.remove("hidden");
  voteButtons.innerHTML = "";

  firebase.database().ref("rooms/" + roomCode + "/players").once("value").then(snap => {
    const players = snap.val();
    for (const id in players) {
      // No puedes votarte a ti mismo
      // if (id !== myId) { 
        // Permitir votarse a sí mismo (a veces es estratégico)
        const btn = document.createElement("button");
        btn.textContent = "Votar a " + players[id];
        btn.onclick = function() {
          firebase.database().ref("rooms/" + roomCode + "/votes/" + myId).set(id);
          voteButtons.innerHTML = "<p>Voto enviado ✅</p>";
        }
        voteButtons.appendChild(btn);
      // }
    }
  });
}

// Resultado
firebase.database().ref("rooms/" + roomCode + "/votes").on("value", snap => {
  const votes = snap.val();
  if (!votes || resultDiv.classList.contains("hidden") === false) return; // Si no hay votos o el resultado ya se muestra

  firebase.database().ref("rooms/" + roomCode + "/players").once("value").then(playersSnap => {
    const allPlayers = playersSnap.val() || {};
    const totalPlayers = Object.keys(allPlayers).length;
    const totalVotes = Object.keys(votes).length;

    // Esperar a que todos voten
    if (totalVotes === totalPlayers) {
      const counts = {};
      Object.values(votes).forEach(id => counts[id] = (counts[id] || 0) + 1);

      let maxVotes = 0, kicked = "";
      // Encontrar al más votado (manejo simple de empates, toma el último)
      for (const id in counts) {
        if (counts[id] >= maxVotes) { 
          maxVotes = counts[id]; 
          kicked = id; 
        }
      }

      resultDiv.classList.remove("hidden");
      voteDiv.classList.add("hidden");
      game.classList.add("hidden"); // Ocultar otras pantallas
      lobby.classList.add("hidden");

      firebase.database().ref("rooms/" + roomCode + "/impostor").once("value").then(impostorSnap => {
        const impostorId = impostorSnap.val();
        if (kicked === impostorId) {
          resultText.textContent = `✅ ¡Atraparon al impostor (${allPlayers[kicked]})! La palabra era ${chosenWord}. ¡Ganaron los ciudadanos!`;
        } else {
          resultText.textContent = `❌ Sacaron a ${allPlayers[kicked]}, pero no era el impostor. El impostor era ${allPlayers[impostorId]}. ¡Gana el impostor!`;
        }
        
        // Limpiar la sala para jugar de nuevo (o recargar)
        if(isHost) {
          // Opción: Borrar la sala
          // firebase.database().ref("rooms/" + roomCode).remove();
          // Opción 2: Resetear la sala (más complejo)
        }
      });
    }
  });
});
