// ==UserScript==
// @name         Dark/Light Theme Toggle for Work time report
// @namespace    https://compassplus.com/
// @version      26M11D25-v4
// @description  Добавляет переключатель тёмной/светлой темы в правый верхний угол и запоминает выбор
// @author       VKK
// @match        https://helpdesk.compassluxe.com/pa-reports-new/report/
// @updateURL    https://github.com/DendriveVlad/CPJobTimeCalc/raw/main/DarkTheme.user.js
// @downloadURL  https://github.com/DendriveVlad/CPJobTimeCalc/raw/main/DarkTheme.user.js
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    // Ключ, под которым хранится выбор пользователя
    const STORAGE_KEY = 'DT_theme';

    // --- Цвета тёмной темы ---
    const DARK_THEME_CSS = `
        html.theme-dark,
        html.theme-dark body {
            background-color: #1e1e1e !important;
            color: #d4d4d4 !important;
        }

        /* Фон ячеек/блоков, у которых задан свой цвет */
        html.theme-dark table,
        html.theme-dark th,
        html.theme-dark td:not(.Work):not(.Weekend),
        html.theme-dark .panel,
        html.theme-dark .content,
        html.theme-dark .main {
            background-color: #252526 !important;
        }

        html.theme-dark th {
            background-color: #333 !important;
            color: #e6e6e6 !important;
        }

        /* --- Сетки и рамки --- */
        html.theme-dark table,
        html.theme-dark td,
        html.theme-dark th {
            border-color: #3c3c3c !important;
        }

        /* --- Текст --- */
        html.theme-dark,
        html.theme-dark body,
        html.theme-dark td,
        html.theme-dark th,
        html.theme-dark div,
        html.theme-dark span,
        html.theme-dark p,
        html.theme-dark li,
        html.theme-dark label,
        html.theme-dark a {
            color: #d4d4d4 !important;
        }

        html.theme-dark a {
            color: #4f9cd9 !important;
        }

        html.theme-dark h1,
        html.theme-dark h2,
        html.theme-dark h3,
        html.theme-dark h4,
        html.theme-dark h5,
        html.theme-dark h6 {
            color: #e6e6e6 !important;
        }

        /* --- Формы --- */
        html.theme-dark input,
        html.theme-dark select,
        html.theme-dark textarea,
        html.theme-dark button:not(#theme-toggle-btn) {
            background-color: #252526 !important;
            color: #d4d4d4 !important;
            border-color: #3c3c3c !important;
        }

        html.theme-dark button:hover:not(#theme-toggle-btn),
        html.theme-dark input[type="submit"]:hover {
            background-color: #333 !important;
        }
        
        /* Выделение текста */
        html.theme-dark ::selection {
            color: #ffffff;
            background: #365a80;
        }
        
        /* Диалог настроек JobTimeCalc */
        html.theme-dark dialog {
            color: #d4d4d4 !important;
            background: #252526 !important;
            border: 1px solid #555 !important;
        }
        
        html.theme-dark dialog input,
        html.theme-dark dialog select,
        html.theme-dark dialog textarea,
        html.theme-dark dialog button {
            background-color: #333 !important;
            color: #e6e6e6 !important;
            border: 1px solid #555 !important;
        }
        
        html.theme-dark dialog button:hover,
        html.theme-dark dialog select:hover,
        html.theme-dark dialog select:focus {
            background-color: #404040 !important;
            border-color: #777 !important;
        }
        
        html.theme-dark dialog::backdrop {
            background-color: rgba(0, 0, 0, 0.6) !important;
        }
        
        html.theme-dark td[style*="color: #000099" i] {
            color: #4f9cd9 !important;
        } 
        
        html.theme-dark td[style*="color: #ff0000" i] {
            color: #F27055 !important;
        }
        
        html.theme-dark span[style*="color: #27ae60;" i] {
            color: #0E820A !important;
        }
        
        html.theme-dark span[style*="color: #2980b9;" i] {
            color: #2980b9 !important;
        }
        
        /* --- Цвета календарной таблицы --- */

        /* Обычные рабочие ячейки: вход и выход */
        html.theme-dark #report2 td.Work > div:nth-child(-n+2) {
            background-color: #30343b !important;
            color: #d4d4d4 !important;
        }
        
        /* Рабочее время и расчётное время */
        html.theme-dark #report2 td.Work > div:nth-child(n+3) {
            background-color: #294333 !important;
            color: #d4e8d8 !important;
        }
        
        /* Выходные дни */
        html.theme-dark #report2 td.Weekend > div {
            background-color: #4a3035 !important;
            color: #eadada !important;
        }
    `;

    let styleEl = null;

    function applyTheme(theme) {
        if (theme === 'dark') {
            if (!styleEl) {
                styleEl = document.createElement('style');
                styleEl.id = 'work-time-report-dark-theme';
                styleEl.textContent = DARK_THEME_CSS;
                document.head.appendChild(styleEl);
            }
            document.documentElement.classList.add('theme-dark');
            document.documentElement.setAttribute('data-theme', 'dark');
        } else {
            if (styleEl) {
                styleEl.remove();
                styleEl = null;
            }
            document.documentElement.classList.remove('theme-dark');
            document.documentElement.removeAttribute('data-theme');
        }
        try {
            localStorage.setItem(STORAGE_KEY, theme);
        } catch (e) {
            console.warn('Не удалось сохранить тему:', e);
        }
    }

    function getSavedTheme() {
        try {
            return localStorage.getItem(STORAGE_KEY) || 'light';
        } catch (e) {
            return 'light';
        }
    }

    // --- Создаём переключатель в правом верхнем углу ---
    function createToggle() {
        if (document.getElementById('theme-toggle-btn')) {
            return document.getElementById('theme-toggle-btn');
        }

        const btn = document.createElement('button');
        btn.id = 'theme-toggle-btn';
        btn.type = 'button';
        btn.style.cssText = [
            'position: fixed',
            'top: 12px',
            'right: 12px',
            'z-index: 2147483647',
            'padding: 8px 14px',
            'border: 1px solid #3c3c3c',
            'border-radius: 6px',
            'cursor: pointer',
            'font: 13px/1.2 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            'box-shadow: 0 2px 8px rgba(0,0,0,0.25)',
            'transition: background 0.2s, color 0.2s',
            'user-select: none'
        ].join(';');

        // Текст/иконка зависят от текущей темы
        function updateLabel() {
            const isDark = document.documentElement.classList.contains('theme-dark');
            btn.textContent = isDark ? '🌙' : '☀️';
            btn.style.backgroundColor = isDark ? '#333' : '#f5f5f5';
            btn.style.color = isDark ? '#e6e6e6' : '#333';
        }

        btn.addEventListener('click', () => {
            const isDark = document.documentElement.classList.contains('theme-dark');
            applyTheme(isDark ? 'light' : 'dark');
            updateLabel();
        });

        // Помещаем переключатель в отдельный контейнер,
        // чтобы не нарушать поиск последнего div в jobTimeCalc
        const host = document.createElement('div');
        host.id = 'dark-theme-host';

        host.appendChild(btn);
        document.body.appendChild(host);

        updateLabel();
        return btn;
    }

    // Применяем сохранённую тему после загрузки DOM
    function init() {
        const saved = getSavedTheme();
        if (saved === 'dark') {
            applyTheme('dark');
        }
        createToggle();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();