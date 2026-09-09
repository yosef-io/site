/**
 * Yosef.io Client Application
 * Handles keyboard shortcuts, SPA hash routing, command palette, live search, and theme switching.
 */
(function () {
  'use strict';

  const state = {
    currentView: 'home',
    themeMode: localStorage.getItem('theme-mode') || 'dark',
    sidebarHidden: localStorage.getItem('sidebar-hidden') === 'true',
    sidebarWidth: parseInt(localStorage.getItem('sidebar-width'), 10) || 250,
    commandPaletteIndex: 0,
    filteredCommandItems: [],
    searchArticles: []
  };

  const elements = {
    views: document.querySelectorAll('.page-view'),
    navItems: document.querySelectorAll('.nav-item[data-view]'),
    themeBtns: document.querySelectorAll('.theme-btn'),
    articleModal: document.getElementById('article-modal'),
    articleModalTitle: document.getElementById('article-modal-title'),
    articleModalMeta: document.getElementById('article-modal-meta'),
    articleModalBody: document.getElementById('article-modal-body'),
    articleModalPermalink: document.getElementById('article-modal-permalink'),
    cmdModal: document.getElementById('cmd-modal'),
    cmdInput: document.getElementById('cmd-input'),
    cmdResults: document.getElementById('cmd-results'),
    toastContainer: document.getElementById('toast-container'),
    sidebar: document.querySelector('.sidebar'),
    sidebarResizer: document.getElementById('sidebar-resizer'),
    sidebarCollapseBtn: document.getElementById('sidebar-collapse-btn'),
    sidebarRevealBtn: document.getElementById('sidebar-reveal-btn'),
    mobileMenuBtn: document.getElementById('mobile-menu-toggle'),
    watermelonBadge: document.getElementById('watermelon-badge-btn'),
    colorMixerBadgeBtn: document.getElementById('color-mixer-badge-btn'),
    sidebarColorMixerBtn: document.getElementById('sidebar-color-mixer-btn'),
    colorMixerModal: document.getElementById('color-mixer-modal'),
    mixerRandomizeBtn: document.getElementById('mixer-randomize-btn'),
    mixerResetBtn: document.getElementById('mixer-reset-btn'),
    mixerCopyBtn: document.getElementById('mixer-copy-btn'),
    mixerSwatchesList: document.getElementById('mixer-swatches-list'),
    mixerPresetsList: document.getElementById('mixer-presets-list'),
    writingCards: document.querySelectorAll('.writing-card')
  };

  // Pre-load searchable articles from Jekyll-generated search.json
  async function loadSearchIndex() {
    try {
      const res = await fetch('/search.json');
      if (res.ok) {
        state.searchArticles = await res.json();
      }
    } catch (e) {
      console.warn('Search index load skipped or failed:', e);
    }
  }

  // Basic markdown parser for inline rendering fallback
  function parseMarkdown(md) {
    if (!md || typeof md !== 'string') return '';
    let html = md;

    // Strip front matter if present
    html = html.replace(/^---[\s\S]*?---\n/, '');

    // Code blocks
    html = html.replace(/```([a-zA-Z0-9_]*)\n([\s\S]*?)```/g, (match, lang, code) => {
      const cleanCode = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return `<pre><code>${cleanCode}</code></pre>`;
    });

    // Inline code
    html = html.replace(/`([^`]+)`/g, (match, code) => {
      const cleanCode = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return `<code>${cleanCode}</code>`;
    });

    // Headers
    html = html.replace(/^#### (.*$)/gim, '<h4>$1</h4>');
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

    // Blockquotes
    html = html.replace(/^\> (.*$)/gim, (match, quote) => {
      const isArabic = /[\u0600-\u06FF]/.test(quote);
      return `<blockquote class="${isArabic ? 'arabic-text' : ''}">${quote}</blockquote>`;
    });

    // Text formatting
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    html = html.replace(/^---$/gim, '<hr>');

    // Paragraphs and lists
    const lines = html.split('\n');
    let inList = false;
    let listType = 'ul';
    let output = [];

    lines.forEach(line => {
      const trimmed = line.trim();
      const isUlItem = trimmed.startsWith('- ') || trimmed.startsWith('* ');
      const isOlItem = /^\d+\.\s/.test(trimmed);

      if (isUlItem || isOlItem) {
        const currentType = isUlItem ? 'ul' : 'ol';
        const content = isUlItem ? trimmed.substring(2) : trimmed.replace(/^\d+\.\s/, '');

        if (!inList) {
          inList = true;
          listType = currentType;
          output.push(`<${listType}>`);
        } else if (listType !== currentType) {
          output.push(`</${listType}>`);
          listType = currentType;
          output.push(`<${listType}>`);
        }
        output.push(`<li>${content}</li>`);
      } else {
        if (inList) {
          inList = false;
          output.push(`</${listType}>`);
        }
        if (trimmed) {
          if (trimmed.startsWith('<h') || trimmed.startsWith('<pre') || trimmed.startsWith('<blockquote') || trimmed.startsWith('<hr')) {
            output.push(trimmed);
          } else {
            const isArabic = /[\u0600-\u06FF]/.test(trimmed);
            output.push(`<p class="${isArabic ? 'arabic-text' : ''}">${trimmed}</p>`);
          }
        }
      }
    });

    if (inList) {
      output.push(`</${listType}>`);
    }

    return output.join('\n');
  }

  // Live timezone clock (Riyadh / Configured Timezone)
  function updateClock() {
    const clockEls = document.querySelectorAll('[data-live-clock]');
    if (!clockEls.length) return;

    clockEls.forEach(clock => {
      const tz = clock.getAttribute('data-timezone') || 'Asia/Riyadh';
      try {
        const timeString = new Date().toLocaleTimeString('en-US', {
          timeZone: tz,
          hour: 'numeric',
          minute: '2-digit'
        });
        clock.textContent = `${timeString.toUpperCase()} RIYADH`;
      } catch (err) {
        const timeString = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        clock.textContent = `${timeString.toUpperCase()} RIYADH`;
      }
    });
  }

  // Toast Notification
  function showToast(message) {
    if (!elements.toastContainer) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    elements.toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(12px)';
      toast.style.transition = 'all 0.2s ease';
      setTimeout(() => toast.remove(), 250);
    }, 3200);
  }

  // Theme Management
  function applyTheme(mode) {
    state.themeMode = mode;
    localStorage.setItem('theme-mode', mode);
    document.documentElement.setAttribute('data-theme-mode', mode);

    let effectiveTheme = mode;
    if (mode === 'auto') {
      effectiveTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    if (effectiveTheme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }

    elements.themeBtns.forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-theme') === mode);
    });

    if (elements.colorMixerModal && elements.colorMixerModal.classList.contains('open')) {
      renderMixerSwatches();
      renderMixerPresets();
    }
  }

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (state.themeMode === 'auto') {
      applyTheme('auto');
    }
  });

  // Sidebar Width & Visibility Management
  const SIDEBAR_CONFIG = {
    DEFAULT_WIDTH: 250,
    MIN_WIDTH: 180,
    MAX_WIDTH: 480
  };

  function applySidebarWidth(width) {
    state.sidebarWidth = width;
    document.documentElement.style.setProperty('--sidebar-width', `${width}px`);
  }

  function saveSidebarWidth(width) {
    try {
      localStorage.setItem('sidebar-width', width);
    } catch (_) {}
  }

  function resetSidebarWidth() {
    applySidebarWidth(SIDEBAR_CONFIG.DEFAULT_WIDTH);
    saveSidebarWidth(SIDEBAR_CONFIG.DEFAULT_WIDTH);
    showToast(`Sidebar width reset to ${SIDEBAR_CONFIG.DEFAULT_WIDTH}px`);
  }

  function toggleSidebar(forceState) {
    if (window.innerWidth <= 900) {
      if (elements.sidebar) {
        if (typeof forceState === 'boolean') {
          elements.sidebar.classList.toggle('open', forceState);
        } else {
          elements.sidebar.classList.toggle('open');
        }
      }
      return;
    }

    const isCurrentlyHidden = document.documentElement.classList.contains('sidebar-hidden') || document.body.classList.contains('sidebar-hidden');
    const shouldHide = typeof forceState === 'boolean' ? forceState : !isCurrentlyHidden;

    state.sidebarHidden = shouldHide;
    if (shouldHide) {
      document.documentElement.classList.add('sidebar-hidden');
      document.body.classList.add('sidebar-hidden');
      try { localStorage.setItem('sidebar-hidden', 'true'); } catch (_) {}
      showToast('Sidebar hidden · Press [ or click icon to show');
    } else {
      document.documentElement.classList.remove('sidebar-hidden');
      document.body.classList.remove('sidebar-hidden');
      try { localStorage.setItem('sidebar-hidden', 'false'); } catch (_) {}
    }
  }

  function initSidebarResizer() {
    if (!elements.sidebarResizer) return;

    let isResizing = false;

    function onPointerMove(e) {
      if (!isResizing) return;
      e.preventDefault();
      const maxWidth = Math.min(SIDEBAR_CONFIG.MAX_WIDTH, Math.floor(window.innerWidth * 0.55));
      const clampedWidth = Math.round(Math.min(Math.max(e.clientX, SIDEBAR_CONFIG.MIN_WIDTH), maxWidth));
      applySidebarWidth(clampedWidth);
    }

    function onPointerUp(e) {
      if (!isResizing) return;
      isResizing = false;
      document.body.classList.remove('is-resizing-sidebar');
      if (elements.sidebarResizer) {
        elements.sidebarResizer.classList.remove('is-active');
        try {
          elements.sidebarResizer.releasePointerCapture(e.pointerId);
        } catch (_) {}
      }
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      saveSidebarWidth(state.sidebarWidth);
    }

    elements.sidebarResizer.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      if (window.innerWidth <= 900) return;
      e.preventDefault();
      isResizing = true;
      document.body.classList.add('is-resizing-sidebar');
      elements.sidebarResizer.classList.add('is-active');
      try {
        elements.sidebarResizer.setPointerCapture(e.pointerId);
      } catch (_) {}
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
      window.addEventListener('pointercancel', onPointerUp);
    });

    elements.sidebarResizer.addEventListener('dblclick', () => {
      resetSidebarWidth();
    });
  }

  window.toggleSidebar = toggleSidebar;
  window.resetSidebarWidth = resetSidebarWidth;

  // ==========================================
  // Color Mixer Studio & Procedural Generator
  // ==========================================

  const COLOR_PRESETS = [
    {
      name: 'Default Palette',
      id: 'default',
      isDefault: true,
      palette: null
    },
    {
      name: 'Cyberpunk Neon (Default Dark)',
      id: 'cyberpunk',
      isDark: true,
      palette: {
        '--bg-primary': '#0a0b16',
        '--bg-surface': '#161932',
        '--bg-surface-elevated': '#22274c',
        '--bg-surface-card': '#0e1022',
        '--bg-surface-soft': '#070810',
        '--bg-subtle': 'rgba(22, 25, 50, 0.65)',
        '--bg-hover': 'rgba(0, 240, 255, 0.16)',
        '--text-primary': '#f2f6ff',
        '--text-secondary': '#93a1c8',
        '--accent-primary': '#00f0ff',
        '--accent-danger': '#ff0055',
        '--accent-warning': '#ffb703',
        '--accent-success': '#06d6a0',
        '--border-subtle': 'rgba(0, 240, 255, 0.2)',
        '--border-strong': 'rgba(0, 240, 255, 0.42)',
        '--border-active': '#00f0ff',
        '--accent-soft': 'rgba(0, 240, 255, 0.18)',
        '--accent-hover': '#4df5ff',
        '--accent-contrast': '#0a0b16',
        '--accent-glow': 'rgba(0, 240, 255, 0.38)',
        '--danger-soft': 'rgba(255, 0, 85, 0.18)',
        '--badge-bg': 'rgba(0, 240, 255, 0.2)',
        '--badge-text': '#70f7ff',
        '--badge-border': 'rgba(0, 240, 255, 0.4)',
        '--card-shadow': '0 2px 8px rgba(0, 0, 0, 0.5)',
        '--card-shadow-hover': '0 8px 24px rgba(0, 0, 0, 0.7), 0 0 0 1px #00f0ff'
      }
    },
    {
      name: 'Oceanic Slate',
      id: 'oceanic',
      isDark: true,
      palette: {
        '--bg-primary': 'rgb(15, 27, 29)',
        '--bg-surface': 'rgb(34, 55, 82)',
        '--bg-surface-elevated': 'rgb(44, 70, 102)',
        '--bg-surface-card': 'rgb(22, 38, 54)',
        '--bg-surface-soft': 'rgb(12, 22, 24)',
        '--bg-subtle': 'rgba(34, 55, 82, 0.65)',
        '--bg-hover': 'rgba(51, 162, 210, 0.15)',
        '--text-primary': 'rgb(229, 240, 242)',
        '--text-secondary': 'rgb(161, 185, 189)',
        '--accent-primary': 'rgb(51, 162, 210)',
        '--accent-danger': 'rgb(203, 75, 75)',
        '--accent-warning': 'rgb(238, 155, 90)',
        '--accent-success': 'rgb(81, 120, 68)',
        '--border-subtle': 'rgba(51, 162, 210, 0.2)',
        '--border-strong': 'rgba(51, 162, 210, 0.4)',
        '--border-active': 'rgb(51, 162, 210)',
        '--accent-soft': 'rgba(51, 162, 210, 0.18)',
        '--accent-hover': '#4db0db',
        '--accent-contrast': 'rgb(15, 27, 29)',
        '--accent-glow': 'rgba(51, 162, 210, 0.35)',
        '--danger-soft': 'rgba(203, 75, 75, 0.18)',
        '--badge-bg': 'rgba(51, 162, 210, 0.2)',
        '--badge-text': '#66c0e5',
        '--badge-border': 'rgba(51, 162, 210, 0.4)',
        '--card-shadow': '0 2px 8px rgba(0, 0, 0, 0.5)',
        '--card-shadow-hover': '0 8px 24px rgba(0, 0, 0, 0.7), 0 0 0 1px rgb(51, 162, 210)'
      }
    },
    {
      name: 'Nordic Forest',
      id: 'forest',
      isDark: true,
      palette: {
        '--bg-primary': '#0c1713',
        '--bg-surface': '#192e26',
        '--bg-surface-elevated': '#244237',
        '--bg-surface-card': '#12231d',
        '--bg-surface-soft': '#08100d',
        '--bg-subtle': 'rgba(25, 46, 38, 0.65)',
        '--bg-hover': 'rgba(74, 222, 128, 0.16)',
        '--text-primary': '#e9f5ef',
        '--text-secondary': '#95b7a7',
        '--accent-primary': '#4ade80',
        '--accent-danger': '#f87171',
        '--accent-warning': '#fbbf24',
        '--accent-success': '#4ade80',
        '--border-subtle': 'rgba(74, 222, 128, 0.2)',
        '--border-strong': 'rgba(74, 222, 128, 0.4)',
        '--border-active': '#4ade80',
        '--accent-soft': 'rgba(74, 222, 128, 0.18)',
        '--accent-hover': '#74e69e',
        '--accent-contrast': '#0c1713',
        '--accent-glow': 'rgba(74, 222, 128, 0.35)',
        '--danger-soft': 'rgba(248, 113, 113, 0.18)',
        '--badge-bg': 'rgba(74, 222, 128, 0.2)',
        '--badge-text': '#86efac',
        '--badge-border': 'rgba(74, 222, 128, 0.38)',
        '--card-shadow': '0 2px 8px rgba(0, 0, 0, 0.5)',
        '--card-shadow-hover': '0 8px 24px rgba(0, 0, 0, 0.7), 0 0 0 1px #4ade80'
      }
    },
    {
      name: 'Sunset Ember',
      id: 'sunset',
      isDark: true,
      palette: {
        '--bg-primary': '#19101d',
        '--bg-surface': '#321c38',
        '--bg-surface-elevated': '#45274d',
        '--bg-surface-card': '#241429',
        '--bg-surface-soft': '#120b15',
        '--bg-subtle': 'rgba(50, 28, 56, 0.65)',
        '--bg-hover': 'rgba(255, 112, 82, 0.16)',
        '--text-primary': '#fdf0f4',
        '--text-secondary': '#cda3be',
        '--accent-primary': '#ff7052',
        '--accent-danger': '#ff3366',
        '--accent-warning': '#fca311',
        '--accent-success': '#52b788',
        '--border-subtle': 'rgba(255, 112, 82, 0.2)',
        '--border-strong': 'rgba(255, 112, 82, 0.4)',
        '--border-active': '#ff7052',
        '--accent-soft': 'rgba(255, 112, 82, 0.18)',
        '--accent-hover': '#ff8e75',
        '--accent-contrast': '#19101d',
        '--accent-glow': 'rgba(255, 112, 82, 0.35)',
        '--danger-soft': 'rgba(255, 51, 102, 0.18)',
        '--badge-bg': 'rgba(255, 112, 82, 0.2)',
        '--badge-text': '#ffa491',
        '--badge-border': 'rgba(255, 112, 82, 0.38)',
        '--card-shadow': '0 2px 8px rgba(0, 0, 0, 0.5)',
        '--card-shadow-hover': '0 8px 24px rgba(0, 0, 0, 0.7), 0 0 0 1px #ff7052'
      }
    },
    {
      name: 'Matcha & Cream (Default Light)',
      id: 'matcha',
      isDark: false,
      palette: {
        '--bg-primary': '#f2f6f1',
        '--bg-surface': '#d6e4d4',
        '--bg-surface-elevated': '#c6dac4',
        '--bg-surface-card': '#f8faf7',
        '--bg-surface-soft': '#e4eee3',
        '--bg-subtle': 'rgba(214, 228, 212, 0.5)',
        '--bg-hover': 'rgba(56, 128, 62, 0.12)',
        '--text-primary': '#192b1b',
        '--text-secondary': '#546b56',
        '--accent-primary': '#38803e',
        '--accent-danger': '#d93838',
        '--accent-warning': '#d97706',
        '--accent-success': '#2d6a4f',
        '--border-subtle': 'rgba(25, 43, 27, 0.14)',
        '--border-strong': 'rgba(25, 43, 27, 0.28)',
        '--border-active': '#38803e',
        '--accent-soft': 'rgba(56, 128, 62, 0.15)',
        '--accent-hover': '#2a632f',
        '--accent-contrast': '#FFFFFF',
        '--accent-glow': 'rgba(56, 128, 62, 0.3)',
        '--danger-soft': 'rgba(217, 56, 56, 0.14)',
        '--badge-bg': 'rgba(56, 128, 62, 0.14)',
        '--badge-text': '#245628',
        '--badge-border': 'rgba(56, 128, 62, 0.3)',
        '--card-shadow': '0 1px 3px rgba(25, 43, 27, 0.05)',
        '--card-shadow-hover': '0 6px 20px rgba(25, 43, 27, 0.1), 0 0 0 1px #38803e'
      }
    },
    {
      name: 'Desert Dune',
      id: 'dune',
      isDark: false,
      palette: {
        '--bg-primary': '#f8f4ed',
        '--bg-surface': '#e7dcd1',
        '--bg-surface-elevated': '#ddcfc2',
        '--bg-surface-card': '#fdfaf5',
        '--bg-surface-soft': '#f0e6dc',
        '--bg-subtle': 'rgba(231, 220, 209, 0.5)',
        '--bg-hover': 'rgba(196, 90, 39, 0.12)',
        '--text-primary': '#32251a',
        '--text-secondary': '#786454',
        '--accent-primary': '#c45a27',
        '--accent-danger': '#cf3030',
        '--accent-warning': '#e08a00',
        '--accent-success': '#4d7c0f',
        '--border-subtle': 'rgba(50, 37, 26, 0.14)',
        '--border-strong': 'rgba(50, 37, 26, 0.28)',
        '--border-active': '#c45a27',
        '--accent-soft': 'rgba(196, 90, 39, 0.15)',
        '--accent-hover': '#9e4419',
        '--accent-contrast': '#FFFFFF',
        '--accent-glow': 'rgba(196, 90, 39, 0.3)',
        '--danger-soft': 'rgba(207, 48, 48, 0.14)',
        '--badge-bg': 'rgba(196, 90, 39, 0.14)',
        '--badge-text': '#8c3d15',
        '--badge-border': 'rgba(196, 90, 39, 0.3)',
        '--card-shadow': '0 1px 3px rgba(50, 37, 26, 0.05)',
        '--card-shadow-hover': '0 6px 20px rgba(50, 37, 26, 0.1), 0 0 0 1px #c45a27'
      }
    },
    {
      name: 'Tokyo Violet',
      id: 'violet',
      isDark: true,
      palette: {
        '--bg-primary': '#121024',
        '--bg-surface': '#252047',
        '--bg-surface-elevated': '#352e64',
        '--bg-surface-card': '#1a1633',
        '--bg-surface-soft': '#0d0b1a',
        '--bg-subtle': 'rgba(37, 32, 71, 0.65)',
        '--bg-hover': 'rgba(168, 85, 247, 0.16)',
        '--text-primary': '#f3f0ff',
        '--text-secondary': '#a8a0cb',
        '--accent-primary': '#a855f7',
        '--accent-danger': '#f43f5e',
        '--accent-warning': '#fbbf24',
        '--accent-success': '#10b981',
        '--border-subtle': 'rgba(168, 85, 247, 0.22)',
        '--border-strong': 'rgba(168, 85, 247, 0.42)',
        '--border-active': '#a855f7',
        '--accent-soft': 'rgba(168, 85, 247, 0.18)',
        '--accent-hover': '#c084fc',
        '--accent-contrast': '#121024',
        '--accent-glow': 'rgba(168, 85, 247, 0.35)',
        '--danger-soft': 'rgba(244, 63, 94, 0.18)',
        '--badge-bg': 'rgba(168, 85, 247, 0.2)',
        '--badge-text': '#d8b4fe',
        '--badge-border': 'rgba(168, 85, 247, 0.38)',
        '--card-shadow': '0 2px 8px rgba(0, 0, 0, 0.5)',
        '--card-shadow-hover': '0 8px 24px rgba(0, 0, 0, 0.7), 0 0 0 1px #a855f7'
      }
    }
  ];

  function generateRandomHarmonicPalette(isDark) {
    const baseHue = Math.floor(Math.random() * 360);
    const harmonyOffsets = [180, 150, 120, 210, 45, 90];
    const accentOffset = harmonyOffsets[Math.floor(Math.random() * harmonyOffsets.length)];
    const accentHue = (baseHue + accentOffset) % 360;
    const dangerHue = (accentHue + 140) % 360;
    const successHue = (baseHue + 115) % 360;

    if (isDark) {
      return {
        '--bg-primary': `hsl(${baseHue}, 28%, 8%)`,
        '--bg-surface': `hsl(${(baseHue + 15) % 360}, 32%, 18%)`,
        '--bg-surface-elevated': `hsl(${(baseHue + 15) % 360}, 34%, 25%)`,
        '--bg-surface-card': `hsl(${(baseHue + 10) % 360}, 28%, 13%)`,
        '--bg-surface-soft': `hsl(${baseHue}, 25%, 10%)`,
        '--bg-subtle': `hsla(${(baseHue + 15) % 360}, 32%, 18%, 0.65)`,
        '--bg-hover': `hsla(${accentHue}, 85%, 62%, 0.16)`,
        '--text-primary': `hsl(${baseHue}, 25%, 94%)`,
        '--text-secondary': `hsl(${(baseHue + 10) % 360}, 20%, 68%)`,
        '--accent-primary': `hsl(${accentHue}, 85%, 62%)`,
        '--accent-danger': `hsl(${dangerHue}, 78%, 60%)`,
        '--accent-warning': `hsl(${(accentHue + 50) % 360}, 85%, 62%)`,
        '--accent-success': `hsl(${successHue}, 60%, 55%)`,
        '--border-subtle': `hsla(${(baseHue + 10) % 360}, 20%, 68%, 0.22)`,
        '--border-strong': `hsla(${(baseHue + 10) % 360}, 20%, 68%, 0.42)`,
        '--border-active': `hsl(${accentHue}, 85%, 62%)`,
        '--accent-soft': `hsla(${accentHue}, 85%, 62%, 0.18)`,
        '--accent-hover': `hsl(${accentHue}, 90%, 72%)`,
        '--accent-contrast': `hsl(${baseHue}, 28%, 8%)`,
        '--accent-glow': `hsla(${accentHue}, 85%, 62%, 0.35)`,
        '--danger-soft': `hsla(${dangerHue}, 78%, 60%, 0.2)`,
        '--danger-hover': `hsl(${dangerHue}, 85%, 68%)`,
        '--danger-contrast': `hsl(${baseHue}, 28%, 8%)`,
        '--badge-bg': `hsla(${accentHue}, 85%, 62%, 0.2)`,
        '--badge-text': `hsl(${accentHue}, 90%, 75%)`,
        '--badge-border': `hsla(${accentHue}, 85%, 62%, 0.38)`,
        '--tag-bg': `hsla(${(baseHue + 15) % 360}, 32%, 18%, 0.85)`,
        '--tag-border': `hsla(${(baseHue + 10) % 360}, 20%, 68%, 0.3)`,
        '--tag-text': `hsl(${baseHue}, 25%, 94%)`,
        '--shortcut-bg': `hsla(${(baseHue + 15) % 360}, 32%, 18%, 0.95)`,
        '--shortcut-border': `hsla(${(baseHue + 10) % 360}, 20%, 68%, 0.32)`,
        '--shortcut-text': `hsl(${baseHue}, 25%, 94%)`,
        '--code-bg': `hsl(${baseHue}, 30%, 6%)`,
        '--code-text': `hsl(${baseHue}, 25%, 94%)`,
        '--code-border': `hsla(${(baseHue + 10) % 360}, 20%, 68%, 0.25)`,
        '--card-shadow': `0 2px 8px rgba(0, 0, 0, 0.5)`,
        '--card-shadow-hover': `0 8px 24px rgba(0, 0, 0, 0.7), 0 0 0 1px hsl(${accentHue}, 85%, 62%)`
      };
    } else {
      return {
        '--bg-primary': `hsl(${baseHue}, 32%, 94%)`,
        '--bg-surface': `hsl(${(baseHue + 15) % 360}, 22%, 82%)`,
        '--bg-surface-elevated': `hsl(${(baseHue + 15) % 360}, 24%, 86%)`,
        '--bg-surface-card': `hsl(${baseHue}, 28%, 97%)`,
        '--bg-surface-soft': `hsl(${(baseHue + 15) % 360}, 20%, 85%)`,
        '--bg-subtle': `hsla(${(baseHue + 15) % 360}, 22%, 82%, 0.5)`,
        '--bg-hover': `hsla(${accentHue}, 90%, 38%, 0.12)`,
        '--text-primary': `hsl(${baseHue}, 50%, 16%)`,
        '--text-secondary': `hsl(${(baseHue + 10) % 360}, 22%, 40%)`,
        '--accent-primary': `hsl(${accentHue}, 90%, 38%)`,
        '--accent-danger': `hsl(${dangerHue}, 80%, 52%)`,
        '--accent-warning': `hsl(${(accentHue + 40) % 360}, 85%, 48%)`,
        '--accent-success': `hsl(${successHue}, 55%, 36%)`,
        '--border-subtle': `hsla(${baseHue}, 50%, 16%, 0.14)`,
        '--border-strong': `hsla(${baseHue}, 50%, 16%, 0.28)`,
        '--border-active': `hsl(${accentHue}, 90%, 38%)`,
        '--accent-soft': `hsla(${accentHue}, 90%, 38%, 0.15)`,
        '--accent-hover': `hsl(${accentHue}, 90%, 30%)`,
        '--accent-contrast': `#FFFFFF`,
        '--accent-glow': `hsla(${accentHue}, 90%, 38%, 0.32)`,
        '--danger-soft': `hsla(${dangerHue}, 80%, 52%, 0.14)`,
        '--danger-hover': `hsl(${dangerHue}, 85%, 44%)`,
        '--danger-contrast': `#FFFFFF`,
        '--badge-bg': `hsla(${accentHue}, 90%, 38%, 0.14)`,
        '--badge-text': `hsl(${accentHue}, 90%, 30%)`,
        '--badge-border': `hsla(${accentHue}, 90%, 38%, 0.3)`,
        '--tag-bg': `hsla(${(baseHue + 15) % 360}, 22%, 82%, 0.55)`,
        '--tag-border': `hsla(${(baseHue + 10) % 360}, 22%, 40%, 0.28)`,
        '--tag-text': `hsl(${baseHue}, 50%, 16%)`,
        '--shortcut-bg': `hsl(${(baseHue + 15) % 360}, 24%, 86%)`,
        '--shortcut-border': `hsla(${(baseHue + 10) % 360}, 22%, 40%, 0.3)`,
        '--shortcut-text': `hsl(${baseHue}, 50%, 16%)`,
        '--code-bg': `hsl(${(baseHue + 15) % 360}, 24%, 88%)`,
        '--code-text': `hsl(${baseHue}, 50%, 16%)`,
        '--code-border': `hsla(${baseHue}, 50%, 16%, 0.15)`,
        '--card-shadow': `0 1px 3px rgba(0, 0, 0, 0.05), 0 4px 12px rgba(0, 0, 0, 0.04)`,
        '--card-shadow-hover': `0 6px 20px rgba(0, 0, 0, 0.1), 0 0 0 1px hsl(${accentHue}, 90%, 38%)`
      };
    }
  }

  function applyCustomPalette(palette, save = true, message = null) {
    for (const [key, val] of Object.entries(palette)) {
      document.documentElement.style.setProperty(key, val);
    }
    if (save) {
      try {
        localStorage.setItem('mixed-color-palette', JSON.stringify(palette));
      } catch (_) {}
    }
    renderMixerSwatches();
    if (message) showToast(message);
  }

  function resetColorsToDefault(showToastMsg = true) {
    const propsToClear = [
      '--bg-primary', '--bg-surface', '--bg-surface-elevated', '--bg-surface-card', '--bg-surface-soft',
      '--bg-subtle', '--bg-hover', '--text-primary', '--text-secondary', '--accent-primary',
      '--accent-danger', '--accent-warning', '--accent-success', '--border-subtle', '--border-strong',
      '--border-active', '--accent-soft', '--accent-hover', '--accent-contrast', '--accent-glow',
      '--danger-soft', '--danger-hover', '--danger-contrast', '--badge-bg', '--badge-text',
      '--badge-border', '--tag-bg', '--tag-border', '--tag-text', '--shortcut-bg', '--shortcut-border',
      '--shortcut-text', '--code-bg', '--code-text', '--code-border', '--card-shadow',
      '--card-shadow-hover', '--watermelon-rind', '--watermelon-inner', '--watermelon-flesh', '--watermelon-seed'
    ];
    propsToClear.forEach(prop => document.documentElement.style.removeProperty(prop));
    try {
      localStorage.removeItem('mixed-color-palette');
    } catch (_) {}
    renderMixerSwatches();
    if (showToastMsg) showToast('Restored default color scheme');
  }

  function mixRandomColors(notify = true) {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const palette = generateRandomHarmonicPalette(isDark);
    applyCustomPalette(palette, true, notify ? '🎨 Mixed colors at random · Press M to mix again' : null);
  }

  function copyPaletteCSS() {
    const computed = getComputedStyle(document.documentElement);
    const cssVars = [
      '--bg-primary',
      '--bg-surface',
      '--text-primary',
      '--text-secondary',
      '--accent-primary',
      '--accent-danger',
      '--accent-warning',
      '--accent-success'
    ];
    const cssLines = cssVars.map(v => `  ${v}: ${computed.getPropertyValue(v).trim()};`).join('\n');
    const cssText = `:root {\n${cssLines}\n}`;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(cssText).then(() => {
        showToast('📋 Palette CSS copied to clipboard!');
      }).catch(() => {
        showToast('Palette values logged in console');
        console.log(cssText);
      });
    } else {
      showToast('Palette values logged in console');
      console.log(cssText);
    }
  }

  function formatColorCode(str) {
    if (!str) return '';
    str = str.trim();
    if (str.startsWith('#')) return str.toUpperCase();
    const rgbMatch = str.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
    if (rgbMatch) {
      const r = parseInt(rgbMatch[1], 10).toString(16).padStart(2, '0');
      const g = parseInt(rgbMatch[2], 10).toString(16).padStart(2, '0');
      const b = parseInt(rgbMatch[3], 10).toString(16).padStart(2, '0');
      return `#${r}${g}${b}`.toUpperCase();
    }
    const hslMatch = str.match(/^hsla?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)%?\s*,\s*(\d+(?:\.\d+)?)%/i);
    if (hslMatch) {
      const h = parseFloat(hslMatch[1]) % 360;
      const s = parseFloat(hslMatch[2]) / 100;
      const l = parseFloat(hslMatch[3]) / 100;
      const a = s * Math.min(l, 1 - l);
      const f = n => {
        const k = (n + h / 30) % 12;
        const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(255 * color).toString(16).padStart(2, '0');
      };
      return `#${f(0)}${f(8)}${f(4)}`.toUpperCase();
    }
    return str.length > 12 ? str.substring(0, 10) + '…' : str;
  }

  function renderMixerSwatches() {
    if (elements.mixerSwatchesList) {
      const computed = getComputedStyle(document.documentElement);
      const swatches = [
        { name: 'Background', key: '--bg-primary' },
        { name: 'Surface', key: '--bg-surface' },
        { name: 'Primary Text', key: '--text-primary' },
        { name: 'Secondary Text', key: '--text-secondary' },
        { name: 'Accent', key: '--accent-primary' },
        { name: 'Danger', key: '--accent-danger' }
      ];

      elements.mixerSwatchesList.innerHTML = swatches.map(s => {
        const rawVal = computed.getPropertyValue(s.key).trim();
        const displayVal = formatColorCode(rawVal);
        return `
          <div class="mixer-swatch-item">
            <div class="mixer-swatch-circle" style="background-color: ${rawVal};"></div>
            <span class="mixer-swatch-name">${s.name}</span>
            <span class="mixer-swatch-val" title="${rawVal}">${displayVal}</span>
          </div>
        `;
      }).join('');
    }
  }

  function renderMixerPresets() {
    if (!elements.mixerPresetsList) return;
    elements.mixerPresetsList.innerHTML = COLOR_PRESETS.map(preset => {
      let c1, c2, c3, c4;
      if (preset.isDefault) {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        if (isDark) {
          c1 = '#0a0b16';
          c2 = '#161932';
          c3 = '#00f0ff';
          c4 = '#ff0055';
        } else {
          c1 = '#f2f6f1';
          c2 = '#d6e4d4';
          c3 = '#38803e';
          c4 = '#d93838';
        }
      } else {
        c1 = preset.palette['--bg-primary'];
        c2 = preset.palette['--bg-surface'];
        c3 = preset.palette['--accent-primary'];
        c4 = preset.palette['--accent-danger'];
      }
      return `
        <div class="mixer-preset-card" data-preset-id="${preset.id}">
          <div class="mixer-preset-colors">
            <div class="mixer-preset-bar" style="background: ${c1};"></div>
            <div class="mixer-preset-bar" style="background: ${c2};"></div>
            <div class="mixer-preset-bar" style="background: ${c3};"></div>
            <div class="mixer-preset-bar" style="background: ${c4};"></div>
          </div>
          <span class="mixer-preset-name">${preset.name}</span>
        </div>
      `;
    }).join('');

    elements.mixerPresetsList.querySelectorAll('.mixer-preset-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.getAttribute('data-preset-id');
        const preset = COLOR_PRESETS.find(p => p.id === id);
        if (!preset) return;
        if (preset.isDefault) {
          resetColorsToDefault(true);
        } else {
          if (preset.isDark) {
            applyTheme('dark');
          } else {
            applyTheme('light');
          }
          applyCustomPalette(preset.palette, true, `🎨 Applied ${preset.name}`);
        }
        renderMixerPresets();
      });
    });
  }

  window.mixRandomColors = mixRandomColors;
  window.resetColorsToDefault = resetColorsToDefault;
  window.openColorMixer = () => {
    openModal(elements.colorMixerModal);
    renderMixerSwatches();
    renderMixerPresets();
  };

  // Client-Side View Navigation
  function navigateTo(viewId) {
    const targetView = document.getElementById(`view-${viewId}`);
    if (!targetView) {
      if (elements.views.length > 0) {
        viewId = 'home';
      } else {
        // We are on a standalone post page — redirect back to the home page with target hash
        window.location.href = `/#${viewId}`;
        return;
      }
    }

    state.currentView = viewId;
    if (window.location.hash !== `#${viewId}`) {
      window.location.hash = viewId === 'home' ? '' : viewId;
    }

    elements.views.forEach(view => {
      view.classList.toggle('active', view.id === `view-${viewId}`);
    });

    elements.navItems.forEach(item => {
      item.classList.toggle('active', item.getAttribute('data-view') === viewId);
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (elements.sidebar && elements.sidebar.classList.contains('open')) {
      elements.sidebar.classList.remove('open');
    }
  }

  window.navigateTo = navigateTo;

  // Modal Dialog Utilities
  function openModal(modalEl) {
    if (!modalEl) return;
    modalEl.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeModal(modalEl) {
    if (!modalEl) return;
    modalEl.classList.remove('open');
    if (!document.querySelector('.modal-overlay.open')) {
      document.body.style.overflow = '';
    }
  }

  function closeAllModals() {
    document.querySelectorAll('.modal-overlay.open').forEach(closeModal);
  }

  // Article Quick-Reader Modal
  async function openArticleModal(url, title, meta, excerptText) {
    if (!elements.articleModal) return;

    if (elements.articleModalTitle) elements.articleModalTitle.textContent = title || 'Article';
    if (elements.articleModalMeta) elements.articleModalMeta.textContent = meta || '';
    if (elements.articleModalPermalink) {
      elements.articleModalPermalink.href = url || '#';
      elements.articleModalPermalink.style.display = url ? 'inline-flex' : 'none';
    }

    if (elements.articleModalBody) {
      elements.articleModalBody.innerHTML = '<p style="color: var(--text-secondary);">Loading article...</p>';
      openModal(elements.articleModal);

      if (url) {
        try {
          const res = await fetch(url);
          if (res.ok) {
            const html = await res.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const postContent = doc.querySelector('.post-content') || doc.querySelector('.markdown-body') || doc.querySelector('main');
            if (postContent) {
              elements.articleModalBody.innerHTML = postContent.innerHTML;
              return;
            }
          }
        } catch (e) {
          console.warn('Direct fetch failed, falling back to excerpt:', e);
        }
      }

      elements.articleModalBody.innerHTML = excerptText 
        ? `<p>${excerptText}</p><hr><p><a href="${url}" class="back-link">Read full post →</a></p>`
        : '<p>Article details unavailable.</p>';
    } else {
      openModal(elements.articleModal);
    }
  }

  // Command Palette (⌘K)
  function initCommandPalette() {
    const paletteItems = [
      { 
        type: 'Navigation', 
        label: 'Go to Home', 
        shortcut: '1', 
        action: () => {
          if (elements.views.length > 0) navigateTo('home');
          else window.location.href = '/#home';
        }
      },
      { 
        type: 'Navigation', 
        label: 'Go to About', 
        shortcut: '2', 
        action: () => {
          if (elements.views.length > 0) navigateTo('about');
          else window.location.href = '/#about';
        }
      },
      { 
        type: 'Navigation', 
        label: 'Go to Writing', 
        shortcut: '3', 
        action: () => {
          if (elements.views.length > 0) navigateTo('writing');
          else window.location.href = '/#writing';
        }
      },
      { 
        type: 'Theme', 
        label: 'Switch to Light Mode', 
        shortcut: 'L', 
        action: () => { 
          applyTheme('light'); 
          showToast('Theme: LIGHT'); 
        }
      },
      { 
        type: 'Theme', 
        label: 'Switch to Dark Mode', 
        shortcut: 'D', 
        action: () => { 
          applyTheme('dark'); 
          showToast('Theme: DARK'); 
        }
      },
      { 
        type: 'Colors', 
        label: 'Mix Colors at Random', 
        shortcut: 'M', 
        action: () => mixRandomColors()
      }
    ];

    function filterCommandPalette(query) {
      const q = query.toLowerCase().trim();

      state.filteredCommandItems = q === ''
        ? paletteItems
        : paletteItems.filter(item => 
            item.label.toLowerCase().includes(q) || 
            item.type.toLowerCase().includes(q) ||
            item.shortcut.toLowerCase() === q
          );

      state.commandPaletteIndex = 0;
      renderCommandResults();
    }

    function renderCommandResults() {
      if (!elements.cmdResults) return;
      if (state.filteredCommandItems.length === 0) {
        elements.cmdResults.innerHTML = `
          <div style="padding: 24px 16px; text-align: center; color: var(--text-secondary); font-size: 13px;">
            No matching command found.
          </div>`;
        return;
      }

      elements.cmdResults.innerHTML = state.filteredCommandItems.map((item, idx) => `
        <div class="cmd-item ${idx === state.commandPaletteIndex ? 'selected' : ''}" data-cmd-idx="${idx}">
          <div class="cmd-item-left">
            <span class="cmd-item-tag">[${item.type}]</span>
            <span style="font-weight: 500;">${item.label}</span>
          </div>
          <span class="shortcut-badge">${item.shortcut}</span>
        </div>
      `).join('');

      elements.cmdResults.querySelectorAll('.cmd-item').forEach(el => {
        el.addEventListener('click', () => {
          const idx = parseInt(el.getAttribute('data-cmd-idx'), 10);
          executeCommand(idx);
        });
      });
    }

    function executeCommand(idx) {
      const item = state.filteredCommandItems[idx];
      if (item && item.action) {
        closeModal(elements.cmdModal);
        item.action();
      }
    }

    if (elements.cmdInput) {
      elements.cmdInput.addEventListener('input', e => {
        filterCommandPalette(e.target.value);
      });

      elements.cmdInput.addEventListener('keydown', e => {
        // Direct execution of single shortcut keys when search box is empty
        if (!e.metaKey && !e.ctrlKey && !e.altKey && elements.cmdInput.value === '') {
          const keyUpper = e.key.toUpperCase();
          if (['1', '2', '3', 'L', 'D', 'M'].includes(keyUpper)) {
            e.preventDefault();
            const matched = paletteItems.find(item => item.shortcut.toUpperCase() === keyUpper);
            if (matched && matched.action) {
              closeModal(elements.cmdModal);
              matched.action();
              return;
            }
          }
        }

        if (e.key === 'ArrowDown') {
          e.preventDefault();
          state.commandPaletteIndex = (state.commandPaletteIndex + 1) % state.filteredCommandItems.length;
          renderCommandResults();
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          state.commandPaletteIndex = (state.commandPaletteIndex - 1 + state.filteredCommandItems.length) % state.filteredCommandItems.length;
          renderCommandResults();
        } else if (e.key === 'Enter') {
          e.preventDefault();
          executeCommand(state.commandPaletteIndex);
        }
      });
    }

    window.openCommandPalette = function () {
      filterCommandPalette('');
      if (elements.cmdInput) elements.cmdInput.value = '';
      openModal(elements.cmdModal);
      setTimeout(() => {
        if (elements.cmdInput) elements.cmdInput.focus();
      }, 50);
    };
  }

  // Keyboard Shortcuts Handler
  function initKeyboardNavigation() {
    window.addEventListener('keydown', e => {
      const activeEl = document.activeElement;
      const isInput = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable);

      // ⌘K or Ctrl+K trigger
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        window.openCommandPalette();
        return;
      }

      // Escape dismiss
      if (e.key === 'Escape') {
        closeAllModals();
        return;
      }

      // If active inside an input/textarea, do not trigger single-character navigation shortcuts
      if (isInput) return;

      // Ctrl+B or Cmd+B to toggle sidebar
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggleSidebar();
        return;
      }

      switch (e.key) {
        case '[':
        case '\\':
          e.preventDefault();
          toggleSidebar();
          break;
        case '1':
          e.preventDefault();
          if (elements.views.length > 0) navigateTo('home');
          else window.location.href = '/#home';
          break;
        case '2':
          e.preventDefault();
          if (elements.views.length > 0) navigateTo('about');
          else window.location.href = '/#about';
          break;
        case '3':
          e.preventDefault();
          if (elements.views.length > 0) navigateTo('writing');
          else window.location.href = '/#writing';
          break;
        case 'l':
        case 'L':
          e.preventDefault();
          applyTheme('light');
          showToast('Theme: LIGHT');
          break;
        case 'd':
        case 'D':
          e.preventDefault();
          applyTheme('dark');
          showToast('Theme: DARK');
          break;
        case 't':
        case 'T':
          e.preventDefault();
          const nextTheme = state.themeMode === 'light' ? 'dark' : 'light';
          applyTheme(nextTheme);
          showToast(`Theme: ${nextTheme.toUpperCase()}`);
          break;
        case 'm':
        case 'M':
          e.preventDefault();
          mixRandomColors();
          break;
      }
    });
  }

  // Setup DOM Event Listeners
  function setupEventListeners() {
    // Navigation clicks
    elements.navItems.forEach(item => {
      item.addEventListener('click', e => {
        const view = item.getAttribute('data-view');
        if (elements.views.length > 0) {
          e.preventDefault();
          navigateTo(view);
        }
      });
    });

    // Theme buttons
    elements.themeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        applyTheme(btn.getAttribute('data-theme'));
      });
    });

    // Mobile sidebar hamburger
    if (elements.mobileMenuBtn && elements.sidebar) {
      elements.mobileMenuBtn.addEventListener('click', () => {
        elements.sidebar.classList.toggle('open');
      });
    }

    // Sidebar collapse / hide button
    if (elements.sidebarCollapseBtn) {
      elements.sidebarCollapseBtn.addEventListener('click', () => {
        toggleSidebar();
      });
    }

    // Sidebar reveal button
    if (elements.sidebarRevealBtn) {
      elements.sidebarRevealBtn.addEventListener('click', () => {
        toggleSidebar(false);
      });
    }

    // Color Mixer Triggers
    if (elements.colorMixerBadgeBtn) {
      elements.colorMixerBadgeBtn.addEventListener('click', () => {
        window.openColorMixer();
      });
    }

    if (elements.sidebarColorMixerBtn) {
      elements.sidebarColorMixerBtn.addEventListener('click', () => {
        window.openColorMixer();
      });
    }

    if (elements.mixerRandomizeBtn) {
      elements.mixerRandomizeBtn.addEventListener('click', () => {
        mixRandomColors();
      });
    }

    if (elements.mixerResetBtn) {
      elements.mixerResetBtn.addEventListener('click', () => {
        resetColorsToDefault();
      });
    }

    if (elements.mixerCopyBtn) {
      elements.mixerCopyBtn.addEventListener('click', () => {
        copyPaletteCSS();
      });
    }

  // Watermelon pop particle explosion easter egg
  function popWatermelons(originX, originY) {
    const particleCount = 28;
    const emojis = ['🍉'];

    for (let i = 0; i < particleCount; i++) {
      const particle = document.createElement('span');
      particle.className = 'watermelon-particle';
      particle.textContent = emojis[Math.floor(Math.random() * emojis.length)];
      particle.style.left = `${originX}px`;
      particle.style.top = `${originY}px`;

      const size = Math.floor(Math.random() * 18 + 18); // 18px to 36px
      particle.style.fontSize = `${size}px`;
      document.body.appendChild(particle);

      // Angle: mostly expanding downwards and leftwards into viewport from top-right corner
      const angle = (Math.PI / 180) * (Math.random() * 260 + 50);
      const distance = Math.random() * 260 + 80;
      const destX = Math.cos(angle) * distance;
      const destY = Math.sin(angle) * distance + (Math.random() * 180 + 70); // Parabolic gravity drop
      const spin = Math.random() * 800 - 400;
      const duration = Math.random() * 600 + 850;

      const anim = particle.animate([
        {
          transform: 'translate(-50%, -50%) scale(0.2) rotate(0deg)',
          opacity: 1
        },
        {
          transform: `translate(calc(-50% + ${destX * 0.4}px), calc(-50% + ${destY * 0.25 - 45}px)) scale(${Math.random() * 0.4 + 1.2}) rotate(${spin * 0.35}deg)`,
          opacity: 1,
          offset: 0.3
        },
        {
          transform: `translate(calc(-50% + ${destX}px), calc(-50% + ${destY}px)) scale(${Math.random() * 0.3 + 0.8}) rotate(${spin}deg)`,
          opacity: 0
        }
      ], {
        duration: duration,
        easing: 'cubic-bezier(0.18, 0.9, 0.32, 1)',
        fill: 'forwards'
      });

      anim.onfinish = () => particle.remove();
    }
  }

  window.popWatermelons = popWatermelons;

    // Watermelon badge easter egg
    if (elements.watermelonBadge) {
      elements.watermelonBadge.addEventListener('click', () => {
        elements.watermelonBadge.classList.remove('popping');
        void elements.watermelonBadge.offsetWidth;
        elements.watermelonBadge.classList.add('popping');

        const rect = elements.watermelonBadge.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        popWatermelons(x, y);
      });
    }

    // Modal background close
    document.querySelectorAll('.modal-overlay').forEach(modal => {
      modal.addEventListener('click', e => {
        if (e.target === modal) closeModal(modal);
      });
    });

    // Modal close button
    document.querySelectorAll('.modal-close-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const modal = btn.closest('.modal-overlay');
        closeModal(modal);
      });
    });

    // Command palette openers
    document.querySelectorAll('[data-action="open-cmd"]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.preventDefault();
        window.openCommandPalette();
      });
    });

    // Writing cards direct navigation
    document.querySelectorAll('.writing-card').forEach(card => {
      card.addEventListener('click', e => {
        // If clicking on an anchor tag directly, allow standard browser navigation
        if (e.target.closest('a')) return;

        // If clicking anywhere else on the card, navigate directly to the article URL
        const url = card.getAttribute('data-article-url');
        if (url) {
          window.location.href = url;
        }
      });
    });

    // URL hash watcher
    window.addEventListener('hashchange', () => {
      const hash = window.location.hash.replace('#', '') || 'home';
      if (elements.views.length > 0) {
        navigateTo(hash);
      }
    });
  }

  // Initialization
  function init() {
    applyTheme(state.themeMode);
    initKeyboardNavigation();
    initCommandPalette();
    loadSearchIndex();

    setupEventListeners();

    // Sidebar state & resizer initialization
    initSidebarResizer();
    if (state.sidebarWidth) {
      applySidebarWidth(state.sidebarWidth);
    }
    if (state.sidebarHidden && window.innerWidth > 900) {
      document.documentElement.classList.add('sidebar-hidden');
      document.body.classList.add('sidebar-hidden');
    }

    window.addEventListener('resize', () => {
      if (window.innerWidth <= 900) {
        document.documentElement.classList.remove('sidebar-hidden');
        document.body.classList.remove('sidebar-hidden');
      } else if (state.sidebarHidden) {
        document.documentElement.classList.add('sidebar-hidden');
        document.body.classList.add('sidebar-hidden');
      }
    });

    // Color Mixer initialization
    renderMixerPresets();
    try {
      const savedPalette = localStorage.getItem('mixed-color-palette');
      if (savedPalette) {
        applyCustomPalette(JSON.parse(savedPalette), false);
      } else {
        renderMixerSwatches();
      }
    } catch (_) {
      renderMixerSwatches();
    }

    // Initial route
    const initialHash = window.location.hash.replace('#', '') || 'home';
    if (elements.views.length > 0) {
      navigateTo(initialHash);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
