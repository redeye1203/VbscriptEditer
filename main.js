// main.js

const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron'); // 新增 shell
const path = require('path');
const fs = require('fs/promises');
const os = require('os');
const { spawn } = require('child_process');
const iconv = require('iconv-lite');
const sqlite3 = require('sqlite3').verbose();
const VBSBeautifier = require('./vbsbeaut.js');

// --- 新增：SQLite 資料庫路徑與暫存檔路徑 ---
const dbPath = path.join(app.getPath('userData'), 'vbs-editor.db');
const tempVbsPath = path.join(os.tmpdir(), 'vbs-editor-temp'); // 新增暫存檔資料夾
let db = null;

async function initDatabase() {
    return new Promise((resolve, reject) => {
        db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('開啟資料庫失敗:', err);
                reject(err);
                return;
            }

            db.run('PRAGMA journal_mode=WAL;', (err) => {
                if (err) {
                    console.error('啟用 WAL 模式失敗:', err);
                } else {
                    console.log('SQLite WAL 模式已啟用');
                }
            });

            db.serialize(() => {
                // 預執行腳本表
                db.run(`CREATE TABLE IF NOT EXISTS pre_scripts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    code TEXT NOT NULL,
                    enabled INTEGER DEFAULT 1,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )`, (err) => {
                    if (err) console.error('建立 pre_scripts 表失敗:', err);
                });

                // 編輯器設定表
                db.run(`CREATE TABLE IF NOT EXISTS editor_settings (
                    id INTEGER PRIMARY KEY CHECK (id = 1),
                    indent_type TEXT DEFAULT 'spaces',
                    spaces_count INTEGER DEFAULT 4,
                    enable_font_zoom INTEGER DEFAULT 1,
                    font_size INTEGER DEFAULT 14,
                    keep_temp_file INTEGER DEFAULT 0,  -- 新增: 預設不保留暫存檔
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )`, (err) => {
                    if (err) console.error('建立 editor_settings 表失敗:', err);

                    // 插入預設設定（如果不存在），並新增 keep_temp_file 欄位
                    db.run(`INSERT OR IGNORE INTO editor_settings (id, indent_type, spaces_count, enable_font_zoom, font_size, keep_temp_file)
                            VALUES (1, 'spaces', 4, 1, 14, 0)`, (err) => {
                        if (err) console.error('插入預設編輯器設定失敗:', err);

                        // 處理舊版本資料庫升級，如果沒有 keep_temp_file 欄位，則新增
                        db.run(`ALTER TABLE editor_settings ADD COLUMN keep_temp_file INTEGER DEFAULT 0`, (alterErr) => {
                            if (alterErr) {
                                // 如果是「Duplicate column name」錯誤，表示欄位已存在，忽略
                                if (!alterErr.message.includes('duplicate column name')) {
                                    console.error('新增 keep_temp_file 欄位失敗:', alterErr);
                                }
                            }
                            // 新增：自訂函數表
                            db.run(`CREATE TABLE IF NOT EXISTS functions (
                                id INTEGER PRIMARY KEY AUTOINCREMENT,
                                name TEXT NOT NULL UNIQUE,
                                description TEXT,
                                parameters TEXT,
                                example TEXT,
                                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                            )`, (err) => {
                                if (err) {
                                    console.error('建立 functions 表失敗:', err);
                                    reject(err);
                                } else {
                                    resolve();
                                }
                            });
                        });
                    });
                });
            });
        });
    });
}

// --- 新增：關閉資料庫 ---
function closeDatabase() {
    if (db) {
        db.close((err) => {
            if (err) {
                console.error('關閉資料庫失敗:', err);
            } else {
                console.log('資料庫連接已關閉');
            }
        });
    }
}

// --- 新增：讀取預執行腳本 ---
async function getPreScripts() {
    return new Promise((resolve, reject) => {
        if (!db) {
            reject(new Error('資料庫未初始化'));
            return;
        }

        db.all('SELECT * FROM pre_scripts ORDER BY id ASC', (err, rows) => {
            if (err) {
                console.error('讀取預執行腳本失敗:', err);
                reject(err);
                return;
            }

            const scripts = rows.map(row => ({
                code: row.code,
                enabled: row.enabled === 1
            }));

            resolve(scripts);
        });
    });
}

