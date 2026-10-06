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
