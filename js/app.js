var app = (function() {
    /* --------------------------------------------------------------------------------------------------
    Variables
    ---------------------------------------------------------------------------------------------------*/
    var keyboard = document.querySelector("#keyboard");
    var backKey = document.querySelectorAll(".input")[0];
    var enterKey = document.querySelectorAll(".input")[1];
    var rows = document.querySelectorAll(".row");
    var activeRow = 0;

    /* --------------------------------------------------------------------------------------------------
    functions
    ---------------------------------------------------------------------------------------------------*/
    function typeKey() {
        var letters = rows[activeRow].querySelectorAll(".letter");
        var i = 0;

        while (i < letters.length && letters[i].textContent !== "") {
            i++;
        }

        console.log(i);

        if (event.target.textContent === "back") {
            if (!letters[i-1]) {
                return;
            }
            letters[i-1].textContent = "";
        }

        else if (event.target.textContent === "enter") {
            if (i === letters.length) {
                console.log("word complete");
                // Here will be the function call for evaluation of the word.
            }
        }

        else if (i < letters.length && event.target.classList.contains('key')) {
            letters[i].textContent = event.target.textContent;
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
