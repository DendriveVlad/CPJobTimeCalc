// ==UserScript==
// @name         workPercentageFix
// @namespace    http://tampermonkey.net/
// @version      26M9D30-v1
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
        const workBlock = document.querySelector('body > div:nth-child(4) > div:nth-child(2) > table');
        const realTime = workBlock.getElementsByClassName("current")[0].getElementsByTagName("td")[3].textContent;
        const fixTime = workBlock.getElementsByClassName("current")[0].getElementsByTagName("td")[4].textContent;

        let tempTimeList = realTime.split(":").map(Number);
        const realSeconds = tempTimeList[0] * 60 * 60 + tempTimeList[1] * 60 + tempTimeList[2];
        tempTimeList = fixTime.split(":").map(Number);
        const fixSeconds = tempTimeList[0] * 60 * 60 + tempTimeList[1] * 60 + tempTimeList[2];
        const timeLeft = realSeconds - fixSeconds;
        // if (fixSeconds === 0) {
        //     document.getElementsByClassName("current")[0].getElementsByTagName("td")[3].textContent = "0%";
        // } else document.getElementsByClassName("current")[0].getElementsByTagName("td")[3].textContent = Math.floor(100 / (realSeconds / fixSeconds)) + "%";
        const logLastTitle = workBlock.getElementsByTagName("thead")[0].getElementsByTagName("tr")[0].appendChild(document.createElement("th"));
        const logLast = workBlock.getElementsByClassName("current")[0].appendChild(document.createElement("th"));
        logLast.style.background = "#fff"
        logLast.style.fontWeight = "unset";
        logLast.align = "center";
        if (timeLeft > 0)
            logLastTitle.textContent = "Осталось залогировать";
        else if (timeLeft === 0) {
            logLastTitle.textContent = "Логировать ничего не надо";
            logLast.textContent = ":)"
            return;
        } else
            logLastTitle.textContent = "Залогировано лишнего";


        const columnsCount = workBlock.getElementsByTagName("thead")[0].getElementsByTagName("tr")[0].childElementCount;
        for (let i = 1; i < columnsCount - 1; i++) {
            workBlock.getElementsByTagName("thead")[0].getElementsByTagName("tr")[0].getElementsByTagName("th")[i].width = "";
        }

        if (timeLeft > 0)
            logLast.textContent += Math.floor(timeLeft / 28800) + "d " + Math.floor((timeLeft % 28800) / 3600) + "h " + Math.floor(((timeLeft % 28800) % 3600) / 60) + "m";
        else
            logLast.textContent += Math.floor(Math.abs(timeLeft) / 28800) + "d " + Math.floor((Math.abs(timeLeft) % 28800) / 3600) + "h " + Math.floor(((Math.abs(timeLeft) % 28800) % 3600) / 60) + "m";
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