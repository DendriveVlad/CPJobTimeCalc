// ==UserScript==
// @name         JobTimeCalc
// @namespace    http://tampermonkey.net/
// @version      26M10D7-v4
// @description  Calculating time to end of work day
// @author       VKK
// @match        https://helpdesk.compassluxe.com/pa-reports-new/report/
// @updateURL    https://raw.githubusercontent.com/DendriveVlad/CPJobTimeCalc/main/jobTimeCalc.user.js
// @downloadURL  https://raw.githubusercontent.com/DendriveVlad/CPJobTimeCalc/main/jobTimeCalc.user.js
// @icon         https://www.google.com/s2/favicons?sz=64&domain=tampermonkey.net
// @grant
// ==/UserScript==
(function () {
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
        "minutes": 0,
        "AllowShortDay": false,
        "NoHolidays": true
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

    function collect_analytics() {
        // analyze_delta_fix();
    }

    function clean_analytics() {
        let analytics = {
            "JTC_AnalyzeFixedTime": 1
        };  // if key == 1: should be cleaned
        let key;
        if (localStorage.getItem("JTC_DisableCollectStats") === "1") {
            for (key in analytics) {
                localStorage.removeItem(key);
            }
            return;
        }
        for (key in analytics) {
            if (analytics[key] === 1) {
                localStorage.removeItem(key);
            }
        }
    }

    // analyze
    function analyze_delta_fix() {
        // Не работает из-за обновлённой системы подсчёта времени при выходи
        const raw_data = localStorage.getItem("JTC_AnalyzeFixedTime");
        const data = raw_data !== null ? JSON.parse(raw_data) : {};

        const current_date = (new Date()).toLocaleDateString('ru', {
            day: '2-digit',
            month: '2-digit',
            year: '2-digit'
        });
        const current_time = (new Date()).toLocaleTimeString('ru', {
            hour: '2-digit',
            minute: '2-digit'
        });

        if (data[current_date] === undefined) {
            data[current_date] = {}
        }

        if (data[current_date][current_time] !== undefined) {
            return;
        }

        const FixDelta = {
            "hours": 0,
            "minutes": 0,
            "seconds": 0
        }

        FixDelta.seconds = jsRealFixedTime.seconds - jsFixedTime.seconds;
        if (FixDelta.seconds < 0) {
            FixDelta.minutes--;
            FixDelta.seconds = 60 + FixDelta.seconds;
        }
        FixDelta.minutes = jsRealFixedTime.minutes - jsFixedTime.minutes + FixDelta.minutes;
        if (FixDelta.minutes < 0) {
            FixDelta.hours--;
            FixDelta.minutes = 60 + FixDelta.minutes;
        }
        FixDelta.hours = jsRealFixedTime.hours - jsFixedTime.hours + FixDelta.hours;

        data[current_date][current_time] = {
            "PortalFix": fixedTime.textContent,
            "RealFix": `${jsRealFixedTime.hours < 10 ? "0" : ""}${jsRealFixedTime.hours}:${jsRealFixedTime.minutes < 10 ? "0" : ""}${jsRealFixedTime.minutes}:${jsRealFixedTime.seconds < 10 ? "0" : ""}${jsRealFixedTime.seconds}`,
            "FixDelta": `${FixDelta.hours < 10 ? "0" : ""}${FixDelta.hours}:${FixDelta.minutes < 10 ? "0" : ""}${FixDelta.minutes}:${FixDelta.seconds < 10 ? "0" : ""}${FixDelta.seconds}`
        }
        localStorage.setItem("JTC_AnalyzeFixedTime", JSON.stringify(data));
        // JSON.parse(localStorage.getItem("JTC_AnalyzeFixedTime"))
    }

    function showLoadingSpinner() {
        // Если уже есть — не добавляем повторно
        if (document.getElementById("JTC_Loader")) return;

        // Создаём стили
        const style = document.createElement("style");
        style.id = "JTC_LoaderStyles";
        style.textContent = `
        @keyframes JTC_Spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        #JTC_Loader {
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 99999;
            transition: opacity 0.3s;
        }
        #JTC_Loader .loader {
            border: 5px solid #f3f3f3;
            border-top: 5px solid #3498db;
            border-radius: 50%;
            width: 15px;
            height: 15px;
            animation: JTC_Spin 1.2s linear infinite;
        }`;
        workBlock.appendChild(style);

        // Создаём элемент
        const loader = document.createElement("div");
        loader.id = "JTC_Loader";
        loader.innerHTML = '<div class="loader"></div>';
        workBlock.appendChild(loader);
    }

    function removeLoadingSpinner() {
        const el = document.getElementById("JTC_Loader");
        if (el) {
            el.style.opacity = "0";
            setTimeout(() => {
                el.remove();
            }, 100);
        }
    }

    async function main() {
        // Main function of the script
        try {
            if (!await initBlocks() || !await initParams()) {
                console.error('JobTimeCalc: Run Error; Stopping execution');
                return;
            }
            prepareBlocks();
            isHoliday ? calcHoliday() : calcWorkDay();
            removeLoadingSpinner();
            setupTimeBlock();
            // To disable collecting any statistic use in console: localStorage.setItem("JTC_DisableCollectStats", "1")
            if (localStorage.getItem("JTC_DisableCollectStats") !== "1") {
                collect_analytics();
            }
            clean_analytics();
        } catch (e) {
            console.error('JobTimeCalc: Unexcepted error: ' + e);
        }
    }

    async function initBlocks() {
        // initializing html blocs vars
        workBlock = document.querySelector('body > div:nth-child(4) > div:nth-child(2)');
        if (workBlock === null) {
            console.warn('JobTimeCalc: Cannot find the Time Control Block');
            return false;
        }
        showLoadingSpinner();
        enterTime = workBlock.querySelector('div:nth-child(1) > span:nth-child(2)');
        if (enterTime === null) {
            console.warn('JobTimeCalc: Cannot find First enter Time');
            return false;
        }

        const lastExitTime = workBlock.querySelector('div:nth-child(2) > span:nth-child(2)');
        if (lastExitTime === null) {
            console.warn('JobTimeCalc: Cannot find Last Exit Time');
        } else {
            wasExit = lastExitTime.textContent !== "00:00:00";
        }

        overTime = document.getElementsByClassName("userRow")[0].getElementsByTagName("td")[7];
        if (overTime === null) {
            console.warn('JobTimeCalc: Cannot find Over Time Block');
        }

        fixedTime = workBlock.querySelector('div:nth-child(4) > span:nth-child(2)');
        if (fixedTime === null) {
            console.warn('JobTimeCalc: Cannot find Fix Time');
        }
        return true
    }

    async function initParams() {
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
                "Settings": {
                    "AllowShortDay": true,
                    "NoHolidays": false
                }
            }));

            localDayTimeSettings = JSON.parse(localStorage.getItem("JTC_DailyTimeSettings"));
        }
        jsCurDayWorkTime.hours = localDayTimeSettings[currentDay]["hours"];
        jsCurDayWorkTime.minutes = localDayTimeSettings[currentDay]["minutes"];
        jsCurDayWorkTime.AllowShortDay = localDayTimeSettings["Settings"]["AllowShortDay"];
        jsCurDayWorkTime.NoHolidays = localDayTimeSettings["Settings"]["NoHolidays"];

        let needUpdate = false;
        for (let param in jsCurDayWorkTime) {
            if (jsCurDayWorkTime[param] === undefined) {
                localDayTimeSettings["Settings"][param] = false;
                needUpdate = true;
            }
        }
        if (needUpdate) {
            localStorage.setItem("JTC_DailyTimeSettings", JSON.stringify(localDayTimeSettings));
        }

        if (jsCurDayWorkTime.hours === 0 && jsCurDayWorkTime.minutes === 0) {
            isHoliday = true;
        } else try {
            let rs = await getDayInfo("https://isdayoff.ru/today?pre=1");

            if (rs === '100') {
                console.warn('JobTimeCalc: Incorrect Data');
            }
            if (!jsCurDayWorkTime.NoHolidays && (rs === null || rs === '100') && [0, 6].includes(currentDay)) {
                isHoliday = true
            } else {
                if (!jsCurDayWorkTime.NoHolidays) {
                    isHoliday = rs === '1';
                }
                isShortDay = rs === '2';
            }
        } catch (error) {
            console.warn("JobTimeCalc: " + error);
            if (!jsCurDayWorkTime.NoHolidays && [0, 6].includes(currentDay)) {
                isHoliday = true;
            }
        }

        if (isShortDay && jsCurDayWorkTime.AllowShortDay) {
            jsCurDayWorkTime.hours--;
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

        let curTimeInSeconds = Math.floor(Date.now() / 1000) % (24 * 60 * 60);
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

        if (wasExit) {
            // Сохраняем последнее зафиксированное время, чтобы часы показывали одно значение даже после обновления страницы
            // Если время сохранено и совпадает с тем, что на портале — используем его, иначе сохраняем новое
            let savedTime;
            if (sessionStorage.getItem("JTC_LastFixedTime") !== null) {
                savedTime = JSON.parse(sessionStorage.getItem("JTC_LastFixedTime"));
                if (savedTime.PortalJSON !== undefined && savedTime.Portal !== fixedTime.textContent) {

                    async function getJSONTime(t1, t2) {
                        let t = {
                            "hours": t1.hours - t2.hours,
                            "minutes": t1.minutes - t2.minutes,
                            "seconds": t1.seconds - t2.seconds
                        }
                        if (t.seconds < 0) {
                            t.seconds += 60;
                            t.minutes--;
                        }
                        if (t.minutes < 0) {
                            t.minutes += 60;
                            t.hours--;
                        }
                        return t;
                    }

                    let t = await getJSONTime(savedTime.Real, savedTime.PortalJSON);
                    let oldTimeDif = t.seconds + t.minutes * 60 + t.hours * 3600;
                    t = await getJSONTime(jsRealFixedTime, jsFixedTime);
                    let newTimeDif = t.seconds + t.minutes * 60 + t.hours * 3600;
                    if (Math.abs(oldTimeDif - newTimeDif) < 120 && oldTimeDif > newTimeDif) {
                        console.warn("oldDif: " + oldTimeDif + "\nnewDif: " + newTimeDif + "\ndifOfDif: " + (oldTimeDif - newTimeDif));
                        savedTime.Portal = "";
                    }
                }
            } else {
                savedTime = {
                    "Portal": "",
                    "PortalJSON": {},
                    "Real": {},
                };
            }
            if (savedTime.PortalJSON === undefined || savedTime.Portal === "") {
                savedTime.Portal = fixedTime.textContent;
                savedTime.PortalJSON = jsFixedTime;
                savedTime.Real = jsRealFixedTime;
                sessionStorage.setItem("JTC_LastFixedTime", JSON.stringify(savedTime));
            } else {
                jsRealFixedTime.hours = savedTime.Real.hours;
                jsRealFixedTime.minutes = savedTime.Real.minutes;
                jsRealFixedTime.seconds = savedTime.Real.seconds;
                jsFixedTime.hours = savedTime.PortalJSON.hours;
                jsFixedTime.minutes = savedTime.PortalJSON.minutes;
                jsFixedTime.seconds = savedTime.PortalJSON.seconds;
            }
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
        if (!isHoliday && !(jsOverTime.hours === 0 && jsOverTime.minutes === 0 && jsOverTime.seconds === 0) || !(jsTimeOut.hours === 0 && jsTimeOut.minutes === 0 && jsTimeOut.seconds === 0)) {
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
        let checkTomorrowSet = false;
        if (wasExit) {
            /// * Минимальное отклонение от реального времени 0 минут 0 секунд, а максимальное 1 минут 59 секунд
            let lTimeWentOut = {  // Difference between expected time and fixed time
                "hours": jsRealFixedTime.hours - jsFixedTime.hours,
                "minutes": jsRealFixedTime.minutes - jsFixedTime.minutes,
                "seconds": jsRealFixedTime.seconds - jsFixedTime.seconds
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
                checkTomorrowSet = true;
                jsTimeOut.hours %= 24;
            }
            // jsTimeOut.postfix = " (Погрешность -2 минуты)"
            // jsTimeOut.prefix = "~"
        } else if (jsTimeOut.hours >= 24) {
            isTomorrow = true;
            checkTomorrowSet = true;
            jsTimeOut.hours %= 24;
        }
        if (isTomorrow && !checkTomorrowSet) {
            isTomorrow = false;
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
            if (jsCurDayWorkTime.hours >= 4 && !isTomorrow &&
                (jsTimeOut.hours - jsEnterTime.hours < 4 || jsTimeOut.hours - jsEnterTime.hours === 4 && (jsTimeOut.minutes < jsEnterTime.minutes || jsTimeOut.minutes === jsEnterTime.minutes && jsTimeOut.seconds < jsEnterTime.seconds))) {
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
        const DAYS = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];

        function loadWeekSettings() {
            let settings;
            try {
                settings = JSON.parse(localStorage.getItem('JTC_DailyTimeSettings'));
            } catch (e) {
                settings = null;
            }
            if (!settings || typeof settings !== 'object') settings = {};

            const days = {};
            for (let i = 0; i < 7; i++) {
                // i — порядок в UI: 0=Пн ... 6=Вс; в хранилище 0=Вс ... 6=Сб
                const d = settings[String((i + 1) % 7)];
                let hours = 0, minutes = 0;
                if (d && Number.isInteger(d.hours) && Number.isInteger(d.minutes)) {
                    hours = Math.min(23, Math.max(0, d.hours));
                    minutes = Math.min(59, Math.max(0, d.minutes));
                }
                days[i] = { hours, minutes };
            }

            const s = settings.Settings || {};
            const zd = Number.isInteger(s.ZDType) ? Math.min(4, Math.max(0, s.ZDType)) : 0;

            return {
                days,
                allowShortDay: !!s.AllowShortDay,
                noHolidays: !!s.NoHolidays,
                zdType: zd
            };
        }

        function buildWeekSettings(days, allowShortDay, noHolidays, zdType) {
            const obj = {};
            for (let i = 0; i < 7; i++) {
                obj[String((i + 1) % 7)] = { hours: days[i].hours, minutes: days[i].minutes };
            }
            obj['Settings'] = { AllowShortDay: allowShortDay, NoHolidays: noHolidays, ZDType: zdType };
            return obj;
        }

        function setDayTimes(days, map) {
            for (let i = 0; i < 7; i++) {
                const t = map[i];
                days[i] = { hours: t ? t[0] : 0, minutes: t ? t[1] : 0 };
            }
        }

        // --- Пресеты ---
        let PRESETS
        if (localStorage.getItem("JTC_IsTestingModeEnabled") === '1') {
            PRESETS = [
                { label: 'По умолчанию', applyZDType: false, zdType: 0,  allowShortDay: true,  noHolidays: false, apply: (days) => setDayTimes(days, { 0: [8, 15], 1: [8, 15], 2: [8, 15], 3: [8, 15], 4: [7, 0] }) },
                { label: '100%',          applyZDType: false, zdType: 0,  allowShortDay: false, noHolidays: false, apply: (days) => setDayTimes(days, { 0: [8, 0], 1: [8, 0], 2: [8, 0], 3: [8, 0], 4: [8, 0] }) },
                { label: '75%',           applyZDType: false, zdType: 0,  allowShortDay: false, noHolidays: false, apply: (days) => setDayTimes(days, { 0: [6, 0], 1: [6, 0], 2: [6, 0], 3: [6, 0], 4: [6, 0] }) },
                { label: '50%',           applyZDType: false, zdType: 0,  allowShortDay: false, noHolidays: false, apply: (days) => setDayTimes(days, { 0: [4, 0], 1: [4, 0], 2: [4, 0], 3: [4, 0], 4: [4, 0] }) },
                { label: '25%',           applyZDType: false, zdType: 0,  allowShortDay: false, noHolidays: false, apply: (days) => setDayTimes(days, { 0: [2, 0], 1: [2, 0], 2: [2, 0], 3: [2, 0], 4: [2, 0] }) },
                { label: '2/2 Вар1',      applyZDType: true,  zdType: 1, allowShortDay: false, noHolidays: true, apply: (days) => setDayTimes(days, { 0: [12, 0], 1: [12, 0], 4: [12, 0], 5: [12, 0] }) },
                { label: '2/2 Вар2',      applyZDType: true,  zdType: 2, allowShortDay: false, noHolidays: true, apply: (days) => setDayTimes(days, { 1: [12, 0], 2: [12, 0], 5: [12, 0], 6: [12, 0] }) },
                { label: '2/2 Вар3',      applyZDType: true,  zdType: 3, allowShortDay: false, noHolidays: true, apply: (days) => setDayTimes(days, { 2: [12, 0], 3: [12, 0], 6: [12, 0] }) },
                { label: '2/2 Вар4',      applyZDType: true,  zdType: 4, allowShortDay: false, noHolidays: true, apply: (days) => setDayTimes(days, { 0: [12, 0], 3: [12, 0], 4: [12, 0] }) },
                { label: '6/1',           applyZDType: false, zdType: 0, allowShortDay: false, noHolidays: false, apply: (days) => setDayTimes(days, { 0: [8, 0], 1: [8, 0], 2: [8, 0], 3: [8, 0], 4: [8, 0], 5: [8, 0] }) },
                { label: '6/1 над 5/2',   applyZDType: false, zdType: 0, allowShortDay: false, noHolidays: false, apply: (days) => setDayTimes(days, { 0: [6, 0], 1: [6, 0], 2: [6, 0], 3: [6, 0], 4: [6, 0], 5: [4, 0] }) },
                { label: 'Безумее',       applyZDType: false, zdType: 0, allowShortDay: false, noHolidays: false, apply: (days) => { for (let i = 0; i < 7; i++) days[i] = { hours: 8, minutes: 0 }; } },
                { label: 'Безумее над 5/2', applyZDType: false, zdType: 0, allowShortDay: false, noHolidays: false, apply: (days) => { for (let i = 0; i < 7; i++) days[i] = { hours: 5, minutes: 0 }; } },
                { label: 'Смерть 💀',     applyZDType: false, zdType: 0, allowShortDay: false, noHolidays: true, apply: (days) => { for (let i = 0; i < 7; i++) days[i] = { hours: 23, minutes: 59 }; } }
            ];
        } else {
            PRESETS = [
                { label: 'По умолчанию', applyZDType: false, zdType: 0,  allowShortDay: true,  noHolidays: false, apply: (days) => setDayTimes(days, { 0: [8, 15], 1: [8, 15], 2: [8, 15], 3: [8, 15], 4: [7, 0] }) },
                { label: '100%',          applyZDType: false, zdType: 0,  allowShortDay: false, noHolidays: false, apply: (days) => setDayTimes(days, { 0: [8, 0], 1: [8, 0], 2: [8, 0], 3: [8, 0], 4: [8, 0] }) },
                { label: '75%',           applyZDType: false, zdType: 0,  allowShortDay: false, noHolidays: false, apply: (days) => setDayTimes(days, { 0: [6, 0], 1: [6, 0], 2: [6, 0], 3: [6, 0], 4: [6, 0] }) },
                { label: '50%',           applyZDType: false, zdType: 0,  allowShortDay: false, noHolidays: false, apply: (days) => setDayTimes(days, { 0: [4, 0], 1: [4, 0], 2: [4, 0], 3: [4, 0], 4: [4, 0] }) },
                { label: '25%',           applyZDType: false, zdType: 0,  allowShortDay: false, noHolidays: false, apply: (days) => setDayTimes(days, { 0: [2, 0], 1: [2, 0], 2: [2, 0], 3: [2, 0], 4: [2, 0] }) },
                { label: '6/1',           applyZDType: false, zdType: 0, allowShortDay: false, noHolidays: false, apply: (days) => setDayTimes(days, { 0: [8, 0], 1: [8, 0], 2: [8, 0], 3: [8, 0], 4: [8, 0], 5: [8, 0] }) },
                { label: '6/1 над 5/2',   applyZDType: false, zdType: 0, allowShortDay: false, noHolidays: false, apply: (days) => setDayTimes(days, { 0: [6, 0], 1: [6, 0], 2: [6, 0], 3: [6, 0], 4: [6, 0], 5: [4, 0] }) },
                { label: 'Безумее',       applyZDType: false, zdType: 0, allowShortDay: false, noHolidays: false, apply: (days) => { for (let i = 0; i < 7; i++) days[i] = { hours: 8, minutes: 0 }; } },
                { label: 'Безумее над 5/2', applyZDType: false, zdType: 0, allowShortDay: false, noHolidays: false, apply: (days) => { for (let i = 0; i < 7; i++) days[i] = { hours: 5, minutes: 0 }; } },
                { label: 'Смерть 💀',     applyZDType: false, zdType: 0, allowShortDay: false, noHolidays: true, apply: (days) => { for (let i = 0; i < 7; i++) days[i] = { hours: 23, minutes: 59 }; } }
            ];
        }


        // --- Создание диалога ---
        function createDataDialog() {
            const dialog = document.createElement('dialog');
            dialog.id = 'dataDialog';

            const form = document.createElement('form');
            form.className = 'dialog-form';

            // Заголовок
            const title = document.createElement('h3');
            title.style.margin = '0 0 15px 0';
            title.style.color = '#6e0000';
            title.textContent = 'Настройка рабочего времени';
            form.appendChild(title);

            // Строка с пресетом
            const presetGroup = document.createElement('div');
            presetGroup.className = 'form-group';
            presetGroup.style.marginBottom = '15px';

            const presetLabel = document.createElement('label');
            presetLabel.htmlFor = 'presetSelect';
            presetLabel.textContent = 'Пресет:';
            presetLabel.style.display = 'inline-block';
            presetLabel.style.width = '120px';
            presetLabel.style.marginRight = '10px';
            presetLabel.style.fontWeight = 'bold';

            const presetSelect = document.createElement('select');
            presetSelect.id = 'presetSelect';
            presetSelect.style.padding = '4px';
            presetSelect.style.border = '1px solid #ccc';
            presetSelect.style.fontFamily = 'inherit';
            presetSelect.style.fontSize = '11px';

            const customOpt = document.createElement('option');
            customOpt.value = 'custom';
            customOpt.textContent = 'Своё';
            presetSelect.appendChild(customOpt);

            PRESETS.forEach((preset, index) => {
                const opt = document.createElement('option');
                opt.value = String(index);
                opt.textContent = preset.label;
                presetSelect.appendChild(opt);
            });

            presetGroup.appendChild(presetLabel);
            presetGroup.appendChild(presetSelect);
            form.appendChild(presetGroup);

            // Строки с днями недели
            const dayRows = []; // каждый элемент: { hours, minutes } — два <select>
            DAYS.forEach((dayName, i) => {
                const group = document.createElement('div');
                group.className = 'form-group';
                group.style.marginBottom = '10px';

                const label = document.createElement('label');
                label.htmlFor = 'dayH' + i;
                label.textContent = dayName + ":";
                label.style.display = 'inline-block';
                label.style.width = '120px';
                label.style.marginRight = '10px';
                label.style.fontWeight = 'bold';

                const makeSelect = (id, max) => {
                    const sel = document.createElement('select');
                    sel.id = id;
                    sel.style.padding = '4px';
                    sel.style.border = '1px solid #ccc';
                    sel.style.fontFamily = 'inherit';
                    sel.style.fontSize = '11px';
                    for (let v = 0; v <= max; v++) {
                        const opt = document.createElement('option');
                        opt.value = v;
                        opt.textContent = String(v).padStart(2, '0');
                        sel.appendChild(opt);
                    }
                    return sel;
                };

                const hours = makeSelect('dayH' + i, 23);
                const minutes = makeSelect('dayM' + i, 59);

                group.appendChild(label);
                group.appendChild(hours);
                group.appendChild(minutes);
                form.appendChild(group);
                dayRows.push({ hours, minutes });
            });

            // Чекбоксы
            function createCheckboxRow(id, labelText, checked) {
                const row = document.createElement('div');
                row.className = 'form-group checkbox-group';
                row.style.marginBottom = '10px';
                row.style.display = 'flex';
                row.style.alignItems = 'center';

                const spacer = document.createElement('span');
                spacer.style.width = '120px';
                spacer.style.marginRight = '10px';
                spacer.style.display = 'inline-block';

                const box = document.createElement('input');
                box.type = 'checkbox';
                box.id = id;
                box.name = id;
                box.checked = checked;

                const boxLabel = document.createElement('label');
                boxLabel.htmlFor = id;
                boxLabel.textContent = labelText;
                boxLabel.style.marginLeft = '5px';
                boxLabel.style.fontWeight = 'normal';
                boxLabel.style.cursor = 'pointer';

                row.appendChild(spacer);
                row.appendChild(box);
                row.appendChild(boxLabel);
                form.appendChild(row);
                return box;
            }

            const shortDayCheck = createCheckboxRow('allowShortDay', 'Учитывать сокращённые дни', true);
            const holidaysCheck = createCheckboxRow('noHolidays', 'Без праздников', true);

            // Кнопки
            const buttonGroup = document.createElement('div');
            buttonGroup.style.textAlign = 'right';
            buttonGroup.style.marginTop = '20px';

            const cancelButton = document.createElement('button');
            cancelButton.type = 'button';
            cancelButton.textContent = '✘ Отмена';
            cancelButton.style.padding = '5px 15px';
            cancelButton.style.marginLeft = '10px';
            cancelButton.style.fontSize = '11px';
            cancelButton.style.cursor = 'pointer';
            cancelButton.style.border = '1px solid #6e0000';
            cancelButton.style.backgroundColor = '#f0f0f0';
            cancelButton.style.color = 'black';
            cancelButton.style.width = '100px';
            cancelButton.style.boxSizing = 'border-box';
            cancelButton.style.textAlign = 'center';

            // Кнопка "Сохранить"
            const saveButton = document.createElement('button');
            saveButton.type = 'button';
            saveButton.textContent = '✓ Сохранить';
            saveButton.style.padding = '5px 15px';
            saveButton.style.marginLeft = '10px';
            saveButton.style.fontSize = '11px';
            saveButton.style.cursor = 'pointer';
            saveButton.style.border = '1px solid #6e0000';
            saveButton.style.backgroundColor = '#f0f0f0';
            saveButton.style.color = 'black';
            saveButton.style.transition = 'all 0.2s ease';
            saveButton.style.width = '100px';
            saveButton.style.boxSizing = 'border-box';
            saveButton.style.textAlign = 'center';

            saveButton.addEventListener('mouseenter', () => {
                saveButton.style.backgroundColor = '#4CAF50';
                saveButton.style.color = 'white';
                saveButton.style.borderColor = '#45a049';
                saveButton.style.transform = 'scale(1.05)';
            });

            saveButton.addEventListener('mouseleave', () => {
                saveButton.style.backgroundColor = '#f0f0f0';
                saveButton.style.color = 'black';
                saveButton.style.borderColor = '#6e0000';
                saveButton.style.transform = 'scale(1)';
            });

            saveButton.addEventListener('mousedown', () => { saveButton.style.transform = 'scale(0.95)'; });
            saveButton.addEventListener('mouseup', () => { saveButton.style.transform = 'scale(1.05)'; });

            // --- Сбор данных из диалога ---
            function collectData() {
                const days = {};
                for (let i = 0; i < 7; i++) {
                    days[i] = {
                        hours: parseInt(dayRows[i].hours.value, 10),
                        minutes: parseInt(dayRows[i].minutes.value, 10)
                    };
                }
                return {
                    days,
                    allowShortDay: shortDayCheck.checked,
                    noHolidays: holidaysCheck.checked,
                    zdType: loadWeekSettings().zdType // ZDType меняется только пресетами
                };
            }

            function closeDialog() {
                cancelButton.style.transform = 'scale(0.95)';
                setTimeout(() => { cancelButton.style.transform = 'scale(1)'; }, 100);
                dialog.classList.add('dialog-hide');
                setTimeout(() => dialog.close(), 200);
            }

            cancelButton.onclick = closeDialog;

            saveButton.onclick = () => {
                saveButton.style.transform = 'scale(0.95)';
                saveButton.style.backgroundColor = '#4CAF50';
                setTimeout(() => { saveButton.style.transform = 'scale(1)'; }, 100);

                const data = collectData();
                jsCurDayWorkTime.AllowShortDay = data.allowShortDay;
                jsCurDayWorkTime.NoHolidays = data.noHolidays;
                jsCurDayWorkTime.hours = data.days[currentDay].hours;
                jsCurDayWorkTime.minutes = data.days[currentDay].minutes;
                localStorage.setItem('JTC_DailyTimeSettings', JSON.stringify(buildWeekSettings(
                    data.days, data.allowShortDay, data.noHolidays, data.zdType
                )));
                initParams();
                isHoliday ? calcHoliday() : calcWorkDay();
                setupTimeBlock();

                closeDialog();
            };

            // --- Логика пресетов ---
            function updatePresetSelect(value) {
                if (presetSelect.value !== value) presetSelect.value = value;
            }

            // Применяет пресет, не трогая ZDType у пресетов без applyZDType
            function applyPreset(preset) {
                const data = collectData();
                preset.apply(data.days);

                if (preset.applyZDType) data.zdType = preset.zdType;

                shortDayCheck.checked = preset.allowShortDay;
                holidaysCheck.checked = preset.noHolidays;

                // Перерисовываем поля времени
                for (let i = 0; i < 7; i++) {
                    dayRows[i].hours.value = String(data.days[i].hours);
                    dayRows[i].minutes.value = String(data.days[i].minutes);
                }
                updatePresetSelect(String(PRESETS.indexOf(preset)));
            }

            presetSelect.addEventListener('change', () => {
                if (presetSelect.value === 'custom') return; // "Своё" ничего не меняет
                applyPreset(PRESETS[parseInt(presetSelect.value, 10)]);
            });

            // Любое ручное изменение -> пресет становится "Своё"
            function markCustom() { updatePresetSelect('custom'); }
            dayRows.forEach(row => {
                row.hours.addEventListener('change', markCustom);
                row.minutes.addEventListener('change', markCustom);
            });
            shortDayCheck.addEventListener('change', markCustom);
            holidaysCheck.addEventListener('change', markCustom);

            buttonGroup.appendChild(cancelButton);
            buttonGroup.appendChild(saveButton);
            form.appendChild(buttonGroup);
            dialog.appendChild(form);

            const container = document.querySelector('body > div:last-child');
            if (container) {
                container.appendChild(dialog);
            }

            return { dialog, dayRows, shortDayCheck, holidaysCheck, presetSelect };
        }

        // --- Стили (как в оригинале) ---
        function addDialogStyles() {
            const style = document.createElement('style');
            style.textContent = `
        @keyframes fadeInScale {
            0% { opacity: 0; transform: scale(0.7); }
            100% { opacity: 1; transform: scale(1); }
        }

        @keyframes fadeOutScale {
            0% { opacity: 1; transform: scale(1); }
            100% { opacity: 0; transform: scale(0.7); }
        }

        dialog {
            padding: 20px;
            border-radius: 8px;
            border: 1px solid #6e0000;
            box-shadow: 0 4px 10px rgba(0,0,0,0.2);
            font-family: Trebuchet MS, Tahoma, Verdana, Arial, sans-serif;
            font-size: 11px;
        }

        dialog::backdrop {
            background-color: rgba(0, 0, 0, 0);
            transition: background-color 0.3s ease;
        }

        dialog[open]::backdrop {
            background-color: rgba(0, 0, 0, 0.5);
        }

        dialog.dialog-show {
            animation: fadeInScale 0.3s ease forwards;
        }

        dialog.dialog-hide {
            animation: fadeOutScale 0.2s ease forwards !important;
        }

        #showDataDialog {
            margin-left: 20px;
            padding: 5px 15px;
            font-size: 11px;
            cursor: pointer;
            border: 1px solid #6e0000;
            background-color: #f0f0f0;
            vertical-align: bottom;
            transition: all 0.2s ease;
        }

        #showDataDialog:hover {
            background-color: #e0e0e0;
            transform: scale(1.05);
        }

        #showDataDialog:active {
            transform: scale(0.95);
        }

        .dialog-form select {
            transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }

        .dialog-form select:hover,
        .dialog-form select:focus {
            border-color: #6e0000;
            box-shadow: 0 0 5px rgba(110, 0, 0, 0.3);
            outline: none;
        }

        .dialog-form button {
            transition: all 0.2s ease;
            width: 100px;
            box-sizing: border-box;
            text-align: center;
        }

        .dialog-form button:hover {
            transform: scale(1.05);
        }

        .dialog-form button:active {
            transform: scale(0.95);
        }
        `;
            document.head.appendChild(style);
        }

        // --- События ---
        function initDialogEvents({ dialog, dayRows, shortDayCheck, holidaysCheck, presetSelect }) {
            // Заполняем поля из localStorage
            const stored = loadWeekSettings();
            for (let i = 0; i < 7; i++) {
                dayRows[i].hours.value = String(stored.days[i].hours);
                dayRows[i].minutes.value = String(stored.days[i].minutes);
            }
            shortDayCheck.checked = stored.allowShortDay;
            holidaysCheck.checked = stored.noHolidays;
            presetSelect.value = 'custom'; // «Своё» по умолчанию

            // Показываем с анимацией
            dialog.classList.add('dialog-show');
            dialog.showModal();
            setTimeout(() => {
                dialog.classList.remove('dialog-show');
            }, 300);

            // Переопределяем стандартное закрытие по ESC
            dialog.addEventListener('cancel', (e) => {
                e.preventDefault();

                dialog.classList.add('dialog-hide');
                setTimeout(() => {
                    dialog.close();
                    dialog.classList.remove('dialog-hide');
                }, 200);
            });

            // Обрабатываем закрытие диалога
            dialog.addEventListener('close', () => {
                dialog.classList.remove('dialog-hide', 'dialog-show');
            });
        }

        initialize();

        function initialize() {
            // Добавляем стили
            addDialogStyles();

            // Создаем элементы диалога
            const dialogRef = createDataDialog();

            // Инициализируем обработчики событий и открываем диалог
            initDialogEvents(dialogRef);
        }
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
            } else {
                return response.text();
            }
        } catch (error) {
            console.warn("JobTimeCalc: Cannot get access to " + url + "\n" + error);
            return null;
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            main().catch(e => console.error('Init failed:', e));
        });
    } else {
        main().catch(e => console.error('Init failed:', e));
    }
})();