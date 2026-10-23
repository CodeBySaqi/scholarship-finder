import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';

const SavedCtx = createContext({ ids: [], rows: [], error: null, toggle: async () => {}, reload: () => {} });
export const useSaved = () => useContext(SavedCtx);

export function SavedProvider({ children }) {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    if (!user) { setRows([]); return; }
    try {
      const r = await api.get('/saved');
      setRows(r.saved);
      setError(null);
    } catch (e) { setRows([]); setError(e.message); }
  }, [user]);

  useEffect(() => { reload(); }, [reload]);

  const toggle = useCallback(async (listingId) => {
    const on = rows.some(r => r.listingId === listingId);
    if (on) { await api.del('/saved/' + listingId); setRows(r => r.filter(x => x.listingId !== listingId)); }
    else {
      const r = await api.post('/saved', { listingId });
      setRows(list => [...list, { ...r.saved, listing: null }]);
    }
    await reload();
    return !on;
  }, [rows, reload]);

  return <SavedCtx.Provider value={{ rows, ids: rows.map(r => r.listingId), toggle, reload, error }}>{children}</SavedCtx.Provider>;
}
