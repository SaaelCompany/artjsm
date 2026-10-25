(function () {
    var STORAGE_KEY = "artjsm-theme";
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
                toLight: "Включить светлую тему"
            };
        }
        return {
            toDark: "Switch to dark theme",
            toLight: "Switch to light theme"
        };
    }

    function currentTheme() {
        return document.documentElement.getAttribute("data-artjsm-theme") === "dark" ? "dark" : "light";
    }

    function apply(theme, persistLocal) {
        var next = theme === "dark" ? "dark" : "light";
        document.documentElement.setAttribute("data-artjsm-theme", next);
        if (persistLocal) {
            try {
                localStorage.setItem(STORAGE_KEY, next);
            } catch (e) {
                /* private mode */
            }
        }
        render();
    }

    function render() {
        var button = document.getElementById("artjsm-theme-toggle");
        if (!button) {
            return;
        }
        var dark = currentTheme() === "dark";
        var label = dark ? texts().toLight : texts().toDark;
        button.setAttribute("aria-pressed", dark ? "true" : "false");
        button.setAttribute("aria-label", label);
        button.setAttribute("title", label);
        var icon = button.querySelector(".artjsm-theme-toggle-icon");
        if (icon) {
            icon.innerHTML = dark ? SUN : MOON;
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
            if (value === "dark" || value === "light") {
                apply(value, true);
            }
        });
    }

    function saveServer(theme, gen) {
        var key = userKey();
        if (!key) {
            return;
        }
        xhr("PUT", propertyUrl(key), JSON.stringify(theme), function () {
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
        button.innerHTML = '<span class="artjsm-theme-toggle-icon" aria-hidden="true"></span>';
        button.addEventListener("click", function (event) {
            event.preventDefault();
            var next = currentTheme() === "dark" ? "light" : "dark";
            var gen = ++generation;
            apply(next, true);
            saveServer(next, gen);
        });
        return button;
    }

    function removeExisting() {
        var item = document.getElementById("artjsm-theme-toggle-item");
        if (item && item.parentNode) {
            item.parentNode.removeChild(item);
        }
        var button = document.getElementById("artjsm-theme-toggle");
        if (button && button.parentNode) {
            button.parentNode.removeChild(button);
        }
    }

    function mount() {
        if (!document.body) {
            return;
        }
        var target = findTarget();
        var existing = document.getElementById("artjsm-theme-toggle");
        if (existing && document.body.contains(existing)) {
            if (target && target.contains(existing)) {
                return;
            }
            if (!target && existing.className.indexOf("artjsm-theme-toggle-fallback") >= 0) {
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
        if (target && String(target.tagName).toUpperCase() === "UL") {
            var li = document.createElement("li");
            li.id = "artjsm-theme-toggle-item";
            li.className = "artjsm-theme-toggle-item";
            li.appendChild(button);
            var user = document.getElementById("header-details-user-fullname");
            if (user && user.parentNode === target) {
                target.insertBefore(li, user);
            } else {
                target.appendChild(li);
            }
        } else if (target) {
            button.id = "artjsm-theme-toggle";
            var holder = document.createElement("span");
            holder.id = "artjsm-theme-toggle-item";
            holder.className = "artjsm-theme-toggle-item";
            holder.appendChild(button);
            target.appendChild(holder);
        } else {
            button.className += " artjsm-theme-toggle-fallback";
            document.body.appendChild(button);
        }
        if (button.className.indexOf("artjsm-theme-toggle-fallback") >= 0 || (target && isLightBackground(target))) {
            button.className += " artjsm-on-light";
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
        });
        window.setTimeout(function () {
            allowFallback = true;
            mount();
        }, 800);
        window.setInterval(mount, 2500);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", start);
    } else {
        start();
    }
})();
