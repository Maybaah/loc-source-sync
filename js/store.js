const Store = (() => {
  const NAME = 'source-sync';
  const SHELF = 'session';

  function open() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(NAME, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(SHELF)) req.result.createObjectStore(SHELF);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  function run(mode, fn) {
    return open().then(db => new Promise((resolve, reject) => {
      const tx = db.transaction(SHELF, mode);
      const req = fn(tx.objectStore(SHELF));
      tx.oncomplete = () => resolve(req ? req.result : undefined);
      tx.onerror = () => reject(tx.error);
    }));
  }

  const put = (key, value) => run('readwrite', s => s.put(value, key)).catch(() => {});
  const get = key => run('readonly', s => s.get(key)).catch(() => undefined);
  const drop = key => run('readwrite', s => s.delete(key)).catch(() => {});
  const clear = () => run('readwrite', s => s.clear()).catch(() => {});

  return { put, get, drop, clear };
})();
