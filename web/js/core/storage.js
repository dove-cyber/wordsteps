/* 持久化层:优先 IndexedDB(容量大),失败时自动回退 localStorage(兼容受限环境) */
(function () {
  const WS = (window.WS = window.WS || {});
  const DB_NAME = 'wordsteps';
  const DB_VERSION = 1;

  // ---------------- IndexedDB 实现 ----------------
  function idb() {
    return new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) { reject(new Error('no idb')); return; }
      let req;
      try { req = window.indexedDB.open(DB_NAME, DB_VERSION); } catch (e) { reject(e); return; }
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('banks')) db.createObjectStore('banks', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('cards')) {
          const st = db.createObjectStore('cards', { keyPath: 'id' });
          st.createIndex('bankId', 'bankId', { unique: false });
        }
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  function idbReq(req) {
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  function tx(db, store, mode, fn) {
    return new Promise((resolve, reject) => {
      const t = db.transaction(store, mode);
      const s = t.objectStore(store);
      const out = fn(s);
      t.oncomplete = () => resolve(out && out.__promise ? out.__promise : out);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error || new Error('aborted'));
    });
  }

  // ---------------- localStorage 回退实现 ----------------
  const LS_KEY = 'ws.db.v1';
  function lsLoad() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      return raw ? JSON.parse(raw) : { banks: {}, cards: {}, meta: {} };
    } catch (e) { return { banks: {}, cards: {}, meta: {} }; }
  }
  function lsSave(db) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(db)); } catch (e) { console.warn('localStorage 保存失败', e); }
  }

  // ---------------- 统一 API ----------------
  let engine = null; // 'idb' | 'ls'
  let _db = null;    // idb 连接或 ls 内存对象

  const API = {
    async init() {
      try {
        _db = await idb();
        engine = 'idb';
      } catch (e) {
        _db = lsLoad();
        engine = 'ls';
      }
      return engine;
    },

    engineName() { return engine; },

    // --- meta ---
    async getMeta(key) {
      if (engine === 'idb') {
        return tx(_db, 'meta', 'readonly', (s) => idbReq(s.get(key)));
      }
      return _db.meta[key];
    },
    async setMeta(key, value) {
      if (engine === 'idb') {
        await tx(_db, 'meta', 'readwrite', (s) => s.put({ key, value }));
      } else {
        _db.meta[key] = value; lsSave(_db);
      }
    },

    // --- banks ---
    async getAllBanks() {
      if (engine === 'idb') {
        const banks = await tx(_db, 'banks', 'readonly', (s) => idbReq(s.getAll()));
        return banks || [];
      }
      return Object.values(_db.banks);
    },
    async putBank(bank) {
      if (engine === 'idb') await tx(_db, 'banks', 'readwrite', (s) => s.put(bank));
      else { _db.banks[bank.id] = bank; lsSave(_db); }
    },
    async deleteBank(id) {
      if (engine === 'idb') {
        await tx(_db, 'banks', 'readwrite', (s) => s.delete(id));
        // 同时删除该词库下所有卡片
        const cards = await tx(_db, 'cards', 'readonly', (s) => idbReq(s.index('bankId').getAll(id)));
        await Promise.all((cards || []).map((c) => tx(_db, 'cards', 'readwrite', (s) => s.delete(c.id))));
      } else {
        delete _db.banks[id];
        for (const cid in _db.cards) if (_db.cards[cid].bankId === id) delete _db.cards[cid];
        lsSave(_db);
      }
    },

    // --- cards ---
    async getAllCards() {
      if (engine === 'idb') {
        const cards = await tx(_db, 'cards', 'readonly', (s) => idbReq(s.getAll()));
        return cards || [];
      }
      return Object.values(_db.cards);
    },
    async getCardsByBank(bankId) {
      if (engine === 'idb') {
        const cards = await tx(_db, 'cards', 'readonly', (s) => idbReq(s.index('bankId').getAll(bankId)));
        return cards || [];
      }
      return Object.values(_db.cards).filter((c) => c.bankId === bankId);
    },
    async putCard(card) {
      if (engine === 'idb') await tx(_db, 'cards', 'readwrite', (s) => s.put(card));
      else { _db.cards[card.id] = card; lsSave(_db); }
    },
    async putCards(cards) {
      if (engine === 'idb') {
        await tx(_db, 'cards', 'readwrite', (s) => { cards.forEach((c) => s.put(c)); });
      } else {
        cards.forEach((c) => { _db.cards[c.id] = c; });
        lsSave(_db);
      }
    },
    async deleteCard(id) {
      if (engine === 'idb') await tx(_db, 'cards', 'readwrite', (s) => s.delete(id));
      else { delete _db.cards[id]; lsSave(_db); }
    },
  };

  WS.DB = API;
})();
