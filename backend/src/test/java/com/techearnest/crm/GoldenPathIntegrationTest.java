package com.techearnest.crm;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.techearnest.crm.auth.api.dto.LoginRequest;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

/**
 * End-to-end golden path: lead → won deal → project → allocation → timesheet → approve → dashboard.
 */
@SpringBootTest
@AutoConfigureMockMvc
class GoldenPathIntegrationTest {

    private static final UUID PUNE = UUID.fromString("22222222-2222-4222-8222-000000000011");
    private static final UUID SEED_RESOURCE = UUID.fromString("bbbbbbb1-bbbb-4bbb-8bbb-000000000001");

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void goldenPathLeadToDashboard() throws Exception {
        String salesToken = login("sales.exec@example.com");
        String suffix = UUID.randomUUID().toString().substring(0, 8);

        ObjectNode leadBody = objectMapper.createObjectNode();
        leadBody.put("regionId", PUNE.toString());
        leadBody.put("firstName", "Golden");
        leadBody.put("lastName", "Path");
        leadBody.put("companyName", "Golden Path Co " + suffix);
        leadBody.put("email", "golden.path+" + suffix + "@example.com");
        leadBody.put("status", "NEW");
        MvcResult leadResult = mockMvc.perform(post("/api/v1/leads")
                        .header("Authorization", "Bearer " + salesToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(leadBody)))
                .andExpect(status().isOk())
                .andReturn();
        String leadId = id(leadResult);

        ObjectNode convert = objectMapper.createObjectNode();
        convert.put("createAccount", true);
        convert.put("createContact", true);
        convert.put("createDeal", true);
        convert.put("dealName", "Golden Deal " + suffix);
        convert.put("dealValue", 100000);
        convert.put("dealStage", "NEW");
        MvcResult convertResult = mockMvc.perform(post("/api/v1/leads/" + leadId + "/convert")
                        .header("Authorization", "Bearer " + salesToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(convert)))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode convertData = objectMapper.readTree(convertResult.getResponse().getContentAsString()).at("/data");
        String dealId = convertData.get("dealId").asText();
        String accountId = convertData.get("accountId").asText();
        assertThat(accountId).isNotBlank();

        for (String stage : new String[] {"QUALIFICATION", "PROPOSAL", "WON"}) {
            ObjectNode stageBody = objectMapper.createObjectNode();
            stageBody.put("toStage", stage);
            mockMvc.perform(post("/api/v1/deals/" + dealId + "/stage")
                            .header("Authorization", "Bearer " + salesToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(stageBody)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.stage").value(stage));
        }

        String orgAdminToken = login("orgadmin@example.com");
        MvcResult projectResult = mockMvc.perform(post("/api/v1/deals/" + dealId + "/create-project")
                        .header("Authorization", "Bearer " + orgAdminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isOk())
                .andReturn();
        String projectId = id(projectResult);

        ObjectNode milestone = objectMapper.createObjectNode();
        milestone.put("name", "Kickoff");
        milestone.put("status", "PLANNED");
        mockMvc.perform(post("/api/v1/projects/" + projectId + "/milestones")
                        .header("Authorization", "Bearer " + orgAdminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(milestone)))
                .andExpect(status().isOk());

        ObjectNode task = objectMapper.createObjectNode();
        task.put("name", "Discovery");
        task.put("status", "TODO");
        mockMvc.perform(post("/api/v1/projects/" + projectId + "/tasks")
                        .header("Authorization", "Bearer " + orgAdminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(task)))
                .andExpect(status().isOk());

        String mgrToken = login("resource.mgr@example.com");
        ObjectNode allocation = objectMapper.createObjectNode();
        allocation.put("projectId", projectId);
        allocation.put("resourceId", SEED_RESOURCE.toString());
        allocation.put("startDate", "2026-12-01");
        allocation.put("endDate", "2026-12-31");
        allocation.put("allocatedHours", 40);
        allocation.put("allocationPercentage", 25);
        allocation.put("role", "Engineer");
        allocation.put("status", "ACTIVE");
        mockMvc.perform(post("/api/v1/allocations")
                        .header("Authorization", "Bearer " + mgrToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(allocation)))
                .andExpect(status().isOk());

        String employeeToken = login("employee@example.com");
        java.time.LocalDate monday = java.time.LocalDate.of(2028, 1, 3)
                .plusDays(Math.abs(suffix.hashCode() % 400) * 7L)
                .with(java.time.temporal.TemporalAdjusters.previousOrSame(java.time.DayOfWeek.MONDAY));
        ObjectNode sheet = objectMapper.createObjectNode();
        sheet.put("weekStartDate", monday.toString());
        MvcResult sheetResult = mockMvc.perform(post("/api/v1/timesheets")
                        .header("Authorization", "Bearer " + employeeToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(sheet)))
                .andExpect(status().isOk())
                .andReturn();
        String timesheetId = id(sheetResult);

        ObjectNode entry = objectMapper.createObjectNode();
        entry.put("projectId", projectId);
        entry.put("workDate", monday.plusDays(1).toString());
        entry.put("hours", 8);
        entry.put("description", "Golden path hours");
        entry.put("billable", true);
        mockMvc.perform(post("/api/v1/timesheets/" + timesheetId + "/entries")
                        .header("Authorization", "Bearer " + employeeToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(entry)))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/v1/timesheets/" + timesheetId + "/submit")
                        .header("Authorization", "Bearer " + employeeToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("SUBMITTED"));

        String pmToken = login("pm@example.com");
        mockMvc.perform(post("/api/v1/timesheets/" + timesheetId + "/approve")
                        .header("Authorization", "Bearer " + pmToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("APPROVED"));

        mockMvc.perform(get("/api/v1/dashboards/organization").header("Authorization", "Bearer " + orgAdminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.cards").isArray());

        mockMvc.perform(get("/api/v1/notifications").header("Authorization", "Bearer " + pmToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
    }

    private String id(MvcResult result) throws Exception {
        return objectMapper.readTree(result.getResponse().getContentAsString()).at("/data/id").asText();
    }

    private String login(String email) throws Exception {
        MvcResult login = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new LoginRequest(email, "ChangeMe!123"))))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper
                .readTree(login.getResponse().getContentAsString())
                .at("/data/accessToken")
                .asText();
    }
}
