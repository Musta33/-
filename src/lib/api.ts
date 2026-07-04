
/**
 * Local API Service as a replacement for Firebase
 */

// Global event bus for real-time local updates
const dataListeners: { id: number; path: string; trigger: (immediate?: boolean) => void }[] = [];
let listenerId = 0;

const triggerUpdate = (path: string) => {
  const base = path.split('/')[0];
  dataListeners.forEach(listener => {
    if (listener.path === path || listener.path === base || listener.path.startsWith(base)) {
      listener.trigger(true);
    }
  });
};

const getAuthToken = () => {
  const token = localStorage.getItem('auth_token');
  return token ? token.replace(/^"|"$/g, '') : null;
};

export const api = {
  get: async (path: string, params?: any, retries = 5) => {
    const searchParams = (params && Object.keys(params).length > 0) ? '?' + new URLSearchParams(params).toString() : '';
    const url = `/api/data/${path}${searchParams}`;
    let response;
    try {
      response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`
        }
      });
    } catch (err) {
      if (retries > 0) {
        console.warn(`Retrying GET ${url}... (${retries} retries left)`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        return api.get(path, params, retries - 1);
      }
      console.warn(`API GET Network Warning for ${url}:`, err);
      // If it's a "Failed to fetch", it might be a temporary network issue or server restart
      throw new Error(`تعذر الاتصال بالخادم (${url}). يرجى التحقق من اتصالك بالإنترنت أو المحاولة لاحقاً.`);
    }

    if (response.status === 429 && retries > 0) {
      await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 2000));
      return api.get(path, params, retries - 1);
    }

    if (response.status === 401 || response.status === 403) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
      window.location.href = '/';
      throw new Error('تم انتهاء صلاحية الجلسة. يرجى تسجيل الدخول مجدداً.');
    }
    
    if (response.status === 404) return null;
    if (!response.ok) {
      const text = await response.text().catch(() => 'Unknown Error');
      throw new Error(text);
    }
    
    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch (e) {
      console.error(`Failed to parse JSON from ${url}. Body starts with: ${text.substring(0, 100)}`);
      throw new SyntaxError(`استجابة غير صالحة من الخادم (JSON parsing failed for ${url})`);
    }
  },
  getOne: async (path: string, id: string, retries = 3) => {
    const url = `/api/data/${path}/${id}`;
    let response;
    try {
      response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`
        }
      });
    } catch (err) {
      if (retries > 0) {
        await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 2000));
        return api.getOne(path, id, retries - 1);
      }
      console.warn(`API GET_ONE Network Warning for ${url}:`, err);
      throw new Error(`تعذر الاتصال بالخادم (${url}). يرجى التحقق من اتصالك بالإنترنت.`);
    }

    if (response.status === 429 && retries > 0) {
        await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 2000));
        return api.getOne(path, id, retries - 1);
    }

    if (response.status === 401 || response.status === 403) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
      window.location.href = '/';
      throw new Error('تم انتهاء صلاحية الجلسة. يرجى تسجيل الدخول مجدداً.');
    }
    
    if (!response.ok) {
      const text = await response.text().catch(() => 'Unknown Error');
      throw new Error(text);
    }
    
    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch (e) {
      console.error(`Failed to parse JSON from ${url}. Body starts with: ${text.substring(0, 100)}`);
      throw new SyntaxError(`استجابة غير صالحة من الخادم (JSON parsing failed for ${url})`);
    }
  },
  post: async (path: string, data: any) => {
    let response;
    try {
      response = await fetch(`/api/data/${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`
        },
        body: JSON.stringify(data)
      });
    } catch (err) {
      console.warn('API POST Error:', err);
      throw new Error(`فشل الاتصال بالخادم: ${err instanceof Error ? err.message : String(err)}`);
    }

    if (response.status === 401 || response.status === 403) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
      window.location.href = '/';
      throw new Error('تم انتهاء صلاحية الجلسة. يرجى تسجيل الدخول مجدداً.');
    }
    if (!response.ok) throw new Error(await response.text());
    triggerUpdate(path);
    return response.json();
  },
  put: async (path: string, id: string, data: any) => {
    let response;
    try {
      response = await fetch(`/api/data/${path}/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`
        },
        body: JSON.stringify(data)
      });
    } catch (err) {
      console.warn('API PUT Error:', err);
      throw new Error(`فشل الاتصال بالخادم: ${err instanceof Error ? err.message : String(err)}`);
    }

    if (response.status === 401 || response.status === 403) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
      window.location.href = '/';
      throw new Error('تم انتهاء صلاحية الجلسة. يرجى تسجيل الدخول مجدداً.');
    }
    if (!response.ok) throw new Error(await response.text());
    triggerUpdate(path);
    return response.json();
  },
  delete: async (path: string, id: string) => {
    let response;
    try {
      response = await fetch(`/api/data/${path}/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`
        }
      });
    } catch (err) {
      console.warn('API DELETE Error:', err);
      throw new Error(`فشل الاتصال بالخادم: ${err instanceof Error ? err.message : String(err)}`);
    }

    if (response.status === 401 || response.status === 403) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
      window.location.href = '/';
      throw new Error('تم انتهاء صلاحية الجلسة. يرجى تسجيل الدخول مجدداً.');
    }
    if (!response.ok) throw new Error(await response.text());
    
    // Check if body is empty (204 No Content)
    if (response.status === 204) {
      triggerUpdate(path);
      return null;
    }
    
    console.log('API Delete: successful status, parsing response');
    triggerUpdate(path);
    return response.json();
  },
  // Specific for auth
  login: async (credentials: any) => {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials)
    }).catch(err => {
      console.warn('API Login Network Error:', err);
      throw new Error(`فشل الاتصال بالخادم: ${err instanceof Error ? err.message : String(err)}`);
    });
    if (!response.ok) {
        const text = await response.text().catch(() => '');
        let errorMessage = `خطأ في تسجيل الدخول (${response.status})`;
        let lockUntil = null;
        try {
          if (text && text.trim().startsWith('{')) {
            const errData = JSON.parse(text);
            errorMessage = errData.message || errorMessage;
            lockUntil = errData.lockUntil || null;
          } else if (text && text.length < 150 && !text.includes('<html>')) {
            errorMessage = text;
          } else if (response.status === 401) {
            errorMessage = 'خطأ في البريد الإلكتروني أو كلمة المرور';
          } else if (response.status === 403) {
            errorMessage = 'الحساب محظور أو غير مصرح له';
          } else if (response.status === 429) {
            errorMessage = 'محاولات كثيرة جداً. يرجى الانتظار.';
          }
        } catch (e) {
          // Fallback
        }
        const error: any = new Error(errorMessage);
        error.lockUntil = lockUntil;
        error.status = response.status;
        throw error;
    }
    return response.json();
  },
  register: async (data: any) => {
    const response = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).catch(err => {
      console.warn('API Register Network Error:', err);
      throw new Error(`فشل الاتصال بالخادم: ${err instanceof Error ? err.message : String(err)}`);
    });
    if (!response.ok) {
        const err = await response.json().catch(() => ({ message: 'فشل إنشاء الحساب' }));
        throw new Error(err.message || 'فشل إنشاء الحساب');
    }
    return response.json();
  },
  unblockCompany: async (companyId: string) => {
    const response = await fetch('/api/admin/unblock-company', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getAuthToken()}`
        },
        body: JSON.stringify({ companyId })
    });
    if (!response.ok) throw new Error('فشل فك الحظر المؤقت');
    return response.json();
  },
  toggleBanCompany: async (companyId: string) => {
    const response = await fetch('/api/admin/toggle-ban-company', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getAuthToken()}`
        },
        body: JSON.stringify({ companyId })
    });
    if (!response.ok) throw new Error('فشل تغيير حالة الحظر النهائي');
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
                id: item.id || item._id,
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
        if (!item) return { id, data: () => null, exists: () => false };
        return {
            id: item.id || item._id,
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
    
    const fetchData = async (immediate = false) => {
        if (!immediate) {
            // Add random jitter between 0 and 2 seconds to stagger initial bursts
            await new Promise(resolve => setTimeout(resolve, Math.random() * 2000));
        }
        try {
            if (q.id) {
                const item = await api.getOne(q.coll, q.id);
                if (!item) {
                    callback({ id: q.id, data: () => null, exists: () => false });
                } else {
                    callback({
                        id: item.id || item._id,
                        data: () => item,
                        exists: () => true
                    });
                }
            } else {
                const data = await api.get(path, q.params);
                callback({
                    docs: data.map((item: any) => ({
                        id: item.id || item._id,
                        data: () => item,
                        exists: () => true
                    })),
                    empty: data.length === 0,
                    size: data.length
                });
            }
        } catch (e) {
            if (errorCallback) errorCallback(e);
        }
    };

    fetchData();
    
    // Register listener for real-time local updates
    const currentListenerId = ++listenerId;
    dataListeners.push({ id: currentListenerId, path: path, trigger: fetchData });

    // Use a longer polling interval to avoid Rate Exceeded errors
    const interval = setInterval(fetchData, 60000); // Polling every 60 seconds
    return () => {
      clearInterval(interval);
      // Remove listener
      const idx = dataListeners.findIndex(l => l.id === currentListenerId);
      if (idx !== -1) dataListeners.splice(idx, 1);
    };
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