// --- 新增：儲存預執行腳本 ---
async function savePreScripts(scripts) {
    return new Promise((resolve, reject) => {
        if (!db) {
            reject(new Error('資料庫未初始化'));
            return;
        }

        db.serialize(() => {
            // 清除舊資料
            db.run('DELETE FROM pre_scripts', (err) => {
                if (err) {
                    console.error('清除舊預執行腳本失敗:', err);
                    reject(err);
                    return;
                }

                if (scripts.length === 0) {
                    resolve();
                    return;
                }

                // 插入新資料
                const stmt = db.prepare('INSERT INTO pre_scripts (code, enabled) VALUES (?, ?)');
                let completed = 0;
                let hasError = false;

                scripts.forEach((script, index) => {
                    const scriptObj = typeof script === 'object' ? script : { code: script, enabled: true };

                    stmt.run([scriptObj.code, scriptObj.enabled ? 1 : 0], (err) => {
                        if (err && !hasError) {
                            hasError = true;
                            console.error('插入預執行腳本失敗:', err);
                            reject(err);
                            return;
                        }

                        completed++;
                        if (completed === scripts.length && !hasError) {
                            stmt.finalize();
                            resolve();
                        }
                    });
                });
            });
        });
    });
}

async function getEditorSettings() {
    return new Promise((resolve, reject) => {
        if (!db) {
            reject(new Error('資料庫未初始化'));
            return;
        }

        db.get('SELECT * FROM editor_settings WHERE id = 1', (err, row) => {
            if (err) {
                console.error('讀取編輯器設定失敗:', err);
                reject(err);
                return;
            }

            if (!row) {
                resolve(null);
                return;
            }

            const settings = {
                indentType: row.indent_type,
                spacesCount: row.spaces_count,
                enableFontZoom: row.enable_font_zoom === 1,
                fontSize: row.font_size,
                keepTempFile: row.keep_temp_file === 1 // 新增：正確讀取 keep_temp_file 欄位
            };

            resolve(settings);
        });
    });
}

// 修改：儲存編輯器設定
async function saveEditorSettings(settings) {
    return new Promise((resolve, reject) => {
        if (!db) {
            reject(new Error('資料庫未初始化'));
            return;
        }

        const stmt = `UPDATE editor_settings SET 
                      indent_type = ?, 
                      spaces_count = ?, 
                      enable_font_zoom = ?, 
                      font_size = ?,
                      keep_temp_file = ?,
                      updated_at = CURRENT_TIMESTAMP
                      WHERE id = 1`;

        db.run(stmt, [
            settings.indentType,
            settings.spacesCount,
            settings.enableFontZoom ? 1 : 0,
            settings.fontSize,
            settings.keepTempFile ? 1 : 0 // 新增: 儲存 keep_temp_file
        ], (err) => {
            if (err) {
                console.error('儲存編輯器設定失敗:', err);
                reject(err);
                return;
            }
            resolve();
        });
    });
}

function createWindow() {
    const win = new BrowserWindow({
        width: 1000,
        height: 800,
        backgroundColor: '#1e1e1e',
        icon: path.join(__dirname, 'logo.png'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
        },
    });

    // 關閉前檢查未儲存變更
    win.on('close', async (event) => {
        event.preventDefault();

        try {
            const shouldClose = await win.webContents.executeJavaScript(`
            (async () => {
                if (window.checkUnsavedChanges) {
                    return await window.checkUnsavedChanges();
                }
                return true;
            })()
        `);

            if (shouldClose !== false) {
                win.destroy();
            }
        } catch (error) {
            console.error('檢查未儲存變更時發生錯誤:', error);
            // 如果檢查失敗，直接關閉
            win.destroy();
        }
    });

    win.loadFile('index.html');
    // 在開發時開啟開發者工具
    // win.webContents.openDevTools();
}

