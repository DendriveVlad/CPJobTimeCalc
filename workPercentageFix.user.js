// ==UserScript==
// @name         workPercentageFix
// @namespace    http://tampermonkey.net/
// @version      25M7D22-v5
// @description  Fixing percentage screen in report
// @author       VP
// @match        https://helpdesk.compassluxe.com/pa-reports-new/report/
// @updateURL    https://raw.githubusercontent.com/DendriveVlad/CPJobTimeCalc/main/workPercentageFix.user.js
// @downloadURL  https://raw.githubusercontent.com/DendriveVlad/CPJobTimeCalc/main/workPercentageFix.user.js
// @icon         https://www.google.com/s2/favicons?sz=64&domain=tampermonkey.net
// @grant        none
// ==/UserScript==

function runScript() {
    if (document.getElementById("Отчет по зафиксированным трудозатратам").checked) {
        const realTime = document.getElementsByClassName("current")[0].getElementsByTagName("td")[1].textContent;
        const fixTime = document.getElementsByClassName("current")[0].getElementsByTagName("td")[2].textContent;

        let tempTimeList = realTime.split(":").map(Number);
        const realSeconds = tempTimeList[0] * 60 * 60 + tempTimeList[1] * 60 + tempTimeList[2];
        tempTimeList = fixTime.split(":").map(Number);
        const fixSeconds = tempTimeList[0] * 60 * 60 + tempTimeList[1] * 60 + tempTimeList[2];
        const timeLeft = realSeconds - fixSeconds;
        if (fixSeconds === 0) {
            document.getElementsByClassName("current")[0].getElementsByTagName("td")[3].textContent = "0%";
        } else document.getElementsByClassName("current")[0].getElementsByTagName("td")[3].textContent = Math.floor(100 / (realSeconds / fixSeconds)) + "%";
        if (timeLeft > 0)
            document.getElementsByClassName("current")[0].getElementsByTagName("td")[3].textContent += " Log left: " + Math.floor(timeLeft / 28800) + "d " + Math.floor((timeLeft % 28800) / 3600) + "h " + Math.floor(((timeLeft % 28800) % 3600) / 60) + "m";
        else 
            document.getElementsByClassName("current")[0].getElementsByTagName("td")[3].textContent += " Loged excess: " + Math.floor(Math.abs(timeLeft) / 28800) + "d " + Math.floor((Math.abs(timeLeft) % 28800) / 3600) + "h " + Math.floor(((Math.abs(timeLeft) % 28800) % 3600) / 60) + "m";
    }
}

// Запускаем сразу (если контент уже загружен)
runScript();

// Наблюдаем за изменениями в DOM
const observer = new MutationObserver(function(mutations) {
    runScript();
});

observer.observe(document.body, {
    childList: true,    // Наблюдаем за добавлением/удалением элементов
    subtree: true       // Проверяем все вложенные элементы
});