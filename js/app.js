/* --------------------------------------------------------------------------------------------------
Variables
---------------------------------------------------------------------------------------------------*/
import {
    curatedWords,
    additionalWords
}
from './words.js';

var keyboard = document.querySelector("#keyboard");
var rows = document.querySelectorAll(".row");
var modal = document.querySelector("aside.modal");
var headline = document.querySelector("h1");
var howToIcon = document.querySelector("#howToIcon");
var howTo = document.querySelector("#howTo");
var settingsIcon = document.querySelector("#settingsIcon");
var settings = document.querySelector("#settings");
var wholeWords = document.querySelector("#wholeWords");
wholeWords.checked = JSON.parse(localStorage.getItem("wortsel_wholeWords") || true);
var activeRow = 0;
var enteredWord = "";
var firstVisit = JSON.parse(localStorage.getItem("wortsel_firstVisit") || true);
var wordList = curatedWords.concat(additionalWords);
var solution = curatedWords[getRndInteger(0, curatedWords.length - 1)].toLowerCase();

/* --------------------------------------------------------------------------------------------------
functions
---------------------------------------------------------------------------------------------------*/
function getRndInteger(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function typeKey() {
    var letters, i;

    letters = rows[activeRow].querySelectorAll(".letter");
    i = 0;

    while (i < letters.length && letters[i].textContent !== "") {
        i++;
    }

    // WHEN BACK-BUTTON IS PRESSED
    if (event.target.textContent === "back") {
        if (!letters[i - 1]) {
            return;
        }
        letters[i - 1].textContent = "";
    }

    // WHEN ENTER-BUTTON IS PRESSED
    else if (event.target.textContent === "enter") {
        if (i === letters.length) {
            if (indexInDatabase(letters) === -1 && wholeWords.checked === true) {
                playErrorAnimation();
                showModal("Kein zulässiges Wort", 1000);
            }
            else {
                colorizeRow(letters);
                colorizeKeyboard(letters);
                hasEnded();
            }
        }
        else {
            showModal("Zu wenig Zeichen", 1000);
        }
    }

    // WHEN ANY LETTER IS PRESSED
    else if (i < letters.length && event.target.classList.contains('key')) {
        letters[i].textContent = event.target.textContent;
    }
}

function indexInDatabase(letters) {
    var index;

    enteredWord = [...letters].map(letters => letters.textContent);
    enteredWord = enteredWord.toString();
    enteredWord = enteredWord.replace(/,/g, "");

    index = wordList.findIndex(element => {
        return element.toLowerCase() === enteredWord.toLowerCase();
    });

    return index;
}

function colorizeRow(letters) {
    var i, j, tempSolution;

    i = 0;
    tempSolution = solution.split("");

    for (i = 0; i < letters.length; i++) {
        if (letters[i].textContent === solution[i]) {
            letters[i].classList.add("correct");
            tempSolution[i] = "";
        }
    }

    for (i = 0; i < letters.length; i++) {
        if (!letters[i].classList.contains("correct")) {
            j = tempSolution.indexOf(letters[i].textContent);
            if (j !== -1) {
                letters[i].classList.add("present");
                tempSolution[j] = "";
            }
        }
    }

    for (i = 0; i < letters.length; i++) {
        if (!letters[i].classList.contains("correct") && !letters[i].classList.contains("present")) {
            letters[i].classList.add("absent");
        }
    }
}

function colorizeKeyboard(letters) {
    var i, j, keys, arrkeys;
    i = 0;
    keys = document.querySelectorAll(".key");
    arrkeys = [...keys].map(keys => keys.textContent);

    for (i = 0; i < letters.length; i++) {
        j = arrkeys.indexOf(letters[i].textContent);

        if (letters[i].classList.contains("absent") &&
            !keys[j].classList.contains("correct") &&
            !keys[j].classList.contains("present")) {
            keys[j].classList.add("absent");
        }

        if (letters[i].classList.contains("present") &&
            !keys[j].classList.contains("correct")) {
            keys[j].classList.add("present");
            keys[j].classList.remove("absent");
        }

        if (letters[i].classList.contains("correct")) {
            keys[j].classList.add("correct");
            keys[j].classList.remove("present");
            keys[j].classList.remove("absent");
        }
    }
}

function hasEnded() {
    var correctLetters, winText;
	winText = [
	"Wahnsinn, eine perfekte Runde!",
	"Wow, das war fantastisch!",
	"Ein beachtlicher Sieg!",
	"Sehr gut gemacht!",
	"Yay, gewonnen!",
	"Puh, das war knapp."
	];
    correctLetters = rows[activeRow].querySelectorAll(".correct");

    if (correctLetters.length === 5) {
        showModal(winText[activeRow], 3000);
        playWinAnimation(correctLetters);
    }
    else {
        activeRow++;
    }

    if (activeRow === 6) {
        showModal("Leider verloren. Gesucht wurde '" + solution.toUpperCase() + "'.", 3000);
    }
}

function showModal(text, duration) {
    modal.textContent = text;
    modal.classList.remove("hidden");

    if (duration > 0) {
        setTimeout(function() {
            modal.classList.add("hidden");
        }, duration);
    }
}

function toggleWindow(x) {
	var correctLetters = rows[activeRow].querySelectorAll(".correct");
    if ((activeRow > 0 && activeRow < 6 && correctLetters.length !== 5) && x.id === "settings") {
        showModal("Nicht während des Spiels möglich", 1000);
    }
    else {
        x.classList.toggle("hidden");
    }
}

function playWinAnimation(letters) {
    var i;

    for (i = 0; i < letters.length; i++) {
        letters[i].classList.add("jump");
    }
}

function playErrorAnimation() {
    rows[activeRow].classList.add("shake");
}

function stopAnyAnimation() {
    event.target.classList.remove("jump");
    event.target.classList.remove("shake");
}

function solve() {
    showModal("Die Lösung lautet '" + solution.toUpperCase() + "'.", 2000);
}

function saveSettings() {
    localStorage.setItem("wortsel_firstVisit", JSON.stringify(false));
    localStorage.setItem("wortsel_wholeWords", JSON.stringify(wholeWords.checked));
}

function reset() {
	var i, letters, keys;
	letters = document.querySelectorAll("main .letter");
	keys = document.querySelectorAll(".key");

	for (i = 0; i < letters.length; i++) {
        letters[i].textContent = "";
        letters[i].classList.remove("correct");
		letters[i].classList.remove("present");
		letters[i].classList.remove("absent");
    }
	for (i = 0; i < keys.length; i++) {
        keys[i].classList.remove("correct");
		keys[i].classList.remove("present");
		keys[i].classList.remove("absent");
    }
	solution = curatedWords[getRndInteger(0, curatedWords.length - 1)].toLowerCase();
	activeRow = 0;
	showModal("Neue Runde, neues Glück",1000);
}

function init() {
    if (firstVisit === true) {
        howTo.classList.remove("hidden");
    }
    var gameBoard = document.querySelector("main");

    document.addEventListener("touchstart", function() {}, false);
    gameBoard.addEventListener("animationend", stopAnyAnimation, false);
    keyboard.addEventListener("click", typeKey, false);
	headline.addEventListener("click", reset, false);
    howTo.addEventListener("click", toggleWindow.bind(null, howTo), false);
    howToIcon.addEventListener("click", toggleWindow.bind(null, howTo), false);
    settingsIcon.addEventListener("click", toggleWindow.bind(null, settings), false, false);
    window.addEventListener("unload", saveSettings, false);

    console.log("curated words: " + curatedWords.length);
    console.log("additional words: " + additionalWords.length);
    console.log("altogether: " + wordList.length);
}

/* --------------------------------------------------------------------------------------------------
public members, exposed with window scope
---------------------------------------------------------------------------------------------------*/
window.wortsel = {
   init,
   solve
};

wortsel.init();
