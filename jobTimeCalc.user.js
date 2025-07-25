// ==UserScript==
// @name         JobTimeCalc
// @namespace    http://tampermonkey.net/
// @version      25M7D24-v2
// @description  Calculating time to end of work day
// @author       VP
// @match        https://helpdesk.compassluxe.com/pa-reports-new/report/
// @updateURL    https://raw.githubusercontent.com/DendriveVlad/CPJobTimeCalc/main/jobTimeCalc.user.js
// @downloadURL  https://raw.githubusercontent.com/DendriveVlad/CPJobTimeCalc/main/jobTimeCalc.user.js
// @icon         https://www.google.com/s2/favicons?sz=64&domain=tampermonkey.net
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    if (!document.getElementById("Сводный отчет").checked)
            return;

    const targetSpan = document.querySelector('body > div:nth-child(3) > div:nth-child(1) > div:nth-child(1) > span:nth-child(2)');
    const targetDiv = document.querySelector('body > div:nth-child(3) > div:nth-child(1)');
    if (!targetSpan) {
        console.info('JobTimeCalc: Элемент не найден!');
        return;
    }
    const origTime = {
        "hours": Number(targetSpan.textContent.split(":")[0]),
        "minutes": Number(targetSpan.textContent.split(":")[1]),
        "seconds": Number(targetSpan.textContent.split(":")[2])
    }
    const timeOut = {
        "hours": 0,
        "minutes": 0,
        "seconds": origTime.seconds,
        "postfix": "",
        "prefix": ""
    };
    let isTomorrow = false;
    if ((new Date(Date.now())).getDay() === 5) { // В пятнице 7 часов
        timeOut.hours = (origTime.hours + 7) % 24;
        timeOut.minutes = origTime.minutes;
        if (origTime.hours + 7 > 23) {
            isTomorrow = true;
        }
    } else if ([0, 6].includes((new Date(Date.now())).getDay())) { // С учётом недоработки, если прийти в выходные
        let lostTime = document.getElementsByClassName("userRow")[0].getElementsByTagName("td")[7].textContent;
        if (!lostTime.includes("-")) {
            timeOut.hours = origTime.hours;
            timeOut.minutes = origTime.minutes;
            timeOut.seconds = origTime.seconds;
        } else {
            lostTime = lostTime.replace("-", "");
            const lostTimeOut = {
                "hours": Number(lostTime.split(":")[0]),
                "minutes": Number(lostTime.split(":")[1]),
                "seconds": Number(lostTime.split(":")[2])
            }
            timeOut.hours = (origTime.hours + lostTimeOut.hours + Math.floor((origTime.minutes + lostTimeOut.minutes + Math.floor((origTime.seconds + lostTimeOut.seconds) / 60)) / 60)) % 24;
            timeOut.minutes = (origTime.minutes + lostTimeOut.minutes + Math.floor((origTime.seconds + lostTimeOut.seconds) / 60)) % 60;
            timeOut.seconds = (origTime.seconds + lostTimeOut.seconds) % 60;
            console.info(origTime.hours + lostTimeOut.hours + Math.floor((origTime.minutes + lostTimeOut.minutes + Math.floor((origTime.seconds + lostTimeOut.seconds) / 60)) / 60));
            if (origTime.hours + lostTimeOut.hours + Math.floor((origTime.minutes + lostTimeOut.minutes + Math.floor((origTime.seconds + lostTimeOut.seconds) / 60)) / 60) > 23) {
                isTomorrow = true;
            }
        }
    } else {
        timeOut.hours = (origTime.hours + 8 + Math.floor((origTime.minutes + 15) / 60)) % 24;
        timeOut.minutes = (origTime.minutes + 15) % 60;
        if ((origTime.hours + 8 + Math.floor((origTime.minutes + 15) / 60)) > 23) {
            isTomorrow = true;
        }
    }

    // Корректировка времени, если выйти из офиса
    if (![0, 6].includes((new Date(Date.now())).getDay()) && document.querySelector('body > div:nth-child(3) > div:nth-child(1) > div:nth-child(2) > span:nth-child(2)').textContent != "00:00:00") {
        const fixedTimeStr = document.querySelector('body > div:nth-child(3) > div:nth-child(1) > div:nth-child(4) > span:nth-child(2)').textContent;
        let tempTimeList = fixedTimeStr.split(":").map(Number);
        const spendSeconds = Math.floor(Date.now() / 1000) % (24 * 60 * 60) - ((tempTimeList[0] + origTime.hours) * 60 * 60 + (tempTimeList[1] + origTime.minutes) * 60 + tempTimeList[2] + origTime.seconds - 18000);
        const diffTime = {
            "hours": Math.floor(spendSeconds / 3600),
            "minutes": Math.floor((spendSeconds % 3600) / 60),
            "seconds": Math.floor((spendSeconds % 3600) % 60)
        }
        timeOut.hours = (timeOut.hours + diffTime.hours + Math.floor((timeOut.minutes + diffTime.minutes + Math.floor((timeOut.seconds + diffTime.seconds) / 60)) / 60)) % 24
        timeOut.minutes = (timeOut.minutes + diffTime.minutes + Math.floor((timeOut.seconds + diffTime.seconds) / 60)) % 60;
        timeOut.seconds = (timeOut.seconds + diffTime.seconds) % 60;
        timeOut.postfix = " (±5 minutes)"
        timeOut.prefix = "~"
    }

    // Настройка новых блоков
    const newBlock = document.createElement('div');
    newBlock.style.display = 'inline-flex';
    newBlock.style.alignItems = 'center';
    const newSpan1 = document.createElement('span');
    newSpan1.textContent = 'Calc time to leave:';
    newSpan1.style.color = '#777';
    newSpan1.style.marginRight = '4px';
    const newSpan2 = document.createElement('span');
    newSpan2.textContent = timeOut.prefix;
    if (timeOut.hours < 10)
        newSpan2.textContent += "0"
    newSpan2.textContent += timeOut.hours + ":"
    if (timeOut.minutes < 10)
        newSpan2.textContent += "0"
    newSpan2.textContent += timeOut.minutes + ":"
    if (timeOut.seconds < 10)
        newSpan2.textContent += "0"
    newSpan2.textContent += timeOut.seconds + timeOut.postfix
    if (isTomorrow) {
        console.info('JobTimeCalc: много работы предстоит!');
        newSpan2.textContent = "Tomorrow in " + newSpan2.textContent
    }
    newSpan2.style.fontWeight = '500';

    // Добавление блоков в HTML
    newBlock.appendChild(newSpan1);
    newBlock.appendChild(newSpan2);
    targetDiv.appendChild(newBlock);
})();