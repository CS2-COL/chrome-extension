(function() {
    var g_historyCursor = window.g_historyCursor;
    var g_rgDescriptions = window.g_rgDescriptions;
    if (g_historyCursor && g_rgDescriptions) {
        document.dispatchEvent(
            new CustomEvent('LOAD_LOCAL_VARIABLES', {
                detail: {
                    'g_historyCursor' : g_historyCursor,
                    'g_rgDescriptions' : g_rgDescriptions,
                    'g_steamID' : g_steamID
                }
            })
        );
    }
})();
