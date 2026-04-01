// ==UserScript==
// @name         JobTimeCalc
// @namespace    http://tampermonkey.net/
// @version      26M4D01-beta-v1
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
        workBlock = document.querySelector('body > div:nth-child(4) > div:nth-child(2)');
        if (workBlock === null) {
            console.warn('JobTimeCalc: Cannot find the Time Control Block');
            return false;
        }

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
            let rs = getDayInfo("https://isdayoff.ru/today?pre=1");
            if (rs === 100) {
                console.warn('JobTimeCalc: Incorrect Data');
            }
            if (!jsCurDayWorkTime.NoHolidays && (rs === null || rs === 100) && currentDay in [0, 6]) {
                isHoliday = true
            } else {
                if (!jsCurDayWorkTime.NoHolidays) {
                    isHoliday = rs === 1;
                }
                isShortDay = rs === 2;
            }
        } catch (error) {
            console.warn("JobTimeCalc: " + error);
            if (!jsCurDayWorkTime.NoHolidays && currentDay in [0, 6]) {
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
        if (localStorage.getItem("JTC_IsTestingModeEnabled") !== '1') {
            alert("In Dev...");
            return;
        }
        function createDataDialog() {
            // Создаем диалоговое окно
            const dialog = document.createElement('dialog');
            dialog.id = 'dataDialog';

            // Создаем форму внутри диалога
            const form = document.createElement('form');
            form.method = 'dialog';
            form.className = 'dialog-form';

            // Заголовок
            const title = document.createElement('h3');
            title.style.margin = '0 0 15px 0';
            title.style.color = '#6e0000';
            title.textContent = 'Ввод дополнительных данных';
            form.appendChild(title);

            // Создаем поля для ввода
            const fields = [
                { id: 'data1', label: 'Данные 1:' },
                { id: 'data2', label: 'Данные 2:' },
                { id: 'data3', label: 'Данные 3:' },
                { id: 'data4', label: 'Данные 4:' }
            ];

            fields.forEach(field => {
                const group = document.createElement('div');
                group.className = 'form-group';
                group.style.marginBottom = '15px';

                const label = document.createElement('label');
                label.htmlFor = field.id;
                label.textContent = field.label;
                label.style.display = 'inline-block';
                label.style.width = '100px';
                label.style.marginRight = '10px';
                label.style.fontWeight = 'bold';

                const input = document.createElement('input');
                input.type = 'text';
                input.id = field.id;
                input.name = field.id;
                input.placeholder = 'Поле для заполнения';
                input.style.padding = '5px';
                input.style.width = '200px';
                input.style.border = '1px solid #ccc';

                group.appendChild(label);
                group.appendChild(input);
                form.appendChild(group);
            });

            // Создаем группу для чекбокса
            const checkboxGroup = document.createElement('div');
            checkboxGroup.className = 'form-group checkbox-group';
            checkboxGroup.style.marginBottom = '15px';
            checkboxGroup.style.display = 'flex';
            checkboxGroup.style.alignItems = 'center';

            const checkboxLabel = document.createElement('label');
            checkboxLabel.htmlFor = 'mySwitch';
            checkboxLabel.textContent = 'Переключатель:';
            checkboxLabel.style.display = 'inline-block';
            checkboxLabel.style.width = '100px';
            checkboxLabel.style.marginRight = '10px';
            checkboxLabel.style.fontWeight = 'bold';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = 'mySwitch';
            checkbox.name = 'mySwitch';
            checkbox.checked = true;

            const checkboxTextLabel = document.createElement('label');
            checkboxTextLabel.htmlFor = 'mySwitch';
            checkboxTextLabel.textContent = 'чек-бокс с галочкой';
            checkboxTextLabel.style.marginLeft = '5px';
            checkboxTextLabel.style.fontWeight = 'normal';

            checkboxGroup.appendChild(checkboxLabel);
            checkboxGroup.appendChild(checkbox);
            checkboxGroup.appendChild(checkboxTextLabel);
            form.appendChild(checkboxGroup);

            // Создаем контейнер для кнопок
            const buttonGroup = document.createElement('div');
            buttonGroup.style.textAlign = 'right';
            buttonGroup.style.marginTop = '20px';

            // Кнопка "Отмена"
            const cancelButton = document.createElement('button');
            cancelButton.type = 'button';
            cancelButton.textContent = 'Отмена';
            cancelButton.style.padding = '5px 15px';
            cancelButton.style.marginLeft = '10px';
            cancelButton.style.fontSize = '11px';
            cancelButton.style.cursor = 'pointer';
            cancelButton.style.border = '1px solid #6e0000';
            cancelButton.style.backgroundColor = '#f0f0f0';
            cancelButton.onclick = function() {
                // Анимация кнопки Отмена
                cancelButton.style.transform = 'scale(0.95)';
                cancelButton.style.backgroundColor = '#ff6b6b';
                cancelButton.style.color = 'white';
                cancelButton.style.borderColor = '#ff4757';

                setTimeout(() => {
                    cancelButton.style.transform = 'scale(1)';
                }, 100);

                // Закрываем диалог с анимацией
                dialog.classList.add('dialog-hide');

                // Даем время на анимацию перед закрытием
                setTimeout(() => {
                    dialog.close();
                    // Не удаляем класс здесь, удалим в обработчике close
                }, 200);
            };

            // Кнопка "OK" с анимацией
            const okButton = document.createElement('button');
            okButton.type = 'submit';
            okButton.value = 'submit';
            okButton.innerHTML = '✓ OK';  // Добавляем галочку
            okButton.style.padding = '5px 15px';
            okButton.style.marginLeft = '10px';
            okButton.style.fontSize = '11px';
            okButton.style.cursor = 'pointer';
            okButton.style.border = '1px solid #6e0000';
            okButton.style.backgroundColor = '#f0f0f0';
            okButton.style.transition = 'all 0.2s ease';

            // Эффект при наведении
            okButton.addEventListener('mouseenter', () => {
                okButton.style.backgroundColor = '#4CAF50';
                okButton.style.color = 'white';
                okButton.style.borderColor = '#45a049';
                okButton.style.transform = 'scale(1.05)';
            });

            okButton.addEventListener('mouseleave', () => {
                okButton.style.backgroundColor = '#f0f0f0';
                okButton.style.color = 'black';
                okButton.style.borderColor = '#6e0000';
                okButton.style.transform = 'scale(1)';
            });

            // Эффект при нажатии
            okButton.addEventListener('mousedown', () => {
                okButton.style.transform = 'scale(0.95)';
            });

            okButton.addEventListener('mouseup', () => {
                okButton.style.transform = 'scale(1.05)';
            });

            okButton.addEventListener('click', (e) => {
                // Не закрываем сразу, даем время на анимацию
                e.preventDefault(); // Предотвращаем немедленное закрытие

                // Анимация кнопки OK
                okButton.style.transform = 'scale(0.95)';
                okButton.style.backgroundColor = '#4CAF50';

                setTimeout(() => {
                    okButton.style.transform = 'scale(1)';
                }, 100);

                // Плавно скрываем диалог
                dialog.classList.add('dialog-hide');

                // Через 200мс отправляем форму и закрываем
                setTimeout(() => {
                    // Программно отправляем форму
                    const form = dialog.querySelector('form');
                    if (form) {
                        form.dispatchEvent(new Event('submit'));
                    }
                    dialog.close('submit');
                }, 200);
            });

            buttonGroup.appendChild(cancelButton);
            buttonGroup.appendChild(okButton);
            form.appendChild(buttonGroup);

            dialog.appendChild(form);

            // Добавляем созданные элементы на страницу
            const container = document.querySelector('body > div:last-child');
            if (container) {
                container.appendChild(dialog);
            }

            return { dialog };
        }

        // Функция для добавления стилей
        function addDialogStyles() {
            const style = document.createElement('style');
            style.textContent = `
            /* Анимация появления */
            @keyframes fadeInScale {
                0% {
                    opacity: 0;
                    transform: scale(0.7);
                }
                100% {
                    opacity: 1;
                    transform: scale(1);
                }
            }
            
            /* Анимация исчезновения */
            @keyframes fadeOutScale {
                0% {
                    opacity: 1;
                    transform: scale(1);
                }
                100% {
                    opacity: 0;
                    transform: scale(0.7);
                }
            }
            
            dialog {
                padding: 20px;
                border-radius: 8px;
                border: 1px solid #6e0000;
                box-shadow: 0 4px 10px rgba(0,0,0,0.2);
                font-family: Trebuchet MS, Tahoma, Verdana, Arial, sans-serif;
                font-size: 11px;
                /* Убираем transition, используем animation */
            }
            
            dialog::backdrop {
                background-color: rgba(0, 0, 0, 0);
                transition: background-color 0.3s ease;
            }
            
            dialog[open]::backdrop {
                background-color: rgba(0, 0, 0, 0.5);
            }
            
            /* Класс для анимации появления */
            dialog.dialog-show {
                animation: fadeInScale 0.3s ease forwards;
            }
            
            /* Класс для анимации закрытия */
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
            
            .dialog-form input[type="text"] {
                transition: border-color 0.2s ease, box-shadow 0.2s ease;
            }
            
            .dialog-form input[type="text"]:hover,
            .dialog-form input[type="text"]:focus {
                border-color: #6e0000;
                box-shadow: 0 0 5px rgba(110, 0, 0, 0.3);
                outline: none;
            }
            
            .dialog-form button {
                transition: all 0.2s ease;
            }
            
            .dialog-form button:hover {
                background-color: #e0e0e0;
                transform: scale(1.05);
            }
            
            .dialog-form button:active {
                transform: scale(0.95);
            }
        `;
            document.head.appendChild(style);
        }

        // Функция для инициализации обработчиков событий
        function initDialogEvents(dialog) {
            // Открываем модальное окно при клике на кнопку
            // Очищаем поля при открытии
            document.getElementById('data1').value = '';
            document.getElementById('data2').value = '';
            document.getElementById('data3').value = '';
            document.getElementById('data4').value = '';
            document.getElementById('mySwitch').checked = true;

            // Показываем с анимацией
            dialog.classList.add('dialog-show');
            dialog.showModal();
            setTimeout(() => {
                dialog.classList.remove('dialog-show');
            }, 300);

            // Переопределяем стандартное закрытие по ESC
            dialog.addEventListener('cancel', (e) => {
                e.preventDefault(); // Отменяем стандартное закрытие

                // Плавно скрываем
                dialog.classList.add('dialog-hide');
                setTimeout(() => {
                    dialog.close();
                    dialog.classList.remove('dialog-hide');
                }, 200);
            });

            // Обрабатываем событие закрытия диалога
            dialog.addEventListener('close', () => {
                if (dialog.returnValue === 'submit') {
                    // Собираем данные из полей
                    const data1 = document.getElementById('data1').value;
                    const data2 = document.getElementById('data2').value;
                    const data3 = document.getElementById('data3').value;
                    const data4 = document.getElementById('data4').value;
                    const mySwitch = document.getElementById('mySwitch').checked;

                    // Выводим в консоль
                    console.log('=== Данные из формы ===');
                    console.log('Данные 1:', data1 || '(не заполнено)');
                    console.log('Данные 2:', data2 || '(не заполнено)');
                    console.log('Данные 3:', data3 || '(не заполнено)');
                    console.log('Данные 4:', data4 || '(не заполнено)');
                    console.log('Переключатель:', mySwitch ? 'включен' : 'выключен');
                    console.log('=======================');

                    const formData = {
                        data1: data1 || null,
                        data2: data2 || null,
                        data3: data3 || null,
                        data4: data4 || null,
                        switch: mySwitch
                    };
                    console.log('Объект с данными:', formData);
                }

                // Убираем классы анимации после закрытия
                dialog.classList.remove('dialog-hide');
            });
        }

        initialize();

        function initialize() {
            // Добавляем стили
            addDialogStyles();

            // Создаем элементы диалога
            const { dialog } = createDataDialog();

            // Инициализируем обработчики событий
            initDialogEvents(dialog);
            // Анимация для иконки домика
            const homeIcon = document.querySelector('img[src="./images/house.png"]');
            if (homeIcon) {
                homeIcon.style.transition = 'transform 0.2s ease, filter 0.2s ease';

                homeIcon.addEventListener('mouseenter', () => {
                    homeIcon.style.transform = 'scale(1.1) rotate(-5deg)';
                    homeIcon.style.filter = 'brightness(1.2)';
                });

                homeIcon.addEventListener('mouseleave', () => {
                    homeIcon.style.transform = 'scale(1) rotate(0deg)';
                    homeIcon.style.filter = 'brightness(1)';
                });

                homeIcon.addEventListener('click', (e) => {
                    e.preventDefault();
                    homeIcon.style.transform = 'scale(0.9) rotate(-10deg)';
                    setTimeout(() => {
                        homeIcon.style.transform = 'scale(1) rotate(0deg)';
                        window.location.href = '';
                    }, 200);
                });
            }
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
            }
            return await response.text();
        } catch (error) {
            console.warn("JobTimeCalc: Cannot get access to " + url + "\n" + error);
            return null;
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', main);
    } else {
        main();
    }
})();