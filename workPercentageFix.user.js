// ==UserScript==
// @name         workPercentageFix
// @namespace    http://tampermonkey.net/
// @version      25M7D22-v1
// @description  Fixing percentage screan in report
// @author       VP
// @match        https://helpdesk.compassluxe.com/pa-reports-new/report/
// @updateURL    https://raw.githubusercontent.com/DendriveVlad/CPJobTimeCalc/main/workPercentageFix.user.js
// @downloadURL  https://raw.githubusercontent.com/DendriveVlad/CPJobTimeCalc/main/workPercentageFix.user.js
// @icon         https://www.google.com/s2/favicons?sz=64&domain=tampermonkey.net
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
    
    if (document.getElementById("Отчет по зафиксированным трудозатратам").checked) {
        const realTime = document.getElementsByClassName("current")[0].getElementsByTagName("td")[1].textContent;
        const fixTime = document.getElementsByClassName("current")[0].getElementsByTagName("td")[2].textContent;

        let tempTimeList = realTime.split(":").map(
            function (strNum) {
                Number(strNum);
            }
        );
        const realSeconds = tempTimeList[0] * 60 * 60 + tempTimeList[1] * 60 + tempTimeList;
        tempTimeList = fixTime.split(":").map(
            function (strNum) {
                Number(strNum);
            }
        );
        const fixSeconds = tempTimeList[0] * 60 * 60 + tempTimeList[1] * 60 + tempTimeList;

        document.getElementsByClassName("current")[0].getElementsByTagName("td")[3].textContent = Math.floor(100 / (realSeconds / fixSeconds)) + "%";
    }
})