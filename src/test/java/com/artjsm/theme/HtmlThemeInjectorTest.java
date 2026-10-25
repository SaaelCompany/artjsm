package com.artjsm.theme;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;
import org.junit.jupiter.api.Test;

class HtmlThemeInjectorTest {

    private static final String CSS = "/jira/download/resources/com.artjsm.theme:artjsm-resources/artjsm.css?v=1";
    private static final String JS = "/jira/download/resources/com.artjsm.theme:artjsm-resources/artjsm.js?v=1";

    @Test
    void insertsBootCssAndScriptWithoutDroppingBody() {
        String html = "<!DOCTYPE html><html><head><title>Задачи</title>"
                + "<link rel=\"stylesheet\" href=\"/jira/s/aui.css\"></head>"
                + "<body><p>Привет</p><header>Шапка</header></body></html>";

        String out = HtmlThemeInjector.inject(html, CSS, JS);

        assertTrue(out.contains("Привет"));
        assertTrue(out.contains("Шапка"));
        int boot = out.indexOf("data-artjsm=\"boot\"");
        int title = out.indexOf("<title>");
        int aui = out.indexOf("aui.css");
        int earlyCss = out.indexOf("data-artjsm=\"css\"");
        int headClose = out.toLowerCase().indexOf("</head>");
        int lateCss = out.indexOf("data-artjsm=\"css-late\"");
        int script = out.indexOf("data-artjsm=\"js\"");
        int bodyClose = out.toLowerCase().indexOf("</body>");
        assertTrue(boot >= 0 && boot < title);
        assertTrue(aui < earlyCss && earlyCss < headClose);
        assertTrue(headClose < lateCss && lateCss < script && script < bodyClose);
        assertTrue(out.contains("href=\"" + CSS + "\""));
        assertTrue(out.contains("src=\"" + JS + "\""));
        assertTrue(out.contains("data-artjsm-theme"));
    }

    @Test
    void doesNotTreatHeaderAsHead() {
        String fragment = "<div><header><h1>Нет документа</h1></header></div>";
        assertNull(HtmlThemeInjector.inject(fragment, CSS, JS));
    }

    @Test
    void matchesHeadCaseInsensitively() {
        String html = "<HTML><HEAD profile=\"jira\"><TITLE>X</TITLE></HEAD><BODY></BODY></HTML>";
        String out = HtmlThemeInjector.inject(html, CSS, JS);
        assertTrue(out.contains("data-artjsm=\"boot\""));
        assertTrue(out.contains("data-artjsm=\"css-late\""));
        assertTrue(out.contains("</BODY>"));
    }

    @Test
    void skipsDocumentsThatAlreadyContainTheTheme() {
        String once = HtmlThemeInjector.inject("<html><head></head><body></body></html>", CSS, JS);
        assertNull(HtmlThemeInjector.inject(once, CSS, JS));
    }

    @Test
    void escapesAttributeBreakoutInResourceUrls() {
        String out = HtmlThemeInjector.inject(
                "<html><head></head><body></body></html>",
                "/css?a=1&b=\"2\"",
                "/js?x=<script>");
        assertTrue(out.contains("href=\"/css?a=1&amp;b=&quot;2&quot;\""));
        assertTrue(out.contains("src=\"/js?x=&lt;script&gt;\""));
    }

    @Test
    void bootScriptDoesNotCloseItselfEarly() {
        String boot = HtmlThemeInjector.bootTag();
        String inner = boot.substring(0, boot.length() - "</script>".length());
        assertFalse(inner.toLowerCase().contains("</script"));
        assertTrue(boot.endsWith("</script>"));
    }

    @Test
    void roundTripsCyrillicBytesAndRejectsInvalidUtf8() {
        byte[] html = "<html><head><title>Графики</title></head><body>Октябрь</body></html>"
                .getBytes(StandardCharsets.UTF_8);
        byte[] out = HtmlThemeInjector.inject(html, StandardCharsets.UTF_8, CSS, JS);
        String text = new String(out, StandardCharsets.UTF_8);
        assertTrue(text.contains("Графики"));
        assertTrue(text.contains("Октябрь"));
        assertTrue(text.contains("data-artjsm=\"boot\""));

        byte[] broken = new byte[] {'<', 'h', 't', 'm', 'l', '>', '<', 'h', 'e', 'a', 'd', '>',
                '<', '/', 'h', 'e', 'a', 'd', '>', (byte) 0xFF, (byte) 0xFE};
        assertSame(broken, HtmlThemeInjector.inject(broken, StandardCharsets.UTF_8, CSS, JS));
    }

    @Test
    void readsCharsetAndHtmlContentTypes() {
        assertEquals(StandardCharsets.UTF_8, HtmlThemeInjector.charsetFrom("text/html; charset=UTF-8"));
        assertEquals("windows-1251", HtmlThemeInjector.charsetFrom("text/html;charset=\"windows-1251\"").name().toLowerCase());
        assertTrue(HtmlThemeInjector.isHtmlType("text/html;charset=UTF-8"));
        assertTrue(HtmlThemeInjector.isHtmlType("application/xhtml+xml"));
        assertFalse(HtmlThemeInjector.isHtmlType("application/json"));
        assertTrue(HtmlThemeInjector.sniffHtml("<!DOCTYPE html><html>".getBytes(StandardCharsets.US_ASCII)));
        assertTrue(HtmlThemeInjector.isGzip(new byte[] {0x1F, (byte) 0x8B, 0}));
    }

    @Test
    void packagedDescriptorMatchesVersionResource() throws Exception {
        String version = new String(Files.readAllBytes(Paths.get("target/classes/artjsm-version.txt")), StandardCharsets.UTF_8).trim();
        String xml = new String(Files.readAllBytes(Paths.get("target/classes/atlassian-plugin.xml")), StandardCharsets.UTF_8);
        assertTrue(version.matches("\\d+\\.\\d+\\.\\d+"));
        assertTrue(xml.contains("<version>" + version + "</version>"));
        assertTrue(xml.contains("key=\"com.artjsm.theme\""));
        assertTrue(xml.contains("location=\"before-decoration\""));
        assertTrue(xml.contains("com.artjsm.theme.ThemeInjectionFilter"));
        assertTrue(xml.contains("plugins-version=\"2\""));
    }
}
