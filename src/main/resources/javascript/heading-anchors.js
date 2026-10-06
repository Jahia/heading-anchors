(function () {
    'use strict';

    var DISPLAY_DURATION = 5000;
    var FADE_DURATION = 200;
    // Same text set twice is not re-announced: the region is emptied first, then filled after this delay
    var ANNOUNCE_DELAY = 75;
    var status = document.getElementById('heading-anchors-status');
    var showTimer;
    var hideTimer;
    var clearTimer;

    // Sticky or fixed header of the site: a bar at least half as wide as the page, attached to the top. Taller
    // elements are overlays (menus, dialogs), and the offset never exceeds half of the viewport
    var PROBES = [0.1, 0.5, 0.9];
    var MIN_BAR_WIDTH = 0.5;
    var MAX_BAR_HEIGHT = 0.9;
    var MAX_OFFSET = 0.5;
    var offset = 0;
    var resizeFrame;

    function barBottom(element, y, width) {
        var position = window.getComputedStyle(element).position;
        if (position !== 'fixed' && position !== 'sticky') {
            return 0;
        }
        var rect = element.getBoundingClientRect();
        if (rect.top > y || rect.width < width * MIN_BAR_WIDTH || rect.height >= window.innerHeight * MAX_BAR_HEIGHT) {
            return 0;
        }
        return rect.bottom;
    }

    function measureOffset() {
        if (!document.elementsFromPoint) {
            return;
        }
        var width = document.documentElement.clientWidth;
        var bottom = 0;
        // Bars can be stacked (top bar, then navigation): probe again just below the last bar found
        for (var pass = 0; pass < 5; pass++) {
            var y = bottom + 1;
            var next = bottom;
            PROBES.forEach(function (ratio) {
                document.elementsFromPoint(width * ratio, y).forEach(function (element) {
                    if (!status || !status.contains(element)) {
                        next = Math.max(next, barBottom(element, y, width));
                    }
                });
            });
            if (next <= bottom) {
                break;
            }
            bottom = next;
        }
        offset = Math.min(Math.ceil(bottom), Math.round(window.innerHeight * MAX_OFFSET));
        document.documentElement.style.setProperty('--heading-anchors-offset', offset + 'px');
    }

    function hashTarget() {
        var id;
        try {
            id = decodeURIComponent(window.location.hash.slice(1));
        } catch (e) {
            return null;
        }
        var target = id && document.getElementById(id);
        return target && target.closest('[data-heading-anchors]') ? target : null;
    }

    // The browser jumped to the fragment before the header was measured: scroll again only when the target is
    // hidden under the header, so a reader who already scrolled is never moved
    function revealHashTarget() {
        var target = hashTarget();
        if (!target) {
            return;
        }
        var top = target.getBoundingClientRect().top;
        if (top >= -1 && top < offset) {
            target.scrollIntoView({block: 'start', behavior: 'instant'});
        }
    }

    measureOffset();
    if (document.readyState === 'complete') {
        revealHashTarget();
    } else {
        window.addEventListener('load', function () {
            measureOffset();
            revealHashTarget();
        });
    }

    window.addEventListener('resize', function () {
        window.cancelAnimationFrame(resizeFrame);
        resizeFrame = window.requestAnimationFrame(measureOffset);
    });

    // Headers can change on scroll (shrink, hide): measured again just before a jump to a fragment of this page
    document.addEventListener('click', function (event) {
        var link = event.target.closest && event.target.closest('a[href]');
        if (link && link.hash && link.origin === window.location.origin && link.pathname === window.location.pathname
                && link.search === window.location.search) {
            measureOffset();
        }
    }, true);

    // WCAG 2.4.11: never cover the focused element, move the toast to the top instead
    function placeAwayFromFocus() {
        status.classList.remove('is-top');
        var focused = document.activeElement;
        if (!focused || focused === document.body) {
            return;
        }
        var focusedRect = focused.getBoundingClientRect();
        var toastRect = status.getBoundingClientRect();
        if (focusedRect.bottom > toastRect.top && focusedRect.top < toastRect.bottom) {
            status.classList.add('is-top');
        }
    }

    function announce(message) {
        if (!status || !message) {
            return;
        }
        window.clearTimeout(showTimer);
        window.clearTimeout(hideTimer);
        window.clearTimeout(clearTimer);
        status.textContent = '';
        showTimer = window.setTimeout(function () {
            status.textContent = message;
            placeAwayFromFocus();
            status.classList.add('is-visible');
            hideTimer = window.setTimeout(function () {
                status.classList.remove('is-visible');
                clearTimer = window.setTimeout(function () {
                    status.textContent = '';
                }, FADE_DURATION);
            }, DISPLAY_DURATION);
        }, ANNOUNCE_DELAY);
    }

    function showInAddressBar(id) {
        if (window.history && window.history.replaceState) {
            window.history.replaceState(null, '', '#' + id);
        } else {
            window.location.hash = id;
        }
        announce(status && status.getAttribute('data-fallback-message'));
    }

    // WCAG 1.4.13: the tooltip can be dismissed with Escape without moving the pointer or the focus
    document.addEventListener('keydown', function (event) {
        if (event.key !== 'Escape') {
            return;
        }
        var buttons = document.querySelectorAll('.heading-anchors-permalink:hover, .heading-anchors-permalink:focus');
        Array.prototype.forEach.call(buttons, function (button) {
            button.classList.add('is-dismissed');
        });
    });

    function resetDismissed(event) {
        var button = event.target.closest && event.target.closest('.heading-anchors-permalink');
        if (button && !button.contains(event.relatedTarget)) {
            button.classList.remove('is-dismissed');
        }
    }

    document.addEventListener('focusout', resetDismissed);
    document.addEventListener('mouseout', resetDismissed);

    document.addEventListener('click', function (event) {
        var button = event.target.closest && event.target.closest('.heading-anchors-permalink');
        if (!button) {
            return;
        }
        var id = button.getAttribute('data-target');
        var url = window.location.origin + window.location.pathname + window.location.search + '#' + encodeURIComponent(id);

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(url).then(function () {
                announce(status && status.getAttribute('data-copied-message'));
            }, function () {
                showInAddressBar(id);
            });
        } else {
            showInAddressBar(id);
        }
    });
})();
