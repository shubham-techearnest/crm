package com.techearnest.crm.resource;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.techearnest.crm.auth.api.dto.LoginRequest;
import com.techearnest.crm.project.domain.Project;
import com.techearnest.crm.project.domain.ProjectRepository;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;
import java.util.function.Consumer;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

/** Internal employees vs. external resources, auto-numbered codes and time entry on ended projects. */
@SpringBootTest
@AutoConfigureMockMvc
class ResourceTypesAndClosedProjectsTest {

    private static final UUID SEED_PROJECT_ID = UUID.fromString("99999999-9999-4999-8999-000000000001");
    private static final UUID SEED_REGION_ID = UUID.fromString("22222222-2222-4222-8222-000000000011");
    /** employee@example.com, already linked to seed resource EMP-1001. */
    private static final UUID LINKED_EMPLOYEE_USER_ID = UUID.fromString("77777777-7777-4777-8777-000000000009");
    private static final String PASSWORD = "ChangeMe!123";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private ProjectRepository projectRepository;

    @Test
    void codesAreAutoNumberedPerTypeAndEmployeesMustBeUsers() throws Exception {
        String admin = login("orgadmin@example.com");

        String first = createExternal(admin, "CONTRACTOR").at("/data/employeeCode").asText();
        String second = createExternal(admin, "CONTRACTOR").at("/data/employeeCode").asText();
        assertThat(first).matches("CON-\\d{3,}");
        assertThat(number(second)).isEqualTo(number(first) + 1);
        assertThat(createExternal(admin, "FREELANCER").at("/data/employeeCode").asText()).matches("FRL-\\d{3,}");

        mockMvc.perform(post("/api/v1/resources")
                        .header("Authorization", "Bearer " + admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body(b -> {
                            b.put("regionId", SEED_REGION_ID.toString());
                            b.put("resourceType", "EMPLOYEE");
                            b.put("fullName", "No Login");
                        })))
                .andExpect(status().isUnprocessableEntity());

        mockMvc.perform(post("/api/v1/resources")
                        .header("Authorization", "Bearer " + admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body(b -> {
                            b.put("regionId", SEED_REGION_ID.toString());
                            b.put("resourceType", "EMPLOYEE");
                            b.put("userId", LINKED_EMPLOYEE_USER_ID.toString());
                        })))
                .andExpect(status().isConflict());

        mockMvc.perform(post("/api/v1/resources")
                        .header("Authorization", "Bearer " + admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body(b -> {
                            b.put("regionId", SEED_REGION_ID.toString());
                            b.put("resourceType", "CONTRACTOR");
                        })))
                .andExpect(status().isUnprocessableEntity());
    }

