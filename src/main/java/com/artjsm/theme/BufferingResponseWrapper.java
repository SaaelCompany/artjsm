package com.artjsm.theme;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.io.OutputStreamWriter;
import java.io.PrintWriter;
import java.nio.charset.Charset;
import java.util.Locale;
import java.util.logging.Level;
import java.util.logging.Logger;
import java.util.zip.GZIPInputStream;
import java.util.zip.GZIPOutputStream;
import javax.servlet.ServletOutputStream;
import javax.servlet.WriteListener;
import javax.servlet.http.HttpServletResponse;
import javax.servlet.http.HttpServletResponseWrapper;

/**
 * Buffers an HTML response so the theme can be inserted before the first byte
 * reaches the client. Non-HTML, redirects, downloads and oversized pages are
 * passed through unchanged.
 */
final class BufferingResponseWrapper extends HttpServletResponseWrapper {

    private static final Logger LOG = Logger.getLogger(BufferingResponseWrapper.class.getName());
    private static final int MAX_BYTES = 8 * 1024 * 1024;

    private final String cssUrl;
    private final String jsUrl;
    private final ByteArrayOutputStream buffer = new ByteArrayOutputStream(8192);
    private final OutputStream bufferStream = new OutputStream() {
        @Override
        public void write(int b) throws IOException {
            if (spilled) {
                raw().write(b);
                return;
            }
            buffer.write(b);
            if (buffer.size() > MAX_BYTES) {
                spill();
            }
        }

        @Override
        public void write(byte[] b, int off, int len) throws IOException {
            if (spilled) {
                raw().write(b, off, len);
                return;
            }
            buffer.write(b, off, len);
            if (buffer.size() > MAX_BYTES) {
                spill();
            }
        }
    };

    private ServletOutputStream stream;
    private ServletOutputStream rawStream;
    private PrintWriter writer;
    private Charset lockedCharset;
    private String contentType;
    private int status = 200;
    private boolean usingStream;
    private boolean usingWriter;
    private boolean spilled;
    private boolean compressed;
    private boolean skipBody;
    private boolean finished;

    BufferingResponseWrapper(HttpServletResponse response, String cssUrl, String jsUrl) {
        super(response);
        this.cssUrl = cssUrl;
        this.jsUrl = jsUrl;
    }

    void finish() throws IOException {
        if (finished) {
            return;
        }
        finished = true;
        if (writer != null) {
            writer.flush();
        }
        if (spilled || skipBody) {
            return;
        }
        byte[] data = buffer.toByteArray();
        buffer.reset();
        if (data.length == 0 || status == 204 || status == 304) {
            return;
        }
        if (isRedirect(status) || isAttachment()) {
            writeThrough(data);
            return;
        }
        if (HtmlThemeInjector.isGzip(data)) {
            byte[] plain;
            try {
                plain = gunzip(data);
            } catch (IOException ex) {
                writeThrough(data);
                return;
            }
            byte[] themed = themeIfHtml(plain);
            if (themed == plain) {
                writeThrough(data);
                return;
            }
            try {
                writeThrough(gzip(themed));
            } catch (IOException ex) {
                LOG.log(Level.WARNING, "ArtJSM theme could not recompress the page", ex);
                writeThrough(data);
            }
            return;
        }
        if (compressed) {
            writeThrough(data);
            return;
        }
        writeThrough(themeIfHtml(data));
    }

    private byte[] themeIfHtml(byte[] data) {
        boolean html = HtmlThemeInjector.isHtmlType(contentType) || HtmlThemeInjector.sniffHtml(data);
        if (!html) {
            return data;
        }
        Charset charset = lockedCharset != null ? lockedCharset : HtmlThemeInjector.charsetFrom(contentType);
        try {
            return HtmlThemeInjector.inject(data, charset, cssUrl, jsUrl);
        } catch (RuntimeException ex) {
            LOG.log(Level.WARNING, "ArtJSM theme injection failed", ex);
            return data;
        }
    }

