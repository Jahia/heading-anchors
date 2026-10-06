(function () {
    'use strict';

    var CLEAR_DELAY = 3000;
    var status = document.getElementById('heading-anchors-status');
    var clearTimer;

    function announce(message) {
        if (!status || !message) {
            return;
        }
        window.clearTimeout(clearTimer);
        status.textContent = message;
        clearTimer = window.setTimeout(function () {
            status.textContent = '';
        }, CLEAR_DELAY);
    }

    function showInAddressBar(id) {
        if (window.history && window.history.replaceState) {
            window.history.replaceState(null, '', '#' + id);
        } else {
            window.location.hash = id;
        }
        announce(status && status.getAttribute('data-fallback-message'));
    }

    document.addEventListener('click', function (event) {
        var button = event.target.closest && event.target.closest('.heading-permalink');
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
