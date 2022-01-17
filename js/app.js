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

        while (letters[i].textContent !== "") {
            i++;
            if (!letters[i]) {
                return;
            }
        }



        if (event.target.classList.contains('key')) {
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
