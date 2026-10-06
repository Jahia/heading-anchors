// Demo overlay injected in the recorded pages (top frame only): visible cursor, address pill, chapter card,
// anchor badges and end card. It is a recording aid, not part of the module.
(() => {
    if (window.top !== window) {
        return;
    }
    const css = `
        #demo-cursor { position: fixed; left: 0; top: 0; width: 24px; height: 24px; margin: -12px 0 0 -12px; border-radius: 50%;
            background: rgba(255, 196, 0, 0.35); border: 2px solid rgba(214, 128, 0, 0.95); pointer-events: none;
            z-index: 2147483647; transition: left 0.45s cubic-bezier(0.22, 1, 0.36, 1), top 0.45s cubic-bezier(0.22, 1, 0.36, 1), transform 0.12s; }
        #demo-cursor.is-down { transform: scale(0.7); background: rgba(255, 196, 0, 0.7); }
        #demo-url { position: fixed; left: 12px; bottom: 12px; z-index: 2147483646; max-width: 70vw; overflow: hidden;
            text-overflow: ellipsis; white-space: nowrap; padding: 6px 10px; border-radius: 6px; pointer-events: none;
            background: rgba(15, 23, 42, 0.88); color: #fff; font: 14px/1.3 ui-monospace, Menlo, Consolas, monospace; }
        #demo-url b { color: #ffd166; font-weight: 600; }
        #demo-card { position: fixed; top: 18px; left: 50%; z-index: 2147483646; transform: translate(-50%, -8px); opacity: 0;
            padding: 10px 22px; border-radius: 10px; pointer-events: none; background: #0b4f9c; color: #fff;
            font: 600 22px/1.3 system-ui, -apple-system, Segoe UI, sans-serif; box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
            transition: opacity 0.35s, transform 0.35s; }
        #demo-card.is-visible { opacity: 1; transform: translate(-50%, 0); }
        .demo-badge { position: absolute; z-index: 2147483645; padding: 2px 7px; border-radius: 5px; pointer-events: none;
            background: #fff4c2; color: #4a3600; border: 1px solid #d9a800; white-space: nowrap;
            font: 600 13px/1.4 ui-monospace, Menlo, Consolas, monospace; box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15); }
        .demo-badge.is-manual { background: #e8f1ff; color: #0b3d75; border-color: #5b8fd6; }
        #demo-end { position: fixed; inset: 0; z-index: 2147483646; display: flex; flex-direction: column; align-items: center;
            justify-content: center; gap: 18px; background: #0b2545; color: #fff; opacity: 0; transition: opacity 0.6s;
            font: 22px/1.4 system-ui, -apple-system, Segoe UI, sans-serif; text-align: center; }
        #demo-end.is-visible { opacity: 1; }
        #demo-end h1 { margin: 0 0 8px; font-size: 52px; font-weight: 700; color: #fff; }
        #demo-end p { margin: 0; color: #d6e4f5; }
        #demo-end code { color: #ffd166; font-size: 24px; }
    `;
    const state = {x: Number(sessionStorage.getItem('demoX') || 640), y: Number(sessionStorage.getItem('demoY') || 400)};

    function install() {
        if (document.getElementById('demo-style')) {
            return;
        }
        const style = document.createElement('style');
        style.id = 'demo-style';
        style.textContent = css;
        document.head.appendChild(style);
        const cursor = document.createElement('div');
        cursor.id = 'demo-cursor';
        cursor.style.transition = 'none';
        cursor.style.left = state.x + 'px';
        cursor.style.top = state.y + 'px';
        document.body.appendChild(cursor);
        requestAnimationFrame(() => cursor.style.removeProperty('transition'));
        const url = document.createElement('div');
        url.id = 'demo-url';
        document.body.appendChild(url);
        const card = document.createElement('div');
        card.id = 'demo-card';
        document.body.appendChild(card);
        const path = document.createElement('span');
        const hash = document.createElement('b');
        url.append(path, hash);
        const refreshUrl = () => {
            // Language prefix and page name only: a short pill never covers the toast centered at the bottom
            const parts = location.pathname.split('/').filter(Boolean);
            path.textContent = parts.length > 2 ? `/${parts[0]}/…/${parts[parts.length - 1]}` : location.pathname;
            hash.textContent = location.hash ? decodeURIComponent(location.hash) : '';
        };
        refreshUrl();
        window.addEventListener('hashchange', refreshUrl);
        setInterval(refreshUrl, 300);
    }

    window.__demo = {
        cursorTo(x, y) {
            install();
            state.x = x;
            state.y = y;
            sessionStorage.setItem('demoX', x);
            sessionStorage.setItem('demoY', y);
            const cursor = document.getElementById('demo-cursor');
            cursor.style.left = x + 'px';
            cursor.style.top = y + 'px';
        },
        press(down) {
            install();
            document.getElementById('demo-cursor').classList.toggle('is-down', down);
        },
        card(title, ms) {
            install();
            const card = document.getElementById('demo-card');
            card.textContent = title;
            card.classList.add('is-visible');
            setTimeout(() => card.classList.remove('is-visible'), ms);
        },
        showIds() {
            install();
            document.querySelectorAll('.demo-badge').forEach(badge => badge.remove());
            const add = (element, text, manual) => {
                const rect = element.getBoundingClientRect();
                const anchorBox = (element.closest('h1, h2, h3, h4, h5, h6') || element).getBoundingClientRect();
                const badge = document.createElement('div');
                badge.className = 'demo-badge' + (manual ? ' is-manual' : '');
                badge.textContent = text;
                const textRange = document.createRange();
                const heading = element.closest('h1, h2, h3, h4, h5, h6');
                let right = anchorBox.right;
                if (heading) {
                    textRange.selectNodeContents(heading);
                    right = Math.min(anchorBox.right, textRange.getBoundingClientRect().right + 40);
                }
                badge.style.left = (manual ? rect.left : right + 12) + window.scrollX + 'px';
                badge.style.top = (manual ? rect.top - 26 : anchorBox.top + (anchorBox.height - 22) / 2) + window.scrollY + 'px';
                document.body.appendChild(badge);
            };
            document.querySelectorAll('[data-heading-anchors]').forEach(element => {
                const heading = element.matches('a') ? element.closest('h1, h2, h3, h4, h5, h6') : element;
                const target = element.matches('a') ? element : heading.querySelector('a.heading-anchors-target') || heading;
                if (!element.matches('a') && target !== heading) {
                    return;
                }
                if (target.id) {
                    add(target, '#' + target.id, false);
                }
            });
            document.querySelectorAll('a[id]:not([href]):not([data-heading-anchors])').forEach(anchor => {
                if (!anchor.textContent.trim()) {
                    add(anchor, 'manual anchor #' + anchor.id, true);
                }
            });
        },
        end(lines) {
            install();
            const end = document.createElement('div');
            end.id = 'demo-end';
            for (const [tag, text] of lines) {
                const line = document.createElement(tag);
                line.textContent = text;
                end.appendChild(line);
            }
            document.body.appendChild(end);
            requestAnimationFrame(() => end.classList.add('is-visible'));
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', install);
    } else {
        install();
    }
})();
