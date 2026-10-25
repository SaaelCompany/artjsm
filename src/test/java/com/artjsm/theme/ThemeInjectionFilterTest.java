package com.artjsm.theme;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class ThemeInjectionFilterTest {

    @Test
    void buffersHtmlPagesAndSkipsDataAndStaticRequests() {
        assertTrue(ThemeInjectionFilter.shouldBuffer("/secure/Dashboard.jspa", "text/html"));
        assertTrue(ThemeInjectionFilter.shouldBuffer("/jira/secure/Dashboard.jspa?os_authType=basic", null));
        assertTrue(ThemeInjectionFilter.shouldBuffer("/plugins/servlet/asset-tree", "text/html,application/xhtml+xml"));
        assertTrue(ThemeInjectionFilter.shouldBuffer("/jira/servicedesk/customer/portal/1", "*/*"));

        assertFalse(ThemeInjectionFilter.shouldBuffer("/jira/rest/api/2/myself", "application/json"));
        assertFalse(ThemeInjectionFilter.shouldBuffer("/rest/api/2/user/properties/artjsm.theme", null));
        assertFalse(ThemeInjectionFilter.shouldBuffer("/download/resources/com.artjsm.theme:artjsm-resources/artjsm.css", null));
        assertFalse(ThemeInjectionFilter.shouldBuffer("/jira/s/ab12/_/download/batch/css", null));
        assertFalse(ThemeInjectionFilter.shouldBuffer("/images/icons/priorities/major.svg", null));
        assertFalse(ThemeInjectionFilter.shouldBuffer("/secure/attachment/10000/file.png", "text/html"));
        assertFalse(ThemeInjectionFilter.shouldBuffer("/secure/useravatar?size=large", null));
        assertFalse(ThemeInjectionFilter.shouldBuffer("/plugins/servlet/oauth/authorize", "text/html"));
        assertFalse(ThemeInjectionFilter.shouldBuffer(null, "text/html"));
        assertFalse(ThemeInjectionFilter.shouldBuffer("/sr/jira.issueviews:searchrequest-xml/temp/SearchRequest.xml", null));
        assertFalse(ThemeInjectionFilter.shouldBuffer("/issues", "application/json"));
        assertTrue(ThemeInjectionFilter.shouldBuffer("/issues", "text/html,application/json"));
    }

    @Test
    void buildsContextSafeResourceUrls() {
        assertEquals(
                "/jira/download/resources/com.artjsm.theme:artjsm-resources/artjsm.css?v=1.0.0",
                ThemeInjectionFilter.resourceUrl("/jira", "1.0.0", "artjsm.css"));
        assertEquals(
                "/download/resources/com.artjsm.theme:artjsm-resources/artjsm.js?v=1.0.0",
                ThemeInjectionFilter.resourceUrl("", "1.0.0", "artjsm.js"));
        assertTrue(ThemeInjectionFilter.resourceUrl("../evil", "1.0.0", "artjsm.css").startsWith("/download/resources/"));
        assertTrue(ThemeInjectionFilter.resourceUrl("/jira/../evil", "1.0.0", "artjsm.css").startsWith("/download/resources/"));
        assertFalse(ThemeInjectionFilter.resourceUrl("/jira", "1.0.0 beta", "artjsm.css").contains(" "));
    }
}
