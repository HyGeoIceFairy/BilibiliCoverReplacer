// 全局状态
let coverImages = [];
let activeSelectors = [];

// 用于记录 [B站图片纯净路径] -> [自定义图片 URL] 的映射关系
const imageMapping = new Map();

// 将不同区域映射到具体的 CSS 选择器
const selectorMap = {
    homeNew: ['.bili-video-card__image--wrap', '.bili-video-card__cover'],
    searchOld: ['.v-img'],
    dynamic: ['.b-img'],
    dynamicLightbox: ['.bili-album__watch']
};

// 获取随机图片 URL
function getRandomImage() {
    if (coverImages.length === 0) {
        return "";
    }
    const index = Math.floor(Math.random() * coverImages.length);
    return coverImages[index];
}

// 核心：校验是否为真正的 B 站内容图片
function isValidBiliImage(srcString) {
    if (!srcString) {
        return false;
    }
    // 过滤 Base64 编码的占位图
    if (srcString.startsWith('data:')) {
        return false;
    }
    // 真正的封面或动态图片必然存在于 Bilibili File System (bfs) 下
    // 如果不包含这个特征，说明可能是空 src 被解析成的当前网址，或是其他外部占位符
    if (!srcString.includes('/bfs/')) {
        return false;
    }
    // 明确排除 B 站的静态资源目录（如通用的 loading 动画、系统默认头像等）
    if (srcString.includes('/static/')) {
        return false;
    }
    return true;
}

// 核心替换逻辑
function applyCoverReplacement() {
    if (coverImages.length === 0 || activeSelectors.length === 0) {
        return;
    }

    const selectorsString = activeSelectors.join(', ');
    const coverContainers = document.querySelectorAll(selectorsString);

    coverContainers.forEach((container) => {
        let originalImageKey = null;
        let rawSrc = "";

        // 获取 B 站原生图片节点
        const nativeImg = container.querySelector('img:not(.custom-cover-overlay)');

        if (nativeImg) {
            // 使用 getAttribute 避免浏览器将空 src 自动补全为当前页面 URL
            const rawAttr = nativeImg.getAttribute('src');
            const targetSrc = rawAttr || nativeImg.src;

            if (isValidBiliImage(targetSrc)) {
                rawSrc = nativeImg.src;
            }
        } else if (container.style.backgroundImage) {
            const match = container.style.backgroundImage.match(/url\(['"]?(.*?)['"]?\)/);
            if (match && match[1] && isValidBiliImage(match[1])) {
                rawSrc = match[1];
            }
        }

        // 如果不是有效的内容图片（处于加载前的空壳状态），直接退出，等待下一次 DOM 更新
        if (!rawSrc) {
            return;
        }

        // 解析并剥离一切后缀，获取最纯粹的文件路径作为唯一 Key
        try {
            const urlObj = new URL(rawSrc, window.location.href);
            originalImageKey = urlObj.pathname.split('@')[0];
        } catch (e) {
            originalImageKey = rawSrc.split('@')[0];
        }

        if (!originalImageKey) {
            return;
        }

        // 检查当前容器是否已经附加了覆盖图
        const existingOverlay = container.querySelector('.custom-cover-overlay');
        if (existingOverlay) {
            if (container.dataset.currentCoverKey === originalImageKey) {
                return;
            } else {
                existingOverlay.remove();
            }
        }

        container.dataset.currentCoverKey = originalImageKey;

        const computedStyle = window.getComputedStyle(container);
        if (computedStyle.position === 'static') {
            container.style.position = 'relative';
        }

        // 从映射表中匹配图片
        let imgUrl = "";
        if (imageMapping.has(originalImageKey)) {
            imgUrl = imageMapping.get(originalImageKey);
        } else {
            imgUrl = getRandomImage();
            imageMapping.set(originalImageKey, imgUrl);
        }

        if (imgUrl) {
            const overlay = document.createElement('img');
            overlay.src = imgUrl;
            overlay.className = 'custom-cover-overlay';
            container.appendChild(overlay);
        }
    });
}

// 防抖函数
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

// 监听 DOM 变化
const observer = new MutationObserver((mutations) => {
    let shouldUpdate = false;
    for (const mutation of mutations) {
        if (mutation.addedNodes.length > 0 || mutation.type === 'attributes') {
            shouldUpdate = true;
            break;
        }
    }
    if (shouldUpdate) {
        debouncedApply();
    }
});

// 异步加载配置并初始化
async function initExtension() {
    try {
        const configUrl = chrome.runtime.getURL('images.json');
        const response = await fetch(configUrl);
        const data = await response.json();

        if (data && Array.isArray(data.images)) {
            coverImages = data.images;
        }

        const defaultSettings = { homeNew: true, searchOld: true, dynamic: true, dynamicLightbox: true };

        chrome.storage.local.get(defaultSettings, (settings) => {
            if (settings.homeNew) {
                activeSelectors.push(...selectorMap.homeNew);
            }
            if (settings.searchOld) {
                activeSelectors.push(...selectorMap.searchOld);
            }
            if (settings.dynamic) {
                activeSelectors.push(...selectorMap.dynamic);
            }
            if (settings.dynamicLightbox) {
                activeSelectors.push(...selectorMap.dynamicLightbox);
            }

            if (coverImages.length > 0 && activeSelectors.length > 0) {
                applyCoverReplacement();
                observer.observe(document.body, {
                    childList: true,
                    subtree: true,
                    attributes: true,
                    attributeFilter: ['src', 'style', 'class']
                });
            }
        });

    } catch (error) {
        console.error("Bilibili Cover Replacer: 初始化失败。", error);
    }
}

// 启动入口
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initExtension();
    });
} else {
    initExtension();
}