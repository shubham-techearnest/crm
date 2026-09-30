package com.techearnest.crm.timesheet;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.techearnest.crm.auth.api.dto.LoginRequest;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;
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

        LocalDate monday = uniqueMonday();
        ObjectNode createBody = objectMapper.createObjectNode();
        createBody.put("weekStartDate", monday.toString());
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
        entryBody.put("workDate", monday.plusDays(1).toString());
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

        LocalDate monday = uniqueMonday();
        ObjectNode createBody = objectMapper.createObjectNode();
        createBody.put("weekStartDate", monday.toString());
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
        entryBody.put("workDate", monday.toString());
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

        LocalDate monday = uniqueMonday();
        ObjectNode createBody = objectMapper.createObjectNode();
        createBody.put("weekStartDate", monday.toString());
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
        entryBody.put("workDate", monday.plusDays(1).toString());
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

    @Test
    void weeklyGridCopyWeekAndBulkApproveUpdateActuals() throws Exception {
        String employeeToken = login("employee@example.com");
        LocalDate monday = uniqueMonday();
        String firstWeekId = createTimesheet(employeeToken, monday);

        ArrayNode overLimit = objectMapper.createArrayNode();
        overLimit.add(gridEntry(monday, 14, true));
        overLimit.add(gridEntry(monday, 12, false));
        mockMvc.perform(put("/api/v1/timesheets/" + firstWeekId + "/entries")
                        .header("Authorization", "Bearer " + employeeToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(objectMapper.createObjectNode().set("entries", overLimit))))
                .andExpect(status().isUnprocessableEntity());

        ArrayNode grid = objectMapper.createArrayNode();
        grid.add(gridEntry(monday, 6, true));
        grid.add(gridEntry(monday.plusDays(1), 7, true));
        grid.add(gridEntry(monday.plusDays(2), 2, false));
        mockMvc.perform(put("/api/v1/timesheets/" + firstWeekId + "/entries")
                        .header("Authorization", "Bearer " + employeeToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(objectMapper.createObjectNode().set("entries", grid))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.entries.length()").value(3))
                .andExpect(jsonPath("$.data.totalHours").value(15));

        String secondWeekId = createTimesheet(employeeToken, monday.plusWeeks(1));
        mockMvc.perform(post("/api/v1/timesheets/" + secondWeekId + "/copy-previous-week")
                        .header("Authorization", "Bearer " + employeeToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.entries.length()").value(3))
                .andExpect(jsonPath("$.data.entries[0].workDate").value(monday.plusWeeks(1).toString()));
        mockMvc.perform(post("/api/v1/timesheets/" + secondWeekId + "/copy-previous-week")
                        .header("Authorization", "Bearer " + employeeToken))
                .andExpect(status().isUnprocessableEntity());

        for (String id : new String[] {firstWeekId, secondWeekId}) {
            mockMvc.perform(post("/api/v1/timesheets/" + id + "/submit")
                            .header("Authorization", "Bearer " + employeeToken))
                    .andExpect(status().isOk());
        }

        String pmToken = login("pm@example.com");
        MvcResult awaiting = mockMvc.perform(get("/api/v1/timesheets")
                        .param("awaitingMyApproval", "true")
                        .param("size", "100")
                        .param("weekStart", monday.toString())
                        .header("Authorization", "Bearer " + pmToken))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode awaitingRows = objectMapper.readTree(awaiting.getResponse().getContentAsString()).at("/data");
        assertThat(awaitingRows.findValuesAsText("id")).contains(firstWeekId);

        ObjectNode bulkBody = objectMapper.createObjectNode();
        bulkBody.putArray("ids").add(firstWeekId).add(secondWeekId);
        mockMvc.perform(post("/api/v1/timesheets/bulk-approve")
                        .header("Authorization", "Bearer " + pmToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(bulkBody)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(2))
                .andExpect(jsonPath("$.data[0].success").value(true))
                .andExpect(jsonPath("$.data[1].success").value(true));

        mockMvc.perform(get("/api/v1/timesheets/" + secondWeekId).header("Authorization", "Bearer " + pmToken))
                .andExpect(jsonPath("$.data.status").value("APPROVED"));

        MvcResult summary = mockMvc.perform(get("/api/v1/projects/" + SEED_PROJECT_ID + "/time-summary")
                        .header("Authorization", "Bearer " + pmToken))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode summaryJson = objectMapper.readTree(summary.getResponse().getContentAsString()).at("/data");
        assertThat(summaryJson.at("/approvedHours").decimalValue()).isGreaterThanOrEqualTo(new java.math.BigDecimal("30"));
        assertThat(summaryJson.at("/byResource").size()).isGreaterThan(0);

        MvcResult project = mockMvc.perform(get("/api/v1/projects/" + SEED_PROJECT_ID)
                        .header("Authorization", "Bearer " + pmToken))
                .andExpect(status().isOk())
                .andReturn();
        assertThat(objectMapper.readTree(project.getResponse().getContentAsString()).at("/data/actualHours").decimalValue())
                .isEqualByComparingTo(summaryJson.at("/approvedHours").decimalValue());
    }

    @Test
    void createWithQuickFillNotesAndSubmitThenCopyIntoNextWeek() throws Exception {
        String employeeToken = login("employee@example.com");
        LocalDate monday = uniqueMonday();

        mockMvc.perform(get("/api/v1/timesheets/entry-projects").header("Authorization", "Bearer " + employeeToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[?(@.projectId == '" + SEED_PROJECT_ID + "')]").exists());

        ObjectNode body = objectMapper.createObjectNode();
        body.put("weekStartDate", monday.toString());
        body.put("notes", "Sprint 12");
        body.put("startWith", "QUICK_FILL");
        body.put("submitAfterCreate", true);
        ObjectNode fill = body.putObject("quickFill");
        fill.put("projectId", SEED_PROJECT_ID.toString());
        fill.put("hoursPerDay", 8);
        fill.putArray("days").add(1).add(2).add(3).add(4).add(5);
        fill.put("billable", true);
        fill.put("description", "Build");
        mockMvc.perform(post("/api/v1/timesheets")
                        .header("Authorization", "Bearer " + employeeToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("SUBMITTED"))
                .andExpect(jsonPath("$.data.notes").value("Sprint 12"))
                .andExpect(jsonPath("$.data.entries.length()").value(5))
                .andExpect(jsonPath("$.data.totalHours").value(40));

        ObjectNode next = objectMapper.createObjectNode();
        next.put("weekStartDate", monday.plusWeeks(1).toString());
        next.put("startWith", "COPY_PREVIOUS");
        mockMvc.perform(post("/api/v1/timesheets")
                        .header("Authorization", "Bearer " + employeeToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(next)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("DRAFT"))
                .andExpect(jsonPath("$.data.entries.length()").value(5));

        ObjectNode noPrevious = objectMapper.createObjectNode();
        noPrevious.put("weekStartDate", monday.minusWeeks(1).toString());
        noPrevious.put("startWith", "COPY_PREVIOUS");
        mockMvc.perform(post("/api/v1/timesheets")
                        .header("Authorization", "Bearer " + employeeToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(noPrevious)))
                .andExpect(status().isUnprocessableEntity());
        mockMvc.perform(get("/api/v1/timesheets")
                        .param("weekStart", monday.minusWeeks(1).toString())
                        .header("Authorization", "Bearer " + employeeToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(0));
    }

    private String createTimesheet(String token, LocalDate monday) throws Exception {
        ObjectNode createBody = objectMapper.createObjectNode();
        createBody.put("weekStartDate", monday.toString());
        MvcResult createResult = mockMvc.perform(post("/api/v1/timesheets")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(createBody)))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(createResult.getResponse().getContentAsString()).at("/data/id").asText();
    }

    private ObjectNode gridEntry(LocalDate date, int hours, boolean billable) {
        ObjectNode entry = objectMapper.createObjectNode();
        entry.put("projectId", SEED_PROJECT_ID.toString());
        entry.put("workDate", date.toString());
        entry.put("hours", hours);
        entry.put("description", "Grid work");
        entry.put("billable", billable);
        return entry;
    }

    /** Tests share a persistent database, so each run needs a week no earlier run has used. */
    private static LocalDate uniqueMonday() {
        return LocalDate.of(2040, 1, 2)
                .with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY))
                .plusWeeks(ThreadLocalRandom.current().nextInt(0, 50_000));
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
