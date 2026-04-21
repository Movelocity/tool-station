/**
 * json-v-storage.js
 * 窗格内容持久化：IndexedDB 存大文本，localStorage 存轻量索引。
 * 另含 text-cards 备份 JSON 的导出 / 解析（与 DOM 无关）。
 *
 * 索引结构（localStorage key: "jsonv_index"）：
 *   [{ id, title, hlMode, height, width, x, y, zIndex, createdAt, updatedAt }, ...]
 *
 * IndexedDB（db: "JsonViewerDB", store: "panes"）：
 *   key = pane id，value = { id, content }
 */

const JsonVStorage = (() => {
  const DB_NAME = 'JsonViewerDB';
  const DB_VERSION = 1;
  const STORE_NAME = 'panes';
  const INDEX_KEY = 'jsonv_index';

  /** 与 index.html 中窗格默认尺寸一致，用于导入缺省字段 */
  const BACKUP_DEFAULT_WIDTH = 560;
  const BACKUP_DEFAULT_HEIGHT = 280;
  const BACKUP_APP = 'text-cards';
  const EXPORT_VERSION = 1;

  let _db = null;

  // ── IndexedDB helpers ──

  /** @returns {Promise<IDBDatabase>} */
  function openDB() {
    if (_db) return Promise.resolve(_db);
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => { _db = req.result; resolve(_db); };
      req.onerror = () => reject(req.error);
    });
  }

  /** 写入单个窗格内容 */
  async function putContent(id, content) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put({ id, content });
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  }

  /** 读取单个窗格内容 */
  async function getContent(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(id);
      req.onsuccess = () => resolve(req.result ? req.result.content : '');
      req.onerror = () => reject(req.error);
    });
  }

  /** 删除单个窗格内容 */
  async function deleteContent(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(id);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  }

  // ── localStorage 索引 ──

  function loadIndex() {
    try {
      return JSON.parse(localStorage.getItem(INDEX_KEY)) || [];
    } catch {
      return [];
    }
  }

  function saveIndex(index) {
    localStorage.setItem(INDEX_KEY, JSON.stringify(index));
  }

  /** 更新索引中某个窗格的元数据（不存在则追加） */
  function upsertIndexEntry(entry) {
    const index = loadIndex();
    const pos = index.findIndex(e => e.id === entry.id);
    const prev = pos >= 0 ? index[pos] : {};
    // 兼容老数据：若历史上没有 createdAt，则用旧 updatedAt 回填，最后兜底当前时间。
    const createdAt = prev.createdAt || entry.createdAt || prev.updatedAt || Date.now();
    const updatedAt = Number.isFinite(entry.updatedAt) ? entry.updatedAt : Date.now();
    const merged = { ...prev, ...entry, createdAt, updatedAt };
    if (pos >= 0) {
      index[pos] = merged;
    } else {
      index.push(merged);
    }
    saveIndex(index);
  }

  /** 从索引中移除某个窗格 */
  function removeIndexEntry(id) {
    const index = loadIndex().filter(e => e.id !== id);
    saveIndex(index);
  }

  // ── 组合 API ──

  /**
   * 保存窗格（内容 + 索引元数据）
   * @param {string} id
   * @param {{ title, content, hlMode, height, width, x, y, zIndex }} meta
   */
  async function savePane(id, meta) {
    const { content, ...indexFields } = meta;
    await putContent(id, content);
    upsertIndexEntry({ id, ...indexFields });
  }

  /** 删除窗格（内容 + 索引） */
  async function removePane(id) {
    await deleteContent(id);
    removeIndexEntry(id);
  }

  /**
   * 加载全部窗格数据
   * @returns {Promise<Array<{ id, title, content, hlMode, height, width, x, y, zIndex }>>}
   */
  async function loadAll() {
    const index = loadIndex();
    if (!index.length) return [];
    const results = [];
    for (const entry of index) {
      const content = await getContent(entry.id);
      results.push({ ...entry, content: content || '' });
    }
    return results;
  }

  // ── 备份 JSON（导出 / 导入解析）──

  function backupFilenameStamp() {
    const now = new Date();
    return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
  }

  function downloadJson(filename, payload) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  /**
   * @param {Array<object>} panes 已与 buildPaneSnapshot 结构一致的纯数据
   */
  function buildBackupPayload(panes) {
    return {
      app: BACKUP_APP,
      version: EXPORT_VERSION,
      exportedAt: Date.now(),
      panes,
    };
  }

  /**
   * @param {Array<object>} panes
   */
  function exportPanesToBackupFile(panes) {
    const payload = buildBackupPayload(panes);
    downloadJson(`text-cards-backup-${backupFilenameStamp()}.json`, payload);
  }

  function parseImportPayload(raw) {
    if (!raw || typeof raw !== 'object') return null;
    if (raw.app !== BACKUP_APP || raw.version !== EXPORT_VERSION || !Array.isArray(raw.panes)) {
      return null;
    }
    return raw.panes
      .filter(p => p && typeof p === 'object' && typeof p.title === 'string' && typeof p.content === 'string')
      .map((p, idx) => ({
        id: typeof p.id === 'string' && p.id ? p.id : `pane-import-${Date.now()}-${idx}`,
        title: p.title,
        content: p.content,
        createdAt: Number.isFinite(p.createdAt) ? p.createdAt : Date.now(),
        updatedAt: Number.isFinite(p.updatedAt) ? p.updatedAt : (Number.isFinite(p.createdAt) ? p.createdAt : Date.now()),
        hlMode: typeof p.hlMode === 'string' ? p.hlMode : '',
        minimized: !!p.minimized,
        wordWrap: p.wordWrap !== false,
        height: Number.isFinite(p.height) ? p.height : BACKUP_DEFAULT_HEIGHT,
        width: Number.isFinite(p.width) ? p.width : BACKUP_DEFAULT_WIDTH,
        x: Number.isFinite(p.x) ? p.x : 40 + (idx * 20),
        y: Number.isFinite(p.y) ? p.y : 40 + (idx * 20),
        zIndex: Number.isFinite(p.zIndex) ? p.zIndex : idx + 1,
      }));
  }

  /**
   * @param {string} text
   * @returns {{ ok: true, panes: Array<object> } | { ok: false, error: 'invalid_json' | 'invalid_format' }}
   */
  function parseBackupFileText(text) {
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      return { ok: false, error: 'invalid_json' };
    }
    const panes = parseImportPayload(parsed);
    if (!panes) {
      return { ok: false, error: 'invalid_format' };
    }
    return { ok: true, panes };
  }

  /**
   * @param {File | null | undefined} file
   * @returns {Promise<{ ok: true, panes: Array<object> } | { ok: false, error: 'no_file' | 'invalid_json' | 'invalid_format' }>}
   */
  async function parseBackupFile(file) {
    if (!file) return { ok: false, error: 'no_file' };
    return parseBackupFileText(await file.text());
  }

  return {
    openDB,
    savePane,
    removePane,
    loadAll,
    loadIndex,
    saveIndex,
    EXPORT_VERSION,
    exportPanesToBackupFile,
    parseBackupFileText,
    parseBackupFile,
  };
})();