app.whenReady().then(async () => {
    try {
        await initDatabase();
        createWindow();
    } catch (error) {
        console.error('初始化資料庫失敗:', error);
        app.quit();
    }

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    closeDatabase();
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('before-quit', () => {
    closeDatabase();
});

// =================== IPC 處理程序 ===================

// 處理從渲染進程獲取預執行腳本的請求
ipcMain.handle('get-pre-scripts', async () => {
    try {
        return await getPreScripts();
    } catch (error) {
        console.error('獲取預執行腳本失敗:', error);
        return [];
    }
});

// 處理從渲染進程保存預執行腳本的請求
ipcMain.handle('save-pre-scripts', async (event, scripts) => {
    try {
        await savePreScripts(scripts);
        return true;
    } catch (error) {
        console.error('儲存預執行腳本失敗:', error);
        return false;
    }
});

// 匯出腳本
ipcMain.handle('export-script', async (event, content, filename) => {
    const { canceled, filePath } = await dialog.showSaveDialog({
        defaultPath: filename,
        filters: [{ name: 'VBScript Files', extensions: ['vbs'] }, { name: 'All Files', extensions: ['*'] }],
    });
    if (canceled || !filePath) {
        return false;
    }
    await fs.writeFile(filePath, content, 'utf-8');
    return true;
});

// 匯入腳本
ipcMain.handle('import-scripts', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [{ name: 'VBScript Files', extensions: ['vbs'] }, { name: 'All Files', extensions: ['*'] }],
    });
    if (canceled || filePaths.length === 0) {
        return null;
    }
    const content = await fs.readFile(filePaths[0], 'utf-8');
    return content;
});

// 打開腳本儲存位置
ipcMain.handle('open-scripts-location', async () => {
    const configDir = path.dirname(dbPath);
    const { shell } = require('electron');
    await shell.openPath(configDir);
});

// 選擇匯出資料夾
ipcMain.handle('select-export-folder', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
        properties: ['openDirectory'],
        title: '選擇匯出資料夾'
    });
    if (canceled || filePaths.length === 0) {
        return null;
    }
    return filePaths[0];
});

// 匯出腳本到指定資料夾
ipcMain.handle('export-script-to-folder', async (event, content, basePath, filename) => {
    const filePath = path.join(basePath, filename);
    await fs.writeFile(filePath, content, 'utf-8');
    return true;
});

// 匯入多個腳本
ipcMain.handle('import-multiple-scripts', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
        properties: ['openFile', 'multiSelections'],
        filters: [{ name: 'VBScript Files', extensions: ['vbs'] }, { name: 'All Files', extensions: ['*'] }],
        title: '選擇要匯入的腳本檔案（可多選）'
    });
    if (canceled || filePaths.length === 0) {
        return null;
    }

    const contents = [];
    for (const filePath of filePaths) {
        const content = await fs.readFile(filePath, 'utf-8');
        contents.push(content);
    }
    return contents;
});


// VBScript (修改: 判斷是否刪除暫存檔)
let lastTempFilePath = null; // 儲存最後一次的暫存檔路徑

