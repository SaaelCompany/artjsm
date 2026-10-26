package com.artjsm.theme;

import java.nio.ByteBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.Charset;
import java.nio.charset.CharsetDecoder;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.util.Locale;

/**
 * Inserts the theme bootstrap, stylesheet and script into a full HTML document.
 * Tag matching is case-insensitive and does not treat {@code <header>} as {@code <head>}.
 */
final class HtmlThemeInjector {

    private HtmlThemeInjector() {
    }

    static byte[] inject(byte[] html, Charset charset, String cssUrl, String jsUrl) {
        if (html == null || html.length == 0) {
            return html;
        }
        Charset actual = charset == null ? StandardCharsets.UTF_8 : charset;
        CharsetDecoder decoder = actual.newDecoder()
                .onMalformedInput(CodingErrorAction.REPORT)
                .onUnmappableCharacter(CodingErrorAction.REPORT);
        String text;
        try {
            text = decoder.decode(ByteBuffer.wrap(html)).toString();
        } catch (CharacterCodingException ex) {
            return html;
        }
        String rewritten = inject(text, cssUrl, jsUrl);
        if (rewritten == null) {
            return html;
        }
        return rewritten.getBytes(actual);
    }

    /**
     * @return rewritten markup, or {@code null} when the document should be left untouched
     */
    static String inject(String html, String cssUrl, String jsUrl) {
        if (html == null || cssUrl == null || jsUrl == null) {
            return null;
        }
        if (indexOfIgnoreCase(html, "data-artjsm=\"boot\"", 0) >= 0) {
            return null;
        }
        int head = findOpenTag(html, "head", 0);
        if (head < 0) {
            return null;
        }
        int headGt = html.indexOf('>', head);
        if (headGt < 0) {
            return null;
        }
        int headClose = findCloseTag(html, "head", headGt + 1);
        if (headClose < 0) {
            return null;
        }

        StringBuilder out = new StringBuilder(html.length() + 700);
        out.append(html, 0, headGt + 1);
        out.append(bootTag());
        out.append(html, headGt + 1, headClose);
        out.append(cssTag(cssUrl, "css"));

        int bodyClose = findCloseTag(html, "body", headClose);
        if (bodyClose >= 0) {
            out.append(html, headClose, bodyClose);
            out.append(cssTag(cssUrl, "css-late"));
            out.append(jsTag(jsUrl));
            out.append(html, bodyClose, html.length());
        } else {
            out.append(html, headClose, html.length());
        }
        return out.toString();
    }

    static String bootTag() {
        return "<script data-artjsm=\"boot\">"
                + "(function(){var d=document.documentElement;"
                + "try{if((\" \"+d.className+\" \").indexOf(\" artjsm \")<0)"
                + "{d.className+=(d.className?\" \":\"\")+\"artjsm\";}}catch(e){}"
                + "try{var t=localStorage.getItem(\"artjsm-theme\");"
                + "if(t!==\"dark\"&&t!==\"light\"){t=\"light\";}"
                + "d.setAttribute(\"data-artjsm-theme\",t);"
                + "var raw=localStorage.getItem(\"artjsm-appearance\");"
                + "if(raw){var o=JSON.parse(raw);"
                + "if(o.mode===\"dark\"||o.mode===\"light\"){d.setAttribute(\"data-artjsm-theme\",o.mode);}"
                + "if(o.palette){d.setAttribute(\"data-artjsm-palette\",o.palette);}"
                + "if(o.accent){d.setAttribute(\"data-artjsm-accent\",o.accent);}"
                + "if(o.header){d.setAttribute(\"data-artjsm-header\",o.header);}}"
                + "}catch(e){}"
                + "})();"
                + "</script>";
    }

    static boolean isHtmlType(String contentType) {
        if (contentType == null) {
            return false;
        }
        String value = contentType.toLowerCase(Locale.US);
        return value.contains("text/html") || value.contains("application/xhtml+xml");
    }

    static Charset charsetFrom(String contentType) {
        if (contentType != null) {
            String[] parts = contentType.split(";");
            for (int i = 1; i < parts.length; i++) {
                String part = parts[i].trim();
                if (part.length() >= 8 && part.substring(0, 8).equalsIgnoreCase("charset=")) {
                    String name = part.substring(8).trim();
                    if (name.length() >= 2 && name.charAt(0) == '"' && name.charAt(name.length() - 1) == '"') {
                        name = name.substring(1, name.length() - 1);
                    }
                    if (!name.isEmpty()) {
                        try {
                            return Charset.forName(name);
                        } catch (IllegalArgumentException ignored) {
                            break;
                        }
                    }
                }
            }
        }
        return StandardCharsets.UTF_8;
    }

    static boolean sniffHtml(byte[] data) {
        if (data == null || data.length == 0) {
            return false;
        }
        int length = Math.min(data.length, 512);
        String start = new String(data, 0, length, StandardCharsets.ISO_8859_1).toLowerCase(Locale.US);
        return start.contains("<!doctype html") || start.contains("<html") || start.contains("<head");
    }

    static boolean isGzip(byte[] data) {
        return data != null
                && data.length >= 2
                && (data[0] & 0xFF) == 0x1F
                && (data[1] & 0xFF) == 0x8B;
    }

    private static String cssTag(String url, String marker) {
        return "<link rel=\"stylesheet\" data-artjsm=\"" + marker + "\" href=\"" + escapeAttr(url) + "\"/>";
    }

    private static String jsTag(String url) {
        return "<script data-artjsm=\"js\" src=\"" + escapeAttr(url) + "\" defer></script>";
    }

    static String escapeAttr(String value) {
        StringBuilder out = new StringBuilder(value.length() + 8);
        for (int i = 0; i < value.length(); i++) {
            char c = value.charAt(i);
            switch (c) {
                case '&':
                    out.append("&amp;");
                    break;
                case '"':
                    out.append("&quot;");
                    break;
                case '<':
                    out.append("&lt;");
                    break;
                case '>':
                    out.append("&gt;");
                    break;
                case '\'':
                    out.append("&#39;");
                    break;
                default:
                    out.append(c);
                    break;
            }
        }
        return out.toString();
    }

    private static int findOpenTag(String html, String tag, int from) {
        String needle = "<" + tag;
        int index = Math.max(0, from);
        while (index < html.length()) {
            int found = indexOfIgnoreCase(html, needle, index);
            if (found < 0) {
                return -1;
            }
            int after = found + needle.length();
            if (after < html.length() && isTagBoundary(html.charAt(after))) {
                return found;
            }
            index = found + 1;
        }
        return -1;
    }

    private static int findCloseTag(String html, String tag, int from) {
        String needle = "</" + tag;
        int index = Math.max(0, from);
        while (index < html.length()) {
            int found = indexOfIgnoreCase(html, needle, index);
            if (found < 0) {
                return -1;
            }
            int after = found + needle.length();
            if (after < html.length() && isTagBoundary(html.charAt(after))) {
                return found;
            }
            index = found + 1;
        }
        return -1;
    }

    private static boolean isTagBoundary(char c) {
        return c == '>' || c == '/' || Character.isWhitespace(c);
    }

    private static int indexOfIgnoreCase(String haystack, String needle, int from) {
        int limit = haystack.length() - needle.length();
        for (int i = Math.max(0, from); i <= limit; i++) {
            if (haystack.regionMatches(true, i, needle, 0, needle.length())) {
                return i;
            }
        }
        return -1;
    }
}
