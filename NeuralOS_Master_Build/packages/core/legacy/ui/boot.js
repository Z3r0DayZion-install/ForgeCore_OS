/**
 * ForgeCore OS - Synchronous Boot Loader
 * Executes before DOM tree is fully constructed to prevent FOUC.
 */
(function () {
    try {
        const theme = localStorage.getItem('forge_theme') || 'BloodNeon';
        document.documentElement.setAttribute('data-theme', theme);

        // Setting an early hint for the body when it arrives
        const observer = new MutationObserver((mutations) => {
            if (document.body) {
                document.body.setAttribute('data-theme', theme);
                observer.disconnect();
            }
        });
        observer.observe(document.documentElement, { childList: true });
    } catch (e) {
        // Fallback or incognito block
    }
})();