ipcMain.handle('execute-vbs', async (event, { vbsCode, keepTempFile }) => {
    // 確保暫存檔資料夾存在
    try {
        await fs.mkdir(tempVbsPath, { recursive: true });
    } catch (err) {
        console.error('建立暫存檔資料夾失敗:', err);
        return { success: false, output: `建立暫存檔案資料夾時發生錯誤: ${err.message}` };
    }

    const tempFilePath = path.join(tempVbsPath, `vbs-script-${Date.now()}.vbs`);
    lastTempFilePath = tempFilePath; // 更新最後一次的暫存檔路徑

    try {
        const contentEncoded = iconv.encode(vbsCode, 'utf16le');
        await fs.writeFile(tempFilePath, contentEncoded);

        return new Promise((resolve) => {
            const child = spawn('cscript', ['//nologo', '//E:VBScript', tempFilePath]);
            
            let stdout = Buffer.alloc(0);
            let stderr = Buffer.alloc(0);
            
            child.stdout.on('data', (data) => {
                stdout = Buffer.concat([stdout, data]);
            });
            
            child.stderr.on('data', (data) => {
                stderr = Buffer.concat([stderr, data]);
            });
            
            child.on('close', (code) => {
                // 如果 keepTempFile 為 false，執行完畢後刪除暫存檔
                if (!keepTempFile) {
                    fs.unlink(tempFilePath).catch(err => console.error(`清理暫存檔失敗: ${tempFilePath}`, err));
                    lastTempFilePath = null; // 清空路徑
                }

                const decodedStdout = iconv.decode(stdout, 'cp950');
                const decodedStderr = iconv.decode(stderr, 'cp950');
                const output = decodedStdout.trim();
                const stderrOutput = decodedStderr.trim();
                
                const error = code !== 0 ? { code } : null;

                const hasVbsError = output.includes('Microsoft VBScript 執行階段錯誤') ||
                    stderrOutput.includes('Microsoft VBScript 執行階段錯誤') ||
                    output.includes('Microsoft VBScript 編譯階段錯誤') ||
                    stderrOutput.includes('Microsoft VBScript 編譯階段錯誤');

                let normalOutput = '';
                let errorOutput = '';
                let hasNormalOutput = false;
                let hasErrorOutput = false;

                // 如果輸出中包含錯誤訊息，嘗試分離正常輸出和錯誤訊息
                if (output) {
                    const hasCompileError = output.includes('Microsoft VBScript 編譯階段錯誤');
                    const hasRuntimeError = output.includes('Microsoft VBScript 執行階段錯誤');
                    
                    if (hasCompileError) {
                        // 編譯階段錯誤：程式碼根本不會執行，所以沒有正常輸出
                        // 但我們仍然檢查是否有任何輸出在錯誤訊息之前
                        const errorIndex = output.indexOf('Microsoft VBScript 編譯階段錯誤');
                        const normalPart = output.substring(0, errorIndex).trim();
                        if (normalPart) {
                            normalOutput = normalPart;
                            hasNormalOutput = true;
                        }
                    } else if (hasRuntimeError) {
                        // 執行階段錯誤：嘗試提取錯誤訊息前的正常輸出
                        const errorIndex = output.indexOf('Microsoft VBScript 執行階段錯誤');
                        const normalPart = output.substring(0, errorIndex).trim();
                        if (normalPart) {
                            normalOutput = normalPart;
                            hasNormalOutput = true;
                        }
                    } else {
                        // 沒有錯誤訊息的正常輸出
                        normalOutput = output;
                        hasNormalOutput = true;
                    }
                }

                if (error || hasVbsError) {
                    hasErrorOutput = true;
                    let errorMessage = hasNormalOutput ? '' : "❌ VBScript 執行失敗 \n\n";

                    if (error && !hasVbsError) {
                        errorMessage += `[執行錯誤]: ${error.message}\n\n`;
                    }

                    // 提取錯誤訊息部分
                    let vbsError = '';
                    if (output.includes('Microsoft VBScript 編譯階段錯誤')) {
                        const errorIndex = output.indexOf('Microsoft VBScript 編譯階段錯誤');
                        vbsError = output.substring(errorIndex).trim();
                    } else if (output.includes('Microsoft VBScript 執行階段錯誤')) {
                        const errorIndex = output.indexOf('Microsoft VBScript 執行階段錯誤');
                        vbsError = output.substring(errorIndex).trim();
                    } else if (stderrOutput.includes('Microsoft VBScript 編譯階段錯誤')) {
                        vbsError = stderrOutput.trim();
                    } else if (stderrOutput.includes('Microsoft VBScript 執行階段錯誤')) {
                        vbsError = stderrOutput.trim();
                    }

                    if (vbsError) {
                        errorMessage += `[VBScript 錯誤]:\n${vbsError}`;
                    } else if (stderrOutput) {
                        errorMessage += `[錯誤輸出]:\n${stderrOutput}`;
                    } else if (!hasVbsError) {
                        errorMessage += `[未知錯誤]: 未提供詳細錯誤訊息`;
                    }

                    errorOutput = errorMessage;

                    // 返回結構化的輸出
                    resolve({ 
                        success: hasNormalOutput, 
                        normalOutput: normalOutput || "",
                        errorOutput: errorOutput || "",
                        hasError: hasErrorOutput
                    });
                } else {
                    resolve({
                        success: true,
                        normalOutput: normalOutput || "程式執行完成，沒有輸出。",
                        errorOutput: "",
                        hasError: false
                    });
                }
            });
        });
    } catch (err) {
        console.error("建立或寫入暫存檔時出錯:", err);
        if (!keepTempFile) {
            fs.unlink(tempFilePath).catch(() => {});
            lastTempFilePath = null;
        }
        return { 
            success: false, 
            normalOutput: "",
            errorOutput: `建立暫存檔案時發生錯誤: ${err.message}`,
            hasError: true
        };
    }
});

