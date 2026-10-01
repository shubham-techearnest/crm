package com.techearnest.crm.timesheet;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
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
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

/** One timesheet, two projects with different project managers: each sees and approves only their own hours. */
@SpringBootTest
@AutoConfigureMockMvc
class TimesheetProjectScopeTest {

    private static final String ORG_ID = "11111111-1111-4111-8111-111111111111";
    private static final String SEED_PROJECT_ID = "99999999-9999-4999-8999-000000000001";
    private static final String SEED_PM_ID = "77777777-7777-4777-8777-000000000006";
    private static final String EMPLOYEE_RESOURCE_ID = "bbbbbbb1-bbbb-4bbb-8bbb-000000000001";
    private static final String PROJECT_MANAGER_ROLE_ID = "66666666-6666-4666-8666-000000000006";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JdbcTemplate jdbc;

    @Test
    void projectManagersOnlySeeAndApproveTheirOwnProjectHours() throws Exception {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        UUID otherPmId = UUID.randomUUID();
        String otherPmEmail = "pm-" + suffix + "@example.com";
        jdbc.update(
                """
                INSERT INTO users (id, organization_id, region_id, branch_id, department_id, team_id,
                                   email, password_hash, first_name, last_name, status)
                SELECT ?, organization_id, region_id, branch_id, department_id, NULL,
                       ?, password_hash, 'Other', 'PM', 'ACTIVE'
                FROM users WHERE id = ?::uuid
                """,
                otherPmId, otherPmEmail, SEED_PM_ID);
        jdbc.update("INSERT INTO user_roles (user_id, role_id) VALUES (?, ?::uuid)", otherPmId, PROJECT_MANAGER_ROLE_ID);

        UUID otherProjectId = UUID.randomUUID();
        jdbc.update(
                """
                INSERT INTO projects (id, organization_id, region_id, account_id, project_manager_id, name,
                                      project_code, status, priority, start_date, end_date, billing_type)
                SELECT ?, organization_id, region_id, account_id, ?, ?, ?, 'ACTIVE', 'MEDIUM',
                       DATE '2026-01-01', DATE '2099-12-31', billing_type
                FROM projects WHERE id = ?::uuid
                """,
                otherProjectId, otherPmId, "Apollo " + suffix, "AP-" + suffix, SEED_PROJECT_ID);
        jdbc.update(
                """
                INSERT INTO resource_allocations (id, organization_id, project_id, resource_id, start_date, end_date,
                                                  allocated_hours, allocation_percentage, role, status)
                VALUES (?, ?::uuid, ?, ?::uuid, DATE '2026-01-01', DATE '2099-12-31', 100, 10, 'Engineer', 'ACTIVE')
                """,
                UUID.randomUUID(), ORG_ID, otherProjectId, EMPLOYEE_RESOURCE_ID);

        LocalDate monday = LocalDate.of(2041, 1, 7)
                .with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY))
                .plusWeeks(ThreadLocalRandom.current().nextInt(0, 50_000));
        ObjectNode body = objectMapper.createObjectNode();
        body.put("weekStartDate", monday.toString());
        body.put("startWith", "CUSTOM");
        body.put("submitAfterCreate", true);
        ArrayNode entries = body.putArray("entries");
        entries.add(entry(SEED_PROJECT_ID, monday, 5, "Storefront work"));
        entries.add(entry(otherProjectId.toString(), monday.plusDays(1), 3, "Apollo work"));
        String employeeToken = login("employee@example.com");
        MvcResult created = mockMvc.perform(post("/api/v1/timesheets")
                        .header("Authorization", "Bearer " + employeeToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("SUBMITTED"))
                .andReturn();
        String timesheetId = objectMapper.readTree(created.getResponse().getContentAsString()).at("/data/id").asText();

        String otherPmToken = login(otherPmEmail);
        mockMvc.perform(get("/api/v1/timesheets/" + timesheetId).header("Authorization", "Bearer " + otherPmToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.visibility").value("MY_PROJECTS"))
                .andExpect(jsonPath("$.data.totalHours").value(3))
                .andExpect(jsonPath("$.data.entries.length()").value(1))
                .andExpect(jsonPath("$.data.entries[0].projectId").value(otherProjectId.toString()));

        MvcResult awaiting = mockMvc.perform(get("/api/v1/timesheets")
                        .param("awaitingMyApproval", "true")
                        .param("size", "100")
                        .header("Authorization", "Bearer " + otherPmToken))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode listed = null;
        for (JsonNode row : objectMapper.readTree(awaiting.getResponse().getContentAsString()).at("/data")) {
            if (timesheetId.equals(row.at("/id").asText())) {
                listed = row;
            }
        }
        assertThat(listed).as("timesheet awaiting the other PM").isNotNull();
        assertThat(listed.at("/totalHours").decimalValue()).isEqualByComparingTo("3");

        mockMvc.perform(post("/api/v1/timesheets/" + timesheetId + "/approve")
                        .header("Authorization", "Bearer " + otherPmToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("SUBMITTED"))
                .andExpect(jsonPath("$.data.entries.length()").value(1))
                .andExpect(jsonPath("$.data.entries[0].approvedAt").isNotEmpty());

        String seedPmToken = login("pm@example.com");
        mockMvc.perform(get("/api/v1/timesheets/" + timesheetId).header("Authorization", "Bearer " + seedPmToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.visibility").value("ALL"))
                .andExpect(jsonPath("$.data.entries.length()").value(2));
        mockMvc.perform(post("/api/v1/timesheets/" + timesheetId + "/approve")
                        .header("Authorization", "Bearer " + seedPmToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("APPROVED"));
    }

    private ObjectNode entry(String projectId, LocalDate date, int hours, String description) {
        ObjectNode entry = objectMapper.createObjectNode();
        entry.put("projectId", projectId);
        entry.put("workDate", date.toString());
        entry.put("hours", hours);
        entry.put("description", description);
        entry.put("billable", true);
        return entry;
    }

    private String login(String email) throws Exception {
        MvcResult login = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new LoginRequest(email, "ChangeMe!123"))))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(login.getResponse().getContentAsString()).at("/data/accessToken").asText();
    }
}
