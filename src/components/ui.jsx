import React, { createContext, useContext, useCallback, useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Alert, Button, Card as HeroCard, CardBody as HeroCardBody, Chip as HeroChip,
  Input as HeroInput, Textarea as HeroTextarea,
  Progress as HeroProgress, Skeleton as HeroSkeleton, Spinner, Switch as HeroSwitch, Tooltip
} from '@heroui/react';
import { ICONS } from './icons.js';

/* ==========================================================================
   Shared primitives — HeroUI components, app layout.

   Every page of the app imports its buttons, cards, chips, tags, progress
   bars, notices, switches and loaders from this file. The public API (names
   and props) has not changed in the move to HeroUI, so pages, the shells and
   the audit suites keep working; what changed is that the paint now comes
   from HeroUI components themed with the app's own tokens in tailwind.config.js.

   The legacy class names (`card`, `btn`, `btn--filled`, `chip`, `tag`, …) are
   kept on the rendered elements: they are stable hooks used by the audit
   suites and by the few legacy anchors that still style themselves, and they
   carry the layout geometry (padding, gap, radius) HeroUI leaves to the
   consumer. Where both set a property, the HeroUI stylesheet loads last and
   wins — see src/styles/heroui.css.
   ========================================================================== */

/* ------------------------------------------------------------------ icons */
export function Icon({ name, size, style, className = '' }) {
  const d = ICONS[name] || ICONS.info;
  const stroke = name === 'sun';
  return (
    <svg className={'ic ' + className} viewBox="0 0 24 24" aria-hidden="true" style={size ? { width: size, height: size } : undefined}
      {...(stroke ? { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' } : {})}>
      <path d={d} />
    </svg>
  );
}

/* ---------------------------------------------------------------- surface */
export function Card({ as: Tag = 'div', className = '', children, ...rest }) {
  return (
    <HeroCard as={Tag} shadow="none" radius="lg" className={'card ' + className} {...rest}>
      {children}
    </HeroCard>
  );
}

/* CardBody is HeroUI's padding/typography wrapper — exported so pages can opt in
   without importing HeroUI directly. */
export function CardSection({ className = '', children, ...rest }) {
  return <HeroCardBody className={className} {...rest}>{children}</HeroCardBody>;
}

const TAG_COLOR = {
  blue: 'primary', primary: 'primary', purple: 'secondary', secondary: 'secondary',
  green: 'success', success: 'success', ok: 'success',
  amber: 'warning', warning: 'warning', warn: 'warning',
  red: 'danger', danger: 'danger', error: 'danger',
  gray: 'default', grey: 'default', neutral: 'default', default: 'default'
};

export function Tag({ tone = '', children, icon }) {
  const color = TAG_COLOR[tone] || 'default';
  return (
    <HeroChip className={'tag ' + (tone ? 'tag--' + tone : '')} color={color} variant="flat"
      size="sm" radius="sm" startContent={icon ? <Icon name={icon} /> : undefined}>
      {children}
    </HeroChip>
  );
}

export function Delta({ value, dir = 'up' }) {
  return <span className={'delta delta--' + (dir === 'down' ? 'down' : dir === 'flat' ? 'flat' : 'up')}>
    <svg viewBox="0 0 24 24" style={{ width: 12, height: 12, fill: 'currentColor' }}><path d={dir === 'down' ? 'M12 16l-6-8h12z' : 'M12 8l6 8H6z'} /></svg>{value}
  </span>;
}

export function StatCard({ label, value, sub, icon = 'bars', tone = 'tone-blue', delta, dir, progress, to }) {
  const inner = (
    <>
      <div className="statcard__top">
        <div><div className="statcard__label">{label}</div><div className="statcard__value">{value}</div></div>
        <span className={'statcard__icon ' + tone}><Icon name={icon} /></span>
      </div>
      <div className="row sp" style={{ gap: 8 }}>
        <span className="statcard__sub">{sub}</span>{delta ? <Delta value={delta} dir={dir} /> : null}
      </div>
      {progress !== undefined && <Progress value={progress} tone="grad" />}
    </>
  );
  return to
    ? <Card as={Link} to={to} className="statcard card--link" style={{ color: 'inherit' }}>{inner}</Card>
    : <Card className="statcard">{inner}</Card>;
}

export function Progress({ value, tone = '', label }) {
  const v = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <HeroProgress aria-label={label || 'Progress'} value={v} size="sm" radius="full"
      color="primary" className={'progress ' + tone}
      classNames={{
        base: 'progress__base',
        track: 'progress__track',
        indicator: tone.includes('grad') ? 'progress__indicator progress--grad' : 'progress__indicator',
        label: 'hidden'
      }} />
  );
}

const NOTICE_COLOR = { info: 'primary', warning: 'warning', danger: 'danger', success: 'success', error: 'danger' };

export function Notice({ tone = 'info', icon, children }) {
  return (
    <Alert className="app-alert" color={NOTICE_COLOR[tone] || 'primary'} variant="flat"
      radius="md" hideIcon={false}
      icon={<Icon name={icon || (tone === 'warning' || tone === 'danger' ? 'alert' : 'info')} />}>
      <span>{children}</span>
    </Alert>
  );
}

export function Empty({ icon = 'search', title, text, action }) {
  return (
    <div className="empty">
      <Icon name={icon} />
      <h2 className="h2">{title}</h2>
      {text && <p className="cap">{text}</p>}
      {action}
    </div>
  );
}

/* Variant names are the app's own (filled / tonal / outlined / text / danger /
   success) and map onto HeroUI's Button variants + colours. */
const BTN_VARIANT = { filled: 'solid', tonal: 'flat', outlined: 'bordered', text: 'light', danger: 'flat', success: 'flat' };
const BTN_COLOR = { filled: 'primary', tonal: 'primary', outlined: 'default', text: 'default', danger: 'danger', success: 'success' };

export function Btn({ as, to, href, variant = 'outlined', size, block, children, icon, isIconOnly, className = '', ...rest }) {
  const cls = ['btn', 'btn--' + variant, size === 'sm' ? 'btn--sm' : '', block ? 'btn--block' : '', className].filter(Boolean).join(' ');
  const props = {
    variant: BTN_VARIANT[variant] || 'bordered',
    color: BTN_COLOR[variant] || 'default',
    size: size === 'sm' ? 'sm' : 'md',
    radius: 'md',
    className: cls,
    fullWidth: !!block,
    isIconOnly: !!isIconOnly,
    startContent: icon && !isIconOnly ? <Icon name={icon} /> : undefined,
    ...rest
  };
  if (to) return <Button as={Link} to={to} {...props}>{children}</Button>;
  if (href) return <Button as="a" href={href} {...props}>{children}</Button>;
  return <Button type={rest.type || 'button'} {...props}>{children}</Button>;
}

export function Field({ label, help, error, children, htmlFor }) {
  return (
    <div className="field">
      {label && <label htmlFor={htmlFor}>{label}</label>}
      {children}
      {help && !error && <span className="help">{help}</span>}
      {error && <span className="err"><Icon name="alert" size={13} />{error}</span>}
    </div>
  );
}

export function SwitchRow({ title, sub, checked, onChange }) {
  return (
    <div className="switch-row">
      <div className="t"><b>{title}</b>{sub && <span>{sub}</span>}</div>
      <HeroSwitch className="switch" size="sm" color="primary" isSelected={!!checked}
        aria-label={title} onValueChange={onChange} />
    </div>
  );
}

/* A bare toggle for the places that draw their own row (filter panels, admin
   forms). Same component SwitchRow uses underneath. */
export function Switch({ checked, onChange, label, disabled, className = 'switch' }) {
  return <HeroSwitch className={className} size="sm" color="primary" isSelected={!!checked}
    isDisabled={!!disabled} aria-label={label} onValueChange={onChange} />;
}

export function Chip({ active, children, onClick, as, to }) {
  const cls = 'chip' + (active ? ' is-on' : '');
  if (to) return <Link className={cls} to={to} aria-pressed={active}>{children}</Link>;
  return (
    <HeroChip as="button" type="button" className={cls} aria-pressed={!!active} onClick={onClick}
      size="sm" radius="sm" variant={active ? 'flat' : 'bordered'} color={active ? 'primary' : 'default'}>
      {children}
    </HeroChip>
  );
}

export function Skeleton({ rows = 3 }) {
  return <div className="col-8">{Array.from({ length: rows }).map((_, i) => (
    <HeroSkeleton key={i} className="sk sk--line" />
  ))}</div>;
}

export function Loader({ label = 'Loading' }) {
  return (
    <div className="boot">
      <Spinner size="sm" color="primary" label={label + '…'} classNames={{ label: 'cap' }} />
    </div>
  );
}

/* ----------------------------------------------------------------- charts */
export function BarChart({ values, labels, height = 160, highlight, showValues = true }) {
  const max = Math.max(...values, 1);
  const bw = 100 / Math.max(values.length, 1);
  return (
    <div className="chart">
      <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" role="img" aria-label="Deadlines per month" style={{ height }}>
        {values.map((v, i) => <rect key={'t' + i} x={`${i * bw + bw * 0.22}%`} y="0" width={`${bw * 0.56}%`} height={height} rx="6" fill="var(--chart-track)" />)}
        {values.map((v, i) => {
          const bh = Math.max(2, (v / max) * height);
          return <rect key={'b' + i} x={`${i * bw + bw * 0.22}%`} y={height - bh} width={`${bw * 0.56}%`} height={bh} rx="6" fill={i === highlight ? 'var(--c1)' : 'var(--c1)'} opacity={i === highlight ? 1 : 0.92} />;
        })}
      </svg>
      {showValues && <div className="barvals">{values.map((v, i) => <span key={i}>{v}</span>)}</div>}
      {labels && <div className="row" style={{ gap: 0, marginTop: 8, fontSize: 11, color: 'var(--text-3)', fontWeight: 600 }}>{labels.map((l, i) => <span key={i} style={{ flex: 1, textAlign: 'center' }}>{l}</span>)}</div>}
    </div>
  );
}

export function AreaChart({ values, height = 150 }) {
  const w = 100;
  const max = Math.max(...values, 1), min = Math.min(...values, 0), span = max - min || 1;
  const pts = values.map((v, i) => [(i / Math.max(values.length - 1, 1)) * w, height - ((v - min) / span) * (height - 14) - 7]);
  const line = (close) => {
    let d = `M${pts[0][0]},${pts[0][1]}`;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i], cx = (a[0] + b[0]) / 2;
      d += ` C${cx},${a[1]} ${cx},${b[1]} ${b[0]},${b[1]}`;
    }
    return close ? d + ` L${w},${height} L0,${height} Z` : d;
  };
  const gid = 'ag' + Math.random().toString(36).slice(2, 8);
  return (
    <div className="chart">
      <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" role="img" aria-label="Trend" style={{ height }}>
        <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--c1)" stopOpacity="0.28" /><stop offset="100%" stopColor="var(--c1)" stopOpacity="0" />
        </linearGradient></defs>
        {[0, 1, 2, 3].map(i => <line key={i} x1="0" y1={(height / 3) * i} x2={w} y2={(height / 3) * i} stroke="var(--chart-grid)" strokeWidth="1" vectorEffect="non-scaling-stroke" />)}
        <path d={line(true)} fill={`url(#${gid})`} />
        <path d={line(false)} fill="none" stroke="var(--c1)" strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
      </svg>
    </div>
  );
}