    @Test
    void timeCannotBeLoggedOnEndedProjectsAndExistingEntriesStayFrozen() throws Exception {
        String admin = login("orgadmin@example.com");
        LocalDate monday = uniqueMonday();
        String resourceId = createExternal(admin, "CONTRACTOR").at("/data/id").asText();
        Project seed = projectRepository.findById(SEED_PROJECT_ID).orElseThrow();
        Project extra = projectRepository.save(Project.create(
                seed.getOrganizationId(),
                seed.getRegionId(),
                seed.getAccountId(),
                null,
                seed.getProjectManagerId(),
                "Closing Project",
                "CLS-" + UUID.randomUUID().toString().substring(0, 8),
                null,
                "ACTIVE",
                seed.getPriority(),
                monday.minusWeeks(4),
                monday.plusWeeks(4),
                null,
                null,
                seed.getBillingType()));
        allocate(admin, resourceId, SEED_PROJECT_ID, monday);
        allocate(admin, resourceId, extra.getId(), monday);

        String timesheetId = json(mockMvc.perform(post("/api/v1/timesheets")
                        .header("Authorization", "Bearer " + admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body(b -> {
                            b.put("resourceId", resourceId);
                            b.put("weekStartDate", monday.toString());
                        })))
                .andExpect(status().isOk())
                .andReturn()).at("/data/id").asText();
        String entryId = json(mockMvc.perform(post("/api/v1/timesheets/" + timesheetId + "/entries")
                        .header("Authorization", "Bearer " + admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(entry(extra.getId(), monday, 6)))
                .andExpect(status().isOk())
                .andReturn()).at("/data/id").asText();

        Project closing = projectRepository.findById(extra.getId()).orElseThrow();
        closing.update(null, null, null, null, null, "COMPLETED", null, null, null, null, null, null);
        projectRepository.saveAndFlush(closing);

        JsonNode options = json(mockMvc.perform(get("/api/v1/timesheets/" + timesheetId + "/projects")
                        .header("Authorization", "Bearer " + admin))
                .andExpect(status().isOk())
                .andReturn()).at("/data");
        JsonNode closedOption = null;
        for (JsonNode option : options) {
            if (extra.getId().toString().equals(option.get("projectId").asText())) {
                closedOption = option;
            }
        }
        assertThat(closedOption).isNotNull();
        assertThat(closedOption.get("closed").asBoolean()).isTrue();
        assertThat(closedOption.get("status").asText()).isEqualTo("COMPLETED");

        mockMvc.perform(post("/api/v1/timesheets/" + timesheetId + "/entries")
                        .header("Authorization", "Bearer " + admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(entry(extra.getId(), monday.plusDays(1), 2)))
                .andExpect(status().isUnprocessableEntity());
        mockMvc.perform(put("/api/v1/time-entries/" + entryId)
                        .header("Authorization", "Bearer " + admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body(b -> b.put("hours", 3))))
                .andExpect(status().isUnprocessableEntity());
        mockMvc.perform(delete("/api/v1/time-entries/" + entryId)
                        .header("Authorization", "Bearer " + admin))
                .andExpect(status().isUnprocessableEntity());

        ObjectNode grid = objectMapper.createObjectNode();
        ArrayNode rows = grid.putArray("entries");
        rows.add(objectMapper.readTree(entry(SEED_PROJECT_ID, monday.plusDays(1), 4)));
        JsonNode saved = json(mockMvc.perform(put("/api/v1/timesheets/" + timesheetId + "/entries")
                        .header("Authorization", "Bearer " + admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(grid)))
                .andExpect(status().isOk())
                .andReturn()).at("/data/entries");
        assertThat(saved).hasSize(2);
        assertThat(saved.findValuesAsText("projectId"))
                .containsExactlyInAnyOrder(SEED_PROJECT_ID.toString(), extra.getId().toString());

        rows.add(objectMapper.readTree(entry(extra.getId(), monday.plusDays(2), 1)));
        mockMvc.perform(put("/api/v1/timesheets/" + timesheetId + "/entries")
                        .header("Authorization", "Bearer " + admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(grid)))
                .andExpect(status().isUnprocessableEntity());
    }

    private JsonNode createExternal(String token, String type) throws Exception {
        return json(mockMvc.perform(post("/api/v1/resources")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body(b -> {
                            b.put("regionId", SEED_REGION_ID.toString());
                            b.put("resourceType", type);
                            b.put("fullName", "External " + UUID.randomUUID().toString().substring(0, 8));
                            b.put("capacityHoursPerWeek", 40);
                        })))
                .andExpect(status().isOk())
                .andReturn());
    }

    private void allocate(String token, String resourceId, UUID projectId, LocalDate monday) throws Exception {
        mockMvc.perform(post("/api/v1/allocations")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body(b -> {
                            b.put("projectId", projectId.toString());
                            b.put("resourceId", resourceId);
                            b.put("startDate", monday.minusWeeks(1).toString());
                            b.put("endDate", monday.plusWeeks(2).toString());
                            b.put("allocationPercentage", 40);
                            b.put("status", "ACTIVE");
                        })))
                .andExpect(status().isOk());
    }

    private String entry(UUID projectId, LocalDate workDate, int hours) throws Exception {
        return body(b -> {
            b.put("projectId", projectId.toString());
            b.put("workDate", workDate.toString());
            b.put("hours", hours);
        });
    }

    private static long number(String code) {
        return Long.parseLong(code.substring(code.indexOf('-') + 1));
    }

    private String body(Consumer<ObjectNode> fill) throws Exception {
        ObjectNode node = objectMapper.createObjectNode();
        fill.accept(node);
        return objectMapper.writeValueAsString(node);
    }

    private JsonNode json(MvcResult result) throws Exception {
        return objectMapper.readTree(result.getResponse().getContentAsString());
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
                        .content(objectMapper.writeValueAsString(new LoginRequest(email, PASSWORD))))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(login.getResponse().getContentAsString()).at("/data/accessToken").asText();
    }
}
