// Config Firebase (global)
const firebaseConfig = {
  apiKey: "AIzaSyAlj1iNqWqtI8j9KXWsrLMpk4NBpHV6KjI",
  authDomain: "impostor-681a4.firebaseapp.com",
  databaseURL: "https://impostor-681a4-default-rtdb.firebaseio.com",
  projectId: "impostor-681a4",
  storageBucket: "impostor-681a4.appspot.com",
  messagingSenderId: "190634294699",
  appId: "1:190634294699:web:ef0fbaa0731e01f92f26ee",
  measurementId: "G-HP4YV0F8JP"
};

// Inicializar Firebase
const app = firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// Variables
let playerName = "";
let roomCode = "";
let isHost = false;
let myId = Math.random().toString(36).substring(2,8);
let chosenWord = "";
let impostorId = "";
const words = ["Pizza","Playa","Cine","Escuela","Hospital","Helado","Fútbol"];

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
  playerName = document.getElementById("playerName").value.trim();
  if(!playerName) return alert("Poné tu nombre");
  roomCode = Math.random().toString(36).substring(2,6).toUpperCase();
  isHost = true;

  firebase.database().ref("rooms/"+roomCode).set({
    players: {[myId]: playerName},
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
  if(!playerName || !roomCode) return alert("Completá los campos");

  firebase.database().ref("rooms/"+roomCode+"/players").update({
    [myId]: playerName
  });

  joinLobby();
}

// Lobby
function joinLobby() {
  menu.classList.add("hidden");
  lobby.classList.remove("hidden");
  roomDisplay.textContent = roomCode;

  firebase.database().ref("rooms/"+roomCode+"/players").on("value", snap=>{
    playerList.innerHTML = "";
    const players = snap.val() || {};
    for(const id in players){
      const li = document.createElement("li");
      li.textContent = players[id];
      playerList.appendChild(li);
    }
  });

  if(isHost){
    startBtn.classList.remove("hidden");
    waitingText.classList.add("hidden");
  }
}

// Iniciar partida
startBtn.onclick = function(){
  firebase.database().ref("rooms/"+roomCode+"/players").once("value").then(snap=>{
    const players = Object.keys(snap.val());
    impostorId = players[Math.floor(Math.random()*players.length)];
    chosenWord = words[Math.floor(Math.random()*words.length)];

    firebase.database().ref("rooms/"+roomCode).update({
      started: true,
      word: chosenWord,
      impostor: impostorId
    });
  });
}

// Escuchar inicio
firebase.database().ref("rooms/"+roomCode).on("value", snap=>{
  const data = snap.val();
  if(data?.started && game.classList.contains("hidden")){
    lobby.classList.add("hidden");
    game.classList.remove("hidden");
    chosenWord = data.word;
    impostorId = data.impostor;
    if(myId === impostorId){
      playerRole.textContent = "Eres el IMPOSTOR 😈";
      wordInfo.textContent = "Fingí saber la palabra...";
    } else {
      playerRole.textContent = "Eres un ciudadano 🧠";
      wordInfo.textContent = "La palabra es: "+chosenWord;
    }
  }
});

// Ir a votación
goToVote.onclick = function(){
  game.classList.add("hidden");
  voteDiv.classList.remove("hidden");
  voteButtons.innerHTML = "";

  firebase.database().ref("rooms/"+roomCode+"/players").once("value").then(snap=>{
    const players = snap.val();
    for(const id in players){
      if(id !== myId){
        const btn = document.createElement("button");
        btn.textContent = "Votar a "+players[id];
        btn.onclick = function(){
          firebase.database().ref("rooms/"+roomCode+"/votes/"+myId).set(id);
          voteButtons.innerHTML = "<p>Voto enviado ✅</p>";
        }
        voteButtons.appendChild(btn);
      }
    }
  });
}

// Resultado
firebase.database().ref("rooms/"+roomCode+"/votes").on("value", snap=>{
  const votes = snap.val();
  if(!votes) return;
  const playersVoted = Object.values(votes);
  const counts = {};
  playersVoted.forEach(id=>counts[id]=(counts[id]||0)+1);
  const total = Object.keys(votes).length;

  firebase.database().ref("rooms/"+roomCode+"/players").once("value").then(snap=>{
    const allPlayers = Object.keys(snap.val());
    if(total === allPlayers.length){
      let maxVotes = 0, kicked = "";
      for(const id in counts){
        if(counts[id]>maxVotes){ maxVotes=counts[id]; kicked=id; }
      }
      resultDiv.classList.remove("hidden");
      voteDiv.classList.add("hidden");
      if(kicked===impostorId){
        resultText.textContent = `✅ Sacaron al impostor (${snap.val()[kicked]}). ¡Ganaron!`;
      } else {
        resultText.textContent = `❌ Sacaron a ${snap.val()[kicked]}, pero el impostor era ${snap.val()[impostorId]}.`;
      }
    }
  });
});
