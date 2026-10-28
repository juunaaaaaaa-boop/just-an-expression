// script.js
// LOVE.exe
// plain JavaScript, no framework required

"use strict";

/* =========================================
   01. HELPERS
========================================= */

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const clamp = (number, min, max) =>
  Math.min(max, Math.max(min, number));

const randomItem = (items) =>
  items[Math.floor(Math.random() * items.length)];

const escapeHTML = (value) =>
  String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);

function safeRead(key, fallback = "") {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : value;
  } catch {
    return fallback;
  }
}

function safeWrite(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    showToast("browser nggak bisa nyimpen data saat ini.");
    return false;
  }
}

function safeReadJSON(key, fallback) {
  try {
    const value = JSON.parse(safeRead(key, ""));
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function showToast(message) {
  const toast = $("#toast");
  if (!toast) return;

  toast.textContent = message;
  toast.classList.add("visible");

  clearTimeout(showToast.timeout);
  showToast.timeout = setTimeout(() => {
    toast.classList.remove("visible");
  }, 2600);
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

function shuffle(array) {
  const result = [...array];

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
}

function downloadBlob(blob, filename) {
  if (!blob) {
    showToast("gagal bikin file. coba lagi ya.");
    return;
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1200);
}

function downloadCanvas(canvas, filename) {
  if (!canvas) return;

  canvas.toBlob((blob) => {
    downloadBlob(blob, filename);
  }, "image/png");
}

function reduceMotionEnabled() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/* =========================================
   02. PAGE NAVIGATION
========================================= */

const sidebar = $("#sidebar");
const mobileMenu = $("#mobileMenu");
const navLinks = $$(".nav-link");
const pages = $$(".page");

function navigateTo(pageName, updateHistory = true) {
  const target = $(`#page-${pageName}`);

  if (!target) {
    showToast("halamannya nggak ketemu. coba pilih menu lain.");
    return;
  }

  pages.forEach((page) => {
    page.classList.toggle("active", page === target);
  });

  navLinks.forEach((link) => {
    const active = link.dataset.page === pageName;

    link.classList.toggle("active", active);

    if (active) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  });

  const status = $("#topStatus");
  if (status) {
    status.textContent = target.dataset.title || "a little corner of the internet";
  }

  sidebar?.classList.remove("open");

  if (mobileMenu) {
    mobileMenu.setAttribute("aria-expanded", "false");
  }

  if (updateHistory) {
    history.replaceState(null, "", `#${pageName}`);
  }

  window.scrollTo({
    top: 0,
    behavior: reduceMotionEnabled() ? "auto" : "smooth"
  });

  if (pageName === "doodle") {
    requestAnimationFrame(resizeDrawingCanvas);
  }

  if (pageName === "memory") {
    renderMemoryCards();
  }

  if (pageName === "wordle") {
    renderWordGrid();
  }
}

navLinks.forEach((link) => {
  link.addEventListener("click", () => {
    navigateTo(link.dataset.page);
  });
});

$$("[data-go]").forEach((button) => {
  button.addEventListener("click", () => {
    navigateTo(button.dataset.go);
  });
});

mobileMenu?.addEventListener("click", () => {
  const open = sidebar.classList.toggle("open");
  mobileMenu.setAttribute("aria-expanded", String(open));
});

document.addEventListener("click", (event) => {
  if (
    window.innerWidth <= 780 &&
    sidebar?.classList.contains("open") &&
    !sidebar.contains(event.target) &&
    !mobileMenu?.contains(event.target)
  ) {
    sidebar.classList.remove("open");
    mobileMenu?.setAttribute("aria-expanded", "false");
  }
});

window.addEventListener("hashchange", () => {
  const pageName = location.hash.slice(1) || "home";
  navigateTo(pageName, false);
});

const initialPage = location.hash.slice(1);
navigateTo(
  pages.some((page) => page.id === `page-${initialPage}`)
    ? initialPage
    : "home",
  false
);

/* =========================================
   03. OPTIONAL SOUND
   Sound starts only after user interaction.
========================================= */

let audioContext = null;
let soundEnabled = false;

function getAudioContext() {
  const AudioContextClass =
    window.AudioContext || window.webkitAudioContext;

  if (!AudioContextClass) return null;

  if (!audioContext) {
    audioContext = new AudioContextClass();
  }

  if (audioContext.state === "suspended") {
    audioContext.resume().catch(() => {});
  }

  return audioContext;
}

function playTone(frequency = 440, duration = 0.09, volume = 0.035) {
  if (!soundEnabled) return;

  const context = getAudioContext();
  if (!context) return;

  const oscillator = context.createOscillator();
  const gain = context.createGain();

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(
    frequency,
    context.currentTime
  );

  gain.gain.setValueAtTime(volume, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(
    0.001,
    context.currentTime + duration
  );

  oscillator.connect(gain);
  gain.connect(context.destination);

  oscillator.start();
  oscillator.stop(context.currentTime + duration);
}

$("#soundToggle")?.addEventListener("click", () => {
  soundEnabled = !soundEnabled;

  $("#soundIcon").textContent = soundEnabled ? "♫" : "♪";
  $("#soundToggle").setAttribute(
    "aria-pressed",
    String(soundEnabled)
  );

  if (soundEnabled) {
    getAudioContext();
    playTone(520, 0.12);
    showToast("suara kecil diaktifkan.");
  } else {
    showToast("suara dimatikan.");
  }
});

/* =========================================
   04. HOME QUOTES
========================================= */

const homeQuotes = [
  '"kadang, hal sederhana justru paling lama diinget."',
  '"nggak semua hal harus punya alasan yang rumit."',
  '"pelan-pelan juga sampai. santai, bukan balapan."',
  '"obrolan receh bisa jadi bagian favorit dari hari."',
  '"jadi diri sendiri aja, nggak perlu jadi versi premium."',
  '"beberapa hal indah datang tanpa pengumuman."',
  '"hari biasa juga punya kemungkinan yang bagus."',
  '"nggak semua pesan harus panjang buat terasa berarti."',
  '"istirahat itu bagian dari perjalanan, bukan kegagalan."',
  '"kalau belum tahu jawabannya, nggak apa-apa."',
  '"semoga besok ada alasan kecil buat senyum."',
  '"hidup bukan lomba siapa yang paling cepat paham."',
  '"kadang yang dibutuhkan cuma didengerin, bukan diceramahin."',
  '"jangan lupa makan. pikiran nggak bisa hidup dari overthinking."',
  '"some things are better when they happen naturally."'
];

let previousQuoteIndex = -1;

$("#changeQuote")?.addEventListener("click", () => {
  let index = Math.floor(Math.random() * homeQuotes.length);

  if (homeQuotes.length > 1) {
    while (index === previousQuoteIndex) {
      index = Math.floor(Math.random() * homeQuotes.length);
    }
  }

  previousQuoteIndex = index;

  const quote = $("#homeQuote");
  quote.animate(
    [{ opacity: 0, transform: "translateY(5px)" }, { opacity: 1, transform: "translateY(0)" }],
    { duration: 300, easing: "ease-out" }
  );

  quote.textContent = homeQuotes[index];
  playTone(400 + index * 12, 0.07);
});

/* =========================================
   05. THE QUESTION
========================================= */

const confessResponse = $("#confessResponse");

function showConfession(message) {
  if (!confessResponse) return;

  confessResponse.hidden = false;
  confessResponse.textContent = message;
  confessResponse.scrollIntoView({
    behavior: reduceMotionEnabled() ? "auto" : "smooth",
    block: "nearest"
  });
}

$("#answerYes")?.addEventListener("click", () => {
  showConfession(
    "wkwk, oke. berarti kita mulai dari hal sederhana aja. cerita random, saling dengerin, dan nggak perlu pura-pura jadi orang lain. makasih udah jawab jujur. ♡"
  );

  playTone(560, 0.12);
  setTimeout(() => playTone(680, 0.16), 100);

  const celebration = $("#celebrationLayer");
  celebration?.classList.add("active");

  setTimeout(() => {
    celebration?.classList.remove("active");
  }, 1600);

  if (typeof confetti === "function" && !reduceMotionEnabled()) {
    confetti({
      particleCount: 65,
      spread: 65,
      startVelocity: 25,
      gravity: 0.85,
      colors: ["#ffffff", "#bdbdbd", "#777777", "#e8e8e8"],
      origin: { y: 0.65 }
    });
  }
});

$("#answerMaybe")?.addEventListener("click", () => {
  showConfession(
    "aman, nggak perlu buru-buru. hal yang nyaman nggak harus diputusin dalam lima detik. ambil waktumu, nggak ada timer di sini."
  );

  playTone(330, 0.1);
});

/* =========================================
   06. QUIZ GAME
========================================= */

// Sesuaikan jawaban di bawah dengan dirimu sendiri.
// Nilai correct adalah indeks jawaban yang dianggap benar.

const quizQuestions = [
  {
    question: "kalau lagi capek, aku paling pengen...",
    options: [
      "rebahan dulu, urusan dunia nanti",
      "jalan-jalan cari angin",
      "main game sebentar",
      "ngobrol sama seseorang"
    ],
    correct: 0,
    explanation: "kadang recharge terbaik ya berhenti sebentar."
  },
  {
    question: "obrolan yang paling asyik itu...",
    options: [
      "yang isinya debat terus",
      "yang natural dan nggak dipaksain",
      "yang cuma satu kata",
      "yang bahas tugas tiap waktu"
    ],
    correct: 1,
    explanation: "nggak harus punya topik hebat buat ngobrol."
  },
  {
    question: "kalau punya waktu luang, enaknya...",
    options: [
      "panik karena nggak produktif",
      "mikirin semua masalah sekaligus",
      "lakuin sesuatu yang disuka",
      "buka kulkas setiap dua menit"
    ],
    correct: 2,
    explanation: "waktu luang juga boleh dinikmati."
  },
  {
    question: "kalau ada salah paham, yang paling masuk akal...",
    options: [
      "langsung ngilang",
      "nebak-nebak sendiri",
      "bikin status kode",
      "ngobrol baik-baik"
    ],
    correct: 3,
    explanation: "komunikasi jelas biasanya lebih membantu daripada tebak-tebakan."
  },
  {
    question: "hal kecil yang bikin hari lebih baik...",
    options: [
      "istirahat cukup",
      "selalu menang debat",
      "nggak pernah salah",
      "punya 100 notifikasi"
    ],
    correct: 0,
    explanation: "nggak perlu hal besar buat mulai merasa lebih baik."
  }
];

let quizIndex = 0;
let quizScore = 0;
let quizSelected = false;
let quizFinished = false;

function renderQuiz() {
  const question = quizQuestions[quizIndex];

  if (!question) return;

  $("#quizProgress").textContent =
    `QUESTION ${String(quizIndex + 1).padStart(2, "0")} / ${String(quizQuestions.length).padStart(2, "0")}`;

  $("#quizScore").textContent = `SCORE: ${quizScore}`;
  $("#quizProgressBar").style.width =
    `${((quizIndex + 1) / quizQuestions.length) * 100}%`;

  $("#quizQuestion").textContent = question.question;
  $("#quizFeedback").textContent = "";
  $("#quizNext").disabled = true;
  $("#quizNext").textContent = quizIndex === quizQuestions.length - 1
    ? "lihat hasil ↗"
    : "lanjut ↗";

  const options = $("#quizOptions");
  options.replaceChildren();

  question.options.forEach((option, index) => {
    const button = document.createElement("button");
    button.className = "quiz-option";
    button.type = "button";

    const letter = document.createElement("span");
    letter.className = "option-letter";
    letter.textContent = String.fromCharCode(65 + index);

    const text = document.createElement("span");
    text.textContent = option;

    button.append(letter, text);

    button.addEventListener("click", () => {
      if (quizSelected || quizFinished) return;

      quizSelected = true;
      const correct = index === question.correct;

      if (correct) {
        quizScore++;
        button.classList.add("correct");
        $("#quizFeedback").textContent = `yep, bener. ${question.explanation}`;
        playTone(580, 0.09);
      } else {
        button.classList.add("selected");
        $("#quizFeedback").textContent =
          `belum tepat, tapi santai. ${question.explanation}`;

        const correctButton = options.children[question.correct];
        correctButton?.classList.add("correct");
        playTone(260, 0.1);
      }

      [...options.children].forEach((item) => {
        item.disabled = true;
      });

      $("#quizScore").textContent = `SCORE: ${quizScore}`;
      $("#quizNext").disabled = false;
    });

    options.appendChild(button);
  });
}

function finishQuiz() {
  quizFinished = true;

  const percentage = Math.round(
    (quizScore / quizQuestions.length) * 100
  );

  $("#quizProgress").textContent = "QUIZ COMPLETE";
  $("#quizProgressBar").style.width = "100%";
  $("#quizQuestion").textContent =
    percentage >= 80
      ? "eh, lumayan kenal juga."
      : percentage >= 40
        ? "masih ada beberapa hal buat dikenali."
        : "waktunya ngobrol lebih banyak, mungkin.";

  $("#quizOptions").replaceChildren();

  const feedback = $("#quizFeedback");
  feedback.textContent =
    `skor kamu ${quizScore}/${quizQuestions.length} (${percentage}%). ini cuma mini quiz, bukan ujian kelayakan jadi manusia.`;

  $("#quizNext").disabled = false;
  $("#quizNext").textContent = "main lagi ↻";
  $("#quizNext").dataset.restart = "true";
}

$("#quizNext")?.addEventListener("click", () => {
  if (quizFinished || $("#quizNext").dataset.restart === "true") {
    quizIndex = 0;
    quizScore = 0;
    quizSelected = false;
    quizFinished = false;
    delete $("#quizNext").dataset.restart;
    renderQuiz();
    return;
  }

  if (!quizSelected) return;

  if (quizIndex < quizQuestions.length - 1) {
    quizIndex++;
    quizSelected = false;
    renderQuiz();
  } else {
    finishQuiz();
  }
});

renderQuiz();

/* =========================================
   07. MEMORY MATCH
========================================= */

const memorySymbols = [
  "♡", "∞", "✧", "☾",
  "✳", "◇", "⌁", "☆"
];

let memoryDeck = [];
let memoryFirst = null;
let memoryLocked = false;
let memoryMoves = 0;
let memoryMatches = 0;
let memoryStartedAt = 0;
let memoryClock = null;

function resetMemoryGame() {
  clearInterval(memoryClock);

  memoryDeck = shuffle([...memorySymbols, ...memorySymbols]).map(
    (symbol, index) => ({
      id: index,
      symbol,
      revealed: false,
      matched: false
    })
  );

  memoryFirst = null;
  memoryLocked = false;
  memoryMoves = 0;
  memoryMatches = 0;
  memoryStartedAt = 0;

  $("#memoryMoves").textContent = "0";
  $("#memoryPairs").textContent = `0 / ${memorySymbols.length}`;
  $("#memoryTime").textContent = "00:00";
  $("#memoryMessage").textContent =
    "coba buka dua kartu. siapa tahu jodohnya ketemu duluan.";

  renderMemoryCards();
}

function renderMemoryCards() {
  const grid = $("#memoryGrid");
  if (!grid) return;

  if (!memoryDeck.length) {
    resetMemoryGame();
    return;
  }

  grid.replaceChildren();

  memoryDeck.forEach((card) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "memory-card";

    if (card.revealed) button.classList.add("revealed");
    if (card.matched) button.classList.add("matched");

    button.textContent = card.symbol;
    button.setAttribute(
      "aria-label",
      card.revealed || card.matched ? card.symbol : "kartu tertutup"
    );

    button.disabled = card.matched || memoryLocked;

    button.addEventListener("click", () => {
      flipMemoryCard(card.id);
    });

    grid.appendChild(button);
  });
}

function startMemoryClock() {
  if (memoryClock) return;

  memoryStartedAt = Date.now();

  memoryClock = setInterval(() => {
    const seconds = Math.floor((Date.now() - memoryStartedAt) / 1000);
    $("#memoryTime").textContent = formatTime(seconds);
  }, 1000);
}

function flipMemoryCard(id) {
  if (memoryLocked) return;

  const card = memoryDeck.find((item) => item.id === id);

  if (!card || card.revealed || card.matched) return;

  startMemoryClock();

  card.revealed = true;
  playTone(420, 0.06);

  if (!memoryFirst) {
    memoryFirst = card;
    renderMemoryCards();
    return;
  }

  memoryMoves++;
  $("#memoryMoves").textContent = String(memoryMoves);

  const first = memoryFirst;
  memoryFirst = null;

  if (first.symbol === card.symbol) {
    first.matched = true;
    card.matched = true;
    memoryMatches++;

    $("#memoryPairs").textContent =
      `${memoryMatches} / ${memorySymbols.length}`;

    $("#memoryMessage").textContent =
      randomItem([
        "pasangannya ketemu. chemistry kartu ini lebih jelas daripada chat yang cuma dibales 'wkwk'.",
        "nice, dua kartu resmi jadian.",
        "cocok! lanjut cari pasangan berikutnya.",
        "otak kamu lagi kerja dengan baik."
      ]);

    playTone(620, 0.12);
    renderMemoryCards();

    if (memoryMatches === memorySymbols.length) {
      clearInterval(memoryClock);
      memoryClock = null;

      const totalSeconds = Math.floor(
        (Date.now() - memoryStartedAt) / 1000
      );

      $("#memoryMessage").textContent =
        `selesai dalam ${formatTime(totalSeconds)} dengan ${memoryMoves} langkah. kartu-kartu ini akhirnya menemukan rumahnya.`;

      showToast("memory game selesai. mantap.");
    }

    return;
  }

  memoryLocked = true;
  renderMemoryCards();

  $("#memoryMessage").textContent =
    randomItem([
      "belum jodoh. kasih mereka waktu dua detik.",
      "beda pasangan. cinta memang penuh plot twist.",
      "hampir, tapi belum. coba inget posisinya."
    ]);

  setTimeout(() => {
    first.revealed = false;
    card.revealed = false;
    memoryLocked = false;
    renderMemoryCards();
  }, 850);
}

$("#restartMemory")?.addEventListener("click", resetMemoryGame);
resetMemoryGame();

/* =========================================
   08. SECRET WORD
========================================= */

// Kata target menggunakan lima huruf.
// Untuk mengganti jawaban, sesuaikan kata dan petunjuknya.

const wordBank = [
  { word: "SENJA", hint: "waktu langit mulai berubah warna." },
  { word: "CERIA", hint: "suasana hati yang penuh semangat." },
  { word: "TENANG", hint: "enam huruf, terlalu panjang untuk game lima kotak." },
  { word: "RINDU", hint: "perasaan ketika ingin bertemu atau ngobrol dengan seseorang." },
  { word: "MANIS", hint: "bisa soal rasa, bisa juga cara seseorang bersikap." },
  { word: "SALAM", hint: "ucapan singkat untuk menyapa." },
  { word: "TULUS", hint: "melakukan sesuatu tanpa pura-pura." },
  { word: "SENYUM", hint: "enam huruf juga. game ini lima huruf, jadi bukan jawabannya." },
  { word: "DAMAI", hint: "keadaan tanpa pertengkaran." },
  { word: "AKRAB", hint: "hubungan yang dekat dan nyaman." },
  { word: "KISAH", hint: "cerita tentang sesuatu yang terjadi." },
  { word: "MIMPI", hint: "sesuatu yang muncul saat tidur, atau sesuatu yang ingin diwujudkan." },
  { word: "HUMOR", hint: "sesuatu yang bikin orang ketawa." },
  { word: "HADIR", hint: "datang atau berada di suatu tempat." }