// 開啟與儲存檔案
ipcMain.handle('open-file', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [{ name: 'VBScript Files', extensions: ['vbs'] }, { name: 'All Files', extensions: ['*'] }],
    });
    if (canceled || filePaths.length === 0) {
        return null;
    }
    const content = await fs.readFile(filePaths[0], 'utf-8');
    return content;
});

ipcMain.handle('save-file', async (event, content) => {
    const { canceled, filePath } = await dialog.showSaveDialog({
        filters: [{ name: 'VBScript Files', extensions: ['vbs'] }, { name: 'All Files', extensions: ['*'] }],
    });
    if (canceled || !filePath) {
        return false;
    }
    await fs.writeFile(filePath, content, 'utf-8');
    return true;
});

/**
 * @description 處理從渲染進程打開暫存檔的請求。
 * @returns {Promise<boolean>} 成功開啟則返回 true，否則返回 false。
 */
ipcMain.handle('open-temp-file', async () => {
    if (!lastTempFilePath) {
        return false;
    }

    // 檢查檔案是否存在
    try {
        await fs.access(lastTempFilePath);

        let command = '';
        if (process.platform === 'win32') {
            // Windows: 使用 notepad.exe 開啟
            command = `notepad.exe "${lastTempFilePath}"`;
        } else if (process.platform === 'darwin') {
            // macOS: 使用 open 指令搭配 -t 參數（text editor）
            command = `open -t "${lastTempFilePath}"`;
        } else {
            // 其他作業系統，例如 Linux，可以嘗試預設的文字編輯器
            // 這部分可能需要根據實際情況調整
            command = `xdg-open "${lastTempFilePath}"`;
        }

        exec(command, (error) => {
            if (error) {
                console.error(`開啟暫存檔時發生錯誤: ${error.message}`);
                return false;
            }
        });

        return true;
    } catch (err) {
        console.error('檔案不存在或無法存取:', err);
        return false;
    }
});

// 獲取編輯器設定
ipcMain.handle('get-editor-settings', async () => {
    try {
        return await getEditorSettings();
    } catch (error) {
        console.error('獲取編輯器設定失敗:', error);
        return null;
    }
});


// 儲存編輯器設定
ipcMain.handle('save-editor-settings', async (event, settings) => {
    try {
        await saveEditorSettings(settings);
        return true;
    } catch (error) {
        console.error('儲存編輯器設定失敗:', error);
        return false;
    }
});

// 儲存自訂函數
ipcMain.handle('add-function', async (event, func) => {
    return new Promise((resolve) => {
        if (!db) {
            return resolve({ success: false, message: '資料庫未初始化' });
        }

        const { name, description, parameters, example } = func;
        if (!name) {
            return resolve({ success: false, message: '函數名稱不能為空' });
        }

        const stmt = `INSERT INTO functions (name, description, parameters, example)
                    VALUES (?, ?, ?, ?)
                    ON CONFLICT(name) DO UPDATE SET
                    description = excluded.description,
                    parameters = excluded.parameters,
                    example = excluded.example;`;

        db.run(stmt, [name, description, parameters, example], function(err) {
            if (err) {
                console.error('儲存函數失敗:', err);
                return resolve({ success: false, message: err.message });
            }
            resolve({ success: true, message: '函數已儲存' });
        });
    });
});

