var app = (function() {
    /* --------------------------------------------------------------------------------------------------
    Variables
    ---------------------------------------------------------------------------------------------------*/
    var keyboard = document.querySelector("#keyboard");
    var rows = document.querySelectorAll(".row");
	var modal = document.querySelector("aside");
    var activeRow = 0;
    var wordList = ["Abart", "Abbau", "Abend", "Abgas", "Abort", "Abruf", "Abtei", "abtun", "Abzug", "Achse", "Acker", "Acryl", "Adieu", "Adler", "adlig", "affig", "affin", "After", "Agave", "Agent", "Ahorn", "Aktie", "aktiv", "Alarm", "Album", "Alias", "Alibi", "Alien", "Allah", "Allee", "Alles", "Alpen", "Alpha", "Altar", "Alter", "Altöl", "Amigo", "Amöbe", "Ampel", "Amsel", "Anbau", "anbei", "Anden", "Angel", "Angst", "Anker", "Anmut", "Anode", "Anruf", "antik", "antun", "Anzug", "Aorta", "Apell", "Apfel", "April", "Arche", "Areal", "Arena", "Armee", "Armut", "Aroma", "Arsch", "artig", "Asien", "Asket", "Aspik", "Assel", "Athen", "Atlas", "atmen", "Atoll", "Audio", "Autor", "Axiom", "Backe", "baden", "banal", "Bande", "bange", "Banjo", "Bares", "Barke", "Baron", "Basar", "Bauch", "bauen", "Bauer", "Beben", "Beere", "Beete", "Beide", "Beige", "Beine", "Belag", "Beleg", "Beruf", "Besen", "Beste", "beten", "Beuge", "Beule", "Beute", "bevor", "Bezug", "Bibel", "Biber", "Biene", "Biere", "Biest", "Binde", "Bingo", "Birke", "Birne", "Bison", "Bitte", "Blank", "Blase", "Blech", "Blick", "blind", "Blitz", "blöde", "Blond", "Blüte", "Blume", "Bluse", "Boden", "Bogen", "Bohne", "Bombe", "Bowle", "Brand", "Braue", "Braun", "Braut", "Bravo", "breit", "Brett", "Brief", "Brise", "Bruch", "Buche", "Bucht", "Bügel", "Bürde", "Büste", "Bulle", "Busch", "Busen", "Capri", "Cello", "Chaos", "Chaot", "Chile", "Chili", "China", "Chips", "Chlor", "circa", "Clown", "Comic", "Couch", "Creme", "Curry", "Dabei", "Dachs", "Dämon", "Dafür", "Daher", "dahin", "Damit", "Dampf", "Danke", "daran", "Darin", "darum", "Datei", "Daten", "Dativ", "Datum", "Dauer", "Davon", "Davor", "debil", "Debüt", "Decke", "Degen", "Deich", "Dekan", "Dekor", "Delle", "Delta", "Demut", "Depot", "devot", "Dicht", "Dicke", "Dildo", "Disco", "Docht", "Dogge", "Dogma", "Dolch", "Döner", "Dosis", "Draht", "Drall", "Drama", "Drang", "Dreck", "Drift", "Droge", "Druck", "Dübel", "Duell", "Dürre", "Duett", "dumpf", "Dunst", "Durch", "Durst", "duzen", "Ebene", "ebnen", "Ebola", "Echse", "eckig", "Effet", "ehren", "Eiche", "Eifer", "eilig", "Eimer", "einig", "Eisen", "eisig", "eitel", "Eiter", "ekeln", "eklig", "Elend", "emsig", "enden", "Engel", "Enkel", "enorm", "Enzym", "erben", "Erbse", "erdig", "Erdöl", "Erlös", "Ernst", "Ernte", "Erpel", "Esche", "Essay", "Essen", "Essig", "Etage", "Ethik", "Etwas", "Euter", "Event", "exakt", "Extra", "Pferd", "Insel", "Knopf", "Hafer", "Feuer"];
    var solution = wordList[getRndInteger(0, wordList.length - 1)].toLowerCase();
    console.log(solution);
    console.log(wordList.length);

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

        if (event.target.textContent === "back") {
            if (!letters[i - 1]) {
                return;
            }
            letters[i - 1].textContent = "";
        }

        else if (event.target.textContent === "enter") {
            if (i === letters.length) {
                checkSolution(letters);
            }
        }

        else if (i < letters.length && event.target.classList.contains('key')) {
            letters[i].textContent = event.target.textContent;
        }
    }

    function checkSolution(letters) {
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

        colorizeKeyboard(letters);
		hasEnded();
    }

    function colorizeKeyboard(letters) {
        var i, j, keys;
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
		var correctLetters;
		
		correctLetters = rows[activeRow].querySelectorAll(".correct");
		if (correctLetters.length === 5) {
			modal.textContent = "Yay, gewonnen!";
			modal.classList.toggle("hidden");
		}
		else {
			activeRow++;
		}
		
		if (activeRow === 6) {
			modal.textContent = "Leider verloren. Gesucht wurde '"+solution.toUpperCase()+"'.";
			modal.classList.toggle("hidden");
		}
	}


    function init() {
        document.addEventListener("touchstart", function() {}, false);
        keyboard.addEventListener("click", typeKey, false);
    }

    /* --------------------------------------------------------------------------------------------------
    public members, exposed with return statement
    ---------------------------------------------------------------------------------------------------*/
    return {
        init: init
    };

})();

app.init();
