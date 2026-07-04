import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Fix for html2canvas crashing on Tailwind v4's oklab color-mix
const origGetComputedStyle = window.getComputedStyle;
window.getComputedStyle = function(el, pseudo) {
  const style = origGetComputedStyle(el, pseudo);
  return new Proxy(style, {
    get(target, prop) {
      const val = target[prop as keyof CSSStyleDeclaration];
      if (typeof val === 'string' && val.includes('color-mix(in oklab')) {
        const match = val.match(/color-mix\(in oklab,\s*(rgba?\([^)]+\))\s*([\d.]+)%,\s*transparent\)/);
        if (match) {
          const rgb = match[1];
          const percent = parseFloat(match[2]);
          const opacity = percent / 100;
          if (rgb.startsWith('rgba')) {
             return rgb.replace(/, [\d.]+\)$/, `, ${opacity})`);
          }
          return rgb.replace('rgb', 'rgba').replace(')', `, ${opacity})`);
        }
        return val.replace(/color-mix\(in oklab,\s*([^ ]+)[^,]+,\s*transparent\)/g, '$1');
      }
      const valFunc = typeof val === 'function' ? val.bind(target) : val;
      return valFunc;
    }
  });
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

