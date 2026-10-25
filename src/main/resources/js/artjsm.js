(function () {
    var root = document.documentElement;
    if ((" " + (root.className || "") + " ").indexOf(" artjsm ") < 0) {
        root.className = root.className ? (root.className + " artjsm") : "artjsm";
    }
    try {
        var early = localStorage.getItem("artjsm-theme");
        if (early !== "dark" && early !== "light") {
            early = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
        }
        root.setAttribute("data-artjsm-theme", early);
        var rawAppearance = localStorage.getItem("artjsm-appearance");
        if (rawAppearance) {
            var earlySettings = JSON.parse(rawAppearance);
            if (earlySettings.mode === "dark" || earlySettings.mode === "light") {
                root.setAttribute("data-artjsm-theme", earlySettings.mode);
            }
            if (earlySettings.palette) {
                root.setAttribute("data-artjsm-palette", earlySettings.palette);
            }
            if (earlySettings.accent) {
                root.setAttribute("data-artjsm-accent", earlySettings.accent);
            }
            if (earlySettings.header) {
                root.setAttribute("data-artjsm-header", earlySettings.header);
            }
        }
    } catch (e) {
        if (!root.getAttribute("data-artjsm-theme")) {
            root.setAttribute("data-artjsm-theme", "light");
        }
    }
    if (window.__artjsmThemeBound) {
        return;
    }
    window.__artjsmThemeBound = true;

    var STORAGE_KEY = "artjsm-theme";
    var SETTINGS_KEY = "artjsm-appearance";
    var PROPERTY = "artjsm.theme";
    var generation = 0;
    var allowFallback = false;
    var contextPath = detectContext();

    var MOON = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">'
        + '<path fill="currentColor" d="M15.2 3.1a8.6 8.6 0 1 0 5.7 12.4A7.2 7.2 0 0 1 15.2 3.1z"/></svg>';
    var SUN = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">'
        + '<circle cx="12" cy="12" r="4" fill="currentColor"/>'
        + '<g stroke="currentColor" stroke-width="2" stroke-linecap="round">'
        + '<path d="M12 2.5v2.2M12 19.3v2.2M4.8 4.8l1.6 1.6M17.6 17.6l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.8 19.2l1.6-1.6M17.6 6.4l1.6-1.6"/>'
        + '</g></svg>';

    function detectContext() {
        var meta = document.querySelector('meta[name="ajs-context-path"]');
        if (meta) {
            return meta.getAttribute("content") || "";
        }
        var script = document.querySelector('script[data-artjsm="js"]');
        var src = script ? (script.getAttribute("src") || "") : "";
        var marker = "/download/resources/";
        var idx = src.indexOf(marker);
        return idx >= 0 ? src.substring(0, idx) : "";
    }

    function texts() {
        var lang = "";
        var meta = document.querySelector('meta[name="ajs-user-locale"]');
        if (meta) {
            lang = meta.getAttribute("content") || "";
        }
        if (!lang) {
            lang = document.documentElement.getAttribute("lang") || "";
        }
        if (lang.toLowerCase().indexOf("ru") === 0) {
            return {
                toDark: "Включить тёмную тему",
                toLight: "Включить светлую тему",
                dark: "Тёмная тема",
                light: "Светлая тема",
                settings: "Настройки темы",
                settingsShort: "Настройки",
                title: "Оформление",
                mode: "Режим",
                lightMode: "Светлая",
                darkMode: "Тёмная",
                palette: "Палитра",
                accent: "Акцент",
                header: "Шапка",
                neutral: "Нейтральная",
                blue: "Синяя",
                graphite: "Графит",
                soft: "Мягкая",
                brand: "Фирменная синяя",
                match: "В цвет темы"
            };
        }
        return {
            toDark: "Switch to dark theme",
            toLight: "Switch to light theme",
            dark: "Dark theme",
            light: "Light theme",
            settings: "Theme settings",
            settingsShort: "Settings",
            title: "Appearance",
            mode: "Mode",
            lightMode: "Light",
            darkMode: "Dark",
            palette: "Palette",
            accent: "Accent",
            header: "Header",
            neutral: "Neutral",
            blue: "Blue",
            graphite: "Graphite",
            soft: "Soft",
            brand: "Brand blue",
            match: "Match theme"
        };
    }

    function currentTheme() {
        return document.documentElement.getAttribute("data-artjsm-theme") === "dark" ? "dark" : "light";
    }

    function currentSettings() {
        var node = document.documentElement;
        var mode = node.getAttribute("data-artjsm-theme") === "dark" ? "dark" : "light";
        return {
            mode: mode,
            palette: node.getAttribute("data-artjsm-palette") || "neutral",
            accent: node.getAttribute("data-artjsm-accent") || "blue",
            header: node.getAttribute("data-artjsm-header") || "match"
        };
    }

    function apply(theme, persistLocal) {
        applySettings({ mode: theme === "dark" ? "dark" : "light" }, persistLocal);
    }

    function applySettings(partial, persistLocal) {
        var next = currentSettings();
        if (partial.mode === "dark" || partial.mode === "light") {
            next.mode = partial.mode;
        }
        if (partial.palette) {
            next.palette = partial.palette;
        }
        if (partial.accent) {
            next.accent = partial.accent;
        }
        if (partial.header) {
            next.header = partial.header;
        }
        var node = document.documentElement;
        node.setAttribute("data-artjsm-theme", next.mode);
        node.setAttribute("data-artjsm-palette", next.palette);
        node.setAttribute("data-artjsm-accent", next.accent);
        node.setAttribute("data-artjsm-header", next.header);
        if (persistLocal) {
            try {
                localStorage.setItem(STORAGE_KEY, next.mode);
                localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
            } catch (e) {
                /* private mode */
            }
        }
        render();
        renderPanel();
        repaintLightSurfaces();
    }

    function classNameOf(el) {
        return el && typeof el.className === "string" ? el.className : "";
    }

    function viewOf(el) {
        var doc = el.ownerDocument;
        if (!doc) {
            return null;
        }
        return doc.defaultView || doc.parentWindow || null;
    }

    function inSkippedChrome(el) {
        var doc = el.ownerDocument || document;
        var node = el;
        while (node && node.nodeType === 1 && node !== doc.body) {
            var id = node.id || "";
            var cls = classNameOf(node);
            var trigger = cls.indexOf("aui-dropdown2-trigger") >= 0 || cls.indexOf("aui-dd-trigger") >= 0;
            var popup = !trigger && (cls.indexOf("aui-dropdown") >= 0 || cls.indexOf("aui-inline-dialog") >= 0 || cls.indexOf("ajs-layer") >= 0);
            if (id === "header" || cls.indexOf("aui-header") >= 0 || popup || cls.indexOf("artjsm-theme-panel") >= 0 || cls.indexOf("aui-flag") >= 0 || cls.indexOf("aui-message") >= 0 || cls.indexOf("aui-banner") >= 0 || cls.indexOf("aui-lozenge") >= 0 || cls.indexOf("aui-icon") >= 0 || cls.indexOf("aui-avatar") >= 0) {
                return true;
            }
            node = node.parentNode;
        }
        return false;
    }

    function inTopHeader(el) {
        var doc = el.ownerDocument || document;
        var node = el;
        while (node && node.nodeType === 1) {
            if (node.id === "header") {
                return true;
            }
            if (node === doc.body) {
                break;
            }
            node = node.parentNode;
        }
        return false;
    }

    function rgbOf(color) {
        var match = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([0-9.]+))?/.exec(color || "");
        if (match) {
            return {
                r: +match[1],
                g: +match[2],
                b: +match[3],
                a: match[4] === undefined ? 1 : +match[4]
            };
        }
        var text = String(color || "").replace(/^\s+|\s+$/g, "");
        var hex = /^#([0-9a-f]{6})$/i.exec(text);
        if (hex) {
            var n = parseInt(hex[1], 16);
            return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 1 };
        }
        var shortHex = /^#([0-9a-f]{3})$/i.exec(text);
        if (!shortHex) {
            return null;
        }
        var s = shortHex[1];
        return {
            r: parseInt(s.charAt(0) + s.charAt(0), 16),
            g: parseInt(s.charAt(1) + s.charAt(1), 16),
            b: parseInt(s.charAt(2) + s.charAt(2), 16),
            a: 1
        };
    }

    function closeColor(a, b, tol) {
        return !!(a && b && Math.abs(a.r - b.r) <= tol && Math.abs(a.g - b.g) <= tol && Math.abs(a.b - b.b) <= tol);
    }

    function luminance(c) {
        return (0.299 * c.r + 0.587 * c.g + 0.114 * c.b) / 255;
    }

    /* Jira's page canvas is often #f0f0f0 or #f4f5f7, below a pure-white cutoff. */
    function neutralLight(color) {
        var c = rgbOf(color);
        if (!c || c.a < 0.35) {
            return false;
        }
        var max = Math.max(c.r, c.g, c.b);
        var min = Math.min(c.r, c.g, c.b);
        return max - min <= 36 && min >= 196;
    }

    function darkNeutralText(color) {
        var c = rgbOf(color);
        if (!c || c.a < 0.45) {
            return false;
        }
        var max = Math.max(c.r, c.g, c.b);
        var min = Math.min(c.r, c.g, c.b);
        return max - min <= 72 && luminance(c) < 0.62;
    }

    function lowLuminance(color) {
        var c = rgbOf(color);
        if (!c || c.a < 0.45) {
            return false;
        }
        return luminance(c) < 0.55;
    }

    function clearPaint(el) {
        if (!el || el.getAttribute("data-artjsm-painted") !== "1") {
            return;
        }
        el.style.removeProperty("background-color");
        el.style.removeProperty("background-image");
        el.style.removeProperty("color");
        el.style.removeProperty("border-color");
        el.removeAttribute("data-artjsm-painted");
    }

    function markPaint(el) {
        el.setAttribute("data-artjsm-painted", "1");
    }

    function hasSprite(style) {
        var image = style && style.backgroundImage ? style.backgroundImage : "";
        return image.indexOf("url(") >= 0;
    }

    function insideSidebarHeader(el) {
        var doc = el.ownerDocument || document;
        var walk = el;
        while (walk && walk.nodeType === 1) {
            var cls = classNameOf(walk);
            if (cls.indexOf("aui-sidebar-header") >= 0 || cls.indexOf("aui-sidebar-subheader") >= 0 || cls.indexOf("project-header") >= 0 || walk.id === "project-header") {
                return true;
            }
            if (walk === doc.body) {
                break;
            }
            walk = walk.parentNode;
        }
        return false;
    }

    function sidebarShell(el) {
        if (!el || el.nodeType !== 1) {
            return false;
        }
        if (el.id === "sidebar" || el.id === "admin-sidebar") {
            return true;
        }
        return (" " + classNameOf(el) + " ").indexOf(" aui-sidebar ") >= 0;
    }

    function insideIssueTable(el) {
        var doc = el.ownerDocument || document;
        var walk = el;
        while (walk && walk.nodeType === 1) {
            var cls = classNameOf(walk);
            if (walk.id === "issuetable" || walk.id === "sd-queues" || cls.indexOf("issue-table") >= 0 || cls.indexOf("issuerow") >= 0 || cls.indexOf("list-view") >= 0) {
                return true;
            }
            if (walk === doc.body) {
                break;
            }
            walk = walk.parentNode;
        }
        return false;
    }

    function insideSidebar(el) {
        var doc = el.ownerDocument || document;
        var walk = el;
        while (walk && walk.nodeType === 1) {
            var cls = classNameOf(walk);
            if (cls.indexOf("aui-sidebar") >= 0 || walk.id === "sidebar" || walk.id === "admin-sidebar") {
                return true;
            }
            if (walk === doc.body) {
                break;
            }
            walk = walk.parentNode;
        }
        return false;
    }

    function paintFill(el) {
        var cls = classNameOf(el);
        var parentCls = el.parentNode ? classNameOf(el.parentNode) : "";
        var tag = el.tagName;
        if (cls.indexOf("focused") >= 0 || parentCls.indexOf("focused") >= 0) {
            return "var(--artjsm-accent-soft)";
        }
        if (tag === "TH" && insideIssueTable(el)) {
            return "transparent";
        }
        if (tag === "TH" || cls.indexOf("dashboard-item-header") >= 0 || cls.indexOf("gadget-header") >= 0) {
            return "var(--artjsm-bg-subtle)";
        }
        if (insideSidebar(el) || cls.indexOf("gadget") >= 0 || cls.indexOf("dashboard-item") >= 0 || cls.indexOf("aui-dialog") >= 0 || cls.indexOf("jira-dialog") >= 0 || cls.indexOf("upm-plugin") >= 0 || cls.indexOf("login-form") >= 0 || el.id === "login-form" || el.id === "login-container") {
            return "var(--artjsm-surface)";
        }
        if (tag === "TD") {
            return "transparent";
        }
        return "var(--artjsm-bg)";
    }

    function isField(el) {
        var tag = el.tagName;
        if (tag === "TEXTAREA" || tag === "SELECT") {
            return true;
        }
        if (tag !== "INPUT") {
            return false;
        }
        var type = (el.getAttribute("type") || "text").toLowerCase();
        return type !== "checkbox" && type !== "radio" && type !== "submit" && type !== "button" && type !== "hidden" && type !== "image" && type !== "file" && type !== "range" && type !== "color";
    }

    function isButton(el) {
        var cls = classNameOf(el);
        if (cls.indexOf("artjsm-") >= 0) {
            return false;
        }
        if (cls.indexOf("aui-button") >= 0 || cls.indexOf("aui-dropdown2-trigger") >= 0 || cls.indexOf("aui-dd-trigger") >= 0) {
            return true;
        }
        var tag = el.tagName;
        var type = (el.getAttribute("type") || "").toLowerCase();
        return (tag === "BUTTON" || tag === "INPUT") && (type === "submit" || type === "button");
    }

    function paintButton(el) {
        var cls = classNameOf(el);
        if (cls.indexOf("aui-button-link") >= 0 || cls.indexOf("cancel") >= 0) {
            el.style.setProperty("background-color", "transparent", "important");
            el.style.setProperty("color", "var(--artjsm-link)", "important");
            el.style.setProperty("border-color", "transparent", "important");
            markPaint(el);
            return;
        }
        var primary = cls.indexOf("aui-button-primary") >= 0 || cls.indexOf("button-primary") >= 0;
        var id = el.id || "";
        var type = (el.getAttribute("type") || "").toLowerCase();
        if (!primary && (id === "login" || id === "login-form-submit" || id === "websudo-submit" || type === "submit")) {
            primary = cls.indexOf("cancel") < 0;
        }
        if (primary) {
            el.style.setProperty("background-color", "var(--artjsm-primary)", "important");
            el.style.setProperty("background-image", "none", "important");
            el.style.setProperty("color", "#ffffff", "important");
            el.style.setProperty("border-color", "var(--artjsm-primary)", "important");
        } else {
            el.style.setProperty("background-color", "var(--artjsm-surface)", "important");
            el.style.setProperty("background-image", "none", "important");
            el.style.setProperty("color", "var(--artjsm-text)", "important");
            el.style.setProperty("border-color", "var(--artjsm-border-strong)", "important");
        }
        markPaint(el);
    }

    function paintField(el) {
        el.style.setProperty("background-color", "var(--artjsm-bg-sunken)", "important");
        el.style.setProperty("background-image", "none", "important");
        el.style.setProperty("color", "var(--artjsm-text)", "important");
        el.style.setProperty("border-color", "var(--artjsm-border-strong)", "important");
        markPaint(el);
    }

    function stylesheetHref() {
        var links = document.getElementsByTagName("link");
        var i;
        for (i = 0; i < links.length; i++) {
            var href = links[i].getAttribute("href") || "";
            if (href.indexOf("artjsm.css") >= 0) {
                return links[i].href;
            }
        }
        return "";
    }

    function cssVar(name, fallback) {
        var value = "";
        try {
            value = window.getComputedStyle(document.documentElement).getPropertyValue(name) || "";
        } catch (e) {
            value = "";
        }
        value = String(value).replace(/^\s+|\s+$/g, "");
        return value || fallback;
    }

    function frameCss() {
        var bg = cssVar("--artjsm-bg", "#181a1f");
        var text = cssVar("--artjsm-text", "#e8eaed");
        var link = cssVar("--artjsm-link", "#9ec1ff");
        var border = cssVar("--artjsm-border", "#3a404b");
        var subtle = cssVar("--artjsm-bg-subtle", "#21242b");
        var sunken = cssVar("--artjsm-bg-sunken", "#101216");
        var subtleText = cssVar("--artjsm-text-subtle", "#b4b9c3");
        return "html,body{background-color:" + bg + " !important;color:" + text + " !important;}"
            + "a,a:visited{color:" + link + " !important;}"
            + "th{background-color:" + subtle + " !important;color:" + subtleText + " !important;}"
            + "td,p,li,span,div,h1,h2,h3,h4{color:" + text + ";}"
            + "input,select,textarea{background-color:" + sunken + " !important;color:" + text + " !important;border-color:" + border + " !important;}";
    }

    function copyThemeAttrs(root) {
        var src = document.documentElement;
        var names = ["data-artjsm-theme", "data-artjsm-palette", "data-artjsm-accent", "data-artjsm-header"];
        var i;
        for (i = 0; i < names.length; i++) {
            var value = src.getAttribute(names[i]);
            if (value) {
                root.setAttribute(names[i], value);
            }
        }
        var cls = root.className || "";
        if ((" " + cls + " ").indexOf(" artjsm ") < 0) {
            root.className = cls + (cls ? " " : "") + "artjsm";
        }
    }

    function ensureFrameAssets(child) {
        copyThemeAttrs(child.documentElement);
        var head = child.getElementsByTagName("head")[0] || child.documentElement;
        var href = stylesheetHref();
        if (href && !child.getElementById("artjsm-frame-css")) {
            var link = child.createElement("link");
            link.id = "artjsm-frame-css";
            link.rel = "stylesheet";
            link.href = href;
            head.appendChild(link);
        }
        var style = child.getElementById("artjsm-frame-style");
        if (!style) {
            style = child.createElement("style");
            style.id = "artjsm-frame-style";
            head.appendChild(style);
        }
        var next = frameCss();
        if (style.textContent !== next) {
            style.textContent = next;
        }
    }

    function repaintDocument(doc) {
        if (!doc || !doc.body) {
            return;
        }
        var dark = currentTheme() === "dark";
        var nodes;
        try {
            nodes = doc.querySelectorAll("body, div, section, main, article, aside, nav, header, footer, table, thead, tbody, tr, th, td, h1, h2, h3, h4, ul, ol, li, form, fieldset, p, label, a, button, input, textarea, select, span, strong, small");
        } catch (e) {
            return;
        }
        var i;
        for (i = 0; i < nodes.length; i++) {
            var el = nodes[i];
            if (!el || el.nodeType !== 1) {
                continue;
            }
            if (inSkippedChrome(el) || inTopHeader(el)) {
                if (!dark) {
                    clearPaint(el);
                }
                continue;
            }
            var tag = el.tagName;
            if (tag === "IMG" || tag === "SVG" || tag === "CANVAS" || tag === "VIDEO") {
                continue;
            }
            if (isButton(el)) {
                paintButton(el);
                continue;
            }
            if (!dark) {
                clearPaint(el);
                continue;
            }
            var view = viewOf(el);
            if (!view || !view.getComputedStyle) {
                continue;
            }
            if (isField(el)) {
                paintField(el);
                continue;
            }
            var style;
            try {
                style = view.getComputedStyle(el);
            } catch (e2) {
                continue;
            }
            var bg = style.backgroundColor;
            var sprite = hasSprite(style);
            if (insideSidebar(el) && !sprite && tag !== "IMG" && closeColor(rgbOf(bg), rgbOf(cssVar("--artjsm-bg", "#181a1f")), 12)) {
                el.style.setProperty("background-color", sidebarShell(el) ? "var(--artjsm-surface)" : "transparent", "important");
                if (insideSidebarHeader(el)) {
                    el.style.setProperty("border-color", "transparent", "important");
                    el.style.setProperty("box-shadow", "none", "important");
                }
                markPaint(el);
            } else if (insideSidebarHeader(el) && !sprite && tag !== "IMG") {
                el.style.setProperty("background-color", "transparent", "important");
                el.style.setProperty("box-shadow", "none", "important");
                el.style.setProperty("border-color", "transparent", "important");
                markPaint(el);
            }
            if (!insideSidebarHeader(el) && tag !== "INPUT") {
                var sides = ["top", "right", "bottom", "left"];
                var sideIndex;
                for (sideIndex = 0; sideIndex < sides.length; sideIndex++) {
                    var sideName = sides[sideIndex];
                    var borderColor = style["border" + sideName.charAt(0).toUpperCase() + sideName.slice(1) + "Color"];
                    if (neutralLight(borderColor)) {
                        el.style.setProperty("border-" + sideName + "-color", "var(--artjsm-border)", "important");
                        markPaint(el);
                    }
                }
            }
            var tiny = el.offsetWidth > 0 && el.offsetWidth < 16 && el.offsetHeight > 0 && el.offsetHeight < 16;
            if (!tiny && neutralLight(bg) && !sprite) {
                el.style.setProperty("background-color", paintFill(el), "important");
                if (tag === "TH" || tag === "TD" || tag === "H1" || tag === "H2" || tag === "H3" || tag === "H4" || tag === "HEADER" || tag === "LABEL" || tag === "A" || tag === "P" || tag === "SPAN" || tag === "LI" || tag === "STRONG" || tag === "SMALL") {
                    el.style.setProperty("color", tag === "A" ? "var(--artjsm-link)" : "var(--artjsm-text)", "important");
                }
                markPaint(el);
            } else if (tag === "A" && lowLuminance(style.color)) {
                el.style.setProperty("color", "var(--artjsm-link)", "important");
                markPaint(el);
            } else if ((tag === "LABEL" || tag === "P" || tag === "H1" || tag === "H2" || tag === "H3" || tag === "H4" || tag === "SPAN" || tag === "LI" || tag === "TD" || tag === "TH" || tag === "SMALL" || tag === "STRONG" || tag === "LEGEND") && darkNeutralText(style.color)) {
                el.style.setProperty("color", "var(--artjsm-text)", "important");
                markPaint(el);
            }
        }
    }

    function themeFrames(doc) {
        var frames;
        try {
            frames = doc.querySelectorAll("iframe");
        } catch (e) {
            return;
        }
        var i;
        for (i = 0; i < frames.length; i++) {
            var frame = frames[i];
            if (frame.getAttribute("data-artjsm-frame") !== "1") {
                frame.setAttribute("data-artjsm-frame", "1");
                frame.addEventListener("load", function () {
                    repaintLightSurfaces();
                });
            }
            var child = null;
            try {
                child = frame.contentDocument;
            } catch (e2) {
                child = null;
            }
            if (!child || !child.documentElement || !child.body) {
                continue;
            }
            try {
                ensureFrameAssets(child);
                repaintDocument(child);
                themeFrames(child);
            } catch (e3) {
                /* cross-origin gadget */
            }
        }
    }

    function repaintLightSurfaces() {
        if (!document.body) {
            return;
        }
        repaintDocument(document);
        themeFrames(document);
    }

    function render() {
        var button = document.getElementById("artjsm-theme-toggle");
        if (!button) {
            return;
        }
        var dark = currentTheme() === "dark";
        var copy = texts();
        var label = dark ? copy.toLight : copy.toDark;
        var caption = dark ? copy.light : copy.dark;
        button.setAttribute("aria-pressed", dark ? "true" : "false");
        button.setAttribute("aria-label", label);
        button.setAttribute("title", label);
        var icon = button.querySelector(".artjsm-theme-toggle-icon");
        if (icon) {
            icon.innerHTML = dark ? SUN : MOON;
        }
        var text = button.querySelector(".artjsm-theme-toggle-label");
        if (text) {
            text.textContent = caption;
        }
        var settings = document.getElementById("artjsm-theme-settings");
        if (settings) {
            settings.setAttribute("aria-label", copy.settings);
            settings.setAttribute("title", copy.settings);
            settings.textContent = copy.settingsShort;
        }
    }

    function userKey() {
        var meta = document.querySelector('meta[name="ajs-remote-user-key"]');
        var key = meta && meta.getAttribute("content");
        if (key) {
            return key;
        }
        try {
            if (window.AJS && AJS.Meta && AJS.Meta.get) {
                return AJS.Meta.get("remote-user-key") || "";
            }
        } catch (e) {
            /* portal pages may not expose AJS */
        }
        return "";
    }

    function propertyUrl(key) {
        return contextPath + "/rest/api/2/user/properties/" + PROPERTY + "?key=" + encodeURIComponent(key);
    }

    function xhr(method, url, body, done) {
        try {
            var req = new XMLHttpRequest();
            req.open(method, url, true);
            req.withCredentials = true;
            req.setRequestHeader("Accept", "application/json");
            req.setRequestHeader("X-Atlassian-Token", "no-check");
            req.setRequestHeader("X-Requested-With", "XMLHttpRequest");
            if (body != null) {
                req.setRequestHeader("Content-Type", "application/json");
            }
            req.onreadystatechange = function () {
                if (req.readyState === 4 && done) {
                    done(req.status, req.responseText || "");
                }
            };
            req.send(body);
        } catch (e) {
            if (done) {
                done(0, "");
            }
        }
    }

    function loadServer() {
        var key = userKey();
        if (!key) {
            return;
        }
        var gen = generation;
        xhr("GET", propertyUrl(key), null, function (status, text) {
            if (gen !== generation || status !== 200) {
                return;
            }
            var value = null;
            try {
                value = JSON.parse(text).value;
            } catch (e) {
                return;
            }
            var stored = value;
            if (typeof stored === "string") {
                if (stored === "dark" || stored === "light") {
                    apply(stored, true);
                    return;
                }
                try {
                    stored = JSON.parse(stored);
                } catch (e2) {
                    return;
                }
            }
            if (!stored || typeof stored !== "object") {
                return;
            }
            applySettings({
                mode: stored.mode || stored.theme,
                palette: stored.palette,
                accent: stored.accent,
                header: stored.header
            }, true);
        });
    }

    function saveServer(gen) {
        var key = userKey();
        if (!key) {
            return;
        }
        xhr("PUT", propertyUrl(key), JSON.stringify(currentSettings()), function () {
            if (gen !== generation) {
                return;
            }
        });
    }

    function isLightBackground(el) {
        var node = el;
        var steps = 0;
        while (node && node.nodeType === 1 && steps < 8) {
            var bg = window.getComputedStyle(node).backgroundColor;
            var match = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(bg || "");
            if (match && bg.indexOf("rgba(0, 0, 0, 0)") !== 0 && bg !== "transparent") {
                var r = +match[1];
                var g = +match[2];
                var b = +match[3];
                if (bg.indexOf("rgba") === 0 && /rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*0\s*\)/.test(bg)) {
                    node = node.parentNode;
                    steps++;
                    continue;
                }
                return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.72;
            }
            node = node.parentNode;
            steps++;
        }
        return false;
    }

    function findTarget() {
        return document.querySelector("#header .aui-header-secondary .aui-nav")
            || document.querySelector(".aui-header-secondary .aui-nav")
            || document.querySelector(".cv-smart-portal-header-actions")
            || document.querySelector(".cv-smart-portal-header-inner")
            || document.querySelector("#header .aui-header-inner");
    }

    function buildButton() {
        var button = document.createElement("button");
        button.type = "button";
        button.id = "artjsm-theme-toggle";
        button.className = "artjsm-theme-toggle";
        button.innerHTML = '<span class="artjsm-theme-toggle-icon" aria-hidden="true"></span>'
            + '<span class="artjsm-theme-toggle-label"></span>';
        button.addEventListener("click", function (event) {
            event.preventDefault();
            var next = currentTheme() === "dark" ? "light" : "dark";
            var gen = ++generation;
            apply(next, true);
            saveServer(gen);
        });
        return button;
    }

    function buildSettingsButton() {
        var button = document.createElement("button");
        button.type = "button";
        button.id = "artjsm-theme-settings";
        button.className = "artjsm-theme-settings";
        button.addEventListener("click", function (event) {
            event.preventDefault();
            event.stopPropagation();
            togglePanel(button);
        });
        return button;
    }

    function choiceRow(setting, values) {
        var row = document.createElement("div");
        row.className = "artjsm-choice";
        row.setAttribute("data-setting", setting);
        var copy = texts();
        var i;
        for (i = 0; i < values.length; i++) {
            var button = document.createElement("button");
            button.type = "button";
            button.setAttribute("data-value", values[i]);
            var caption = copy[values[i]] || values[i];
            if (setting === "mode" && values[i] === "light") {
                caption = copy.lightMode;
            }
            if (setting === "mode" && values[i] === "dark") {
                caption = copy.darkMode;
            }
            button.textContent = caption;
            if (setting === "accent") {
                button.className = "artjsm-swatch";
                button.textContent = "";
                button.setAttribute("aria-label", copy[values[i]] || values[i]);
                button.setAttribute("title", copy[values[i]] || values[i]);
            }
            row.appendChild(button);
        }
        return row;
    }

    function ensurePanel() {
        var panel = document.getElementById("artjsm-theme-panel");
        if (panel) {
            return panel;
        }
        panel = document.createElement("div");
        panel.id = "artjsm-theme-panel";
        panel.className = "artjsm-theme-panel";
        panel.setAttribute("role", "dialog");
        panel.setAttribute("aria-label", texts().title);
        panel.hidden = true;
        var title = document.createElement("div");
        title.className = "artjsm-theme-panel-title";
        title.textContent = texts().title;
        panel.appendChild(title);
        panel.appendChild(label(texts().mode));
        panel.appendChild(choiceRow("mode", ["light", "dark"]));
        panel.appendChild(label(texts().palette));
        panel.appendChild(choiceRow("palette", ["neutral", "blue", "graphite", "soft"]));
        panel.appendChild(label(texts().accent));
        panel.appendChild(choiceRow("accent", ["blue", "teal", "purple", "green", "orange"]));
        panel.appendChild(label(texts().header));
        panel.appendChild(choiceRow("header", ["brand", "match"]));
        panel.addEventListener("click", function (event) {
            var button = event.target;
            while (button && button.tagName && String(button.tagName).toUpperCase() !== "BUTTON") {
                button = button.parentNode;
            }
            if (!button || !panel.contains(button)) {
                return;
            }
            var row = button.parentNode;
            var setting = row && row.getAttribute("data-setting");
            var value = button.getAttribute("data-value");
            if (!setting || !value) {
                return;
            }
            var partial = {};
            partial[setting] = value === "light" ? "light" : value === "dark" ? "dark" : value;
            if (setting === "mode") {
                partial.mode = value;
            }
            var gen = ++generation;
            applySettings(partial, true);
            saveServer(gen);
        });
        document.body.appendChild(panel);
        document.addEventListener("mousedown", function (event) {
            if (panel.hidden) {
                return;
            }
            var target = event.target;
            if (panel.contains(target)) {
                return;
            }
            if (target && target.closest && target.closest("#artjsm-theme-settings")) {
                return;
            }
            var settings = document.getElementById("artjsm-theme-settings");
            if (settings && (target === settings || settings.contains(target))) {
                return;
            }
            panel.hidden = true;
        });
        document.addEventListener("keydown", function (event) {
            if (event.key === "Escape") {
                panel.hidden = true;
            }
        });
        return panel;
    }

    function label(text) {
        var node = document.createElement("div");
        node.className = "artjsm-theme-panel-label";
        node.textContent = text;
        return node;
    }

    function renderPanel() {
        var panel = document.getElementById("artjsm-theme-panel");
        if (!panel) {
            return;
        }
        var settings = currentSettings();
        var rows = panel.querySelectorAll(".artjsm-choice");
        var i;
        for (i = 0; i < rows.length; i++) {
            var setting = rows[i].getAttribute("data-setting");
            var buttons = rows[i].querySelectorAll("button");
            var j;
            for (j = 0; j < buttons.length; j++) {
                var selected = buttons[j].getAttribute("data-value") === settings[setting];
                if (selected) {
                    buttons[j].className += buttons[j].className.indexOf("is-selected") >= 0 ? "" : " is-selected";
                } else {
                    buttons[j].className = buttons[j].className.replace(" is-selected", "").replace("is-selected", "");
                }
                buttons[j].setAttribute("aria-pressed", selected ? "true" : "false");
            }
        }
    }

    function togglePanel(anchor) {
        var panel = ensurePanel();
        renderPanel();
        if (!panel.hidden) {
            panel.hidden = true;
            return;
        }
        panel.hidden = false;
        var rect = anchor.getBoundingClientRect();
        panel.style.top = (rect.bottom + 8) + "px";
        panel.style.left = Math.max(8, rect.left) + "px";
        var width = panel.offsetWidth || 280;
        if (rect.left + width > window.innerWidth - 8) {
            panel.style.left = Math.max(8, window.innerWidth - width - 8) + "px";
        }
    }

    function removeExisting() {
        var selectors = ["#artjsm-theme-toggle-item", "#artjsm-theme-toggle"];
        var s;
        var i;
        for (s = 0; s < selectors.length; s++) {
            var nodes = document.querySelectorAll(selectors[s]);
            for (i = 0; i < nodes.length; i++) {
                var node = nodes[i];
                if (!node.parentNode) {
                    continue;
                }
                var parent = node.parentNode;
                if (String(parent.tagName).toUpperCase() === "LI") {
                    parent.parentNode.removeChild(parent);
                } else {
                    parent.removeChild(node);
                }
            }
        }
    }

    function mount() {
        if (!document.body) {
            return;
        }
        var target = findTarget();
        var existing = document.getElementById("artjsm-theme-toggle");
        var ours = existing
            && String(existing.tagName).toUpperCase() === "BUTTON"
            && existing.querySelector(".artjsm-theme-toggle-label");
        if (ours && document.getElementById("artjsm-theme-settings") && document.body.contains(existing)) {
            if (target && target.contains(existing)) {
                return;
            }
            var fallbackHost = existing.parentNode;
            if (!target && fallbackHost && fallbackHost.className.indexOf("artjsm-theme-toggle-fallback") >= 0) {
                return;
            }
            if (!target && !allowFallback) {
                return;
            }
        }
        if (!target && !allowFallback) {
            return;
        }
        removeExisting();
        var button = buildButton();
        var settingsButton = buildSettingsButton();
        if (target && String(target.tagName).toUpperCase() === "UL") {
            var li = document.createElement("li");
            li.id = "artjsm-theme-toggle-item";
            li.className = "artjsm-theme-toggle-item";
            li.appendChild(button);
            li.appendChild(settingsButton);
            var quick = document.getElementById("quicksearch");
            if (!quick) {
                var searchInput = document.getElementById("quickSearchInput");
                quick = searchInput;
                while (quick && String(quick.tagName).toUpperCase() !== "LI") {
                    quick = quick.parentNode;
                }
            }
            var user = document.getElementById("header-details-user-fullname")
                || document.getElementById("header-details-user")
                || document.getElementById("user-options");
            if (quick && quick.parentNode === target) {
                target.insertBefore(li, quick);
            } else if (user && user.parentNode === target) {
                target.insertBefore(li, user);
            } else if (target.firstChild) {
                target.insertBefore(li, target.firstChild);
            } else {
                target.appendChild(li);
            }
        } else if (target) {
            button.id = "artjsm-theme-toggle";
            var holder = document.createElement("span");
            holder.id = "artjsm-theme-toggle-item";
            holder.className = "artjsm-theme-toggle-item";
            holder.appendChild(button);
            holder.appendChild(settingsButton);
            target.appendChild(holder);
        } else {
            var fallback = document.createElement("span");
            fallback.id = "artjsm-theme-toggle-item";
            fallback.className = "artjsm-theme-toggle-item artjsm-theme-toggle-fallback";
            fallback.appendChild(button);
            fallback.appendChild(settingsButton);
            document.body.appendChild(fallback);
        }
        var lightChrome = button.className.indexOf("artjsm-theme-toggle-fallback") >= 0 || (target && isLightBackground(target));
        if (lightChrome) {
            button.className += " artjsm-on-light";
            settingsButton.className += " artjsm-on-light";
            if (button.parentNode) {
                button.parentNode.className += " artjsm-on-light";
            }
        }
        render();
    }

    function watchSystemTheme() {
        if (!window.matchMedia) {
            return;
        }
        var query = window.matchMedia("(prefers-color-scheme: dark)");
        var onChange = function () {
            var stored = null;
            try {
                stored = localStorage.getItem(STORAGE_KEY);
            } catch (e) {
                stored = "set";
            }
            if (stored === "dark" || stored === "light") {
                return;
            }
            generation++;
            apply(query.matches ? "dark" : "light", false);
        };
        if (query.addEventListener) {
            query.addEventListener("change", onChange);
        } else if (query.addListener) {
            query.addListener(onChange);
        }
    }

    function start() {
        mount();
        loadServer();
        watchSystemTheme();
        window.addEventListener("storage", function (event) {
            if (event.key === STORAGE_KEY && (event.newValue === "dark" || event.newValue === "light")) {
                generation++;
                apply(event.newValue, false);
            }
            if (event.key === SETTINGS_KEY && event.newValue) {
                try {
                    generation++;
                    applySettings(JSON.parse(event.newValue), false);
                } catch (e) {
                    /* ignore foreign values */
                }
            }
        });
        repaintLightSurfaces();
        window.setTimeout(function () {
            allowFallback = true;
            mount();
            repaintLightSurfaces();
        }, 300);
        window.setTimeout(repaintLightSurfaces, 1200);
        window.setInterval(function () {
            mount();
            repaintLightSurfaces();
        }, 2500);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", start);
    } else {
        start();
    }
})();
