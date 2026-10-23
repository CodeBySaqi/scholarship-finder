import React, { useEffect } from 'react';
import { Icon } from './ui.jsx';

export function Sheet({ open, title, onClose, children, footer }) {
  useEffect(() => {
    function key(e) { if (e.key === 'Escape') onClose(); }
    if (open) document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className={'scrim' + (open ? ' is-open' : '')} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="sheet__grab" />
        <div className="sheet__head">
          <h2 className="h2">{title}</h2>
          <button className="iconbtn" type="button" aria-label="Close" onClick={onClose}><Icon name="close" /></button>
        </div>
        {children}
        {footer}
      </div>
    </div>
  );
}
