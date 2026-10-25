package com.artjsm.theme;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import javax.servlet.Filter;
import javax.servlet.FilterChain;
import javax.servlet.FilterConfig;
import javax.servlet.ServletException;
import javax.servlet.ServletRequest;
import javax.servlet.ServletResponse;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

/**
 * Injects the theme into decorated HTML.
 *
 * <p>The filter sits at {@code before-decoration}, outside SiteMesh, so the
 * wrapper sees the finished page (header included) rather than the raw servlet
 * output that SiteMesh later discards.
 */
public class ThemeInjectionFilter implements Filter {

    static final String MODULE_KEY = "com.artjsm.theme:artjsm-resources";

    private String version = "dev";

    @Override
    public void init(FilterConfig filterConfig) {
        version = readVersion();
    }

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {
        if (!(request instanceof HttpServletRequest) || !(response instanceof HttpServletResponse)) {
            chain.doFilter(request, response);
            return;
        }
        HttpServletRequest httpRequest = (HttpServletRequest) request;
        HttpServletResponse httpResponse = (HttpServletResponse) response;
        if (!shouldBuffer(httpRequest.getRequestURI(), httpRequest.getHeader("Accept"))) {
            chain.doFilter(request, response);
            return;
        }
        String css = resourceUrl(httpRequest.getContextPath(), version, "artjsm.css");
        String js = resourceUrl(httpRequest.getContextPath(), version, "artjsm.js");
        BufferingResponseWrapper wrapper = new BufferingResponseWrapper(httpResponse, css, js);
        try {
            chain.doFilter(request, wrapper);
            wrapper.finish();
        } catch (IOException ex) {
            wrapper.discard();
            throw ex;
        } catch (ServletException ex) {
            wrapper.discard();
            throw ex;
        } catch (RuntimeException ex) {
            wrapper.discard();
            throw ex;
        }
    }

    @Override
    public void destroy() {
    }

    static String readVersion() {
        try (InputStream in = ThemeInjectionFilter.class.getResourceAsStream("/artjsm-version.txt")) {
            if (in == null) {
                return "dev";
            }
            BufferedReader reader = new BufferedReader(new InputStreamReader(in, StandardCharsets.UTF_8));
            String line = reader.readLine();
            if (line == null) {
                return "dev";
            }
            line = line.trim();
            if (line.isEmpty() || line.indexOf('$') >= 0) {
                return "dev";
            }
            return line;
        } catch (IOException ex) {
            return "dev";
        }
    }

    static boolean shouldBuffer(String uri, String accept) {
        if (uri == null) {
            return false;
        }
        String path = uri.toLowerCase(Locale.US);
        int query = path.indexOf('?');
        if (query >= 0) {
            path = path.substring(0, query);
        }
        if (path.contains("/rest/")
                || path.contains("/download/")
                || path.contains("/plugins/servlet/oauth")
                || path.contains("/websocket")) {
            return false;
        }
        if (path.contains("/secure/attachment")
                || path.contains("/secure/thumbnail")
                || path.contains("/secure/viewavatar")
                || path.contains("/secure/useravatar")
                || path.contains("/secure/projectavatar")
                || path.contains("/images/")) {
            return false;
        }
        if (path.contains("/s/") && path.contains("/_/")) {
            return false;
        }
        if (hasStaticExtension(path)) {
            return false;
        }
        if (accept != null) {
            String accepted = accept.toLowerCase(Locale.US);
            boolean data = accepted.contains("application/json")
                    || accepted.contains("application/xml")
                    || accepted.contains("text/xml")
                    || accepted.contains("text/javascript");
            if (data && !accepted.contains("text/html")) {
                return false;
            }
        }
        return true;
    }

    static String resourceUrl(String contextPath, String version, String file) {
        String context = sanitizeContext(contextPath);
        String safeVersion = urlQueryValue(version == null ? "dev" : version);
        return context + "/download/resources/" + MODULE_KEY + "/" + file + "?v=" + safeVersion;
    }

    private static String sanitizeContext(String contextPath) {
        if (contextPath == null || contextPath.isEmpty()) {
            return "";
        }
        String context = contextPath;
        if (context.endsWith("/")) {
            context = context.substring(0, context.length() - 1);
        }
        if (!context.startsWith("/")
                || context.contains("..")
                || context.contains("//")
                || context.contains("\\")
                || context.contains(" ")
                || !context.matches("[A-Za-z0-9._/\\-]*")) {
            return "";
        }
        return context;
    }

    private static String urlQueryValue(String value) {
        StringBuilder out = new StringBuilder(value.length());
        for (int i = 0; i < value.length(); i++) {
            char c = value.charAt(i);
            boolean safe = (c >= 'a' && c <= 'z')
                    || (c >= 'A' && c <= 'Z')
                    || (c >= '0' && c <= '9')
                    || c == '.' || c == '-' || c == '_';
            if (safe) {
                out.append(c);
            } else if (c < 128) {
                out.append('%');
                String hex = Integer.toHexString(c).toUpperCase(Locale.US);
                if (hex.length() == 1) {
                    out.append('0');
                }
                out.append(hex);
            }
        }
        return out.length() == 0 ? "dev" : out.toString();
    }

    private static boolean hasStaticExtension(String path) {
        return path.endsWith(".css")
                || path.endsWith(".js")
                || path.endsWith(".map")
                || path.endsWith(".png")
                || path.endsWith(".jpg")
                || path.endsWith(".jpeg")
                || path.endsWith(".gif")
                || path.endsWith(".svg")
                || path.endsWith(".ico")
                || path.endsWith(".woff")
                || path.endsWith(".woff2")
                || path.endsWith(".ttf")
                || path.endsWith(".eot")
                || path.endsWith(".webp")
                || path.endsWith(".pdf")
                || path.endsWith(".zip")
                || path.endsWith(".jar")
                || path.endsWith(".xml")
                || path.endsWith(".json")
                || path.endsWith(".txt")
                || path.endsWith(".csv");
    }
}
