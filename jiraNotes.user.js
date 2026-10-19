// ==UserScript==
// @name         JiraNotes
// @namespace    local.jiranotes
// @version      26M10D19-v1
// @description  Jira (Server/DC): группа "Local notes" на странице задачи (под Agile, иначе под Dates/People). Текстблок (Visual) с рамкой/фокусом, простой тулбар (code — toggle). Все клавиши внутри блока блокируются на window/capture — глобальные хоткеи Jira не срабатывают. Заметки: localStorage JN_SavedNote, свёрнутость: JN_Collapsed.
// @match        https://helpdesk.compassluxe.com/browse/*
// @updateURL    https://raw.githubusercontent.com/DendriveVlad/CPJobTimeCalc/main/jiraNotes.user.js
// @downloadURL  https://raw.githubusercontent.com/DendriveVlad/CPJobTimeCalc/main/jiraNotes.user.js
// @grant        none
// @run-at       document-idle
// @noframes
// ==/UserScript==

(() => {
    'use strict';

    const STORAGE_KEY   = 'JN_SavedNote';   // { "TXCORE-123": "HTML заметки", ... }
    const COLLAPSE_KEY  = 'JN_Collapsed';   // { "TXCORE-123": true, ... }
    const GROUP_ID      = 'jn-local-notes';
    const GROUP_TITLE   = 'Local notes';
    const ANCHOR_TITLES = ['Agile', 'Dates', 'People', 'Даты', 'Люди'];
    // шеврон из заголовка модулей Jira
    const CHEVRON = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14"><g fill="none" fill-rule="evenodd"><path d="M3.29175 4.793c-.389.392-.389 1.027 0 1.419l2.939 2.965c.218.215.5.322.779.322s.556-.107.769-.322l2.93-2.955c.388-.392.388-1.027 0-1.419-.389-.392-1.018-.392-1.406 0l-2.298 2.317-2.307-2.327c-.194-.195-.449-.293-.703-.293-.255 0-.51.098-.703.293z" fill="currentColor"></path></g></svg>';

    // ---------- localStorage ----------
    const readMap = k => { try { return JSON.parse(localStorage.getItem(k) || '{}') || {}; } catch (e) { return {}; } };
    const writeMap = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { console.warn('JiraNotes', e); } };
    const loadNote = k => readMap(STORAGE_KEY)[k] || '';
    const saveNote = (k, v) => { const m = readMap(STORAGE_KEY); if (v) m[k] = v; else delete m[k]; writeMap(STORAGE_KEY, m); };
    const loadCollapsed = k => !!readMap(COLLAPSE_KEY)[k];
    const saveCollapsed = (k, v) => { const m = readMap(COLLAPSE_KEY); if (v) m[k] = true; else delete m[k]; writeMap(COLLAPSE_KEY, m); };

    // ---------- DOM ----------
    const getIssueKey = () => {
        const m = location.pathname.match(/\/browse\/([A-Za-z][A-Za-z0-9]*-\d+)/);
        return m ? m[1] : location.pathname;
    };

    function findText(root, text) {
        const all = [];
        const w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
        let n;
        while ((n = w.nextNode())) {
            const t = (n.textContent || '').trim();
            if (t === text && t.length <= 50) all.push(n);
        }
        const deepest = all.filter(a => !all.some(b => b !== a && a.contains(b)));
        const vis = deepest.filter(el => el.getClientRects().length > 0);
        return vis.length ? vis : deepest;
    }

    function findModule(title) {
        for (const h of document.querySelectorAll('h4.toggle-title')) {
            if (h.textContent.trim() === title) {
                const m = h.closest('.module');
                if (m) return m;
            }
        }
        const hit = findText(document.body, title).pop();
        if (!hit) return null;
        const mh = hit.closest('div.mod-header');
        return hit.closest('.module') || (mh && mh.parentElement) || null;
    }

    const findAnchor = () => ANCHOR_TITLES.map(findModule).find(Boolean) || null;

    // курсор на границе contenteditable
    function caretAtStart(container) {
        const sel = window.getSelection();
        if (!sel.rangeCount) return false;
        try {
            const r = sel.getRangeAt(0);
            const pre = document.createRange();
            pre.selectNodeContents(container);
            pre.setEnd(r.startContainer, r.startOffset);
            return pre.toString().length === 0;
        } catch (e) { return false; }
    }
    function caretAtEnd(container) {
        const sel = window.getSelection();
        if (!sel.rangeCount) return false;
        try {
            const r = sel.getRangeAt(0);
            const post = document.createRange();
            post.selectNodeContents(container);
            post.setStart(r.endContainer, r.endOffset);
            return post.toString().length === 0;
        } catch (e) { return false; }
    }
    function placeCaret(container, atStart) {
        const range = document.createRange();
        range.selectNodeContents(container);
        range.collapse(atStart);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        container.focus();
    }

    // ---------- стили ----------
    function ensureStyles() {
        if (document.getElementById('jn-styles')) return;
        const s = document.createElement('style');
        s.id = 'jn-styles';
        s.textContent =
            '#jn-local-notes .mod-header .toggle-title svg { transition: transform .15s ease; }' +
            '#jn-local-notes .jn-visual {' +
            '  font: inherit; line-height: 1.5;' +
            '  min-height: 150px; padding: 8px 10px; outline: none;' +
            '  background: var(--color-bg-secondary, rgba(0,0,0,.25));' +
            '  border: 1px solid var(--color-border, #54595f); border-radius: 3px;' +
            '  transition: border-color .15s ease, box-shadow .15s ease;' +
            '}' +
            '#jn-local-notes .jn-visual:focus {' +
            '  border-color: var(--color-focus, #4c9aff);' +
            '  box-shadow: 0 0 0 1px var(--color-focus, #4c9aff);' +
            '}' +
            '#jn-local-notes .jn-visual a { color: var(--color-link-primary, #4c9aff); }' +
            '#jn-local-notes .jn-visual code { background: rgba(255,255,255,.08); padding: 0 3px; border-radius: 3px; }' +
            '#jn-local-notes .jn-visual pre { background: rgba(255,255,255,.06); border: 1px solid var(--color-border, #54595f); border-radius: 3px; padding: 6px 8px; white-space: pre-wrap; font-family: monospace; font-size: 12px; }' +
            '#jn-local-notes .jn-visual ul, #jn-local-notes .jn-visual ol { margin: 4px 0 4px 18px; padding: 0; }' +
            '#jn-local-notes .jn-visual[data-ph-empty]:before { content: attr(data-ph); color: var(--color-text-subtle, #8f98a0); pointer-events: none; }' +
            '#jn-local-notes .aui-toolbar2 { margin-bottom: 4px; }';
        document.head.appendChild(s);
    }

    // ---------- создание группы ----------
    let current = null; // { visual, onKey } — текущий блок и его обработчик клавиатуры

    function buildGroup(anchor, key) {
        const wrap = document.createElement('div');
        wrap.id = GROUP_ID;
        // те же классы, что у Agile, НО без collapsed/expanded
        wrap.className = ((anchor.className || '').trim())
            .split(/\s+/)
            .filter(c => c && !/^(collapsed|expanded)$/i.test(c))
            .join(' ') || 'module toggle-wrap';

        // заголовок — родные классы Jira
        const header = document.createElement('div');
        header.className = 'mod-header';
        const ops = document.createElement('ul');
        ops.className = 'ops';
        const btn = document.createElement('a');
        btn.href = '#';
        btn.className = 'aui-button toggle-title';
        btn.setAttribute('role', 'button');
        btn.setAttribute('aria-label', 'Свернуть/развернуть ' + GROUP_TITLE);
        btn.innerHTML = CHEVRON;
        const title = document.createElement('h4');
        title.className = 'toggle-title';
        title.textContent = GROUP_TITLE;
        header.append(ops, btn, title);
        wrap.appendChild(header);

        const content = document.createElement('div');
        content.className = 'mod-content';
        const field = document.createElement('div');
        field.className = 'field-ignore-highlight';

        // ---------- простой тулбар ----------
        const bar = document.createElement('div');
        bar.className = 'aui-toolbar2';
        const inner = document.createElement('div');
        inner.className = 'aui-toolbar2-inner';
        const grp = document.createElement('div');
        grp.className = 'aui-buttons';

        // ---------- текстблок (Visual) ----------
        const visual = document.createElement('div');
        visual.className = 'wiki-edit-content jn-visual';
        visual.contentEditable = 'true';
        visual.setAttribute('role', 'textbox');
        visual.setAttribute('aria-multiline', 'true');
        visual.setAttribute('spellcheck', 'false');
        visual.dataset.ph = 'Заметка для ' + key + '…';

        // статус сохранения
        const status = document.createElement('div');
        status.style.cssText = 'margin-top:4px; min-height:14px; text-align:right; font-size:11px; opacity:.65;';

        // ---------- сохранение ----------
        let timer = null;
        const persist = () => {
            saveNote(key, visual.innerHTML);
            status.textContent = 'Сохранено в ' + new Date().toLocaleTimeString();
        };
        const scheduleSave = () => {
            status.textContent = 'Сохранение…';
            clearTimeout(timer);
            timer = setTimeout(persist, 500);
        };

        const updatePlaceholder = () => {
            const empty = visual.innerText.trim() === '' && !visual.querySelector('img,a');
            if (empty) visual.setAttribute('data-ph-empty', '1');
            else visual.removeAttribute('data-ph-empty');
        };

        visual.addEventListener('input', () => { scheduleSave(); updatePlaceholder(); });
        visual.addEventListener('blur', () => { clearTimeout(timer); persist(); });

        // восстановление выделения (сохранённого на mousedown кнопки) перед действием
        let savedRange = null;
        const restoreSel = () => {
            visual.focus();
            if (savedRange && savedRange.commonAncestorContainer &&
                visual.contains(savedRange.commonAncestorContainer)) {
                const sel = window.getSelection();
                sel.removeAllRanges();
                sel.addRange(savedRange);
            }
        };

        const cmd = (name, val) => {
            restoreSel();
            document.execCommand(name, false, val);
            scheduleSave();
            updatePlaceholder();
        };

        // code — переключатель: внутри <code> снимает, вне — надевает
        const codeAncestorsInRange = range => {
            const codes = new Set();
            [range.startContainer, range.endContainer].forEach(node => {
                let n = node.nodeType === 1 ? node : node.parentElement;
                while (n && n !== visual) {
                    if (n.tagName === 'CODE') codes.add(n);
                    n = n.parentElement;
                }
            });
            const root = range.commonAncestorContainer;
            const container = root.nodeType === 1 ? root : root.parentElement;
            if (container && container !== document) {
                const walker = document.createTreeWalker(container, NodeFilter.SHOW_ELEMENT, null);
                let n;
                while ((n = walker.nextNode())) {
                    if (n.tagName === 'CODE') {
                        try { if (range.intersectsNode(n)) codes.add(n); }
                        catch (e) { if (n.compareDocumentPosition(range.endContainer) & Node.DOCUMENT_POSITION_CONTAINED_BY) codes.add(n); }
                    }
                }
            }
            return [...codes];
        };
        const unwrapCode = codeEl => {
            const parent = codeEl.parentNode;
            if (!parent) return;
            while (codeEl.firstChild) parent.insertBefore(codeEl.firstChild, codeEl);
            parent.removeChild(codeEl);
            parent.normalize();
        };
        const toggleCode = () => {
            restoreSel();
            const sel = window.getSelection();
            if (!sel.rangeCount) return;
            const range = sel.getRangeAt(0);
            const codes = codeAncestorsInRange(range);
            if (codes.length) {
                codes.forEach(unwrapCode);
                scheduleSave();
            } else {
                if (range.collapsed) return;
                const el = document.createElement('code');
                try { range.surroundContents(el); }
                catch (e) {
                    const frag = range.extractContents();
                    el.appendChild(frag);
                    range.insertNode(el);
                }
                scheduleSave();
            }
        };

        const makeLink = () => {
            const url = window.prompt('URL ссылки:', 'https://');
            if (!url) return;
            restoreSel();
            if (window.getSelection().isCollapsed) {
                document.execCommand('insertHTML', false, '<a href="' + url.replace(/"/g, '&quot;') + '" target="_blank">' + url + '</a>');
            } else {
                document.execCommand('createLink', false, url);
            }
            scheduleSave();
        };

        const actions = [
            { html: '<b>B</b>',            title: 'Bold (Ctrl+B)',                 fn: () => cmd('bold') },
            { html: '<i>I</i>',            title: 'Italic (Ctrl+I)',               fn: () => cmd('italic') },
            { html: '<u>U</u>',            title: 'Underline (Ctrl+U)',            fn: () => cmd('underline') },
            { html: '<s>S</s>',            title: 'Strikethrough (Ctrl+Shift+S)',  fn: () => cmd('strikeThrough') },
            { html: '<code>code</code>',   title: 'Инлайн-код (нажать ещё раз — снять)', fn: toggleCode },
            { html: 'Link',                title: 'Ссылка (Ctrl+K)',               fn: makeLink },
            { html: '• List',              title: 'Маркированный список (Ctrl+L)', fn: () => cmd('insertUnorderedList') },
            { html: '1. List',             title: 'Нумерованный список',           fn: () => cmd('insertOrderedList') },
            { html: 'Clear',               title: 'Сбросить форматирование',       fn: () => { cmd('unlink'); cmd('removeFormat'); cmd('formatBlock', 'p'); } },
        ];
        for (const a of actions) {
            const el = document.createElement('a');
            el.href = '#';
            el.className = 'aui-button aui-button-subtle';
            el.title = a.title;
            el.innerHTML = a.html;
            el.addEventListener('mousedown', e => {
                e.preventDefault(); // не даём кнопке забрать фокус/выделение
                const sel = window.getSelection();
                savedRange = (sel && sel.rangeCount) ? sel.getRangeAt(0).cloneRange() : null;
            });
            el.addEventListener('click', e => { e.preventDefault(); a.fn(); });
            grp.appendChild(el);
        }
        inner.appendChild(grp);
        bar.appendChild(inner);

        // ---------- клавиатура блока ----------
        // Вызывается из глобального перехвата (window, capture) — там же событие
        // останавливается, поэтому до обработчиков Jira оно не доходит.
        const onKey = e => {
            const k = e.key;
            if (!e.ctrlKey && !e.metaKey && !e.altKey) {
                // стрелки на границах: не даём caret уйти из блока
                if (k === 'ArrowUp' && caretAtStart(visual)) {
                    e.preventDefault();
                    setTimeout(() => {
                        const s = window.getSelection();
                        if (!s || !s.anchorNode || !visual.contains(s.anchorNode)) placeCaret(visual, true);
                    }, 0);
                } else if (k === 'ArrowDown' && caretAtEnd(visual)) {
                    e.preventDefault();
                    setTimeout(() => {
                        const s = window.getSelection();
                        if (!s || !s.anchorNode || !visual.contains(s.anchorNode)) placeCaret(visual, false);
                    }, 0);
                }
                return; // обычный ввод — default action (печатание) идёт как есть
            }
            // хоткеи форматирования
            const lower = k.toLowerCase();
            let fn = null;
            if (lower === 'b') fn = () => cmd('bold');
            else if (lower === 'i') fn = () => cmd('italic');
            else if (lower === 'u') fn = () => cmd('underline');
            else if (lower === 'k') fn = makeLink;
            else if (lower === 'l') fn = () => cmd('insertUnorderedList');
            else if (e.shiftKey && lower === 's') fn = () => cmd('strikeThrough');
            if (fn) { e.preventDefault(); fn(); }
        };

        // ссылки внутри поля не уносят со страницы
        visual.addEventListener('click', e => {
            if (e.target.closest && e.target.closest('a')) e.preventDefault();
        }, true);

        // ---------- шеврон ----------
        const svg = btn.querySelector('svg');
        const applyCollapsed = collapsed => {
            wrap.classList.remove('collapsed');
            content.style.display = collapsed ? 'none' : '';
            if (svg) svg.style.transform = collapsed ? 'rotate(-90deg)' : '';
        };
        btn.addEventListener('click', e => {
            e.preventDefault();
            e.stopPropagation();
            const collapsed = content.style.display !== 'none';
            applyCollapsed(collapsed);
            saveCollapsed(key, collapsed);
        });
        title.addEventListener('click', e => e.stopPropagation());
        applyCollapsed(loadCollapsed(key));

        // ---------- загрузка заметки ----------
        const saved = loadNote(key);
        if (saved) {
            if (/<[a-z]/i.test(saved)) visual.innerHTML = saved;   // HTML
            else visual.textContent = saved;                        // старый чистый текст
        }
        updatePlaceholder();

        // страховка: сохранить при закрытии вкладки
        window.addEventListener('beforeunload', () => {
            clearTimeout(timer);
            persist();
        });

        field.append(bar, visual, status);
        content.appendChild(field);
        wrap.appendChild(content);

        current = { visual, onKey };
        return { wrap };
    }

    // ---------- глобальный перехват клавиатуры (window, capture) ----------
    // Самое раннее место в цепочке событий: сюда событие приходит ДО document
    // и ДО всех обработчиков Jira. Если клавиша нажата внутри нашего блока —
    // событие гасим целиком (keydown/keypress/keyup), Jira его не видит.
    // stopPropagation не отменяет ввод — печатать можно как обычно.
    function inNoteBlock(e) {
        const c = current;
        if (!c) return null;
        const v = c.visual;
        if (!v.isConnected) return null;
        const t = e.target;
        if (!t) return null;
        return v.contains(t) ? c : null;
    }
    ['keydown', 'keypress', 'keyup'].forEach(type => {
        window.addEventListener(type, e => {
            const c = inNoteBlock(e);
            if (!c) return;
            e.stopPropagation(); // скрываем клавишу от Jira и прочих глобальных обработчиков
            if (type === 'keydown') c.onKey(e);
        }, true);
    });

    // ---------- внедрение ----------
    function inject(key) {
        ensureStyles();
        const existing = document.getElementById(GROUP_ID);
        if (existing) {
            if (existing.dataset.jnKey === key) return;
            existing.remove();
        }
        const anchor = findAnchor();
        if (!anchor) return;
        const { wrap } = buildGroup(anchor, key);
        wrap.dataset.jnKey = key;
        anchor.after(wrap);
    }

    // цикл: ждём DOM и SPA-перерисовки
    let lastAttempt = 0;
    function tick() {
        const key = getIssueKey();
        if (!key || Date.now() - lastAttempt < 250) return;
        lastAttempt = Date.now();
        try { inject(key); } catch (e) { console.warn('JiraNotes', e); }
    }
    let pending = false;
    function schedule() {
        if (pending) return;
        pending = true;
        requestAnimationFrame(() => { pending = false; tick(); });
    }
    new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
    setInterval(schedule, 1000);
    schedule();

    console.info('JiraNotes v1.15: скрипт загружен');
})();