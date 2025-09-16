// preload.js

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // 將 executeVbs 的參數改為物件
    executeVbs: (code, keepTempFile) => ipcRenderer.invoke('execute-vbs', { vbsCode: code, keepTempFile }),
    openFile: () => ipcRenderer.invoke('open-file'),
    saveFile: (content) => ipcRenderer.invoke('save-file', content),

    // 用於永久保存預執行腳本的 API
    getPreScripts: () => ipcRenderer.invoke('get-pre-scripts'),
    savePreScripts: (scripts) => ipcRenderer.invoke('save-pre-scripts', scripts),
    exportScript: (content, filename) => ipcRenderer.invoke('export-script', content, filename),
    importScripts: () => ipcRenderer.invoke('import-scripts'),
    openScriptsLocation: () => ipcRenderer.invoke('open-scripts-location'),
    selectExportFolder: () => ipcRenderer.invoke('select-export-folder'),
    exportScriptToFolder: (content, basePath, filename) => ipcRenderer.invoke('export-script-to-folder', content, basePath, filename),
    importMultipleScripts: () => ipcRenderer.invoke('import-multiple-scripts'),
    // 在現有 API 後面新增
    getEditorSettings: () => ipcRenderer.invoke('get-editor-settings'),
    saveEditorSettings: (settings) => ipcRenderer.invoke('save-editor-settings', settings),
    // 開啟暫存檔
    openTempFile: () => ipcRenderer.invoke('open-temp-file'),

    // 用於函數管理的新 API
    addFunction: (func) => ipcRenderer.invoke('add-function', func),
    getFunction: (name) => ipcRenderer.invoke('get-function', name),
    updateFunction: (func) => ipcRenderer.invoke('update-function', func),
    deleteFunction: (name) => ipcRenderer.invoke('delete-function', name),
    getAllFunctions: () => ipcRenderer.invoke('get-all-functions'),
    formatVbs: (code, options) => ipcRenderer.invoke('format-vbs', code, options),
    
    // 用於開啟外部連結的 API
    openExternal: (url) => ipcRenderer.invoke('open-external', url),
});