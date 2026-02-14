// ==UserScript==
// @name         JobTimeCalc
// @namespace    http://tampermonkey.net/
// @version      26M2D14-beta-v1
// @description  Calculating time to end of work day
// @author       VKK
// @match        https://helpdesk.compassluxe.com/pa-reports-new/report/
// @updateURL    https://raw.githubusercontent.com/DendriveVlad/CPJobTimeCalc/main/jobTimeCalc.user.js
// @downloadURL  https://raw.githubusercontent.com/DendriveVlad/CPJobTimeCalc/main/jobTimeCalc.user.js
// @icon         https://www.google.com/s2/favicons?sz=64&domain=tampermonkey.net
// @grant
// ==/UserScript==

// blocks from html
let workBlock;
let enterTime;
let overTime;
let fixedTime;

// new blocks (TO - TimeOut)
let TOBlock;
let TOTitle;
let TOTime;
let TOSettings

// Inner time vars
const jsEnterTime = {
    "hours": 0,
    "minutes": 0,
    "seconds": 0
};
const jsTimeOut = {
    "hours": 0,
    "minutes": 0,
    "seconds": 0,
    "postfix": "",
    "prefix": ""
};
const jsOverTime = {
    "negative": 1,
    "hours": 0,
    "minutes": 0,
    "seconds": 0
};
const jsFixedTime = {
    "hours": 0,
    "minutes": 0,
    "seconds": 0
};
const jsCurDayWorkTime = {
    "hours": 0,
    "minutes": 0
};
const jsRealFixedTime = {
    "hours": 0,
    "minutes": 0,
    "seconds": 0
};

// helping vars
let currentDay;
let isHoliday = false;
let isShortDay = false;
let isTomorrow = false;
let isOverTimeApplied = false;  // time displays using overtime or not
let wasExit = false;
let minimumExceeded = false;


function main() {
    // Main function of the script
    try {
        if (!initBlocks() || !initParams()) {
            console.error('JobTimeCalc: Run Error; Stopping execution');
            return;
        }
        prepareBlocks();
        isHoliday ? calcHoliday() : calcWorkDay();
        setupTimeBlock();
    } catch (e) {
        console.error('JobTimeCalc: Unexcepted error: ' + e);
    }
}

function initBlocks() {
    // initializing html blocs vars
    workBlock = document.querySelector('body > div:nth-child(4) > div:nth-child(1)');
    if (workBlock === null) {
        console.warn('JobTimeCalc: Cannot find the Time Control Block');
        return false;
    }

    enterTime = document.querySelector('body > div:nth-child(4) > div:nth-child(1) > div:nth-child(1) > span:nth-child(2)');
    if (enterTime === null) {
        console.warn('JobTimeCalc: Cannot find First enter Time');
        return false;
    }

    const lastExitTime = document.querySelector('body > div:nth-child(4) > div:nth-child(1) > div:nth-child(2) > span:nth-child(2)');
    if (lastExitTime === null) {
        console.warn('JobTimeCalc: Cannot find Last Exit Time');
    }
    wasExit = lastExitTime.textContent !== "00:00:00";

    overTime = document.getElementsByClassName("userRow")[0].getElementsByTagName("td")[7];
    if (overTime === null) {
        console.warn('JobTimeCalc: Cannot find Over Time Block');
    }

    fixedTime = document.querySelector('body > div:nth-child(4) > div:nth-child(1) > div:nth-child(4) > span:nth-child(2)');
    if (fixedTime === null) {
        console.warn('JobTimeCalc: Cannot find Fix Time');
    }
    return true
}

