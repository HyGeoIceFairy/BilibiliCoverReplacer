let coverImages = [];

function getRandomImage() {
    if (coverImages.length === 0) {
        return "";
    }
    const index = Math.floor(Math.random() * coverImages.length);
    return coverImages[index];
}

function applyCoverReplacement() {
    if (coverImages.length === 0) {
        return;
    }

    const selectors = [
        '.bili-video-card__image--wrap',
        '.bili-video-card__cover',
        '.v-img',
        '.b-img'
    ].join(', ');

    const coverContainers = document.querySelectorAll(selectors);

    coverContainers.forEach((container) => {
        if (container.dataset.hasCustomCover === "true") {
            return;
        }

        container.dataset.hasCustomCover = "true";

        const computedStyle = window.getComputedStyle(container);
        if (computedStyle.position === 'static') {
            container.style.position = 'relative';
        }

        const overlay = document.createElement('img');
        const imgUrl = getRandomImage();

        if (imgUrl) {
            overlay.src = imgUrl;
            overlay.className = 'custom-cover-overlay';
            container.appendChild(overlay);
        }
    });
}

function debounce(func, wait) {
    let timeout;
    return function () {
        const context = this;
        const args = arguments;
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            func.apply(context, args);
        }, wait);
    };
}

const debouncedApply = debounce(applyCoverReplacement, 200);

const observer = new MutationObserver((mutations) => {
    let shouldUpdate = false;
    for (const mutation of mutations) {
        if (mutation.addedNodes.length > 0) {
            shouldUpdate = true;
            break;
        }
    }

    if (shouldUpdate) {
        debouncedApply();
    }
});

async function initExtension() {
    try {
        const configUrl = chrome.runtime.getURL('images.json');
        const response = await fetch(configUrl);
        const data = await response.json();

        if (data && Array.isArray(data.images)) {
            coverImages = data.images;
        }

        if (coverImages.length > 0) {
            applyCoverReplacement();
            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        } else {
            console.warn("Bilibili Cover Replacer: images.json 中没有找到有效的图片列表。");
        }
    } catch (error) {
        console.error("Bilibili Cover Replacer: 无法加载图片配置文件。", error);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initExtension();
    });
} else {
    initExtension();
}