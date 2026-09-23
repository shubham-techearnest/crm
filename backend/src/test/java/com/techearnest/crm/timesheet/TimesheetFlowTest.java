package com.techearnest.crm.timesheet;

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

@SpringBootTest
@AutoConfigureMockMvc
class TimesheetFlowTest {

    private static final UUID SEED_PROJECT_ID = UUID.fromString("99999999-9999-4999-8999-000000000001");
    private static final UUID SEED_REGION_ID = UUID.fromString("22222222-2222-4222-8222-000000000011");
    private static final UUID PM_USER_ID = UUID.fromString("77777777-7777-4777-8777-000000000006");

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void employeeRecordsSubmitAndPmApproves() throws Exception {
        String employeeToken = login("employee@example.com");

        mockMvc.perform(get("/api/v1/timesheets").header("Authorization", "Bearer " + employeeToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        ObjectNode createBody = objectMapper.createObjectNode();
        createBody.put("weekStartDate", "2027-01-04");
        MvcResult createResult = mockMvc.perform(post("/api/v1/timesheets")
                        .header("Authorization", "Bearer " + employeeToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(createBody)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("DRAFT"))
                .andReturn();
        String timesheetId = objectMapper
                .readTree(createResult.getResponse().getContentAsString())
                .at("/data/id")
                .asText();

        ObjectNode entryBody = objectMapper.createObjectNode();
        entryBody.put("projectId", SEED_PROJECT_ID.toString());
        entryBody.put("workDate", "2027-01-05");
        entryBody.put("hours", 6);
        entryBody.put("description", "Implementation work");
        entryBody.put("billable", true);
        mockMvc.perform(post("/api/v1/timesheets/" + timesheetId + "/entries")
                        .header("Authorization", "Bearer " + employeeToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(entryBody)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.hours").value(6));

        mockMvc.perform(post("/api/v1/timesheets/" + timesheetId + "/submit")
                        .header("Authorization", "Bearer " + employeeToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("SUBMITTED"));

        String pmToken = login("pm@example.com");
        mockMvc.perform(post("/api/v1/timesheets/" + timesheetId + "/approve")
                        .header("Authorization", "Bearer " + pmToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("APPROVED"))
                .andExpect(jsonPath("$.data.approvedBy").value(PM_USER_ID.toString()));
    }

    @Test
    void selfApproveIsForbidden() throws Exception {
        UUID orgAdminId = UUID.fromString("77777777-7777-4777-8777-000000000002");
        String adminToken = login("orgadmin@example.com");

        MvcResult meBefore = mockMvc.perform(get("/api/v1/auth/me").header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andReturn();
        String existingResourceId = objectMapper
                .readTree(meBefore.getResponse().getContentAsString())
                .at("/data/resourceId")
                .asText();

        String resourceId = existingResourceId;
        if (resourceId == null || resourceId.isBlank() || "null".equals(resourceId)) {
            String mgrToken = login("resource.mgr@example.com");
            ObjectNode resourceBody = objectMapper.createObjectNode();
            resourceBody.put("regionId", SEED_REGION_ID.toString());
            resourceBody.put("userId", orgAdminId.toString());
            resourceBody.put("resourceType", "EMPLOYEE");
            resourceBody.put("employeeCode", "EMP-OA-" + UUID.randomUUID().toString().substring(0, 8));
            resourceBody.put("designation", "Org Admin");
            resourceBody.put("capacityHoursPerWeek", 40);
            resourceBody.put("status", "AVAILABLE");
            MvcResult resourceResult = mockMvc.perform(post("/api/v1/resources")
                            .header("Authorization", "Bearer " + mgrToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(resourceBody)))
                    .andExpect(status().isOk())
                    .andReturn();
            resourceId = objectMapper
                    .readTree(resourceResult.getResponse().getContentAsString())
                    .at("/data/id")
                    .asText();
            adminToken = login("orgadmin@example.com");
        }
        assertThat(resourceId).isNotBlank();

        ObjectNode createBody = objectMapper.createObjectNode();
        createBody.put("weekStartDate", "2027-02-01");
        MvcResult createResult = mockMvc.perform(post("/api/v1/timesheets")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(createBody)))
                .andExpect(status().isOk())
                .andReturn();
        String timesheetId = objectMapper
                .readTree(createResult.getResponse().getContentAsString())
                .at("/data/id")
                .asText();

        ObjectNode entryBody = objectMapper.createObjectNode();
        entryBody.put("projectId", SEED_PROJECT_ID.toString());
        entryBody.put("workDate", "2027-02-01");
        entryBody.put("hours", 4);
        entryBody.put("description", "Self sheet");
        mockMvc.perform(post("/api/v1/timesheets/" + timesheetId + "/entries")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(entryBody)))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/v1/timesheets/" + timesheetId + "/submit")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("SUBMITTED"));

        mockMvc.perform(post("/api/v1/timesheets/" + timesheetId + "/approve")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.success").value(false));

        MvcResult me = mockMvc.perform(get("/api/v1/auth/me").header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode meJson = objectMapper.readTree(me.getResponse().getContentAsString());
        assertThat(meJson.at("/data/resourceId").asText()).isEqualTo(resourceId);
    }

    @Test
    void rejectRequiresReasonAndAllowsResubmit() throws Exception {
        String employeeToken = login("employee@example.com");

        ObjectNode createBody = objectMapper.createObjectNode();
        createBody.put("weekStartDate", "2027-01-18");
        MvcResult createResult = mockMvc.perform(post("/api/v1/timesheets")
                        .header("Authorization", "Bearer " + employeeToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(createBody)))
                .andExpect(status().isOk())
                .andReturn();
        String timesheetId = objectMapper
                .readTree(createResult.getResponse().getContentAsString())
                .at("/data/id")
                .asText();

        ObjectNode entryBody = objectMapper.createObjectNode();
        entryBody.put("projectId", SEED_PROJECT_ID.toString());
        entryBody.put("workDate", "2027-01-19");
        entryBody.put("hours", 5);
        entryBody.put("description", "To be rejected");
        mockMvc.perform(post("/api/v1/timesheets/" + timesheetId + "/entries")
                        .header("Authorization", "Bearer " + employeeToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(entryBody)))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/v1/timesheets/" + timesheetId + "/submit")
                        .header("Authorization", "Bearer " + employeeToken))
                .andExpect(status().isOk());

        String pmToken = login("pm@example.com");
        ObjectNode rejectBody = objectMapper.createObjectNode();
        rejectBody.put("reason", "Missing billable notes");
        mockMvc.perform(post("/api/v1/timesheets/" + timesheetId + "/reject")
                        .header("Authorization", "Bearer " + pmToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(rejectBody)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("REJECTED"))
                .andExpect(jsonPath("$.data.rejectionReason").value("Missing billable notes"));

        mockMvc.perform(post("/api/v1/timesheets/" + timesheetId + "/submit")
                        .header("Authorization", "Bearer " + employeeToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("SUBMITTED"));
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
