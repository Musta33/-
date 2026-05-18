
/**
 * Local API Service as a replacement for Firebase
 */

const getAuthToken = () => localStorage.getItem('auth_token');

export const api = {
  get: async (path: string, params?: any) => {
    const searchParams = params ? '?' + new URLSearchParams(params).toString() : '';
    const response = await fetch(`/api/data/${path}${searchParams}`, {
      headers: {
        'Authorization': `Bearer ${getAuthToken()}`
      }
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  },
  getOne: async (path: string, id: string) => {
    const response = await fetch(`/api/data/${path}/${id}`, {
      headers: {
        'Authorization': `Bearer ${getAuthToken()}`
      }
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  },
  post: async (path: string, data: any) => {
    const response = await fetch(`/api/data/${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}`
      },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  },
  put: async (path: string, id: string, data: any) => {
    const response = await fetch(`/api/data/${path}/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}`
      },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  },
  delete: async (path: string, id: string) => {
    const response = await fetch(`/api/data/${path}/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${getAuthToken()}`
      }
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  },
  // Specific for auth
  login: async (credentials: any) => {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials)
    });
    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || 'فشل تسجيل الدخول');
    }
    return response.json();
  },
  register: async (data: any) => {
    const response = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || 'فشل إنشاء الحساب');
    }
    return response.json();
  }
};

// --- Firebase Compatibility Layer ---

export const db = {}; // Mock db object

export const auth = {
    signOut: async () => {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
        window.location.reload();
    }
};

export const collection = (db: any, ...pathSegments: string[]) => pathSegments.join('/');
export const doc = (...args: any[]) => {
    // Overloads:
    // doc(db, coll, id)
    // doc(collRef, id)
    // doc(collRef)
    let coll, id;
    if (args.length === 3) {
        // doc(db, path, id)
        coll = args[1];
        id = args[2];
    } else if (args.length === 2) {
        // doc(collRef, id)
        coll = args[0];
        id = args[1];
    } else if (args.length === 1) {
        // doc(collRef)
        coll = args[0];
        id = Date.now().toString() + Math.random().toString(36).substring(2, 7);
    }
    return { coll, id };
};

export const getDocs = async (q: any) => {
    const path = typeof q === 'string' ? q : q.coll;
    const params = typeof q === 'string' ? {} : (q.params || {});
    try {
        const data = await api.get(path, params);
        return {
            docs: data.map((item: any) => ({
                id: item.id,
                data: () => item,
                exists: () => true
            })),
            empty: data.length === 0
        };
    } catch (e) {
        return { docs: [], empty: true };
    }
};

export const getDoc = async (d: any) => {
    const { coll, id } = d;
    try {
        const item = await api.getOne(coll, id);
        return {
            id: item.id,
            data: () => item,
            exists: () => true
        };
    } catch (e) {
        return { exists: () => false };
    }
};

export const setDoc = async (d: any, data: any, options?: any) => {
    const { coll, id } = d;
    // In local API, merge is handled by PUT on the server (which uses spread)
    return api.put(coll, id, data);
};

export const addDoc = async (coll: string, data: any) => {
    return api.post(coll, data);
};

export const updateDoc = async (d: any, data: any) => {
    const { coll, id } = d;
    return api.put(coll, id, data);
};

export const deleteDoc = async (d: any) => {
    const { coll, id } = d;
    return api.delete(coll, id);
};

export const query = (coll: string, ...constraints: any[]) => {
    const params: any = {};
    constraints.forEach(c => {
        if (c.type === 'where') {
            params[c.field] = c.value; // Simple equality for now
        }
    });
    return { coll, params };
};

export const where = (field: string, op: string, value: any) => ({ type: 'where', field, op, value });
export const limit = (n: number) => ({ type: 'limit', value: n });
export const orderBy = (field: string, dir: string = 'asc') => ({ type: 'orderBy', field, dir });
export const serverTimestamp = () => new Date().toISOString();
export const arrayUnion = (...items: any[]) => items; // Mock

export const onSnapshot = (q: any, callback: (snap: any) => void, errorCallback?: (err: any) => void) => {
    // Basic polling or just one-off for now to avoid complexity of websockets in this turn
    // In a real app we'd use WebSockets or SSE
    const path = typeof q === 'string' ? q : (q.coll || (q.id ? `${q.coll}/${q.id}` : q.coll));
    
    const fetchData = async () => {
        try {
            if (q.id) {
                const item = await api.getOne(q.coll, q.id);
                callback({
                    id: item.id,
                    data: () => item,
                    exists: () => true
                });
            } else {
                const data = await api.get(path, q.params);
                callback({
                    docs: data.map((item: any) => ({
                        id: item.id,
                        data: () => item,
                        exists: () => true
                    })),
                    empty: data.length === 0
                });
            }
        } catch (e) {
            if (errorCallback) errorCallback(e);
        }
    };

    fetchData();
    const interval = setInterval(fetchData, 5000); // Polling every 5 seconds
    return () => clearInterval(interval);
};

export const signOut = async (auth: any) => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    window.location.reload();
};

export const onAuthStateChanged = (auth: any, callback: (user: any) => void) => {
    const savedUser = localStorage.getItem('auth_user');
    if (savedUser) {
        try {
            callback(JSON.parse(savedUser));
        } catch (e) {
            callback(null);
        }
    } else {
        callback(null);
    }
    return () => {}; // No-op unsubscribe
};