    private static byte[] gunzip(byte[] data) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream(Math.min(data.length * 4, MAX_BYTES));
        GZIPInputStream in = new GZIPInputStream(new ByteArrayInputStream(data));
        try {
            byte[] chunk = new byte[8192];
            int total = 0;
            int read;
            while ((read = in.read(chunk)) >= 0) {
                total += read;
                if (total > MAX_BYTES) {
                    throw new IOException("uncompressed page exceeds " + MAX_BYTES + " bytes");
                }
                out.write(chunk, 0, read);
            }
        } finally {
            in.close();
        }
        return out.toByteArray();
    }

    private static byte[] gzip(byte[] data) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream(data.length);
        GZIPOutputStream compressedOut = new GZIPOutputStream(out);
        try {
            compressedOut.write(data);
        } finally {
            compressedOut.close();
        }
        return out.toByteArray();
    }

    void discard() {
        finished = true;
    }

    @Override
    public void setStatus(int sc) {
        status = sc;
        super.setStatus(sc);
    }

    @Override
    public void setStatus(int sc, String sm) {
        status = sc;
        super.setStatus(sc, sm);
    }

    @Override
    public void sendError(int sc) throws IOException {
        status = sc;
        skipBody = true;
        finished = true;
        super.sendError(sc);
    }

    @Override
    public void sendError(int sc, String msg) throws IOException {
        status = sc;
        skipBody = true;
        finished = true;
        super.sendError(sc, msg);
    }

    @Override
    public void sendRedirect(String location) throws IOException {
        status = SC_FOUND;
        skipBody = true;
        finished = true;
        super.sendRedirect(location);
    }

    @Override
    public void setContentType(String type) {
        contentType = type;
        super.setContentType(type);
    }

    @Override
    public String getContentType() {
        return contentType != null ? contentType : super.getContentType();
    }

    @Override
    public void setContentLength(int len) {
        // Replaced with the themed body length in finish().
    }

    @Override
    public void setContentLengthLong(long len) {
        // Replaced with the themed body length in finish().
    }

    @Override
    public void setHeader(String name, String value) {
        if (isContentLength(name)) {
            return;
        }
        noteHeader(name, value);
        super.setHeader(name, value);
    }

    @Override
    public void addHeader(String name, String value) {
        if (isContentLength(name)) {
            return;
        }
        noteHeader(name, value);
        super.addHeader(name, value);
    }

    @Override
    public void setIntHeader(String name, int value) {
        if (isContentLength(name)) {
            return;
        }
        super.setIntHeader(name, value);
    }

    @Override
    public void addIntHeader(String name, int value) {
        if (isContentLength(name)) {
            return;
        }
        super.addIntHeader(name, value);
    }

    @Override
    public void resetBuffer() {
        buffer.reset();
        if (!spilled && !isCommitted()) {
            super.resetBuffer();
        }
    }

    @Override
    public void reset() {
        buffer.reset();
        contentType = null;
        status = 200;
        compressed = false;
        if (!spilled) {
            super.reset();
        }
    }

    @Override
    public void flushBuffer() throws IOException {
        if (writer != null) {
            writer.flush();
        }
        if (spilled) {
            super.flushBuffer();
        }
    }

    @Override
    public ServletOutputStream getOutputStream() throws IOException {
        if (usingWriter) {
            throw new IllegalStateException("getWriter() already called");
        }
        usingStream = true;
        if (stream == null) {
            stream = new ServletOutputStream() {
                @Override
                public boolean isReady() {
                    return true;
                }

                @Override
                public void setWriteListener(WriteListener writeListener) {
                }

                @Override
                public void write(int b) throws IOException {
                    bufferStream.write(b);
                }

                @Override
                public void write(byte[] b, int off, int len) throws IOException {
                    bufferStream.write(b, off, len);
                }

                @Override
                public void flush() {
                }

                @Override
                public void close() throws IOException {
                    finish();
                }
            };
        }
        return stream;
    }

    @Override
    public PrintWriter getWriter() throws IOException {
        if (usingStream) {
            throw new IllegalStateException("getOutputStream() already called");
        }
        usingWriter = true;
        if (writer == null) {
            lockedCharset = HtmlThemeInjector.charsetFrom(contentType);
            writer = new PrintWriter(new OutputStreamWriter(bufferStream, lockedCharset));
        }
        return writer;
    }

    private void noteHeader(String name, String value) {
        if (name == null) {
            return;
        }
        if ("Content-Type".equalsIgnoreCase(name)) {
            contentType = value;
        } else if ("Content-Encoding".equalsIgnoreCase(name) && isCompressed(value)) {
            compressed = true;
        }
    }

    private void spill() throws IOException {
        if (spilled) {
            return;
        }
        spilled = true;
        LOG.warning("ArtJSM theme skipped a page larger than " + MAX_BYTES + " bytes");
        byte[] data = buffer.toByteArray();
        buffer.reset();
        if (data.length > 0) {
            raw().write(data);
        }
    }

    private ServletOutputStream raw() throws IOException {
        if (rawStream == null) {
            rawStream = ((HttpServletResponse) getResponse()).getOutputStream();
        }
        return rawStream;
    }

    private void writeThrough(byte[] data) throws IOException {
        HttpServletResponse response = (HttpServletResponse) getResponse();
        response.setContentLength(data.length);
        ServletOutputStream out = raw();
        out.write(data);
        out.flush();
    }

    private boolean isAttachment() {
        String disposition = ((HttpServletResponse) getResponse()).getHeader("Content-Disposition");
        return disposition != null && disposition.toLowerCase(Locale.US).contains("attachment");
    }

    private static boolean isRedirect(int code) {
        return code == 301 || code == SC_FOUND || code == SC_SEE_OTHER || code == 307 || code == 308;
    }

    private static boolean isContentLength(String name) {
        return name != null && "Content-Length".equalsIgnoreCase(name);
    }

    private static boolean isCompressed(String value) {
        if (value == null) {
            return false;
        }
        String encoding = value.toLowerCase(Locale.US).trim();
        return !encoding.isEmpty() && !"identity".equals(encoding);
    }
}
