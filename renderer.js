// renderer.js
document.addEventListener('DOMContentLoaded', async () => {
    let hasUnsavedChanges = false;
    let lastSavedContent = '';
    let isFileLoaded = false;

    // 設定相關變數
    let editorSettings = {
        indentType: 'spaces',
        spacesCount: 4,
        enableFontZoom: true,
        fontSize: 14,
        keepTempFile: false
    };

    async function loadSettings() {
        try {
            const settings = await window.electronAPI.getEditorSettings();
            if (settings) {
                editorSettings = {
                    ...editorSettings,
                    ...settings,
                    keepTempFile: Boolean(settings.keepTempFile) // 強制轉換為布林值
                };
                console.log('載入設定:', editorSettings); // 除錯用，可以移除
            }
        } catch (error) {
            console.log('載入設定失敗，使用預設值');
        }
    }

    // 套用設定函數
    function applySettings() {
        // 確保 editor 已經初始化
        if (!editor) return;

        // 使用 extraKeys 控制縮排設定
        editor.setOption('indentUnit', editorSettings.spacesCount);

        // 套用字體大小
        const editorElement = document.querySelector('.CodeMirror');
        const outputElement = document.getElementById('output');
        if (editorElement) {
            editorElement.style.fontSize = editorSettings.fontSize + 'px';
        }
        if (outputElement) {
            outputElement.style.fontSize = editorSettings.fontSize + 'px';
        }

        editor.refresh();
    }

    // 儲存設定函數
    async function saveSettings() {
        await window.electronAPI.saveEditorSettings(editorSettings);
    }

    // 初始化 CodeMirror 編輯器
    const editor = CodeMirror.fromTextArea(document.getElementById('editor'), {
        lineNumbers: true,
        mode: 'vbscript',
        theme: 'material-darker',
        indentUnit: 4,
        autofocus: true,
        electricChars: false,
        extraKeys: {
            "Tab": function(cm) {
                const selection = cm.getSelection();

                if (selection && selection.includes('\n')) {
                    // 多行選取時，對每一行進行縮排
                    const from = cm.getCursor("from");
                    const to = cm.getCursor("to");
                    const lines = [];

                    for (let i = from.line; i <= to.line; i++) {
                        const lineText = cm.getLine(i);
                        if (editorSettings.indentType === 'tab') {
                            lines.push('\t' + lineText);
                        } else {
                            const spaces = ' '.repeat(editorSettings.spacesCount);
                            lines.push(spaces + lineText);
                        }
                    }

                    // 替換選取範圍的文字
                    cm.replaceRange(
                        lines.join('\n'),
                        from,
                        to
                    );

                    // 保持選取範圍
                    cm.setSelection(from, { line: to.line, ch: lines[lines.length - 1].length });
                } else {
                    // 單行或無選取時，插入縮排
                    if (editorSettings.indentType === 'tab') {
                        cm.replaceSelection('\t');
                    } else {
                        const spaces = ' '.repeat(editorSettings.spacesCount);
                        cm.replaceSelection(spaces);
                    }
                }
            },
            "Shift-Tab": function(cm) {
                const selection = cm.getSelection();
                const from = cm.getCursor("from");
                const to = cm.getCursor("to");

                if (selection && selection.includes('\n')) {
                    // 多行選取時，對每一行進行反縮排
                    const lines = [];

                    for (let i = from.line; i <= to.line; i++) {
                        const lineText = cm.getLine(i);
                        let newLine = lineText;

                        if (editorSettings.indentType === 'tab') {
                            // 移除開頭的一個 Tab
                            if (lineText.startsWith('\t')) {
                                newLine = lineText.substring(1);
                            }
                        } else {
                            // 移除開頭的指定數量空格（一個縮排單位）
                            const indentSize = editorSettings.spacesCount;
                            const spaces = ' '.repeat(indentSize);

                            if (lineText.startsWith(spaces)) {
                                // 如果開頭正好是完整的縮排單位，移除它
                                newLine = lineText.substring(indentSize);
                            } else {
                                // 否則，計算開頭有多少空格，最多移除一個縮排單位的數量
                                let leadingSpaces = 0;
                                for (let j = 0; j < lineText.length; j++) {
                                    if (lineText[j] === ' ') {
                                        leadingSpaces++;
                                    } else {
                                        break;
                                    }
                                }

                                if (leadingSpaces > 0) {
                                    // 移除的空格數量：min(實際空格數, 一個縮排單位)
                                    const spacesToRemove = Math.min(leadingSpaces, indentSize);
                                    newLine = lineText.substring(spacesToRemove);
                                }
                            }
                        }
                        lines.push(newLine);
                    }

                    // 替換選取範圍的文字
                    cm.replaceRange(
                        lines.join('\n'),
                        from,
                        to
                    );

                    // 保持選取範圍
                    cm.setSelection(from, { line: to.line, ch: lines[lines.length - 1].length });
                } else {
                    // 單行時進行反縮排
                    const cursor = cm.getCursor();
                    const lineNum = cursor.line;
                    const line = cm.getLine(lineNum);
                    let newLine = line;
                    let removedChars = 0;

                    if (editorSettings.indentType === 'tab') {
                        // 移除開頭的一個 Tab
                        if (line.startsWith('\t')) {
                            newLine = line.substring(1);
                            removedChars = 1;
                        }
                    } else {
                        // 移除開頭的指定數量空格（一個縮排單位）
                        const indentSize = editorSettings.spacesCount;
                        const spaces = ' '.repeat(indentSize);

                        if (line.startsWith(spaces)) {
                            // 如果開頭正好是完整的縮排單位，移除它
                            newLine = line.substring(indentSize);
                            removedChars = indentSize;
                        } else {
                            // 否則，計算開頭有多少空格，最多移除一個縮排單位的數量
                            let leadingSpaces = 0;
                            for (let i = 0; i < line.length; i++) {
                                if (line[i] === ' ') {
                                    leadingSpaces++;
                                } else {
                                    break;
                                }
                            }

                            if (leadingSpaces > 0) {
                                // 移除的空格數量：min(實際空格數, 一個縮排單位)
                                const spacesToRemove = Math.min(leadingSpaces, indentSize);
                                newLine = line.substring(spacesToRemove);
                                removedChars = spacesToRemove;
                            }
                        }
                    }

                    if (removedChars > 0) {
                        cm.replaceRange(newLine, { line: lineNum, ch: 0 }, { line: lineNum, ch: line.length });

                        // 調整游標位置
                        const newCursorCh = Math.max(0, cursor.ch - removedChars);
                        cm.setCursor({ line: lineNum, ch: newCursorCh });
                    }
                }
            },
            "Space": function(cm) {
                // Space 鍵永遠只插入一個空格
                cm.replaceSelection(' ');
            },
            "Ctrl-/": function(cm) {
                const selection = cm.getSelection();
                const cursor = cm.getCursor();

                if (selection) {
                    // 有選取文字時，對選取的每一行進行註解/取消註解
                    const from = cm.getCursor("from");
                    const to = cm.getCursor("to");
                    const lines = [];
                    let allCommented = true;

                    // 檢查選取範圍內的所有行是否都已註解
                    for (let i = from.line; i <= to.line; i++) {
                        const lineText = cm.getLine(i);
                        lines.push(lineText);
                        if (lineText.trim() && !lineText.trim().startsWith("'")) {
                            allCommented = false;
                        }
                    }

                    // 根據是否全部已註解來決定動作
                    const newLines = lines.map(line => {
                        if (allCommented) {
                            // 取消註解：精確移除 "' " 或單獨的 "'"
                            return line.replace(/^(\s*)'\s?/, '$1');
                        } else {
                            // 加入註解：在行首加入 '
                            if (line.trim()) {
                                return line.replace(/^(\s*)/, '$1\' ');
                            }
                            return line;
                        }
                    });

                    // 替換選取範圍的文字
                    cm.replaceRange(
                        newLines.join('\n'),
                        from,
                        to
                    );

                    // 保持選取範圍
                    cm.setSelection(from, { line: to.line, ch: newLines[newLines.length - 1].length });
                } else {
                    // 沒有選取文字時，對當前行進行註解/取消註解
                    const lineNum = cursor.line;
                    const line = cm.getLine(lineNum);
                    const isCommented = line.trim().startsWith("'");

                    let newLine;
                    if (isCommented) {
                        // 取消註解：精確移除 "' " 或單獨的 "'"
                        newLine = line.replace(/^(\s*)'\s?/, '$1');
                    } else {
                        // 加入註解
                        newLine = line.replace(/^(\s*)/, '$1\' ');
                    }

                    cm.replaceRange(newLine, { line: lineNum, ch: 0 }, { line: lineNum, ch: line.length });

                    // 保持游標位置
                    const newCursorCh = Math.max(0, cursor.ch + (newLine.length - line.length));
                    cm.setCursor({ line: lineNum, ch: newCursorCh });
                }
            },
            "Ctrl-F": function(cm) {
                // 獲取當前選取的文字
                const selectedText = cm.getSelection();

                // 檢查是否已有自訂搜尋框
                let existingDialog = document.querySelector('.custom-search-dialog');
                if (existingDialog) {
                    if (selectedText) {
                        // 如果有選取文字，更新搜尋框內容
                        const input = existingDialog.querySelector('.custom-search-input');
                        input.value = selectedText;
                        input.focus();
                        input.select();

                        // 觸發搜尋
                        const event = new Event('input', { bubbles: true });
                        input.dispatchEvent(event);
                    } else {
                        // 沒有選取文字，關閉搜尋框
                        existingDialog.remove();
                        cm.removeOverlay('searchHighlight');
                    }
                } else {
                    // 建立自訂搜尋框
                    const dialog = document.createElement('div');
                    dialog.className = 'custom-search-dialog CodeMirror-dialog';
                    dialog.innerHTML = `
           <input type="text" placeholder="搜尋..." class="custom-search-input" value="${selectedText}">
           <button type="button" class="search-prev-btn">▲</button>
           <button type="button" class="search-next-btn">▼</button>
           <span class="search-count">0/0</span>
           <button type="button" class="search-close-btn">✕</button>
       `;

                    // 插入到編輯器區域
                    const editorWrapper = cm.getWrapperElement();
                    editorWrapper.appendChild(dialog);

                    const input = dialog.querySelector('.custom-search-input');
                    const prevBtn = dialog.querySelector('.search-prev-btn');
                    const nextBtn = dialog.querySelector('.search-next-btn');
                    const countSpan = dialog.querySelector('.search-count');
                    const closeBtn = dialog.querySelector('.search-close-btn');

                    let searchMatches = [];
                    let currentMatch = -1;

                    // 搜尋函數
                    function performSearch(query) {
                        cm.removeOverlay('searchHighlight');
                        searchMatches = [];
                        currentMatch = -1;

                        if (!query) {
                            updateCount();
                            return;
                        }

                        // 建立搜尋高亮
                        const overlay = {
                            token: function(stream) {
                                const match = stream.match(new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
                                if (match) {
                                    return 'searchHighlight';
                                }
                                stream.next();
                                return null;
                            }
                        };
                        cm.addOverlay(overlay, { opaque: false });

                        // 尋找所有匹配項
                        const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
                        const content = cm.getValue();
                        let match;

                        while ((match = regex.exec(content)) !== null) {
                            const pos = cm.posFromIndex(match.index);
                            searchMatches.push({
                                from: pos,
                                to: cm.posFromIndex(match.index + match[0].length)
                            });
                        }

                        if (searchMatches.length > 0) {
                            currentMatch = 0;
                            jumpToMatch();
                        }

                        updateCount();
                    }

                    function jumpToMatch() {
                        if (currentMatch >= 0 && currentMatch < searchMatches.length) {
                            const match = searchMatches[currentMatch];
                            cm.setSelection(match.from, match.to);
                            cm.scrollIntoView(match.from, 100);
                        }
                    }

                    function updateCount() {
                        const total = searchMatches.length;
                        const current = total > 0 ? currentMatch + 1 : 0;
                        countSpan.textContent = `${current}/${total}`;
                    }

                    function nextMatch() {
                        if (searchMatches.length === 0) return;
                        currentMatch = (currentMatch + 1) % searchMatches.length;
                        jumpToMatch();
                        updateCount();
                    }

                    function prevMatch() {
                        if (searchMatches.length === 0) return;
                        currentMatch = currentMatch === 0 ? searchMatches.length - 1 : currentMatch - 1;
                        jumpToMatch();
                        updateCount();
                    }

                    // 事件監聽
                    input.addEventListener('input', (e) => {
                        performSearch(e.target.value);
                    });

                    input.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            if (e.shiftKey) {
                                prevMatch();
                            } else {
                                nextMatch();
                            }
                        }
                    });

                    nextBtn.addEventListener('click', nextMatch);
                    prevBtn.addEventListener('click', prevMatch);
                    closeBtn.addEventListener('click', () => {
                        dialog.remove();
                        cm.removeOverlay('searchHighlight');
                    });

                    // 自動聚焦並選取所有文字
                    input.focus();
                    input.select();

                    // 如果有預填文字，立即執行搜尋
                    if (selectedText) {
                        performSearch(selectedText);
                    }
                }
            },
            "F3": "findNext",
            "Shift-F3": "findPrev"
        }
    });

    // === 修正 VBScript 語法高亮問題 ===
    // 覆寫 VBScript 模式的錯誤檢測，修正底線 "_" 被誤標為錯誤的問題
    const originalVBScriptMode = CodeMirror.getMode({}, "vbscript");
    CodeMirror.defineMode("vbscript-fixed", function(config, parserConfig) {
        const mode = originalVBScriptMode;
        const originalToken = mode.token;
        
        mode.token = function(stream, state) {
            const result = originalToken.call(this, stream, state);
            
            // 修正底線 "_" 在行尾時不應被標記為錯誤
            if (result === "error" && stream.current() === "_") {
                // 檢查是否在行尾或後面只有空白
                const remainingLine = stream.string.substring(stream.pos);
                if (!remainingLine.trim()) {
                    return "operator"; // 將底線改為操作符，而不是錯誤
                }
            }
            
            return result;
        };
        
        return mode;
    });

    // 使用修正後的模式
    editor.setOption("mode", "vbscript-fixed");

    // === 監聽編輯器變更 ===
    editor.on('change', () => {
        const currentContent = editor.getValue();
        // 修改邏輯：如果有內容且內容與上次儲存的不同，就標記為未儲存
        hasUnsavedChanges = currentContent.trim() !== '' && currentContent !== lastSavedContent;
        updateWindowTitle();
    });

    // 更新視窗標題
    function updateWindowTitle() {
        const title = hasUnsavedChanges ? 'VBScript Editor - 未儲存*' : 'VBScript Editor';
        document.title = title;
    }

    // 全域檢查函數
    window.checkUnsavedChanges = async () => {
        if (!hasUnsavedChanges) {
            return true; // 沒有未儲存變更，可以關閉
        }

        // 使用自訂對話框
        return new Promise((resolve) => {
            const modal = document.getElementById('close-confirm-modal');
            const saveAndCloseBtn = document.getElementById('save-and-close-btn');
            const closeWithoutSaveBtn = document.getElementById('close-without-save-btn');
            const cancelCloseBtn = document.getElementById('cancel-close-btn');

            // 顯示對話框
            modal.style.display = 'flex';

            // 儲存並關閉
            const handleSaveAndClose = async () => {
                modal.style.display = 'none';
                const saved = await window.electronAPI.saveFile(editor.getValue());
                if (saved) {
                    hasUnsavedChanges = false;
                    lastSavedContent = editor.getValue();
                    resolve(true);
                } else {
                    resolve(false);
                }
                cleanup();
            };

            // 不儲存直接關閉
            const handleCloseWithoutSave = () => {
                modal.style.display = 'none';
                resolve(true);
                cleanup();
            };

            // 取消關閉
            const handleCancel = () => {
                modal.style.display = 'none';
                resolve(false);
                cleanup();
            };

            // 清理事件監聽器
            const cleanup = () => {
                saveAndCloseBtn.removeEventListener('click', handleSaveAndClose);
                closeWithoutSaveBtn.removeEventListener('click', handleCloseWithoutSave);
                cancelCloseBtn.removeEventListener('click', handleCancel);
            };

            // 綁定事件
            saveAndCloseBtn.addEventListener('click', handleSaveAndClose);
            closeWithoutSaveBtn.addEventListener('click', handleCloseWithoutSave);
            cancelCloseBtn.addEventListener('click', handleCancel);

            // ESC 鍵取消
            const handleKeyDown = (e) => {
                if (e.key === 'Escape') {
                    e.preventDefault();
                    handleCancel();
                    document.removeEventListener('keydown', handleKeyDown);
                }
            };
            document.addEventListener('keydown', handleKeyDown);
        });
    };

    // 獲取所有 UI 元素
    const runBtn = document.getElementById('run-btn');
    const openBtn = document.getElementById('open-btn');
    const saveBtn = document.getElementById('save-btn');
    const clearEditorBtn = document.getElementById('clear-editor-btn');
    const clearOutputBtn = document.getElementById('clear-output-btn');
    const copyBtn = document.getElementById('copy-btn');
    const copyOptions = document.getElementById('copy-options');
    const outputEl = document.getElementById('output');
    const editorPane = document.getElementById('editor-pane');
    const outputPane = document.getElementById('output-pane');
    const formatBtn = document.getElementById('format-btn');

    // === 格式化按鈕事件 ===
    formatBtn.addEventListener('click', async () => {
        const currentCode = editor.getValue();
        if (!currentCode.trim()) {
            showNotification('編輯器中沒有程式碼可以格式化', 'warning');
            return;
        }

        // 顯示處理中通知
        const formattingNotification = showNotification('正在格式化程式碼...', 'info', 0); // 0 表示不自動關閉

        try {
            // 將當前的編輯器設定傳遞給主程序
            const result = await window.electronAPI.formatVbs(currentCode, {
                useSpaces: editorSettings.indentType === 'spaces',
                spaceCount: editorSettings.spacesCount
            });

            // 移除處理中通知
            formattingNotification.remove();

            if (result.success) {
                editor.setValue(result.code);
                showNotification('程式碼已成功格式化', 'success');
            } else {
                console.error('格式化失敗:', result.message);
                showNotification(`格式化失敗: ${result.message}`.substring(0, 100), 'error');
            }
        } catch (error) {
            // 移除處理中通知
            formattingNotification.remove();
            console.error('格式化過程中發生錯誤:', error);
            showNotification('格式化過程中發生嚴重錯誤', 'error');
        }
    });

    // 輸出區搜尋功能變數
    let outputSearchMatches = [];
    let currentOutputMatch = -1;
    const outputSearchBox = document.getElementById('output-search-box');
    const outputSearchInput = document.getElementById('output-search-input');
    const outputSearchPrev = document.getElementById('output-search-prev');
    const outputSearchNext = document.getElementById('output-search-next');
    const outputSearchCount = document.getElementById('output-search-count');
    const outputSearchClose = document.getElementById('output-search-close');

    // 處理貼上時的Tab轉換
    editor.on('beforeChange', function(instance, changeObj) {
        // 只處理貼上操作
        if (changeObj.origin === 'paste' && editorSettings.indentType === 'spaces') {
            const text = changeObj.text.join('\n');
            // 將Tab字符轉換為對應數量的空格
            const spaces = ' '.repeat(editorSettings.spacesCount);
            const convertedText = text.replace(/\t/g, spaces);
            changeObj.update(changeObj.from, changeObj.to, convertedText.split('\n'));
        }
    });

    // 快速搜尋功能 - 輸出區
    outputPane.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'f') {
            e.preventDefault();
            showOutputSearch();
        }
    });

    // 顯示輸出區搜尋框
    function showOutputSearch() {
        outputSearchBox.style.display = 'flex';
        outputSearchInput.focus();
        outputSearchInput.select();
    }

    // 隱藏輸出區搜尋框
    function hideOutputSearch() {
        outputSearchBox.style.display = 'none';
        clearOutputHighlights();
        outputPane.focus();
    }

    // 執行輸出區搜尋
    function performOutputSearch(query) {
        clearOutputHighlights();
        outputSearchMatches = [];
        currentOutputMatch = -1;

        if (!query.trim()) {
            updateOutputSearchCount();
            return;
        }

        const text = outputEl.textContent;
        const regex = new RegExp(escapeRegExp(query), 'gi');
        let match;

        while ((match = regex.exec(text)) !== null) {
            outputSearchMatches.push({
                start: match.index,
                end: match.index + match[0].length,
                text: match[0]
            });
        }

        if (outputSearchMatches.length > 0) {
            currentOutputMatch = 0;
            highlightOutputMatches();
            scrollToCurrentOutputMatch();
        }

        updateOutputSearchCount();
    }

    // 高亮輸出區搜尋結果
    function highlightOutputMatches() {
        const text = outputEl.textContent;
        let highlightedHTML = '';
        let lastIndex = 0;

        outputSearchMatches.forEach((match, index) => {
            highlightedHTML += escapeHtml(text.substring(lastIndex, match.start));
            const className = index === currentOutputMatch ? 'search-highlight current' : 'search-highlight';
            highlightedHTML += `<span class="${className}">${escapeHtml(match.text)}</span>`;
            lastIndex = match.end;
        });

        highlightedHTML += escapeHtml(text.substring(lastIndex));
        outputEl.innerHTML = highlightedHTML;
    }

    // 清除輸出區高亮
    function clearOutputHighlights() {
        outputEl.innerHTML = escapeHtml(outputEl.textContent);
    }

    // 滾動到當前搜尋結果
    function scrollToCurrentOutputMatch() {
        if (currentOutputMatch >= 0 && currentOutputMatch < outputSearchMatches.length) {
            const currentHighlight = outputEl.querySelector('.search-highlight.current');
            if (currentHighlight) {
                currentHighlight.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    }

    // 更新搜尋計數
    function updateOutputSearchCount() {
        const total = outputSearchMatches.length;
        const current = total > 0 ? currentOutputMatch + 1 : 0;
        outputSearchCount.textContent = `${current}/${total}`;
    }

    // 跳到下一個搜尋結果
    function nextOutputMatch() {
        if (outputSearchMatches.length === 0) return;
        currentOutputMatch = (currentOutputMatch + 1) % outputSearchMatches.length;
        highlightOutputMatches();
        scrollToCurrentOutputMatch();
        updateOutputSearchCount();
    }

    // 跳到上一個搜尋結果
    function prevOutputMatch() {
        if (outputSearchMatches.length === 0) return;
        currentOutputMatch = currentOutputMatch === 0 ? outputSearchMatches.length - 1 : currentOutputMatch - 1;
        highlightOutputMatches();
        scrollToCurrentOutputMatch();
        updateOutputSearchCount();
    }

    // 工具函數
    function escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // 輸出區搜尋事件監聽
    outputSearchInput.addEventListener('input', (e) => {
        performOutputSearch(e.target.value);
    });

    outputSearchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (e.shiftKey) {
                prevOutputMatch();
            } else {
                nextOutputMatch();
            }
        } else if (e.key === 'Escape') {
            hideOutputSearch();
        }
    });

    outputSearchNext.addEventListener('click', nextOutputMatch);
    outputSearchPrev.addEventListener('click', prevOutputMatch);
    outputSearchClose.addEventListener('click', hideOutputSearch);


    // 執行按鈕 (修改: 傳遞 keepTempFile 設定)
    runBtn.addEventListener('click', async () => {
        const mainScript = editor.getValue();
        const helpRegex = /^\s*help\s+(\"([^\"]*)\"|(\w+))\s*$/gim;
        const helpMatches = [...mainScript.matchAll(helpRegex)];
        
        // 檢查是否只有 help 指令（單獨使用）
        const trimmedScript = mainScript.trim();
        const scriptLines = trimmedScript.split('\n').filter(line => line.trim() !== '');
        const isOnlyHelp = helpMatches.length > 0 && helpMatches.length === scriptLines.length;
        
        // 檢查是否包含 help 呼叫（混用模式）
        const hasMixedHelp = helpMatches.length > 0 && !isOnlyHelp;

        outputEl.textContent = '執行中...';
        outputEl.classList.remove('error');
        hideOutputSearch();
        clearErrorHighlights();

        // 如果是單獨的 help 指令，顯示完整說明
        if (isOnlyHelp) {
            // 如果有多個 help 指令，顯示所有
            if (helpMatches.length > 1) {
                let allHelpOutputs = [];
                
                for (let i = 0; i < helpMatches.length; i++) {
                    const helpMatch = helpMatches[i];
                    const functionName = (helpMatch[2] || helpMatch[3] || '').toLowerCase();
                    
                    if (i > 0) {
                        allHelpOutputs.push('<div style="margin: 20px 0; border-top: 2px solid #404040; padding-top: 15px;"></div>');
                    }
                    
                    // 處理特殊參數：all, list, 或空字串
                    if (functionName === '' || functionName === 'all' || functionName === 'list') {
                        const allFunctionsResult = await window.electronAPI.getAllFunctions();
                        
                        if (!allFunctionsResult.success) {
                            allHelpOutputs.push(`<div style="color: #f48771;">獲取函數列表時發生錯誤：${allFunctionsResult.message}</div>`);
                            continue;
                        }
                        
                        if (allFunctionsResult.data.length === 0) {
                            allHelpOutputs.push(`
<div style="font-family: inherit; white-space: pre-line; color: inherit;">
' --------------------------------------------------
' 目前沒有自訂函數
' 
' 使用「函數」按鈕來新增自訂函數說明
' 或使用 help "函數名稱" 來查詢特定函數
' --------------------------------------------------
</div>`);
                        } else {
                            const functionListHtml = `
<div style="font-family: inherit; white-space: pre-line; color: inherit;">
' --------------------------------------------------
' 可用的自訂函數列表：
' 
${allFunctionsResult.data.map(func => 
    `' ${func.name}${func.description ? ' - ' + func.description : ''} 
  <span style="color: #4CAF50; cursor: pointer; text-decoration: underline; margin-right: 8px; font-weight: bold; padding: 2px 6px; background: rgba(76, 175, 80, 0.1); border-radius: 3px;" 
        onclick="window.editFunction('${func.name}')" 
        title="點擊編輯函數">[編輯]</span><span style="color: #f44336; cursor: pointer; text-decoration: underline; font-weight: bold; padding: 2px 6px; background: rgba(244, 67, 54, 0.1); border-radius: 3px;" 
        onclick="window.deleteFunction('${func.name}')" 
        title="點擊刪除函數">[刪除]</span>`
).join('\n')}
'
' 使用 help "函數名稱" 來查詢特定函數的詳細資訊
' --------------------------------------------------
</div>`;
                            allHelpOutputs.push(functionListHtml);
                        }
                    } else {
                        const result = await window.electronAPI.getFunction(functionName);

                        if (!result) {
                            allHelpOutputs.push(`<div style="color: #f48771;">查詢函數 "${functionName}" 時發生錯誤。</div>`);
                            continue;
                        }

                        if (result.exact) {
                            const func = result.data;
                            const functionHtml = `
<div style="font-family: inherit; white-space: pre-line; color: inherit;">
<div style="margin-bottom: 15px; padding: 8px; background: rgba(255, 255, 255, 0.05); border-radius: 4px;">
<span style="color: #4CAF50; cursor: pointer; text-decoration: underline; margin-right: 15px; font-weight: bold; padding: 4px 8px; background: rgba(76, 175, 80, 0.1); border-radius: 3px;" 
      onclick="window.editFunction('${func.name}')" 
      title="點擊編輯函數">[編輯]</span>
<span style="color: #f44336; cursor: pointer; text-decoration: underline; font-weight: bold; padding: 4px 8px; background: rgba(244, 67, 54, 0.1); border-radius: 3px;" 
      onclick="window.deleteFunction('${func.name}')" 
      title="點擊刪除函數">[刪除]</span>
</div>' --------------------------------------------------
' 函數: ${func.name}
' 功能: ${(func.description || '未提供').replace(/</g, '&lt;').replace(/>/g, '&gt;')}
' 參數:
'   ${(func.parameters || '未提供').replace(/\n/g, "\n'   ").replace(/</g, '&lt;').replace(/>/g, '&gt;')}
' 範例:
'   ${(func.example || '未提供').replace(/\n/g, "\n'   ").replace(/</g, '&lt;').replace(/>/g, '&gt;')}
' --------------------------------------------------
</div>`;
                            allHelpOutputs.push(functionHtml);
                        } else {
                            if (result.data && result.data.length > 0) {
                                const similarHtml = `
<div style="font-family: inherit; white-space: pre-line; color: inherit;">
' 找到類似的函數，您是不是要找：
'
' - ${result.data.join("\n' - ")}
'
' 請使用 help "函數全名" 來查詢詳細資訊。
</div>`;
                                allHelpOutputs.push(similarHtml);
                            } else {
                                allHelpOutputs.push(`<div style="color: inherit;">找不到名稱類似 "${functionName}" 的函數。</div>`);
                            }
                        }
                    }
                }
                
                outputEl.innerHTML = allHelpOutputs.join('');
                return;
            }
            
            // 單個 help 指令的原有邏輯
            const functionName = (helpMatches[0][2] || helpMatches[0][3] || '').toLowerCase();
            
            // 處理特殊參數：all, list, 或空字串
            if (functionName === '' || functionName === 'all' || functionName === 'list') {
                const allFunctionsResult = await window.electronAPI.getAllFunctions();
                
                if (!allFunctionsResult.success) {
                    outputEl.textContent = `獲取函數列表時發生錯誤：${allFunctionsResult.message}`;
                    outputEl.classList.add('error');
                    return;
                }
                
                if (allFunctionsResult.data.length === 0) {
                    outputEl.textContent = `
' --------------------------------------------------
' 目前沒有自訂函數
' 
' 使用「函數」按鈕來新增自訂函數說明
' 或使用 help "函數名稱" 來查詢特定函數
' --------------------------------------------------
                    `.trim();
                } else {
                    const functionList = allFunctionsResult.data.map(func => 
                        `' ${func.name}${func.description ? ' - ' + func.description : ''}`
                    ).join('\n');
                    
                    // 使用 HTML 來顯示可點擊的函數列表
                    outputEl.innerHTML = `
<div style="font-family: inherit; white-space: pre-line; color: inherit;">
' --------------------------------------------------
' 可用的自訂函數列表：
' 
${allFunctionsResult.data.map(func => 
    `' ${func.name}${func.description ? ' - ' + func.description : ''} 
  <span style="color: #4CAF50; cursor: pointer; text-decoration: underline; margin-right: 8px; font-weight: bold; padding: 2px 6px; background: rgba(76, 175, 80, 0.1); border-radius: 3px;" 
        onclick="window.editFunction('${func.name}')" 
        title="點擊編輯函數">[編輯]</span><span style="color: #f44336; cursor: pointer; text-decoration: underline; font-weight: bold; padding: 2px 6px; background: rgba(244, 67, 54, 0.1); border-radius: 3px;" 
        onclick="window.deleteFunction('${func.name}')" 
        title="點擊刪除函數">[刪除]</span>`
).join('\n')}
'
' 使用 help "函數名稱" 來查詢特定函數的詳細資訊
' --------------------------------------------------
</div>
                    `.trim();
                }
                return;
            }
            
            const result = await window.electronAPI.getFunction(functionName);

            if (!result) {
                outputEl.textContent = `查詢函數 \"${functionName}\" 時發生錯誤。`;
                outputEl.classList.add('error');
                return;
            }

            if (result.exact) {
                const func = result.data;
                
                // 使用 HTML 來顯示可點擊的編輯和刪除按鈕，左右排列在最上面
                outputEl.innerHTML = `
<div style="font-family: inherit; white-space: pre-line; color: inherit;">
<div style="margin-bottom: 15px; padding: 8px; background: rgba(255, 255, 255, 0.05); border-radius: 4px;">
<span style="color: #4CAF50; cursor: pointer; text-decoration: underline; margin-right: 15px; font-weight: bold; padding: 4px 8px; background: rgba(76, 175, 80, 0.1); border-radius: 3px;" 
      onclick="window.editFunction('${func.name}')" 
      title="點擊編輯函數">[編輯]</span>
<span style="color: #f44336; cursor: pointer; text-decoration: underline; font-weight: bold; padding: 4px 8px; background: rgba(244, 67, 54, 0.1); border-radius: 3px;" 
      onclick="window.deleteFunction('${func.name}')" 
      title="點擊刪除函數">[刪除]</span>
</div>' --------------------------------------------------
' 函數: ${func.name}
' 功能: ${(func.description || '未提供').replace(/</g, '&lt;').replace(/>/g, '&gt;')}
' 參數:
'   ${(func.parameters || '未提供').replace(/\n/g, "\n'   ").replace(/</g, '&lt;').replace(/>/g, '&gt;')}
' 範例:
'   ${(func.example || '未提供').replace(/\n/g, "\n'   ").replace(/</g, '&lt;').replace(/>/g, '&gt;')}
' --------------------------------------------------
</div>
                `.trim();
            } else {
                if (result.data && result.data.length > 0) {
                    const output = `
' 找到類似的函數，您是不是要找：
'
' - ${result.data.join("\n' - ")}
'
' 請使用 help \"函數全名\" 來查詢詳細資訊。
                    `.trim();
                    outputEl.textContent = output;
                } else {
                    outputEl.textContent = `找不到名稱類似 \"${functionName}\" 的函數。`;
                }
            }
        } else {
            // 如果是混用模式，先顯示所有 help 說明
            if (hasMixedHelp) {
                let helpOutputs = [];
                
                for (const helpMatch of helpMatches) {
                    const functionName = (helpMatch[2] || helpMatch[3] || '').toLowerCase();
                    
                    // 處理特殊參數：all, list, 或空字串
                    if (functionName === '' || functionName === 'all' || functionName === 'list') {
                        const allFunctionsResult = await window.electronAPI.getAllFunctions();
                        
                        if (allFunctionsResult.success && allFunctionsResult.data.length > 0) {
                            const functionListHtml = `
<div style="font-family: inherit; white-space: pre-line; color: #e8f5e8; background: rgba(76, 175, 80, 0.15); padding: 10px; border-left: 4px solid #4CAF50; margin-bottom: 10px; border-radius: 4px;">
📋 可用函數列表：
${allFunctionsResult.data.map(func => 
    `${func.name}${func.description ? ' - ' + func.description : ''} 
<span style="color: #4CAF50; cursor: pointer; text-decoration: underline; margin-right: 8px; font-weight: bold; padding: 2px 5px; background: rgba(76, 175, 80, 0.3); border-radius: 3px;" 
      onclick="window.editFunction('${func.name}')" 
      title="點擊編輯函數">[編輯]</span><span style="color: #f44336; cursor: pointer; text-decoration: underline; font-weight: bold; padding: 2px 5px; background: rgba(244, 67, 54, 0.3); border-radius: 3px;" 
      onclick="window.deleteFunction('${func.name}')" 
      title="點擊刪除函數">[刪除]</span>`
).join('\n')}

使用 help "函數名稱" 查看詳細說明
</div>`;
                            helpOutputs.push(functionListHtml);
                        } else {
                            const noFunctionHtml = `
<div style="font-family: inherit; white-space: pre-line; color: #e8f5e8; background: rgba(76, 175, 80, 0.15); padding: 10px; border-left: 4px solid #4CAF50; margin-bottom: 10px; border-radius: 4px;">
📋 目前沒有自訂函數
使用「函數」按鈕來新增自訂函數說明
</div>`;
                            helpOutputs.push(noFunctionHtml);
                        }
                    } else {
                        const result = await window.electronAPI.getFunction(functionName);
                        
                        if (result && result.exact) {
                            const func = result.data;
                            const functionHtml = `
<div style="font-family: inherit; white-space: pre-line; color: #e0f2f1; background: rgba(76, 175, 80, 0.15); padding: 10px; border-left: 4px solid #4CAF50; margin-bottom: 10px; border-radius: 4px;">
<div style="margin-bottom: 10px;">
<span style="color: #4CAF50; cursor: pointer; text-decoration: underline; margin-right: 10px; font-weight: bold; padding: 3px 6px; background: rgba(76, 175, 80, 0.2); border-radius: 3px;" 
      onclick="window.editFunction('${func.name}')" 
      title="點擊編輯函數">[編輯]</span>
<span style="color: #f44336; cursor: pointer; text-decoration: underline; font-weight: bold; padding: 3px 6px; background: rgba(244, 67, 54, 0.2); border-radius: 3px;" 
      onclick="window.deleteFunction('${func.name}')" 
      title="點擊刪除函數">[刪除]</span>
</div>📖 函數說明: ${func.name}
功能: ${(func.description || '未提供').replace(/</g, '&lt;').replace(/>/g, '&gt;')}
參數: ${(func.parameters || '未提供').replace(/</g, '&lt;').replace(/>/g, '&gt;')}
範例: ${(func.example || '未提供').replace(/</g, '&lt;').replace(/>/g, '&gt;')}
</div>`;
                            helpOutputs.push(functionHtml);
                        } else if (result && result.data && result.data.length > 0) {
                            const similarHtml = `
<div style="font-family: inherit; white-space: pre-line; color: #fff8e1; background: rgba(255, 193, 7, 0.15); padding: 10px; border-left: 4px solid #ffc107; margin-bottom: 10px; border-radius: 4px;">
🔍 找到類似的函數：
${result.data.join(', ')}

請使用完整的函數名稱
</div>`;
                            helpOutputs.push(similarHtml);
                        } else {
                            const notFoundHtml = `
<div style="font-family: inherit; white-space: pre-line; color: #ffebee; background: rgba(220, 53, 69, 0.15); padding: 10px; border-left: 4px solid #dc3545; margin-bottom: 10px; border-radius: 4px;">
❌ 找不到函數 "${functionName}"
</div>`;
                            helpOutputs.push(notFoundHtml);
                        }
                    }
                }
                
                // 將所有 help 輸出組合在一起
                outputEl.innerHTML = `
${helpOutputs.join('')}
<div id="script-output" style="font-family: inherit; white-space: pre-line; color: inherit;">正在執行程式...</div>`;
            }
            
            // 執行前先隱藏按鈕
            document.getElementById('open-temp-file-btn').style.display = 'none';

            const allPreScripts = await getPreScripts();
            const preScripts = allPreScripts
                .filter(script => {
                    const scriptObj = typeof script === 'object' ? script : { code: script, enabled: true };
                    return scriptObj.enabled !== false;
                })
                .map(script => typeof script === 'object' ? script.code : script);

            // 內建的 help 函數，避免執行階段錯誤
            const builtInHelp = `
' === 內建 Help 函數 ===
Function help(param)
    ' 函數說明已在上方顯示，此處不重複輸出避免干擾
    help = param
End Function
`;

            const fullScript = builtInHelp + '\n\n' + preScripts.join('\n\n') + '\n\n' + mainScript;

            // 修改: 傳遞設定物件給 main.js
            const execResult = await window.electronAPI.executeVbs(fullScript, editorSettings.keepTempFile);

            // 執行完成後，如果設定為保存暫存檔，則顯示按鈕
            if (editorSettings.keepTempFile) {
                document.getElementById('open-temp-file-btn').style.display = 'inline-block';
            }

            if (hasMixedHelp) {
                // 混用模式：將執行結果添加到 script-output div
                const scriptOutputDiv = document.getElementById('script-output');
                if (scriptOutputDiv) {
                    // 支援新舊格式
                    const normalOut = execResult.normalOutput || (execResult.success ? execResult.output : '');
                    const errorOut = execResult.errorOutput || (!execResult.success ? execResult.output : '');
                    
                    if (normalOut || errorOut) {
                        let outputHtml = '';
                        
                        // 先顯示正常輸出（白色）
                        if (normalOut) {
                            outputHtml += `<span style="color: #d4d4d4;">${processLinksInText(normalOut)}</span>`;
                        }
                        
                        // 如果有錯誤，加上分隔線和錯誤輸出（紅色）
                        if (errorOut) {
                            if (normalOut) {
                                outputHtml += '<br><span style="color: #f48771;">━━━━━━━━ 執行過程中發生錯誤 ━━━━━━━━</span><br>';
                            }
                            outputHtml += `<span style="color: #f48771;">${processLinksInText(errorOut)}</span>`;
                            
                            // 添加錯誤位置資訊
                            const errorLocationInfo = getErrorLocationInfo(errorOut, preScripts, mainScript);
                            if (errorLocationInfo) {
                                outputHtml += `<br><span style="color: #f48771;">${processLinksInText(errorLocationInfo)}</span>`;
                            }
                            highlightErrorLine(errorOut, preScripts, mainScript);
                        }
                        
                        scriptOutputDiv.innerHTML = outputHtml;
                    } else {
                        scriptOutputDiv.textContent = "程式執行完成，沒有輸出。";
                    }
                }
            } else {
                // 一般模式：替換整個輸出區域
                // 支援新舊格式
                const normalOut = execResult.normalOutput || (execResult.success ? execResult.output : '');
                const errorOut = execResult.errorOutput || (!execResult.success ? execResult.output : '');
                
                if (normalOut || errorOut) {
                    let outputHtml = '';
                    
                    // 先顯示正常輸出（白色）
                    if (normalOut) {
                        outputHtml += `<span style="color: #d4d4d4;">${processLinksInText(normalOut)}</span>`;
                    }
                    
                    // 如果有錯誤，加上分隔線和錯誤輸出（紅色）
                    if (errorOut) {
                        if (normalOut) {
                            outputHtml += '<br><br><span style="color: #f48771;">━━━━━━━━ 執行過程中發生錯誤 ━━━━━━━━</span><br>';
                        }
                        outputHtml += `<span style="color: #f48771;">${processLinksInText(errorOut)}</span>`;
                        
                        // 添加錯誤位置資訊
                        const errorLocationInfo = getErrorLocationInfo(errorOut, preScripts, mainScript);
                        if (errorLocationInfo) {
                            outputHtml += `<br><span style="color: #f48771;">${processLinksInText(errorLocationInfo)}</span>`;
                        }
                        outputEl.classList.add('error');
                        highlightErrorLine(errorOut, preScripts, mainScript);
                    }
                    
                    outputEl.innerHTML = outputHtml;
                } else {
                    outputEl.textContent = "程式執行完成，沒有輸出。";
                    outputEl.classList.remove('error');
                }
            }
        }
    });

    // 開啟檔案按鈕
    openBtn.addEventListener('click', async () => {
        // 檢查是否有未儲存變更
        if (hasUnsavedChanges) {
            const shouldContinue = await window.checkUnsavedChanges();
            if (!shouldContinue) return;
        }

        const content = await window.electronAPI.openFile();
        if (content !== null) {
            editor.setValue(content);
            lastSavedContent = content;
            hasUnsavedChanges = false;
            isFileLoaded = true;
            updateWindowTitle();
        }
    });

    // 儲存檔案按鈕
    // 儲存檔案按鈕
    saveBtn.addEventListener('click', async () => {
        const content = editor.getValue();
        const saved = await window.electronAPI.saveFile(content);
        if (saved) {
            lastSavedContent = content;
            hasUnsavedChanges = false;
            isFileLoaded = true;
            updateWindowTitle();
            showNotification('檔案已儲存', 'success');
        }
    });

    // 清除按鈕
    clearEditorBtn.addEventListener('click', () => editor.setValue(''));
    clearOutputBtn.addEventListener('click', () => {
        outputEl.textContent = '';
        outputEl.classList.remove('error');
        hideOutputSearch();
    });

    // 複製按鈕功能
    copyBtn.addEventListener('click', async () => {
        try {
            const contentToCopy = copyOptions.value === 'code' ?
                editor.getValue() :
                outputEl.textContent;

            if (!contentToCopy.trim()) {
                showNotification('沒有內容可複製', 'warning');
                return;
            }

            await navigator.clipboard.writeText(contentToCopy);
            showNotification('已複製到剪貼簿', 'success');
        } catch (err) {
            console.error('複製失敗:', err);
            showNotification('複製失敗', 'error');
        }
    });

    // 顯示通知的輔助函數
    function showNotification(message, type = 'info', duration = 3000) {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;

        document.body.appendChild(notification);

        if (duration > 0) {
            setTimeout(() => {
                notification.classList.add('fade-out');
                setTimeout(() => notification.remove(), 300);
            }, duration);
        }

        return notification; // 返回 DOM 元素以便可以手動移除
    }

    // 錯誤行凸顯相關函數
    function clearErrorHighlights() {
        // 清除編輯器中的錯誤行樣式
        for (let i = 0; i < editor.lineCount(); i++) {
            editor.removeLineClass(i, 'background', 'error-line-bg');
            editor.removeLineClass(i, 'wrap', 'error-line-border');
        }

        // 清除所有標記
        const markers = editor.getAllMarks();
        markers.forEach(marker => {
            if (marker.className && marker.className.includes('error-line')) {
                marker.clear();
            }
        });
    }

    // 提取錯誤位置資訊的輔助函數
    function getErrorLocationInfo(errorOutput, preScripts, mainScript) {
        // 分析錯誤訊息，提取行號
        const lineRegex = /\((\d+),\s*(\d+)\)/;
        const match = errorOutput.match(lineRegex);

        if (!match) return null;

        const vbsErrorLine = parseInt(match[1]); // VBScript 原始行號（從1開始）
        const errorCol = parseInt(match[2]);

        // 必須與實際執行時的腳本結構完全一致
        const builtInHelp = `
' === 內建 Help 函數 ===
Function help(param)
    ' 函數說明已在上方顯示，此處不重複輸出避免干擾
    help = param
End Function
`;
        const fullScript = builtInHelp + '\n\n' + preScripts.join('\n\n') + '\n\n' + mainScript;
        const fullScriptLines = fullScript.split('\n');
        const errorLineContent = fullScriptLines[vbsErrorLine - 1];

        // 在主腳本中搜尋相同的內容
        const mainScriptLines = mainScript.split('\n');
        let targetLineIndex = -1;

        for (let i = 0; i < mainScriptLines.length; i++) {
            if (mainScriptLines[i].trim() === errorLineContent?.trim()) {
                targetLineIndex = i;
                break;
            }
        }

        // 如果找不到完全匹配，嘗試模糊匹配
        if (targetLineIndex === -1 && errorLineContent) {
            const errorKeywords = errorLineContent.replace(/\s+/g, ' ').trim();
            for (let i = 0; i < mainScriptLines.length; i++) {
                const lineKeywords = mainScriptLines[i].replace(/\s+/g, ' ').trim();
                if (lineKeywords.includes(errorKeywords) || errorKeywords.includes(lineKeywords)) {
                    if (lineKeywords.length > 3) { // 避免匹配空行或太短的行
                        targetLineIndex = i;
                        break;
                    }
                }
            }
        }

        if (targetLineIndex >= 0) {
            return `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                `❌ 錯誤位置：主編輯器，第 ${targetLineIndex + 1} 行，第 ${errorCol} 列\n` +
                `📝 錯誤行內容：${mainScriptLines[targetLineIndex]}\n` +
                `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
        }

        return null;
    }

    function highlightErrorLine(errorOutput, preScripts, mainScript) {
        // 分析錯誤訊息，提取行號
        const lineRegex = /\((\d+),\s*(\d+)\)/;
        const match = errorOutput.match(lineRegex);

        if (!match) return;

        const vbsErrorLine = parseInt(match[1]); // VBScript 原始行號（從1開始）
        const errorCol = parseInt(match[2]) - 1;

        // 必須與實際執行時的腳本結構完全一致
        const builtInHelp = `
' === 內建 Help 函數 ===
Function help(param)
    ' 函數說明已在上方顯示，此處不重複輸出避免干擾
    help = param
End Function
`;
        const fullScript = builtInHelp + '\n\n' + preScripts.join('\n\n') + '\n\n' + mainScript;
        const fullScriptLines = fullScript.split('\n');
        const errorLineContent = fullScriptLines[vbsErrorLine - 1];

        // 在主腳本中搜尋相同的內容
        const mainScriptLines = mainScript.split('\n');
        let targetLineIndex = -1;

        for (let i = 0; i < mainScriptLines.length; i++) {
            if (mainScriptLines[i].trim() === errorLineContent?.trim()) {
                targetLineIndex = i;
                break;
            }
        }

        // 如果找不到完全匹配，嘗試模糊匹配
        if (targetLineIndex === -1 && errorLineContent) {
            const errorKeywords = errorLineContent.replace(/\s+/g, ' ').trim();
            for (let i = 0; i < mainScriptLines.length; i++) {
                const lineKeywords = mainScriptLines[i].replace(/\s+/g, ' ').trim();
                if (lineKeywords.includes(errorKeywords) || errorKeywords.includes(lineKeywords)) {
                    if (lineKeywords.length > 3) { // 避免匹配空行或太短的行
                        targetLineIndex = i;
                        break;
                    }
                }
            }
        }

        if (targetLineIndex >= 0) {
            // 在編輯器中高亮錯誤行
            editor.addLineClass(targetLineIndex, 'background', 'error-line-bg');
            editor.addLineClass(targetLineIndex, 'wrap', 'error-line-border');

            // 設定游標到錯誤位置
            editor.setCursor(targetLineIndex, Math.max(0, errorCol));
            editor.scrollIntoView({line: targetLineIndex, ch: errorCol}, 100);
        }
    }

    // === 預執行程式 Modal 邏輯 ===
    const modal = document.getElementById('pre-exec-modal');
    const preExecBtn = document.getElementById('pre-exec-btn');
    const closeBtn = document.querySelector('.close-btn');
    const addPreScriptBtn = document.getElementById('add-pre-script-btn');
    const newPreScriptInput = document.getElementById('new-pre-script-input');
    const preScriptsList = document.getElementById('pre-scripts-list');

    async function getPreScripts() {
        return await window.electronAPI.getPreScripts();
    }

    async function exportScripts() {
        const scripts = await getPreScripts();
        if (scripts.length === 0) {
            showNotification('沒有腳本可匯出', 'warning');
            return;
        }

        const exportType = await showExportDialog();
        if (!exportType) return;

        if (exportType === 'single') {
            // 分別匯出：讓使用者選擇一次資料夾
            const basePath = await window.electronAPI.selectExportFolder();
            if (basePath) {
                for (let i = 0; i < scripts.length; i++) {
                    const scriptObj = typeof scripts[i] === 'object' ? scripts[i] : { code: scripts[i], enabled: true };
                    const filename = `預執行腳本_${i + 1}.vbs`;
                    await window.electronAPI.exportScriptToFolder(scriptObj.code, basePath, filename);
                }
                showNotification(`已匯出 ${scripts.length} 個腳本`, 'success');
            }
        } else {
            // 合併匯出
            const allScripts = scripts.map((script, index) => {
                const scriptObj = typeof script === 'object' ? script : { code: script, enabled: true };
                return `' === 預執行腳本 ${index + 1} ===\n${scriptObj.code}`;
            }).join('\n\n');
            await window.electronAPI.exportScript(allScripts, '所有預執行腳本.vbs');
        }
    }

    async function importScripts() {
        const contents = await window.electronAPI.importMultipleScripts();
        if (contents && contents.length > 0) {
            const scripts = await getPreScripts();

            // 將匯入的腳本加入到現有腳本中
            contents.forEach(content => {
                scripts.push({ code: content, enabled: true });
            });

            await savePreScripts(scripts);
            showNotification(`已匯入 ${contents.length} 個腳本`, 'success');
        }
    }

    function showExportDialog() {
        return new Promise((resolve) => {
            const dialog = document.createElement('div');
            dialog.className = 'modal';
            dialog.style.display = 'flex';
            dialog.innerHTML = `
            <div class="modal-content" style="max-width: 400px;">
                <h3>選擇匯出方式</h3>
                <div style="margin: 20px 0;">
                    <button id="export-single" class="btn-primary" style="margin-right: 10px;">分別匯出</button>
                    <button id="export-all" class="btn-primary">合併匯出</button>
                </div>
                <button id="export-cancel" class="btn-cancel">取消</button>
            </div>
        `;
            document.body.appendChild(dialog);

            document.getElementById('export-single').onclick = () => {
                document.body.removeChild(dialog);
                resolve('single');
            };
            document.getElementById('export-all').onclick = () => {
                document.body.removeChild(dialog);
                resolve('all');
            };
            document.getElementById('export-cancel').onclick = () => {
                document.body.removeChild(dialog);
                resolve(null);
            };
        });
    }

    async function savePreScripts(scripts) {
        await window.electronAPI.savePreScripts(scripts);
        await renderPreScripts();
    }

    async function renderPreScripts() {
        // 保存當前滾動位置
        const currentScrollTop = preScriptsList.scrollTop;

        // 創建文檔片段，減少 DOM 操作次數
        const fragment = document.createDocumentFragment();
        const scripts = await getPreScripts();

        if (scripts.length === 0) {
            preScriptsList.innerHTML = '<p>尚無預執行腳本。</p>';
            return;
        }

        scripts.forEach((script, index) => {
            const item = document.createElement('div');
            item.className = 'pre-script-item';
            item.dataset.index = index;

            const displayView = document.createElement('div');
            displayView.className = 'display-view';

            const scriptObj = typeof script === 'object' ? script : { code: script, enabled: true };
            const codePre = document.createElement('pre');
            codePre.textContent = scriptObj.code;

            // 如果腳本被停用，添加視覺提示
            if (scriptObj.enabled === false) {
                item.style.opacity = '0.6';
                item.style.filter = 'grayscale(50%)';
            }

            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'script-actions';

            const editBtn = document.createElement('button');
            editBtn.textContent = '修改';
            editBtn.className = 'btn-edit';
            editBtn.onclick = () => {
                item.querySelector('.display-view').style.display = 'none';
                item.querySelector('.edit-view').style.display = 'flex';
            };

            const removeBtn = document.createElement('button');
            removeBtn.textContent = '移除';
            removeBtn.className = 'btn-remove';
            removeBtn.onclick = async () => {
                const currentScripts = await getPreScripts();
                const updatedScripts = currentScripts.filter((_, i) => i !== index);
                await savePreScripts(updatedScripts);
            };

            const toggleBtn = document.createElement('button');
            toggleBtn.textContent = scriptObj.enabled !== false ? '停用' : '啟用';
            toggleBtn.className = scriptObj.enabled !== false ? 'btn-disable' : 'btn-enable';
            toggleBtn.onclick = async () => {
                // 立即更新 UI，避免等待
                toggleBtn.disabled = true;
                toggleBtn.textContent = '處理中...';

                try {
                    const currentScripts = await getPreScripts();
                    const currentScript = currentScripts[index];
                    const currentScriptObj = typeof currentScript === 'object' ? currentScript : { code: currentScript, enabled: true };

                    // 切換啟用/停用狀態
                    currentScriptObj.enabled = !currentScriptObj.enabled;
                    currentScripts[index] = currentScriptObj;

                    await savePreScripts(currentScripts);
                } finally {
                    toggleBtn.disabled = false;
                }
            };

            const exportSingleBtn = document.createElement('button');
            exportSingleBtn.textContent = '匯出';
            exportSingleBtn.className = 'btn-secondary';
            exportSingleBtn.onclick = async () => {
                const filename = `預執行腳本_${index + 1}.vbs`;
                const exported = await window.electronAPI.exportScript(scriptObj.code, filename);
                if (exported) {
                    showNotification('腳本已匯出', 'success');
                }
            };

            actionsDiv.appendChild(toggleBtn);
            actionsDiv.appendChild(exportSingleBtn);
            actionsDiv.appendChild(editBtn);
            actionsDiv.appendChild(removeBtn);
            displayView.appendChild(codePre);
            displayView.appendChild(actionsDiv);

            const editView = document.createElement('div');
            editView.className = 'edit-view';

            const editTextarea = document.createElement('textarea');
            editTextarea.className = 'edit-textarea';
            editTextarea.value = scriptObj.code;
            const editControlsDiv = document.createElement('div');
            editControlsDiv.className = 'edit-controls';

            const saveBtn = document.createElement('button');
            saveBtn.textContent = '儲存';
            saveBtn.className = 'btn-save';
            saveBtn.onclick = async () => {
                const newScriptContent = editTextarea.value.trim();
                if (newScriptContent) {
                    const currentScripts = await getPreScripts();
                    const currentScript = currentScripts[index];
                    const scriptObj = typeof currentScript === 'object' ? currentScript : { code: currentScript, enabled: true };

                    // 保持啟用狀態，只更新程式碼
                    scriptObj.code = newScriptContent;
                    currentScripts[index] = scriptObj;

                    await savePreScripts(currentScripts);
                }
            };

            const cancelBtn = document.createElement('button');
            cancelBtn.textContent = '取消';
            cancelBtn.className = 'btn-cancel';
            cancelBtn.onclick = () => {
                item.querySelector('.edit-view').style.display = 'none';
                item.querySelector('.display-view').style.display = 'flex';
            };

            editControlsDiv.appendChild(saveBtn);
            editControlsDiv.appendChild(cancelBtn);
            editView.appendChild(editTextarea);
            editView.appendChild(editControlsDiv);

            item.appendChild(displayView);
            item.appendChild(editView);
            fragment.appendChild(item);
        });

        // 一次性更新 DOM，減少閃爍
        preScriptsList.innerHTML = '';
        preScriptsList.appendChild(fragment);

        // 使用 requestAnimationFrame 確保在重繪前恢復滾動位置
        requestAnimationFrame(() => {
            preScriptsList.scrollTop = currentScrollTop;
        });
    }

    // Modal 的事件監聽器
    preExecBtn.onclick = async () => {
        modal.style.display = 'flex';
        await renderPreScripts();
    };

    closeBtn.onclick = () => {
        modal.style.display = 'none';
    };

    // Removed: clicking outside modal no longer closes it
    // window.onclick = (event) => {
    //     if (event.target == modal) {
    //         modal.style.display = 'none';
    //     }
    // };

    addPreScriptBtn.onclick = async () => {
        const newScript = newPreScriptInput.value.trim();
        if (newScript) {
            const scripts = await getPreScripts();
            scripts.push({ code: newScript, enabled: true });
            await savePreScripts(scripts);
            newPreScriptInput.value = '';
        }
    };

    // 匯入匯出按鈕事件
    const importBtn = document.getElementById('import-scripts-btn');
    const exportBtn = document.getElementById('export-scripts-btn');
    const openLocationBtn = document.getElementById('open-location-btn');

    if (importBtn) importBtn.onclick = importScripts;
    if (exportBtn) exportBtn.onclick = exportScripts;
    if (openLocationBtn) openLocationBtn.onclick = async () => {
        await window.electronAPI.openScriptsLocation();
    };

    // === 設定視窗相關元素 ===
    const settingsModal = document.getElementById('settings-modal');
    const settingsBtn = document.getElementById('settings-btn');
    const settingsCloseBtn = document.getElementById('settings-close-btn');
    const saveSettingsBtn = document.getElementById('save-settings-btn');
    const resetSettingsBtn = document.getElementById('reset-settings-btn');
    const keepTempFileCheckbox = document.getElementById('keep-temp-file');

    // === 設定按鈕事件 ===
    settingsBtn.onclick = () => {
        settingsModal.style.display = 'flex';
        updateSettingsUI();
    };

    settingsCloseBtn.onclick = () => {
        settingsModal.style.display = 'none';
    };

    // === 修改：更新設定界面函數 ===
    function updateSettingsUI() {
        document.getElementById('indent-tab').checked = editorSettings.indentType === 'tab';
        document.getElementById('indent-spaces').checked = editorSettings.indentType === 'spaces';
        document.getElementById('spaces-count').value = editorSettings.spacesCount;
        document.getElementById('enable-font-zoom').checked = editorSettings.enableFontZoom;
        keepTempFileCheckbox.checked = editorSettings.keepTempFile; //  更新 checkbox 狀態

        const spacesCountSetting = document.getElementById('spaces-count-setting');
        spacesCountSetting.style.display = editorSettings.indentType === 'spaces' ? 'block' : 'none';
    }

    // === 縮排類型切換事件 ===
    document.querySelectorAll('input[name="indent-type"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            const oldIndentType = editorSettings.indentType;
            editorSettings.indentType = e.target.value;

            // 如果從Tab切換到spaces，轉換編輯器中現有的Tab
            if (oldIndentType === 'tab' && e.target.value === 'spaces') {
                const content = editor.getValue();
                const spaces = ' '.repeat(editorSettings.spacesCount);
                const convertedContent = content.replace(/\t/g, spaces);
                editor.setValue(convertedContent);
            }
            // 如果從spaces切換到Tab，轉換編輯器中現有的空格
            else if (oldIndentType === 'spaces' && e.target.value === 'tab') {
                const content = editor.getValue();
                const spacesPattern = new RegExp(' '.repeat(editorSettings.spacesCount), 'g');
                const convertedContent = content.replace(spacesPattern, '\t');
                editor.setValue(convertedContent);
            }

            updateSettingsUI();
        });
    });

    // === 空格數量變更事件 ===
    document.getElementById('spaces-count').addEventListener('change', (e) => {
        editorSettings.spacesCount = parseInt(e.target.value);
    });

    // === 字體縮放開關事件 ===
    document.getElementById('enable-font-zoom').addEventListener('change', (e) => {
        editorSettings.enableFontZoom = e.target.checked;
    });

    // ===  暫存檔設定變更事件 ===
    keepTempFileCheckbox.addEventListener('change', (e) => {
        editorSettings.keepTempFile = e.target.checked;
    });

    // === 儲存設定按鈕 ===
    saveSettingsBtn.onclick = async () => {
        await saveSettings();
        applySettings();
        showNotification('設定已儲存', 'success');
        settingsModal.style.display = 'none';
    };

    // === 重置設定按鈕 ===
    resetSettingsBtn.onclick = () => {
        editorSettings = {
            indentType: 'spaces',
            spacesCount: 4,
            enableFontZoom: true,
            fontSize: 14,
            keepTempFile: false
        };
        updateSettingsUI();
        applySettings();
        showNotification('設定已重置', 'info');
    };

    // === 窗格大小調整邏輯 ===
    const resizer = document.getElementById('resizer');

    resizer.addEventListener('mousedown', (e) => {
        e.preventDefault();
        document.addEventListener('mousemove', mouseMoveHandler);
        document.addEventListener('mouseup', mouseUpHandler);
    });

    function mouseMoveHandler(e) {
        const containerHeight = resizer.parentNode.clientHeight;
        const toolbarHeight = document.querySelector('.toolbar').offsetHeight;
        let newEditorHeight = e.clientY - toolbarHeight;

        const minHeight = 50;
        const maxHeight = containerHeight - minHeight - resizer.offsetHeight;

        if (newEditorHeight < minHeight) newEditorHeight = minHeight;
        if (newEditorHeight > maxHeight) newEditorHeight = maxHeight;

        editorPane.style.flexBasis = `${newEditorHeight}px`;
        outputPane.style.flexBasis = `calc(100% - ${newEditorHeight}px - ${resizer.offsetHeight}px)`;

        editor.refresh();
    }

    function mouseUpHandler() {
        document.removeEventListener('mousemove', mouseMoveHandler);
        document.removeEventListener('mouseup', mouseUpHandler);
    }

    // === 字體縮放功能 ===
    function setupFontZoom() {
        const handleWheelZoom = (e, element) => {
            if (!editorSettings.enableFontZoom) return;

            if (e.ctrlKey) {
                e.preventDefault();
                const delta = e.deltaY > 0 ? -1 : 1;
                editorSettings.fontSize = Math.max(8, Math.min(32, editorSettings.fontSize + delta));

                element.style.fontSize = editorSettings.fontSize + 'px';
                if (element.classList.contains('CodeMirror')) {
                    editor.refresh();
                }

                saveSettings();
            }
        };

        // 編輯器字體縮放
        const editorElement = document.querySelector('.CodeMirror');
        if (editorElement) {
            editorElement.addEventListener('wheel', (e) => handleWheelZoom(e, editorElement));
        }

        // 輸出區字體縮放
        const outputElement = document.getElementById('output');
        if (outputElement) {
            outputElement.addEventListener('wheel', (e) => handleWheelZoom(e, outputElement));
        }
    }

    // === 初始化設定功能 ===
    setupFontZoom();
    // 先載入設定，然後套用設定
    loadSettings().then(() => {
        applySettings();
    });

    // === 函數管理 Modal 邏輯 ===
    const addFunctionModal = document.getElementById('add-function-modal');
    const addFunctionBtn = document.getElementById('add-function-btn');
    const addFunctionCloseBtn = document.getElementById('add-function-close-btn');
    const saveFunctionBtn = document.getElementById('save-function-btn');
    
    let currentEditingFunction = null; // 追蹤目前正在編輯的函數

    addFunctionBtn.onclick = () => {
        currentEditingFunction = null;
        clearFunctionForm();
        document.querySelector('#add-function-modal h2').textContent = '新增自訂函數';
        document.getElementById('save-function-btn').textContent = '儲存函數';
        addFunctionModal.style.display = 'flex';
    };

    addFunctionCloseBtn.onclick = () => {
        addFunctionModal.style.display = 'none';
        currentEditingFunction = null;
    };

    function clearFunctionForm() {
        document.getElementById('func-name').value = '';
        document.getElementById('func-desc').value = '';
        document.getElementById('func-params').value = '';
        document.getElementById('func-example').value = '';
        document.getElementById('func-name').disabled = false;
    }

    function populateFunctionForm(func) {
        document.getElementById('func-name').value = func.name;
        document.getElementById('func-desc').value = func.description || '';
        document.getElementById('func-params').value = func.parameters || '';
        document.getElementById('func-example').value = func.example || '';
        document.getElementById('func-name').disabled = false; // 允許編輯時修改函數名稱
    }

    // 從 help 輸出創建編輯函數的功能
    window.editFunction = async function(functionName) {
        const result = await window.electronAPI.getFunction(functionName);
        if (result && result.exact) {
            currentEditingFunction = functionName;
            populateFunctionForm(result.data);
            document.querySelector('#add-function-modal h2').textContent = '編輯自訂函數';
            document.getElementById('save-function-btn').textContent = '更新函數';
            addFunctionModal.style.display = 'flex';
        } else {
            showNotification('找不到指定的函數', 'error');
        }
    };

    // 刪除函數的功能 - 美化彈窗
    window.deleteFunction = async function(functionName) {
        return new Promise((resolve) => {
            // 創建美化的刪除確認彈窗
            const deleteModal = document.createElement('div');
            deleteModal.className = 'modal';
            deleteModal.style.display = 'flex';
            deleteModal.innerHTML = `
                <div class="modal-content" style="max-width: 400px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.3);">
                    <div style="text-align: center; padding: 20px 0 10px 0;">
                        <div style="font-size: 48px; color: #ff6b6b; margin-bottom: 15px;">⚠️</div>
                        <h3 style="margin: 0 0 10px 0; color: #333;">確認刪除</h3>
                        <p style="margin: 0; color: #666; line-height: 1.4;">
                            確定要刪除函數 <strong style="color: #333;">"${functionName}"</strong> 嗎？<br>
                            <small style="color: #999;">此操作無法復原</small>
                        </p>
                    </div>
                    <div style="display: flex; gap: 10px; padding: 20px; border-top: 1px solid #eee;">
                        <button id="confirm-delete" style="
                            flex: 1; padding: 10px; border: none; border-radius: 4px; 
                            background: #ff6b6b; color: white; font-weight: bold; cursor: pointer;
                            transition: background 0.2s;
                        ">確定刪除</button>
                        <button id="cancel-delete" style="
                            flex: 1; padding: 10px; border: 1px solid #ddd; border-radius: 4px; 
                            background: white; color: #666; cursor: pointer;
                            transition: all 0.2s;
                        ">取消</button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(deleteModal);
            
            // 按鈕 hover 效果
            const confirmBtn = deleteModal.querySelector('#confirm-delete');
            const cancelBtn = deleteModal.querySelector('#cancel-delete');
            
            confirmBtn.onmouseover = () => confirmBtn.style.background = '#ff5252';
            confirmBtn.onmouseout = () => confirmBtn.style.background = '#ff6b6b';
            cancelBtn.onmouseover = () => {
                cancelBtn.style.background = '#f5f5f5';
                cancelBtn.style.borderColor = '#ccc';
            };
            cancelBtn.onmouseout = () => {
                cancelBtn.style.background = 'white';
                cancelBtn.style.borderColor = '#ddd';
            };
            
            // 事件處理
            confirmBtn.onclick = async () => {
                confirmBtn.disabled = true;
                confirmBtn.textContent = '刪除中...';
                confirmBtn.style.background = '#ccc';
                
                const result = await window.electronAPI.deleteFunction(functionName);
                document.body.removeChild(deleteModal);
                
                if (result.success) {
                    showNotification('函數已刪除', 'success');
                    // 如果當前顯示的是函數列表，需要重新觸發 help 來更新
                    if (outputEl.innerHTML.includes('可用的自訂函數列表')) {
                        // 模擬點擊執行按鈕重新載入列表
                        setTimeout(() => {
                            const currentScript = editor.getValue();
                            if (currentScript.trim().match(/^\s*help\s+(\"([^\"]*)\"|(\w+))\s*$/i)) {
                                runBtn.click();
                            }
                        }, 100);
                    }
                } else {
                    showNotification(`刪除失敗: ${result.message}`, 'error');
                }
                resolve();
            };
            
            cancelBtn.onclick = () => {
                document.body.removeChild(deleteModal);
                resolve();
            };
            
            // ESC 鍵取消
            const handleKeyDown = (e) => {
                if (e.key === 'Escape') {
                    document.body.removeChild(deleteModal);
                    document.removeEventListener('keydown', handleKeyDown);
                    resolve();
                }
            };
            document.addEventListener('keydown', handleKeyDown);
            
            // Removed: clicking outside modal no longer closes it
            // 點擊外部關閉
            // deleteModal.onclick = (e) => {
            //     if (e.target === deleteModal) {
            //         document.body.removeChild(deleteModal);
            //         resolve();
            //     }
            // };
        });
    };

    saveFunctionBtn.onclick = async () => {
        const func = {
            name: document.getElementById('func-name').value.trim(),
            description: document.getElementById('func-desc').value.trim(),
            parameters: document.getElementById('func-params').value.trim(),
            example: document.getElementById('func-example').value.trim(),
        };

        if (!func.name) {
            showNotification('函數名稱不能為空', 'error');
            return;
        }

        let result;
        if (currentEditingFunction) {
            // 檢查函數名稱是否有變更
            if (currentEditingFunction !== func.name) {
                // 函數名稱已變更，需要先刪除舊函數再新增新函數
                const deleteResult = await window.electronAPI.deleteFunction(currentEditingFunction);
                if (!deleteResult.success) {
                    showNotification(`刪除舊函數失敗: ${deleteResult.message}`, 'error');
                    return;
                }
                result = await window.electronAPI.addFunction(func);
            } else {
                // 函數名稱未變更，直接更新
                result = await window.electronAPI.updateFunction(func);
            }
        } else {
            result = await window.electronAPI.addFunction(func);
        }

        if (result.success) {
            showNotification(currentEditingFunction ? '函數已更新' : '函數已成功儲存', 'success');
            addFunctionModal.style.display = 'none';
            clearFunctionForm();
            currentEditingFunction = null;
        } else {
            showNotification(`${currentEditingFunction ? '更新' : '儲存'}失敗: ${result.message}`, 'error');
        }
    };

    // === 連結檢測和處理功能 ===
    
    /**
     * 檢測文字中的URL
     * @param {string} text - 要檢測的文字
     * @returns {Array} 包含URL資訊的陣列
     */
    function detectUrls(text) {
        // 改進的 URL 正則表達式，更精確且支援多種格式
        const urlPatterns = [
            // 完整協議 URL (http/https/ftp/file)
            /(?:https?|ftp|file):\/\/(?:[-\w._~:/?#[\]@!$&'()*+,;=]|%[0-9a-f]{2})+/gi,
            // www. 開頭的域名
            /\bwww\.(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}(?::\d+)?(?:\/(?:[-\w._~:/?#[\]@!$&'()*+,;=]|%[0-9a-f]{2})*)?/gi,
            // 純域名 (需要至少一個點和有效 TLD)
            /\b(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+(?:[a-z]{2,}|xn--[a-z0-9]+)(?::\d+)?(?:\/(?:[-\w._~:/?#[\]@!$&'()*+,;=]|%[0-9a-f]{2})*)?(?=[\s\])}>"'\u4e00-\u9fff]|$)/gi,
            // IP 地址 (IPv4)
            /\b(?:(?:https?|ftp):\/\/)?(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)(?::\d+)?(?:\/(?:[-\w._~:/?#[\]@!$&'()*+,;=]|%[0-9a-f]{2})*)?/gi,
            // localhost 和本地域名
            /\blocalhost(?::\d+)?(?:\/(?:[-\w._~:/?#[\]@!$&'()*+,;=]|%[0-9a-f]{2})*)?/gi
        ];
        
        const urls = [];
        const foundRanges = []; // 避免重複檢測
        
        urlPatterns.forEach(pattern => {
            let match;
            pattern.lastIndex = 0; // 重置正則狀態
            
            while ((match = pattern.exec(text)) !== null) {
                const start = match.index;
                const end = start + match[0].length;
                
                // 檢查是否與已找到的URL重疊
                const overlaps = foundRanges.some(range => 
                    (start < range.end && end > range.start)
                );
                
                if (!overlaps) {
                    let url = match[0];
                    
                    // 移除結尾的標點符號（如果不是URL的一部分）
                    url = url.replace(/[.,;:!?）】}"'\u3002\uff0c\uff1b\uff1a\uff01\uff1f\u300d]+$/, '');
                    
                    // 規範化 URL
                    let normalizedUrl;
                    if (/^(?:https?|ftp|file):\/\//i.test(url)) {
                        normalizedUrl = url;
                    } else if (/^www\./i.test(url)) {
                        normalizedUrl = `https://${url}`;
                    } else if (/^localhost/i.test(url)) {
                        normalizedUrl = `http://${url}`;
                    } else if (/^\d+\.\d+\.\d+\.\d+/.test(url)) {
                        // IP 地址
                        normalizedUrl = url.startsWith('http') ? url : `http://${url}`;
                    } else {
                        // 純域名
                        normalizedUrl = `https://${url}`;
                    }
                    
                    urls.push({
                        url: url,
                        start: start,
                        end: start + url.length,
                        normalizedUrl: normalizedUrl
                    });
                    
                    foundRanges.push({ start: start, end: start + url.length });
                }
            }
        });
        
        // 按位置排序
        return urls.sort((a, b) => a.start - b.start);
    }

    /**
     * 將文字中的URL轉換為可點擊的連結
     * @param {string} text - 原始文字
     * @returns {string} 處理後的HTML字串
     */
    function processLinksInText(text) {
        const urls = detectUrls(text);
        
        if (urls.length === 0) {
            return escapeHtml(text);
        }
        
        let result = '';
        let lastIndex = 0;
        
        urls.forEach(urlInfo => {
            // 添加URL前的文字
            result += escapeHtml(text.substring(lastIndex, urlInfo.start));
            
            // 添加可點擊的連結
            result += `<span class="output-link" data-url="${escapeHtml(urlInfo.normalizedUrl)}" title="Ctrl+點擊開啟連結">${escapeHtml(urlInfo.url)}</span>`;
            
            lastIndex = urlInfo.end;
        });
        
        // 添加最後剩餘的文字
        result += escapeHtml(text.substring(lastIndex));
        
        return result;
    }

    /**
     * 處理包含HTML的內容中的連結
     * @param {string} htmlContent - HTML內容
     * @returns {string} 處理後的HTML內容
     */
    function processLinksInHtml(htmlContent) {
        // 創建一個臨時容器來解析HTML
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = htmlContent;
        
        // 遞歸處理所有文本節點
        function processTextNodes(node) {
            if (node.nodeType === Node.TEXT_NODE) {
                const text = node.textContent;
                const urls = detectUrls(text);
                
                if (urls.length > 0) {
                    // 創建新的HTML內容來替換文本節點
                    const wrapper = document.createElement('span');
                    wrapper.innerHTML = processLinksInText(text);
                    
                    // 替換原來的文本節點
                    node.parentNode.replaceChild(wrapper, node);
                }
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                // 跳過已經是連結的元素
                if (node.classList && node.classList.contains('output-link')) {
                    return;
                }
                
                // 遞歸處理子節點
                const children = Array.from(node.childNodes);
                children.forEach(child => processTextNodes(child));
            }
        }
        
        processTextNodes(tempDiv);
        return tempDiv.innerHTML;
    }

    /**
     * 顯示連結確認對話框
     * @param {string} url - 要開啟的URL
     * @returns {Promise<boolean>} 使用者是否確認開啟連結
     */
    function showLinkConfirmation(url) {
        return new Promise((resolve) => {
            // 創建對話框
            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.style.display = 'flex';
            modal.innerHTML = `
                <div class="modal-content link-confirm-modal">
                    <div class="modal-header">
                        <div class="link-icon">🔗</div>
                        <h3>開啟外部連結</h3>
                    </div>
                    <div class="modal-body">
                        <p>您即將開啟以下外部連結：</p>
                        <div class="link-url">${escapeHtml(url)}</div>
                        <p>請確認您信任此連結再繼續。</p>
                    </div>
                    <div class="modal-footer">
                        <button class="btn-open-link" id="confirm-open-link">開啟連結</button>
                        <button class="btn-cancel-link" id="cancel-open-link">取消</button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            const confirmBtn = modal.querySelector('#confirm-open-link');
            const cancelBtn = modal.querySelector('#cancel-open-link');
            
            // 確認開啟
            confirmBtn.onclick = () => {
                document.body.removeChild(modal);
                resolve(true);
            };
            
            // 取消
            cancelBtn.onclick = () => {
                document.body.removeChild(modal);
                resolve(false);
            };
            
            // ESC鍵取消
            const handleKeyDown = (e) => {
                if (e.key === 'Escape') {
                    document.body.removeChild(modal);
                    document.removeEventListener('keydown', handleKeyDown);
                    resolve(false);
                }
            };
            document.addEventListener('keydown', handleKeyDown);
            
            // 聚焦到確認按鈕
            confirmBtn.focus();
        });
    }

    // === Ctrl+點擊連結事件處理 ===
    
    // 為輸出區域添加點擊事件監聽
    outputEl.addEventListener('click', async (e) => {
        // 檢查是否同時按住Ctrl鍵
        if (e.ctrlKey && e.target.classList.contains('output-link')) {
            e.preventDefault();
            e.stopPropagation();
            
            const url = e.target.getAttribute('data-url');
            if (url) {
                // 顯示確認對話框
                const confirmed = await showLinkConfirmation(url);
                if (confirmed) {
                    // 使用Electron的shell來安全地開啟外部連結
                    try {
                        await window.electronAPI.openExternal(url);
                    } catch (error) {
                        console.error('開啟連結失敗:', error);
                        showNotification('開啟連結失敗', 'error');
                    }
                }
            }
        }
    });

    // 精確的連結事件處理 - 只對滑鼠懸停的連結啟用 Ctrl 效果
    function setupLinkEventHandlers() {
        // 使用事件委派處理動態生成的連結
        outputEl.addEventListener('mouseenter', (e) => {
            if (e.target.classList.contains('output-link')) {
                // 滑鼠進入連結時，檢查 Ctrl 鍵狀態
                if (e.ctrlKey) {
                    e.target.classList.add('ctrl-hover');
                }
            }
        }, true); // 使用捕獲模式
        
        outputEl.addEventListener('mouseleave', (e) => {
            if (e.target.classList.contains('output-link')) {
                // 滑鼠離開連結時，移除高亮
                e.target.classList.remove('ctrl-hover');
            }
        }, true);
        
        // 當在連結上按下或釋放 Ctrl 鍵時更新樣式
        outputEl.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.target.classList.contains('output-link')) {
                e.target.classList.add('ctrl-hover');
            }
        });
        
        outputEl.addEventListener('keyup', (e) => {
            if (!e.ctrlKey && e.target.classList.contains('output-link')) {
                e.target.classList.remove('ctrl-hover');
            }
        });
        
        // 全域鍵盤事件 - 更新當前懸停的連結
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey) {
                // 找到當前滑鼠懸停的連結
                const hoveredLink = document.querySelector('.output-link:hover');
                if (hoveredLink) {
                    hoveredLink.classList.add('ctrl-hover');
                }
            }
        });
        
        document.addEventListener('keyup', (e) => {
            if (!e.ctrlKey) {
                // 移除所有 ctrl-hover 樣式
                document.querySelectorAll('.output-link.ctrl-hover').forEach(link => {
                    link.classList.remove('ctrl-hover');
                });
            }
        });
    }
    // 初始化連結事件處理器
    setupLinkEventHandlers();
});

// 開啟暫存檔按鈕事件
const openTempFileBtn = document.getElementById('open-temp-file-btn');
openTempFileBtn.addEventListener('click', async () => {
    const success = await window.electronAPI.openTempFile();
    if (!success) {
        showNotification('找不到暫存檔或檔案已刪除', 'warning');
    }
});