// 查詢自訂函數
ipcMain.handle('get-function', async (event, name) => {
    return new Promise((resolve) => {
        if (!db) {
            return resolve(null);
        }

        // 首先嘗試完全匹配
        db.get('SELECT * FROM functions WHERE name = ? COLLATE NOCASE', [name], (err, row) => {
            if (err) {
                console.error('查詢函數失敗:', err);
                return resolve(null);
            }

            if (row) {
                // 找到完全匹配的，直接返回
                return resolve({ exact: true, data: row });
            }

            // 如果沒有完全匹配，則進行模糊查詢
            const searchTerm = `%${name}%`;
            db.all('SELECT name FROM functions WHERE name LIKE ? ORDER BY name LIMIT 10', [searchTerm], (err, rows) => {
                if (err) {
                    console.error('模糊查詢函數失敗:', err);
                    return resolve(null);
                }
                // 返回部分匹配的列表
                resolve({ exact: false, data: rows.map(r => r.name) });
            });
        });
    });
});

// 更新自訂函數
ipcMain.handle('update-function', async (event, func) => {
    return new Promise((resolve) => {
        if (!db) {
            return resolve({ success: false, message: '資料庫未初始化' });
        }

        const { name, description, parameters, example } = func;
        if (!name) {
            return resolve({ success: false, message: '函數名稱不能為空' });
        }

        const stmt = `UPDATE functions SET 
                      description = ?, 
                      parameters = ?, 
                      example = ?
                      WHERE name = ? COLLATE NOCASE`;

        db.run(stmt, [description, parameters, example, name], function(err) {
            if (err) {
                console.error('更新函數失敗:', err);
                return resolve({ success: false, message: err.message });
            }
            if (this.changes === 0) {
                return resolve({ success: false, message: '找不到指定的函數' });
            }
            resolve({ success: true, message: '函數已更新' });
        });
    });
});

// 刪除自訂函數
ipcMain.handle('delete-function', async (event, name) => {
    return new Promise((resolve) => {
        if (!db) {
            return resolve({ success: false, message: '資料庫未初始化' });
        }

        if (!name) {
            return resolve({ success: false, message: '函數名稱不能為空' });
        }

        const stmt = `DELETE FROM functions WHERE name = ? COLLATE NOCASE`;

        db.run(stmt, [name], function(err) {
            if (err) {
                console.error('刪除函數失敗:', err);
                return resolve({ success: false, message: err.message });
            }
            if (this.changes === 0) {
                return resolve({ success: false, message: '找不到指定的函數' });
            }
            resolve({ success: true, message: '函數已刪除' });
        });
    });
});

// 獲取所有函數列表
ipcMain.handle('get-all-functions', async (event) => {
    return new Promise((resolve) => {
        if (!db) {
            return resolve({ success: false, message: '資料庫未初始化' });
        }

        db.all('SELECT name, description FROM functions ORDER BY name', (err, rows) => {
            if (err) {
                console.error('獲取函數列表失敗:', err);
                return resolve({ success: false, message: err.message });
            }
            resolve({ success: true, data: rows });
        });
    });
});

// 格式化 VBScript
ipcMain.handle('format-vbs', async (event, vbsCode, options) => {
    try {
        // 使用從渲染器傳來的設定，並提供預設值
        const beautifierOptions = {
            spaces: options?.useSpaces ?? true, // VBSBeautifier 的參數是 spaces
            spaceCount: options?.spaceCount ?? 4
        };
        const beautifier = new VBSBeautifier(beautifierOptions);
        const formattedCode = beautifier.doAll(vbsCode);
        return { success: true, code: formattedCode };
    } catch (error) {
        console.error('格式化 VBScript 失敗:', error);
        return { success: false, message: error.message };
    }
});

// 開啟外部連結
ipcMain.handle('open-external', async (event, url) => {
    try {
        await shell.openExternal(url);
        return { success: true };
    } catch (error) {
        console.error('開啟外部連結失敗:', error);
        return { success: false, message: error.message };
    }
});