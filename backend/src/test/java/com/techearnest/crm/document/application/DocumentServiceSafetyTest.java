package com.techearnest.crm.document.application;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

class DocumentServiceSafetyTest {

    @Test
    void sanitizeNameStripsPathsQuotesAndControlCharacters() {
        assertThat(DocumentService.sanitizeName("..\\..\\evil.pdf")).isEqualTo("evil.pdf");
        assertThat(DocumentService.sanitizeName("/tmp/report.pdf")).isEqualTo("report.pdf");
        assertThat(DocumentService.sanitizeName("a\"b\r\nX-Injected: 1.pdf")).isEqualTo("abX-Injected: 1.pdf");
        assertThat(DocumentService.sanitizeName("  ")).isEqualTo("file");
    }

    @Test
    void onlyKnownSafeTypesKeepTheirContentType() {
        assertThat(DocumentService.safeMediaType("application/pdf")).isEqualTo(MediaType.APPLICATION_PDF);
        assertThat(DocumentService.safeMediaType("IMAGE/PNG")).isEqualTo(MediaType.IMAGE_PNG);
        assertThat(DocumentService.safeMediaType("image/jpeg; q=0.9")).isEqualTo(MediaType.IMAGE_JPEG);
        assertThat(DocumentService.safeMediaType("text/html")).isEqualTo(MediaType.APPLICATION_OCTET_STREAM);
        assertThat(DocumentService.safeMediaType("image/svg+xml")).isEqualTo(MediaType.APPLICATION_OCTET_STREAM);
        assertThat(DocumentService.safeMediaType("not a type")).isEqualTo(MediaType.APPLICATION_OCTET_STREAM);
        assertThat(DocumentService.safeMediaType(null)).isEqualTo(MediaType.APPLICATION_OCTET_STREAM);
    }

    @Test
    void allowlistExcludesExecutableAndScriptableTypes() {
        assertThat(DocumentService.ALLOWED_EXTENSIONS).contains("pdf", "docx", "png", "csv");
        assertThat(DocumentService.ALLOWED_EXTENSIONS).doesNotContain("html", "htm", "svg", "js", "exe", "bat", "sh");
    }
}
