package com.artjsm.theme;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.PrintWriter;
import java.lang.reflect.Proxy;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import java.util.zip.GZIPInputStream;
import java.util.zip.GZIPOutputStream;
import javax.servlet.ServletOutputStream;
import javax.servlet.WriteListener;
import javax.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.Test;

class BufferingResponseWrapperTest {

    @Test
    void injectsThemeIntoHtmlAndKeepsCyrillic() throws Exception {
        FakeResponse response = new FakeResponse();
        BufferingResponseWrapper wrapper = new BufferingResponseWrapper(response.http(), "/theme.css?a=1&b=2", "/theme.js");
        wrapper.setContentType("text/html;charset=UTF-8");
        PrintWriter writer = wrapper.getWriter();
        writer.write("<html><head><title>Графики</title></head><body><header>Октябрь</header></body></html>");
        wrapper.finish();

        String body = response.body();
        assertTrue(body.contains("Графики"));
        assertTrue(body.contains("Октябрь"));
        assertTrue(body.contains("data-artjsm=\"boot\""));
        assertTrue(body.contains("href=\"/theme.css?a=1&amp;b=2\""));
        assertTrue(body.contains("src=\"/theme.js\""));
        assertTrue(response.contentLength > 0);
    }

    @Test
    void passesJsonAndGzipThroughUntouched() throws Exception {
        FakeResponse json = new FakeResponse();
        BufferingResponseWrapper jsonWrapper = new BufferingResponseWrapper(json.http(), "/a.css", "/a.js");
        jsonWrapper.setContentType("application/json");
        jsonWrapper.getOutputStream().write("{\"theme\":\"dark\"}".getBytes(StandardCharsets.UTF_8));
        jsonWrapper.finish();
        assertEquals("{\"theme\":\"dark\"}", json.body());
        assertFalse(json.body().contains("artjsm"));

        FakeResponse gzip = new FakeResponse();
        BufferingResponseWrapper gzipWrapper = new BufferingResponseWrapper(gzip.http(), "/a.css", "/a.js");
        gzipWrapper.setContentType("text/html");
        gzipWrapper.setHeader("Content-Encoding", "gzip");
        byte[] payload = new byte[] {0x1F, (byte) 0x8B, 1, 2, 3};
        gzipWrapper.getOutputStream().write(payload);
        gzipWrapper.finish();
        assertEquals(5, gzip.bytes.size());
        assertEquals(0x1F, gzip.bytes.toByteArray()[0] & 0xFF);
        assertEquals((byte) 0x8B, gzip.bytes.toByteArray()[1]);
    }

    @Test
    void leavesPlainHtmlAloneWhenEncodingClaimsGzipButBodyIsNot() throws Exception {
        FakeResponse response = new FakeResponse();
        BufferingResponseWrapper wrapper = new BufferingResponseWrapper(response.http(), "/a.css", "/a.js");
        wrapper.setContentType("text/html;charset=UTF-8");
        wrapper.setHeader("Content-Encoding", "gzip");
        byte[] payload = "<html><head></head><body>plain</body></html>".getBytes(StandardCharsets.UTF_8);
        wrapper.getOutputStream().write(payload);
        wrapper.finish();
        assertEquals(new String(payload, StandardCharsets.UTF_8), response.body());
        assertFalse(response.body().contains("data-artjsm"));
    }

    @Test
    void injectsThemeIntoRealGzipHtml() throws Exception {
        String html = "<html><head><title>Очереди</title></head><body>Все оборудование</body></html>";
        ByteArrayOutputStream gz = new ByteArrayOutputStream();
        GZIPOutputStream gzip = new GZIPOutputStream(gz);
        gzip.write(html.getBytes(StandardCharsets.UTF_8));
        gzip.close();

        FakeResponse response = new FakeResponse();
        BufferingResponseWrapper wrapper = new BufferingResponseWrapper(response.http(), "/theme.css", "/theme.js");
        wrapper.setContentType("text/html;charset=UTF-8");
        wrapper.setHeader("Content-Encoding", "gzip");
        wrapper.getOutputStream().write(gz.toByteArray());
        wrapper.finish();

        byte[] body = response.bytes.toByteArray();
        assertTrue(body.length > 2);
        assertEquals(0x1F, body[0] & 0xFF);
        assertEquals(0x8B, body[1] & 0xFF);
        String text = gunzipToString(body);
        assertTrue(text.contains("data-artjsm=\"boot\""));
        assertTrue(text.contains("Все оборудование"));
        assertTrue(text.contains("href=\"/theme.css\""));
    }

    private static String gunzipToString(byte[] body) throws IOException {
        GZIPInputStream in = new GZIPInputStream(new ByteArrayInputStream(body));
        try {
            ByteArrayOutputStream plain = new ByteArrayOutputStream();
            byte[] buf = new byte[256];
            int read;
            while ((read = in.read(buf)) >= 0) {
                plain.write(buf, 0, read);
            }
            return new String(plain.toByteArray(), StandardCharsets.UTF_8);
        } finally {
            in.close();
        }
    }

    private static final class FakeResponse {
        private final ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        private final Map<String, String> headers = new HashMap<String, String>();
        private final ServletOutputStream stream = new ServletOutputStream() {
            @Override
            public boolean isReady() {
                return true;
            }

            @Override
            public void setWriteListener(WriteListener writeListener) {
            }

            @Override
            public void write(int b) {
                bytes.write(b);
            }
        };
        private int contentLength = -1;
        private final HttpServletResponse http;

        private FakeResponse() {
            http = (HttpServletResponse) Proxy.newProxyInstance(
                    HttpServletResponse.class.getClassLoader(),
                    new Class<?>[] {HttpServletResponse.class},
                    (proxy, method, args) -> {
                        String name = method.getName();
                        if ("getOutputStream".equals(name)) {
                            return stream;
                        }
                        if ("setContentLength".equals(name) || "setContentLengthLong".equals(name)) {
                            contentLength = ((Number) args[0]).intValue();
                            return null;
                        }
                        if ("setContentType".equals(name) || "setHeader".equals(name) || "addHeader".equals(name)) {
                            if ("setContentType".equals(name)) {
                                headers.put("Content-Type", (String) args[0]);
                            } else {
                                headers.put(((String) args[0]).toLowerCase(), (String) args[1]);
                            }
                            return null;
                        }
                        if ("getHeader".equals(name)) {
                            return headers.get(String.valueOf(args[0]).toLowerCase());
                        }
                        if ("getContentType".equals(name)) {
                            return headers.get("Content-Type");
                        }
                        if ("isCommitted".equals(name)) {
                            return false;
                        }
                        if (method.getReturnType().equals(boolean.class)) {
                            return false;
                        }
                        if (method.getReturnType().equals(int.class)) {
                            return 0;
                        }
                        if (method.getReturnType().equals(long.class)) {
                            return 0L;
                        }
                        return null;
                    });
        }

        private HttpServletResponse http() {
            return http;
        }

        private String body() {
            return new String(bytes.toByteArray(), StandardCharsets.UTF_8);
        }
    }
}
