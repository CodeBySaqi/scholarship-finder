/* Static checks on the built stylesheet.
   The DOM harness cannot evaluate media queries, so layout guarantees that only
   exist in CSS are asserted here: which rule exists, inside which breakpoint,
   and in what order. Run after `npm run build`, against dist/assets/*.css. */
import fs from 'node:fs';
import path from 'node:path';

const dir = 'dist/assets';
const file = fs.readdirSync(dir).find(f => f.endsWith('.css'));
if (!file) { console.error('no built css — run `npm run build` first'); process.exit(1); }
const css = fs.readFileSync(path.join(dir, file), 'utf8');

const results = [];
const ok = (name, pass, detail = '') => { results.push({ pass }); console.log((pass ? 'PASS ' : 'FAIL ') + name + (detail ? ' — ' + detail : '')); };

/* Split into top-level blocks: prelude → body. Handles nesting inside @media. */
function blocks(source) {
  const out = [];
  let depth = 0, start = 0;
  for (let i = 0; i < source.length; i++) {
    if (source[i] === '{') {
      if (depth === 0) {
        const prelude = source.slice(start, i).trim();
        let j = i, d = 0;
        for (; j < source.length; j++) {
          if (source[j] === '{') d++;
          else if (source[j] === '}') { d--; if (d === 0) break; }
        }
        out.push({ prelude, body: source.slice(i + 1, j), index: out.length });
        i = j;
        start = j + 1;
      }
    }
  }
  return out;
}

const top = blocks(css);
const media = (re) => top.filter(b => b.prelude.startsWith('@media') && re.test(b.prelude));
const phone = media(/max-width:\s*767px/);
const phoneBody = phone.map(b => b.body).join('\n');
const ruleIn = (body, selector) => {
  const m = body.match(new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{([^}]*)\\}', 'g')) || [];
  return m.join('');
};
const compact = (s) => String(s).replace(/\s+/g, '');

/* position of the rule in the whole sheet, so "later wins" can be checked */
const idx = (needle) => css.indexOf(needle);

/* --------------------------------------------------------------- the bar */
/* base rules are selector blocks: the selector is the prelude */
const baseBar = top.filter(b => !b.prelude.startsWith('@') && /\.bottomnav\b/.test(b.prelude));
const phoneBar = ruleIn(phoneBody, '.bottomnav');
const hiddenFrom768 = media(/min-width:\s*768px/).some(b => /\.bottomnav\s*\{[^}]*display:\s*none/.test(b.body));

ok('base .bottomnav rule exists', baseBar.length > 0);
ok('a .bottomnav rule exists inside the phone breakpoint', !!phoneBar, phone[0] ? phone[0].prelude : 'no phone block');
ok('the phone rule is position: fixed', /position:\s*fixed/.test(phoneBar), compact(phoneBar).slice(0, 70));
ok('it is pinned to the bottom edge', /bottom:\s*0/.test(phoneBar));
ok('it spans the full width', /left:\s*0/.test(phoneBar) && /right:\s*0/.test(phoneBar));
ok('it clears the home indicator', /safe-area-inset-bottom/.test(phoneBar));
ok('it wins over the sticky base rule (declared later in the sheet)',
  idx('.bottomnav{position:fixed') > idx('.bottomnav{position:sticky'));
ok('the bar is display:none from 768px up, so fixed never reaches tablet/desktop', hiddenFrom768);