export function Donut({ segments, centerValue, centerLabel }) {
  const total = segments.reduce((a, s) => a + s.value, 0) || 1;
  const r = 54, c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div className="row" style={{ gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
      <div style={{ position: 'relative', flex: 'none' }}>
        <svg viewBox="0 0 140 140" width="140" height="140" role="img" aria-label="Breakdown">
          <circle r={r} cx="70" cy="70" fill="none" stroke="var(--chart-track)" strokeWidth="16" />
          {segments.map((s, i) => {
            const len = (s.value / total) * c;
            const el = <circle key={i} r={r} cx="70" cy="70" fill="none" stroke={s.color} strokeWidth="16"
              strokeDasharray={`${Math.max(len - 6, 1)} ${c - Math.max(len - 6, 1)}`} strokeDashoffset={-acc} strokeLinecap="round" transform="rotate(-90 70 70)" />;
            acc += len;
            return el;
          })}
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center' }}>
          <div><div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-.8px' }}>{centerValue}</div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600 }}>{centerLabel}</div></div>
        </div>
      </div>
      <div className="col-8 grow" style={{ gap: 10, minWidth: 140 }}>
        {segments.map((s, i) => (
          <div className="legend__item" key={i}>
            <span className="legend__dot" style={{ background: s.color }} />
            <span className="grow">{s.label}</span>
            <b className="w600" style={{ color: 'var(--text)' }}>{s.value}</b>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ toast */
const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((message, action) => {
    const id = Math.random().toString(36).slice(2);
    setItems(list => [...list, { id, message, action }]);
    setTimeout(() => setItems(list => list.filter(i => i.id !== id)), 4200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toast-wrap">
        {items.map(i => (
          <div className="snackbar" key={i.id} style={{ position: 'static', transform: 'none' }}>
            <span>{i.message}</span>
            {i.action && <button type="button" onClick={() => { i.action.fn(); setItems(l => l.filter(x => x.id !== i.id)); }}>{i.action.label}</button>}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

const TRANSIENT = (e) => e && (e.offline || (e.status >= 500));

export function useAsync(fn, deps = []) {
  const [state, setState] = useState({ loading: true, data: null, error: null, errorObj: null });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    setState(s => ({ ...s, loading: true }));

    /* One silent retry for a dropped request or a 5xx: a restarting server should not
       turn into an error page. A real 400/401/403/404 fails straight away. */
    const attempt = (n) => fn().then(
      data => { if (alive) setState({ loading: false, data, error: null, errorObj: null }); },
      e => {
        if (!alive) return;
        if (n > 0 && TRANSIENT(e)) { setTimeout(() => { if (alive) attempt(n - 1); }, 700); return; }
        setState({ loading: false, data: null, error: e.message, errorObj: e });
      }
    );

    attempt(1);
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  return { ...state, reload: () => setTick(t => t + 1) };
}

/* One card for "this could not load" — used wherever a failed request used to leave a
   page blank or throw. Never a white screen, always a way back. */
export function LoadError({ error, onRetry, title = 'This could not load', what = 'page' }) {
  const offline = /reach the server|too long/i.test(String(error || ''));
  return (
    <Card>
      <div className="row" style={{ gap: 10 }}>
        <span className="statcard__icon tone-amber"><Icon name={offline ? 'globe' : 'alert'} /></span>
        <div>
          <div className="h3">{offline ? 'Cannot reach the server' : title}</div>
          <p className="cap">
            {offline
              ? 'The request did not get through. Check your connection and try again.'
              : 'The server answered with an error, so the ' + what + ' is not shown. Nothing was changed.'}
            {error && !offline ? ' (' + error + ')' : ''}
          </p>
        </div>
      </div>
      {onRetry && (
        <div className="row" style={{ gap: 8, marginTop: 12 }}>
          <Btn variant="filled" size="sm" onClick={onRetry}>Try again</Btn>
          <Btn variant="outlined" size="sm" to="/dashboard">Go to dashboard</Btn>
        </div>
      )}
    </Card>
  );
}

export const Disclosure = ({ children }) => <>{children}</>;

export const useTitle = (t) => useMemo(() => { if (typeof document !== 'undefined') document.title = t; return t; }, [t]);

/* Re-exported so pages that want the raw HeroUI primitives (Tooltip, CardBody,
   Avatar, Tabs…) can take them from here instead of adding a second import. */
export { Tooltip };

/* HeroUI form controls, re-pointed so pages never import HeroUI themselves.
   `classNames.inputWrapper` carries the app's own `input` class (styling in
   src/styles/heroui.css), which keeps every existing selector — including
   `#ai-key`, `.path-fields input`, `input--error` — working unchanged. */
export function Input({ className = '', classNames, ...rest }) {
  return (
    <HeroInput variant="bordered" radius="md" size="md" {...rest}
      classNames={{ inputWrapper: ['input', className].filter(Boolean).join(' '), input: 'app-input__el', ...(classNames || {}) }} />
  );
}

export function Textarea({ className = '', classNames, ...rest }) {
  return (
    <HeroTextarea variant="bordered" radius="md" size="md" minRows={3} {...rest}
      classNames={{ inputWrapper: ['input', 'input--area', className].filter(Boolean).join(' '), input: 'app-input__el', ...(classNames || {}) }} />
  );
}

export { Avatar, Badge, Checkbox, RadioGroup, Radio, Select, SelectItem } from '@heroui/react';
