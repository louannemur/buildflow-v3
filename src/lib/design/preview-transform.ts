/**
 * Transforms React code for browser preview rendering in an iframe
 */

import { injectBfIds } from './inject-bf-ids';
import { getIframeBridgeScript } from './iframe-bridge';

/**
 * Transform generated React code for preview rendering
 * - Replaces imports with browser-compatible versions
 * - Transforms exports for standalone execution
 */
export function transformCodeForPreview(code: string): string {
  let transformed = code;

  // Remove 'use client' directive
  transformed = transformed.replace(/['"]use client['"];?\s*\n?/g, '');

  // Replace framer-motion imports with window globals
  transformed = transformed.replace(
    /import\s+\{([^}]+)\}\s+from\s+['"]framer-motion['"]/g,
    (_, imports) => {
      const importNames = imports.split(',').map((i: string) => i.trim());
      return `const { ${importNames.join(', ')} } = window.Motion;`;
    }
  );

  // Replace Three.js imports with window globals
  // Handle: import * as THREE from 'three'
  transformed = transformed.replace(
    /import\s+\*\s+as\s+THREE\s+from\s+['"]three['"]/g,
    'const THREE = window.THREE;'
  );
  // Handle: import { Scene, Mesh, ... } from 'three'
  transformed = transformed.replace(
    /import\s+\{([^}]+)\}\s+from\s+['"]three['"]/g,
    (_, imports) => {
      const importNames = imports.split(',').map((i: string) => i.trim());
      return `const { ${importNames.join(', ')} } = window.THREE;`;
    }
  );
  // Handle: import THREE from 'three' (default import)
  transformed = transformed.replace(
    /import\s+THREE\s+from\s+['"]three['"]/g,
    'const THREE = window.THREE;'
  );
  // Remove @react-three/fiber and @react-three/drei imports (no UMD builds available)
  transformed = transformed.replace(
    /import\s+\{[^}]+\}\s+from\s+['"]@react-three\/(?:fiber|drei)['"]\s*;?\n?/g,
    ''
  );

  // Replace lucide-react imports with iconify-based fallbacks
  transformed = transformed.replace(
    /import\s+\{([^}]+)\}\s+from\s+['"]lucide-react['"]/g,
    (_, icons) => {
      const iconNames = icons.split(',').map((i: string) => i.trim());
      return iconNames.map((name: string) => {
        const kebabName = name.replace(/([A-Z])/g, (m: string, _p: string, o: number) =>
          o ? '-' + m.toLowerCase() : m.toLowerCase()
        );
        return `const ${name} = ({ className = '', size = 24, ...props }) => {
  return React.createElement('iconify-icon', {
    icon: 'lucide:${kebabName}',
    width: size,
    height: size,
    className: className,
    style: { display: 'inline-block' },
    ...props
  });
};`;
      }).join('\n');
    }
  );

  // Transform React imports
  transformed = transformed.replace(
    /import\s+React,?\s*\{([^}]*)\}\s+from\s+['"]react['"]/g,
    (_, hooks) => {
      const hookNames = hooks.split(',').map((h: string) => h.trim()).filter(Boolean);
      return `const { ${hookNames.join(', ')} } = React;`;
    }
  );

  transformed = transformed.replace(
    /import\s+\{([^}]*)\}\s+from\s+['"]react['"]/g,
    (_, hooks) => {
      const hookNames = hooks.split(',').map((h: string) => h.trim()).filter(Boolean);
      return `const { ${hookNames.join(', ')} } = React;`;
    }
  );

  transformed = transformed.replace(/import\s+React\s+from\s+['"]react['"];?\n?/g, '');

  // Remove other imports (both 'import x from "y"' and bare 'import "y"')
  // Use [\s\S]*? instead of .*? to handle multiline imports like:
  //   import {
  //     Something,
  //     Other
  //   } from 'package';
  transformed = transformed.replace(
    /import\s+[\s\S]*?\s+from\s+['"][^'"]+['"];?\n?/g,
    ''
  );
  transformed = transformed.replace(
    /import\s+['"][^'"]+['"];?\n?/g,
    ''
  );

  // Replace 'export default' with 'const App ='
  transformed = transformed.replace(/export\s+default\s+function\s+(\w+)/g, 'function App');
  transformed = transformed.replace(/export\s+default\s+(\w+);?/g, 'const App = $1;');

  // Remove other exports
  transformed = transformed.replace(/export\s+(?!default)/g, '');

  // Add App alias if needed
  if (!transformed.includes('function App') && !transformed.includes('const App')) {
    const componentMatch = transformed.match(/function\s+(\w+)\s*\(/);
    if (componentMatch) {
      transformed += `\nconst App = ${componentMatch[1]};`;
    }
  }

  return transformed;
}

export interface PreviewOptions {
  enableBridge?: boolean;
}

/**
 * Generate complete HTML for preview iframe
 */
export function generatePreviewHtml(code: string, options: PreviewOptions = {}): string {
  const { enableBridge = false } = options;

  // Inject bf-ids if bridge is enabled (for the visual editor)
  let processedCode = code;
  if (enableBridge) {
    const { annotatedCode } = injectBfIds(code);
    processedCode = annotatedCode;
  }

  const transformedCode = transformCodeForPreview(processedCode);
  const bridgeScript = enableBridge ? `<script>${getIframeBridgeScript()}</script>` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Design Preview</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <script src="https://unpkg.com/framer-motion@10.18.0/dist/framer-motion.js"></script>
  <script src="https://unpkg.com/three@0.160.0/build/three.min.js"></script>
  <script src="https://code.iconify.design/iconify-icon/2.3.0/iconify-icon.min.js"></script>
  <script>
    // Setup Motion globals with fallbacks
    window.Motion = window.Motion || window['framer-motion'] || {};
    if (!window.Motion.motion) {
      // Fallback: create basic motion components if framer-motion didn't load
      const createMotionComponent = (tag) => {
        return function MotionComponent(props) {
          const { initial, animate, whileInView, whileHover, whileTap, variants, transition, viewport, style, ...rest } = props;
          return React.createElement(tag, { style, ...rest });
        };
      };
      window.Motion = {
        motion: new Proxy({}, { get: (_, tag) => createMotionComponent(tag) }),
        useInView: () => true,
        useScroll: () => ({ scrollY: { get: () => 0 }, scrollYProgress: { get: () => 0 } }),
        useTransform: (value, input, output) => ({ get: () => output ? output[0] : 0 }),
        useSpring: (value) => value,
        useMotionValue: (initial) => ({ get: () => initial, set: () => {} }),
        AnimatePresence: ({ children }) => children,
      };
    }
  </script>
  <script>
    // Ensure THREE global exists even if CDN fails
    if (!window.THREE) {
      window.THREE = {
        Scene: function() { this.add = function(){}; this.background = null; },
        PerspectiveCamera: function() { this.position = {x:0,y:0,z:5,set:function(){}}; this.aspect = 1; this.updateProjectionMatrix = function(){}; },
        WebGLRenderer: function(opts) { this.domElement = document.createElement('canvas'); this.setSize = function(){}; this.setPixelRatio = function(){}; this.render = function(){}; this.dispose = function(){}; this.setClearColor = function(){}; },
        Mesh: function() { this.rotation = {x:0,y:0,z:0}; this.position = {x:0,y:0,z:0,set:function(){}}; },
        BoxGeometry: function(){}, SphereGeometry: function(){}, PlaneGeometry: function(){}, TorusGeometry: function(){}, IcosahedronGeometry: function(){}, TorusKnotGeometry: function(){}, CylinderGeometry: function(){}, CircleGeometry: function(){}, RingGeometry: function(){},
        MeshStandardMaterial: function(){}, MeshBasicMaterial: function(){}, MeshPhongMaterial: function(){}, MeshNormalMaterial: function(){}, ShaderMaterial: function(){}, PointsMaterial: function(){},
        DirectionalLight: function() { this.position = {x:0,y:0,z:0,set:function(){}}; },
        AmbientLight: function(){}, PointLight: function() { this.position = {x:0,y:0,z:0,set:function(){}}; }, SpotLight: function() { this.position = {x:0,y:0,z:0,set:function(){}}; },
        Group: function() { this.add = function(){}; this.rotation = {x:0,y:0,z:0}; this.position = {x:0,y:0,z:0}; },
        Points: function() { this.rotation = {x:0,y:0,z:0}; },
        BufferGeometry: function() { this.setAttribute = function(){}; },
        Float32BufferAttribute: function(){},
        Color: function(){}, Vector3: function(x,y,z) { this.x=x||0; this.y=y||0; this.z=z||0; },
        Clock: function() { this.getElapsedTime = function(){ return 0; }; this.getDelta = function(){ return 0.016; }; },
        MathUtils: { randFloatSpread: function(r){ return (Math.random()-0.5)*r; } },
        AdditiveBlending: 2,
      };
    }
  </script>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      -webkit-font-smoothing: antialiased;
    }
    :root {
      --primary: #0ea5e9;
      --primary-foreground: #ffffff;
      --background: #ffffff;
      --foreground: #09090b;
      --muted: #f4f4f5;
      --muted-foreground: #71717a;
      --border: #e4e4e7;
    }
  </style>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            primary: 'var(--primary)',
            'primary-foreground': 'var(--primary-foreground)',
            background: 'var(--background)',
            foreground: 'var(--foreground)',
            muted: 'var(--muted)',
            'muted-foreground': 'var(--muted-foreground)',
            border: 'var(--border)',
          },
        },
      },
    };
  </script>
</head>
<body>
  <div id="root">
    <div style="display: flex; align-items: center; justify-content: center; height: 100vh; color: #666;">
      Loading preview...
    </div>
  </div>
  <script id="__generated_code" type="text/plain">${Buffer.from(transformedCode).toString('base64')}</script>
  <script>
    // Show styled error overlay and notify parent
    function showError(message) {
      console.error('Preview error:', message);
      var safeMsg = String(message).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
      document.getElementById('root').innerHTML =
        '<div style="padding:32px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;color:#fca5a5;background:#18181b;min-height:100vh;">' +
          '<div style="max-width:640px;margin:0 auto;">' +
            '<div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;">' +
              '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>' +
              '<span style="font-size:14px;font-weight:600;color:#ef4444;">Preview Error</span>' +
            '</div>' +
            '<pre style="white-space:pre-wrap;word-break:break-word;line-height:1.6;margin:0 0 16px 0;color:#fca5a5;">' + safeMsg + '</pre>' +
            '<button onclick="navigator.clipboard.writeText(document.querySelector(\\'pre\\').textContent)" style="padding:6px 14px;background:#27272a;color:#a1a1aa;border:1px solid #3f3f46;border-radius:6px;font-size:12px;cursor:pointer;font-family:inherit;">Copy Error</button>' +
          '</div>' +
        '</div>';
      try {
        window.parent.postMessage({ type: 'PREVIEW_ERROR', message: String(message) }, '*');
      } catch(e) {}
    }

    // Global error handlers for runtime errors
    window.onerror = function(msg) { showError(msg); };
    window.addEventListener('unhandledrejection', function(e) { showError(e.reason ? (e.reason.message || e.reason) : 'Unhandled promise rejection'); });

    // Wait for DOM and scripts to be ready
    function initPreview() {
      var generatedCode;
      try {
        generatedCode = atob(document.getElementById('__generated_code').textContent);
      } catch(e) {
        showError('Failed to decode preview code: ' + e.message);
        return;
      }

      try {
        if (typeof Babel === 'undefined') {
          throw new Error('Babel not loaded — check your network connection');
        }
        if (typeof React === 'undefined') {
          throw new Error('React not loaded — check your network connection');
        }

        var transformed = Babel.transform(generatedCode, {
          presets: [
            ['react', { runtime: 'classic' }],
            ['typescript', { isTSX: true, allExtensions: true }]
          ],
          filename: 'component.tsx'
        });

        var execute = new Function('React', 'ReactDOM', transformed.code + '\\nreturn typeof App !== "undefined" ? App : null;');
        var App = execute(React, ReactDOM);

        if (App) {
          var root = ReactDOM.createRoot(document.getElementById('root'));
          root.render(React.createElement(App));
          // Signal successful render
          try { window.parent.postMessage({ type: 'PREVIEW_RENDER_OK' }, '*'); } catch(e) {}
        } else {
          showError('No App component found in generated code');
        }
      } catch (error) {
        showError(error.message || String(error));
      }
    }

    // Execute when DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initPreview);
    } else {
      // Small delay to ensure all scripts are parsed
      setTimeout(initPreview, 50);
    }
  </script>
  ${bridgeScript}
</body>
</html>`;
}