/* ------------------------------------------------- nothing hides underneath */
ok('the page reserves space for the bar',
  /body\[data-shell=app\]\s*\.page/.test(phoneBody.replace(/"/g, '')) &&
  /padding-bottom:\s*calc\(84px/.test(phoneBody), compact(phoneBody).match(/body\[data-shell=app\][^{]*\{[^}]*\}/)?.[0] || '');
ok('toasts sit above the bar', /\.toast-wrap\s*\{[^}]*bottom:\s*calc\(84px/.test(phoneBody));
ok('an open sheet covers the bar', /\.scrim\.is-open(:not\(\.side-scrim\))?\s*\{[^}]*z-index:\s*6\d/.test(phoneBody));
ok('the bar sits below the drawer scrim (z-index 34 < 44)',
  /z-index:\s*34/.test(phoneBar) && /z-index:\s*44/.test(css));

/* ----------------------------------------------------- the rest of the layer */
ok('phone, tablet and desktop breakpoints all present', top.filter(b => b.prelude.startsWith('@media')).length >= 8,
  top.filter(b => b.prelude.startsWith('@media')).map(b => b.prelude.replace('@media ', '')).join(' · '));

const stackOutside = top.filter(b => !b.prelude.startsWith('@') && /\.table--stack/.test(b.body));
ok('stacked-table rules live only inside media queries', stackOutside.length === 0,
  stackOutside.map(b => b.prelude).join(', '));

ok('header search has a phone-only expanded state',
  phone.some(b => /\.hsearch\.is-open \.searchpill--form/.test(b.body)) || media(/max-width/).some(b => /hsearch/.test(b.body)));
ok('sheets become centred dialogs from 768px up',
  media(/min-width:\s*768px/).some(b => /\.scrim\s*\{[^}]*align-items:\s*center/.test(b.body)));
ok('inputs are 16px on phones (no iOS zoom)', media(/max-width:\s*640px/).some(b => /font-size:\s*16px/.test(b.body)));


/* ------------------------------------------- drawer vs scrim vs bottom bar
   The bug this guards against: a rule that lifts any open .scrim to z-index 62
   also lifted the sidebar scrim above the drawer (45), so the menu looked grey
   and unclickable. The elevation rule must exclude the sidebar scrim. */
const elevated = css.match(/\.scrim\.is-open[^{]*\{[^}]*z-index:\s*6\d/);
ok('the sheet elevation rule excludes the sidebar scrim',
  !!elevated && elevated[0].includes(':not(.side-scrim)'), elevated ? elevated[0].slice(0, 60) : 'no elevation rule found');
ok('the drawer sits above its own scrim', /z-index:\s*45/.test(css) && /\.scrim\.side-scrim\s*\{[^}]*z-index:\s*44/.test(css));

ok('the bottom bar hides while the drawer is open',
  /body\.drawer-open \.bottomnav\s*\{[^}]*display:\s*none/.test(css));
ok('that rule is scoped below the desktop breakpoint', /@media \(max-width: 1023px\)\{?[^@]*body\.drawer-open/.test(css) ||
  media(/max-width:\s*1023px/).some(b => /drawer-open/.test(b.body)));


/* --------------------------------------------- the Matches segmented switch
   app.css shrinks .tabs to 12px/9px under 560px; the phone layer must beat it.
   Assert the winning declaration, and that it is at least as big as desktop. */
const tabSizes = [...css.matchAll(/\.tabs button\{([^}]*)\}/g)].map(m => ({ decl: m[1], index: m.index }));
const shrink = tabSizes.find(t => /font-size:\s*12px/.test(t.decl));
/* the phone rule we care about lives in the 767px block, not the 399px trim */
const tabsInPhone = (phoneBody.match(/\.tabs button\{([^}]*)\}/) || [])[1] || '';
const phoneWin = { decl: tabsInPhone, index: css.indexOf('.tabs button{min-height:46px') };
ok('the shrink-to-12px rule exists (the reason it looked small)', !!shrink);
ok('a phone rule restores a 46px tab height', !!phoneWin.decl, phoneWin.decl || 'none');
ok('that rule is declared after the shrink rule, so it wins', !!phoneWin.decl && !!shrink && phoneWin.index > shrink.index);
ok('phone tab text is at least as large as desktop (14px vs 13px)',
  !!phoneWin.decl && Number(/font-size:\s*([\d.]+)px/.exec(phoneWin.decl)[1]) >= 14,
  phoneWin.decl ? /font-size:\s*([\d.]+)px/.exec(phoneWin.decl)[1] + 'px' : '');
ok('phone tabs are at least 44px tall (tap target)', !!phoneWin.decl &&
  Number(/min-height:\s*(\d+)px/.exec(phoneWin.decl)[1]) >= 44);
ok('the "…/count" badge stays legible at 12px or more',
  /\.tabs \.count\{font-size:1[2-9]/.test(css.replace(/ /g, '')) || /\.tabs \.count\s*\{[^}]*font-size:\s*1[2-9]/.test(css));


/* ------------------------------------------- the Matches filter card */
ok('the filter card grid reflows with auto-fit columns',
  /\.mfilter__grid\{[^}]*grid-template-columns:\s*repeat\(auto-fit/.test(css.replace(/\n/g, '')));
ok('it collapses to a single column on a phone',
  /\.mfilter__grid\{grid-template-columns:\s*1fr/.test(phoneBody), phoneBody.match(/\.mfilter__grid\{[^}]*\}/)?.[0] || '');
ok('phone chips inside the card are at least 36px tall (tap target)',
  /\.mfilter \.chip\{min-height:3[6-9]px/.test(phoneBody.replace(/\n/g, '').replace(/;\s*/g, ';')) ||
  /\.mfilter \.chip\{min-height:4\dpx/.test(phoneBody));
ok('the counts are tabular so they do not jiggle',
  /\.mfilter__n\{[^}]*font-variant-numeric:\s*tabular-nums/.test(css));

console.log('\n' + results.filter(r => r.pass).length + '/' + results.length + ' stylesheet checks passed');
process.exit(results.every(r => r.pass) ? 0 : 1);
