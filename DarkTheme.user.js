// ==UserScript==
// @name         Dark/Light Theme Toggle for Work time report
// @namespace    https://compassplus.com/
// @version      26M11D25-v2
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

        /* Все основные контейнеры, таблицы и панели */
        html.theme-dark table,
        html.theme-dark td,
        html.theme-dark th,
        html.theme-dark div,
        html.theme-dark span,
        html.theme-dark p,
        html.theme-dark li,
        html.theme-dark ul,
        html.theme-dark ol,
        html.theme-dark section,
        html.theme-dark article,
        html.theme-dark form,
        html.theme-dark fieldset,
        html.theme-dark header,
        html.theme-dark footer {
            background-color: transparent !important;
        }

        /* Фон ячеек/блоков, у которых задан свой цвет */
        html.theme-dark table,
        html.theme-dark th,
        html.theme-dark td,
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
        html.theme-dark button {
            background-color: #252526 !important;
            color: #d4d4d4 !important;
            border: 1px solid #3c3c3c !important;
        }

        html.theme-dark button:hover,
        html.theme-dark input[type="submit"]:hover {
            background-color: #333 !important;
        }

        /* Затемнение элементов с фоновой картинкой/градиентом */
        html.theme-dark * {
            box-shadow: none !important;
        }
        
        html.theme-dark td[style*="color: #000099" i] {
            color: #4f9cd9 !important;
        } 
        
        html.theme-dark td[style*="color: #ff0000" i] {
            color: #F27055 !important;
        }
        
        html.theme-dark td[style*="color: #27ae60;" i] {
            color: #27ae60 !important;
        }
        
        html.theme-dark td[style*="color: #2980b9;" i] {
            color: #2980b9 !important;
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

        document.body.appendChild(btn);
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