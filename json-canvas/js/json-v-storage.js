/**
 * json-v-storage.js
 * 窗格内容持久化：IndexedDB 存大文本，localStorage 存轻量索引。
 *
 * 索引结构（localStorage key: "jsonv_index"）：
 *   [{ id, title, highlightOn, height, width, x, y, zIndex, updatedAt }, ...]
 *
 * IndexedDB（db: "JsonViewerDB", store: "panes"）：
 *   key = pane id，value = { id, content }
 */

const JsonVStorage = (() => {
  const DB_NAME = 'JsonViewerDB';
  const DB_VERSION = 1;
  const STORE_NAME = 'panes';
  const INDEX_KEY = 'jsonv_index';

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
    const merged = { ...(pos >= 0 ? index[pos] : {}), ...entry, updatedAt: Date.now() };
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
   * @param {{ title, content, highlightOn, height, width, x, y, zIndex }} meta
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
   * @returns {Promise<Array<{ id, title, content, highlightOn, height, width, x, y, zIndex }>>}
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

  return { openDB, savePane, removePane, loadAll, loadIndex, saveIndex };
})();
