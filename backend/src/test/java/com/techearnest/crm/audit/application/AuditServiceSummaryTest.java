package com.techearnest.crm.audit.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.techearnest.crm.audit.domain.AuditLogRepository;
import org.junit.jupiter.api.Test;

class AuditServiceSummaryTest {

    private final AuditService service = new AuditService(mock(AuditLogRepository.class), new ObjectMapper());

    @Test
    void keepsValidJson() {
        assertThat(service.toJson("{\"bulk\":true}")).isEqualTo("{\"bulk\":true}");
    }

    @Test
    void wrapsPlainTextSoTheJsonbInsertCannotFail() {
        assertThat(service.toJson("Workflow DEAL_WON_NOTIFY_PM succeeded for DEAL_WON"))
                .isEqualTo("{\"summary\":\"Workflow DEAL_WON_NOTIFY_PM succeeded for DEAL_WON\"}");
        assertThat(service.toJson("{\"name\":\"Bob \"The\" Builder\"}")).startsWith("{\"summary\":");
        assertThat(service.toJson("{\"a\":1} trailing")).startsWith("{\"summary\":");
    }

    @Test
    void blankSummaryIsStoredAsNull() {
        assertThat(service.toJson("  ")).isNull();
        assertThat(service.toJson(null)).isNull();
    }
}