function initParams() {
    // initializing other vars
    let curDate = (new Date(Date.now()));
    currentDay = curDate.getDay();
    let localDayTimeSettings = JSON.parse(localStorage.getItem("JTC_DailyTimeSettings"));
    if (localDayTimeSettings === null) {
        console.info('JobTimeCalc: Local storage not set up');
        localStorage.setItem("JTC_DailyTimeSettings", JSON.stringify({
                0: {"hours": 0, "minutes": 0},
                1: {"hours": 8, "minutes": 15},
                2: {"hours": 8, "minutes": 15},
                3: {"hours": 8, "minutes": 15},
                4: {"hours": 8, "minutes": 15},
                5: {"hours": 7, "minutes": 0},
                6: {"hours": 0, "minutes": 0},
                "Settings": {"AllowShortDay": false}
            }));

        localDayTimeSettings = JSON.parse(localStorage.getItem("JTC_DailyTimeSettings"));
    }
    jsCurDayWorkTime.hours = localDayTimeSettings[currentDay]["hours"];
    jsCurDayWorkTime.minutes = localDayTimeSettings[currentDay]["minutes"];

    if (jsCurDayWorkTime.hours === 0 && jsCurDayWorkTime.minutes === 0) {
        isHoliday = true;
    } else try {
        let rs = getDayInfo("https://isdayoff.ru/today?pre=1");
        if (rs === 100) {
            console.warn('JobTimeCalc: Incorrect Data');
        }
        if ((rs === null || rs === 100) && currentDay in [0, 6]) {
            isHoliday = true
        } else {
            isHoliday = rs === 1;
            isShortDay = rs === 2; // TODO: Пока что не используется, потому что не всем это актуально
        }
    } catch (error) {
        console.warn("JobTimeCalc: " + error);
        if (currentDay in [0, 6]) {
            isHoliday = true;
        }
    }

    try {
        jsEnterTime.hours = Number(enterTime.textContent.split(":")[0]);
        jsEnterTime.minutes = Number(enterTime.textContent.split(":")[1]);
        jsEnterTime.seconds = Number(enterTime.textContent.split(":")[2]);
    } catch (e) {
        console.warn('JobTimeCalc: Cannot parse enter time' + e);
        return false;
    }

    try {
        if (overTime.style.color === "rgb(255, 0, 0)") {
            jsOverTime.negative = -1;
        }

        jsOverTime.hours = Math.abs(Number(overTime.textContent.split(":")[0]));
        jsOverTime.minutes = Number(overTime.textContent.split(":")[1]);
        jsOverTime.seconds = Number(overTime.textContent.split(":")[2]);
    } catch (e) {
        console.warn('JobTimeCalc: Cannot parse over time\n' + e);
    }

    try {
        jsFixedTime.hours = Number(fixedTime.textContent.split(":")[0]);
        jsFixedTime.minutes = Number(fixedTime.textContent.split(":")[1]);
        jsFixedTime.seconds = Number(fixedTime.textContent.split(":")[2]);
    } catch (e) {
        console.warn('JobTimeCalc: Cannot parse fixed time\n' + e);
        if (wasExit) {
            console.error('JobTimeCalc: Cannot calculate time if there is no fixed time\n');
            return false;
        }
    }

    let curTimeInSeconds =  Math.floor(Date.now() / 1000) % (24 * 60 * 60);
    jsRealFixedTime.hours = (Math.floor(curTimeInSeconds / 60 / 60) + 5) - jsEnterTime.hours;  // ВРЕМЯ В ЕКТ(+5)
    jsRealFixedTime.minutes = Math.floor(curTimeInSeconds / 60 % 60) - jsEnterTime.minutes;
    jsRealFixedTime.seconds = curTimeInSeconds % 60 - jsEnterTime.seconds;
    if (jsRealFixedTime.seconds < 0) {
        jsRealFixedTime.minutes--;
        jsRealFixedTime.seconds += 60;
    }
    if (jsRealFixedTime.minutes < 0) {
        jsRealFixedTime.hours--;
        jsRealFixedTime.minutes += 60;
    }

    return true;
}

function prepareBlocks() {
    TOBlock = document.createElement('div');
        TOBlock.style.display = 'inline-flex';
        TOBlock.style.alignItems = 'center';

    TOTitle = document.createElement('span');
        TOTitle.textContent = 'Calc time to leave:';
        TOTitle.style.color = '#777';
        TOTitle.style.marginRight = '4px';

    TOTime = document.createElement('span');
        TOTime.style.fontWeight = '500';
        if (!isHoliday || (jsTimeOut.hours !== 0 && jsTimeOut.minutes !== 0 && jsTimeOut.seconds !== 0)) {
            TOTime.style.transition = 'background .2718s';
            TOTime.style.borderRadius = '7px';
            setupDefaultMoseEvent(TOTime, recalcTime)
        }

    TOSettings = document.createElement('span');
        TOSettings.textContent = "⚙️";
        TOSettings.title = "Настроить учёт времени";
        TOSettings.style.fontWeight = '500';
        TOSettings.style.transition = 'background .2718s';
        TOSettings.style.borderRadius = '7px';
        setupDefaultMoseEvent(TOSettings, settingsMenu);

    TOBlock.appendChild(TOTitle);
    TOBlock.appendChild(TOTime);
    TOBlock.appendChild(TOSettings);
    workBlock.appendChild(TOBlock);
}

function calcWorkDay() {
    jsTimeOut.seconds = jsEnterTime.seconds;
    jsTimeOut.minutes = (jsEnterTime.minutes + jsCurDayWorkTime.minutes) % 60;
    jsTimeOut.hours = (jsEnterTime.hours + jsCurDayWorkTime.hours + Math.floor((jsEnterTime.minutes + jsCurDayWorkTime.minutes) / 60));
    if (wasExit) {
        /// * Минимальное отклонение от реального времени 11 минут 15 секунд, а максимальное 13 минут 20 секунд (Поэтому Fixed Time + 11:15)
        let lTimeWentOut = {  // Difference between expected time and fixed time
            "hours": jsRealFixedTime.hours - jsFixedTime.hours,
            "minutes": jsRealFixedTime.minutes - jsFixedTime.minutes - 11, // *
            "seconds": jsRealFixedTime.seconds - jsFixedTime.seconds - 15  // *
        }
        if (lTimeWentOut.seconds < 0) {
            lTimeWentOut.seconds += 60;
            lTimeWentOut.minutes--;
        }
        if (lTimeWentOut.minutes < 0) {
            lTimeWentOut.minutes += 60;
            lTimeWentOut.hours--;
        }

        jsTimeOut.hours += lTimeWentOut.hours;
        jsTimeOut.minutes += lTimeWentOut.minutes;
        jsTimeOut.seconds += lTimeWentOut.seconds;
        if (jsTimeOut.seconds >= 60) {
            jsTimeOut.minutes++;
            jsTimeOut.seconds %= 60;
        }
        if (jsTimeOut.minutes >= 60) {
            jsTimeOut.hours++;
            jsTimeOut.minutes %= 60;
        }
        if (jsTimeOut.hours >= 24) {
            isTomorrow = true;
            jsTimeOut.hours %= 24;
        }
        jsTimeOut.postfix = " (Погрешность -2 минуты)"
        jsTimeOut.prefix = "~"
    }
}

