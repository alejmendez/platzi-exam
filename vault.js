// This database belongs to the extension origin, not to the Platzi content script.
globalThis.PlatziVault = {
  async access(provider, operation, value) {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open("platzi-private-settings", 1);
      request.onupgradeneeded = () => request.result.createObjectStore("keys");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error("No se pudo abrir el almacenamiento de claves."));
    });
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction("keys", operation === "get" ? "readonly" : "readwrite");
        const store = tx.objectStore("keys");
        const request = operation === "get" ? store.get(provider) : operation === "delete" ? store.delete(provider) : store.put(value, provider);
        tx.oncomplete = () => resolve(request.result);
        tx.onerror = tx.onabort = () => reject(new Error("No se pudo guardar o leer la API key."));
      });
    } finally { db.close(); }
  }
};
