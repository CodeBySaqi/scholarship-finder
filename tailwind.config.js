import fs from 'node:fs';
import path from 'node:path';
import { heroui } from '@heroui/react';

/* HeroUI ships each component's classes as string literals in its own package
   (rounded-medium, h-full, data-[hover=true]:opacity-hover …). Tailwind only
   emits a class it has seen in a scanned file, so every HeroUI dist that is
   actually installed has to be in `content` — scanning only the umbrella
   package silently drops utilities and the components come out half-painted.
   The packages also nest (npm hoisting), hence the two roots. */
function herouiSources() {
  const roots = ['node_modules/@heroui', 'node_modules/@heroui/react/node_modules/@heroui'];
  const out = [];
  for (const root of roots) {
    let names = [];
    try { names = fs.readdirSync(root); } catch { continue; }
    for (const name of names) {
      const dist = path.join(root, name, 'dist');
      if (fs.existsSync(dist)) out.push(dist + '/**/*.{js,mjs}');
    }
  }
  return out;
}

/* ==========================================================================
   Tailwind + HeroUI are here for DESIGN ONLY.

   The app's own layout (sidebar, topbar, bottom bar, footer, grids) is still
   written in src/styles/*.css with the design tokens in tokens.css — HeroUI
   supplies the components (Button, Input, Select, Card, Chip, Modal, Alert,
   Progress, Spinner, Switch, Tabs, Avatar, Badge, Tooltip, Dropdown…) and their
   look. The colours and radii below are the app's own tokens, so HeroUI
   components sit inside the existing design instead of replacing it.

   Preflight is off (see postcss.config.js / heroui.css): Tailwind's reset would
   otherwise flatten the legacy stylesheet the whole app is laid out with.
   ========================================================================== */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}', ...herouiSources()],
  darkMode: ['selector', '[data-theme="dark"]'],
  /* the app ships its own reset in app.css; Tailwind's would flatten it */
  corePlugins: { preflight: false },
  theme: {
    extend: {
      fontFamily: { sans: ['Inter', 'Segoe UI', 'system-ui', '-apple-system', 'Roboto', 'sans-serif'] }
    }
  },
  plugins: [
    heroui({
      defaultTheme: 'light',
      defaultExtendTheme: 'light',
      layout: {
        radius: { small: '10px', medium: '12px', large: '16px' },
        borderWidth: { small: '1px', medium: '1px', large: '2px' },
        boxShadow: {
          small: '0 2px 12px rgba(140, 152, 164, .10)',
          medium: '0 8px 24px rgba(140, 152, 164, .22)',
          large: '0 12px 40px rgba(17, 34, 68, .16)'
        }
      },
      themes: {
        light: {
          colors: {
            background: '#F2F4F9',
            foreground: '#0B1437',
            divider: '#E7EBF3',
            focus: '#1B84FF',
            content1: '#FFFFFF',
            content2: '#F8FAFD',
            content3: '#F2F6FC',
            content4: '#EAEFF6',
            default: {
              50: '#F2F6FC', 100: '#E9F0FA', 200: '#DDE7F4', 300: '#C9D6E7',
              400: '#8494AD', 500: '#5A6A85', 600: '#48566E', 700: '#374458',
              800: '#243049', 900: '#0B1437',
              DEFAULT: '#E9F0FA', foreground: '#374458'
            },
            primary: {
              50: '#E8F1FF', 100: '#D6E8FF', 200: '#B4D4FF', 300: '#84BAFF',
              400: '#4C9BFF', 500: '#1B84FF', 600: '#0E74EC', 700: '#0B5FC0',
              800: '#0A4D9B', 900: '#0A3E7C',
              DEFAULT: '#1B84FF', foreground: '#FFFFFF'
            },
            success: { 50: '#E6F8EF', 100: '#D2F1E1', 200: '#A9E5C6', 300: '#74D6A4', 400: '#3EC97A', 500: '#1DB863', 600: '#16A34A', 700: '#127F3B', 800: '#0F632F', 900: '#0A4521', DEFAULT: '#16A34A', foreground: '#FFFFFF' },
            warning: { 50: '#FFF4E0', 100: '#FFEAC6', 200: '#FFD79B', 300: '#F7BF66', 400: '#F0A93C', 500: '#E39616', 600: '#D98511', 700: '#A85F06', 800: '#854A04', 900: '#633603', DEFAULT: '#D98511', foreground: '#FFFFFF' },
            danger: { 50: '#FDECEC', 100: '#FBDADA', 200: '#F7BCBC', 300: '#F09292', 400: '#EB6B6B', 500: '#E65454', 600: '#E04343', 700: '#B62F2F', 800: '#8F2323', 900: '#681717', DEFAULT: '#E04343', foreground: '#FFFFFF' },
            secondary: { DEFAULT: '#7C4DF0', foreground: '#FFFFFF' }
          }
        },
        dark: {
          colors: {
            background: '#0B0F1A',
            foreground: '#EAF0FA',
            divider: '#232E45',
            focus: '#1B84FF',
            content1: '#131A2A',
            content2: '#172033',
            content3: '#1A2336',
            content4: '#202B42',
            default: {
              50: '#1A2336', 100: '#202B42', 200: '#2A3650', 300: '#3A4763',
              400: '#8593AC', 500: '#A9B6CC', 600: '#C4CEDE', 700: '#D7DFEB',
              800: '#E8EEF7', 900: '#F4F8FF',
              DEFAULT: '#202B42', foreground: '#E8EEF7'
            },
            primary: {
              50: '#10233D', 100: '#123054', 200: '#14406F', 300: '#17558F',
              400: '#1B6FBF', 500: '#1B84FF', 600: '#4C9BFF', 700: '#84BAFF',
              800: '#B4D4FF', 900: '#D6E8FF',
              DEFAULT: '#1B84FF', foreground: '#FFFFFF'
            },
            success: { DEFAULT: '#28C76F', foreground: '#04170C' },
            warning: { DEFAULT: '#FF9F43', foreground: '#1D1104' },
            danger: { DEFAULT: '#FF6B6B', foreground: '#1D0505' }
          }
        }
      }
    })
  ]
};
