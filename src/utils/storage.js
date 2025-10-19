const parseStorage = (raw) => {
    if (!raw)
        return undefined;
    try {
        const payload = JSON.parse(raw);
        if (payload && typeof payload === 'object' && 'data' in payload) {
            return payload.data;
        }
        return payload;
    }
    catch {
        return undefined;
    }
};
export const storage = {
    get(key, fallback) {
        if (typeof window === 'undefined')
            return fallback;
        try {
            return parseStorage(window.localStorage.getItem(key)) ?? fallback;
        }
        catch {
            return fallback;
        }
    },
    set(key, value) {
        if (typeof window === 'undefined')
            return;
        try {
            const payload = { version: 1, data: value };
            window.localStorage.setItem(key, JSON.stringify(payload));
        }
        catch {
            // Silent fail to avoid breaking UX
        }
    },
    remove(key) {
        if (typeof window === 'undefined')
            return;
        try {
            window.localStorage.removeItem(key);
        }
        catch {
            // ignore
        }
    }
};
export default storage;
