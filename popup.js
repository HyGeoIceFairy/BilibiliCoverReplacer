const defaultSettings = {
    homeNew: true,
    searchOld: true,
    dynamic: true,
    dynamicLightbox: true
};

document.addEventListener('DOMContentLoaded', () => {
    chrome.storage.local.get(defaultSettings, (result) => {
        document.getElementById('homeNew').checked = result.homeNew;
        document.getElementById('searchOld').checked = result.searchOld;
        document.getElementById('dynamic').checked = result.dynamic;
        document.getElementById('dynamicLightbox').checked = result.dynamicLightbox;
    });
});

document.getElementById('saveBtn').addEventListener('click', () => {
    const settings = {
        homeNew: document.getElementById('homeNew').checked,
        searchOld: document.getElementById('searchOld').checked,
        dynamic: document.getElementById('dynamic').checked,
        dynamicLightbox: document.getElementById('dynamicLightbox').checked
    };

    chrome.storage.local.set(settings, () => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs.length > 0) {
                chrome.tabs.reload(tabs[0].id);
            }
        });
        window.close();
    });
});