function calcHoliday() {
    if (jsOverTime.negative === 1) {
        jsTimeOut.hours += jsEnterTime.hours;
        jsTimeOut.minutes += jsEnterTime.minutes;
        jsTimeOut.seconds += jsEnterTime.seconds;
    } else {
        jsTimeOut.seconds = (jsEnterTime.seconds + jsOverTime.seconds) % 60;
        jsTimeOut.minutes = (jsEnterTime.minutes + jsOverTime.minutes + Math.floor((jsEnterTime.seconds + jsOverTime.seconds) / 60)) % 60;
        jsTimeOut.hours = (jsEnterTime.hours + jsOverTime.hours + Math.floor((jsEnterTime.minutes + jsOverTime.minutes + (jsEnterTime.seconds + jsOverTime.seconds) / 60) / 60));
    }
}

function setupTimeBlock() {
    TOTime.textContent = jsTimeOut.prefix;
    if (jsTimeOut.hours < 10)
        TOTime.textContent += "0"
    TOTime.textContent += jsTimeOut.hours + ":"
    if (jsTimeOut.minutes < 10)
        TOTime.textContent += "0"
    TOTime.textContent += jsTimeOut.minutes + ":"
    if (jsTimeOut.seconds < 10)
        TOTime.textContent += "0"
    TOTime.textContent += jsTimeOut.seconds + jsTimeOut.postfix
    TOTime.title = isOverTimeApplied ? 'Отобразить время без учёта (недо/пере)работки' :
                                       'Отобразить время с учётом (недо/пере)работки';
    if (isTomorrow) {
        console.info('JobTimeCalc: много работы предстоит!');
        TOTime.textContent = "Tomorrow in " + TOTime.textContent
    }
}

function recalcTime() {
    if (minimumExceeded) {
        calcWorkDay();
        minimumExceeded = false;
    } else {
        jsTimeOut.hours += jsOverTime.hours * -1 * jsOverTime.negative * (isOverTimeApplied ? -1 : 1);
        jsTimeOut.minutes += jsOverTime.minutes * -1 * jsOverTime.negative * (isOverTimeApplied ? -1 : 1);
        jsTimeOut.seconds += jsOverTime.seconds * -1 * jsOverTime.negative * (isOverTimeApplied ? -1 : 1);
        if (jsTimeOut.seconds >= 60) {
            jsTimeOut.minutes++;
            jsTimeOut.seconds %= 60;
        } else if (jsTimeOut.seconds < 0) {
            jsTimeOut.minutes--;
            jsTimeOut.seconds += 60;
        }
        if (jsTimeOut.minutes >= 60) {
            jsTimeOut.hours++;
            jsTimeOut.minutes %= 60;
        } else if (jsTimeOut.minutes < 0) {
            jsTimeOut.hours--;
            jsTimeOut.minutes += 60;
        }
        if (jsTimeOut.hours >= 24) {
            isTomorrow = true;
            jsTimeOut.hours %= 24;
        } else if (jsTimeOut.hours < 0) {
            isTomorrow = false;
            jsTimeOut.hours += 24;
        } else {
            isTomorrow = false;
        }
        if (jsCurDayWorkTime.hours >= 4 && !isTomorrow && jsTimeOut.hours - jsEnterTime.hours < 4) {
            jsTimeOut.hours = jsEnterTime.hours + 4;
            jsTimeOut.minutes = jsEnterTime.minutes;
            jsTimeOut.seconds = jsEnterTime.seconds;

            minimumExceeded = true;
        }
    }
    isOverTimeApplied = !isOverTimeApplied;

    setupTimeBlock()
}

function settingsMenu() {
    alert("In Dev...")
}

function setupDefaultMoseEvent(block, clickFunc = null) {
    block.addEventListener("mouseenter", () => {
        block.style.background = "#C7C7C7";
        block.style.cursor = "default";
    });

    block.addEventListener("mouseleave", () => {
        block.style.background = "";
    });

    if (clickFunc !== null) {
        block.addEventListener("click", clickFunc);
    }
}

async function getDayInfo(url, isJson = false) {
    try {
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        if (isJson) {
            return response.json();
        }
        return await response.text();
    } catch (error) {
        console.warn("JobTimeCalc: Cannot get access to " + url + "\n" + error);
        return null;
    }
}

main();
