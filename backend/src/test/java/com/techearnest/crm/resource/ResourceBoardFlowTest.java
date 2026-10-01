package com.techearnest.crm.resource;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.techearnest.crm.auth.api.dto.LoginRequest;
import com.techearnest.crm.project.domain.Project;
import com.techearnest.crm.project.domain.ProjectRepository;
import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.Map;
import java.util.UUID;
import java.util.function.Consumer;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;

/** Resource board: derived states, availability search, lifecycle, leave, approved cost and authorization. */
@SpringBootTest
@AutoConfigureMockMvc
class ResourceBoardFlowTest {

    private static final UUID SEED_PROJECT_ID = UUID.fromString("99999999-9999-4999-8999-000000000001");
    private static final UUID SEED_REGION_ID = UUID.fromString("22222222-2222-4222-8222-000000000011");
    private static final UUID MUMBAI_REGION_ID = UUID.fromString("22222222-2222-4222-8222-000000000012");
    private static final UUID WEST_REGION_ID = UUID.fromString("22222222-2222-4222-8222-000000000001");
    private static final String PASSWORD = "ChangeMe!123";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private ProjectRepository projectRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void boardDerivesAllocationStatesAndSupportsAvailabilitySearch() throws Exception {
        String admin = login("orgadmin@example.com");
        LocalDate today = LocalDate.now();
        String tag = "Brd" + UUID.randomUUID().toString().substring(0, 6);
        UUID project = newProject(today).getId();

        String partial = createExternal(admin, tag + " Partial", today.plusDays(300), 6);
        String over = createExternal(admin, tag + " Over", today.plusDays(300), 8);
        String ending = createExternal(admin, tag + " Ending", today.plusDays(300), 7);
        String bench = createExternal(admin, tag + " Bench", today.plusDays(300), 2);

        allocate(admin, partial, project, today.minusDays(10), today.plusDays(100), 60).andExpect(status().isOk());
        allocate(admin, over, project, today.minusDays(10), today.plusDays(100), 80).andExpect(status().isOk());
        allocate(admin, over, SEED_PROJECT_ID, today.minusDays(10), today.plusDays(100), 40).andExpect(status().isOk());
        allocate(admin, ending, project, today.minusDays(10), today.plusDays(5), 100).andExpect(status().isOk());

        JsonNode board = json(mockMvc.perform(get("/api/v1/resource-board")
                        .param("search", tag)
                        .header("Authorization", "Bearer " + admin))
                .andExpect(status().isOk())
                .andReturn()).at("/data");
        assertThat(board.get("financialsVisible").asBoolean()).isTrue();
        Map<String, JsonNode> rows = rowsById(board.get("resources"));
        assertThat(rows).containsKeys(partial, over, ending, bench);
        assertThat(rows.get(partial).get("status").asText()).isEqualTo("PARTIALLY_ALLOCATED");
        assertThat(rows.get(partial).get("available").asBoolean()).isTrue();
        assertThat(rows.get(partial).get("availableCapacityPct").decimalValue()).isEqualByComparingTo("40");
        assertThat(rows.get(over).get("status").asText()).isEqualTo("OVERALLOCATED");
        assertThat(rows.get(over).get("currentAllocationPct").decimalValue()).isEqualByComparingTo("120");
        assertThat(rows.get(over).get("activeProjectCount").asInt()).isEqualTo(2);
        assertThat(rows.get(ending).get("status").asText()).isEqualTo("ENDING_SOON");
        assertThat(rows.get(ending).get("availableFrom").asText()).isEqualTo(today.plusDays(6).toString());
        assertThat(rows.get(bench).get("status").asText()).isEqualTo("BENCH");
        assertThat(rows.get(partial).get("costRate").decimalValue()).isEqualByComparingTo("1000");
        assertThat(board.at("/summary/totalResources").asInt()).isEqualTo(4);
        assertThat(board.at("/summary/overallocated").asInt()).isEqualTo(1);
        assertThat(board.at("/summary/bench").asInt()).isEqualTo(1);

        boolean projectListed = false;
        for (JsonNode p : board.get("projects")) {
            if (project.toString().equals(p.get("projectId").asText())) {
                projectListed = true;
                assertThat(p.get("teamSize").asInt()).isEqualTo(3);
                assertThat(p.get("fte").decimalValue()).isEqualByComparingTo("2.40");
                assertThat(p.get("membersOverallocated").asInt()).isEqualTo(1);
            }
        }
        assertThat(projectListed).isTrue();

        assertThat(ids(get("/api/v1/resource-board/overallocated"), admin)).contains(over).doesNotContain(partial);
        assertThat(ids(get("/api/v1/resource-board/ending-soon"), admin)).contains(ending).doesNotContain(bench);
        assertThat(ids(get("/api/v1/resource-board/bench"), admin)).contains(bench).doesNotContain(partial);
        assertThat(ids(get("/api/v1/resource-board/available").param("withinDays", "0"), admin))
                .contains(partial, bench)
                .doesNotContain(over, ending);

        JsonNode found = json(mockMvc.perform(get("/api/v1/resource-board/search")
                        .param("search", tag)
                        .param("availableWithinDays", "15")
                        .param("maxAllocationPct", "80")
                        .param("minExperienceYears", "5")
                        .header("Authorization", "Bearer " + admin))
                .andExpect(status().isOk())
                .andReturn()).at("/data");
        assertThat(found.findValuesAsText("id")).containsExactly(partial);

        mockMvc.perform(get("/api/v1/resource-board").header("Authorization", "Bearer " + login("employee@example.com")))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/v1/resource-board").header("Authorization", "Bearer " + login("sales.exec@example.com")))
                .andExpect(status().isForbidden());

        JsonNode viewerBoard = json(mockMvc.perform(get("/api/v1/resource-board")
                        .param("search", tag)
                        .header("Authorization", "Bearer " + login("viewer@example.com")))
                .andExpect(status().isOk())
                .andReturn()).at("/data");
        assertThat(viewerBoard.get("financialsVisible").asBoolean()).isFalse();
        for (JsonNode row : viewerBoard.get("resources")) {
            assertThat(row.has("costRate")).isFalse();
            assertThat(row.has("cost")).isFalse();
            assertThat(row.has("revenue")).isFalse();
        }
        assertThat(viewerBoard.at("/summary/totals").has("cost")).isFalse();
        assertThat(viewerBoard.at("/summary/totals").has("capacityHours")).isTrue();
    }

    @Test
    void deactivationKeepsHistoryAndReactivationRestoresWork() throws Exception {
        String admin = login("orgadmin@example.com");
        LocalDate today = LocalDate.now();
        String tag = "Life" + UUID.randomUUID().toString().substring(0, 6);
        UUID project = newProject(today).getId();
        String resource = createExternal(admin, tag, today.plusDays(30), 4);

        JsonNode conflict = json(allocate(admin, resource, project, today, today.plusDays(60), 20)
                .andExpect(status().isOk())
                .andReturn()).at("/data");
        assertThat(conflict.get("warnings").toString()).contains("engagement");
        mockMvc.perform(delete("/api/v1/allocations/" + conflict.get("id").asText())
                        .header("Authorization", "Bearer " + admin))
                .andExpect(status().isOk());

        String allocationId = json(allocate(admin, resource, project, today.minusDays(5), today.plusDays(20), 50)
                .andExpect(status().isOk())
                .andReturn()).at("/data/id").asText();

        mockMvc.perform(post("/api/v1/resources/" + resource + "/deactivate")
                        .header("Authorization", "Bearer " + admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body(b -> b.put("reason", "Contract closed"))))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("OPEN_ALLOCATIONS"));

        JsonNode deactivated = json(mockMvc.perform(post("/api/v1/resources/" + resource + "/deactivate")
                        .header("Authorization", "Bearer " + admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body(b -> {
                            b.put("reason", "Contract closed");
                            b.put("endOpenAllocations", true);
                        })))
                .andExpect(status().isOk())
                .andReturn()).at("/data");
        assertThat(deactivated.get("allocationsEnded").asInt()).isEqualTo(1);
        assertThat(deactivated.at("/resource/status").asText()).isEqualTo("INACTIVE");
        assertThat(deactivated.at("/resource/deactivationReason").asText()).isEqualTo("Contract closed");

        JsonNode ended = json(mockMvc.perform(get("/api/v1/allocations/" + allocationId)
                        .header("Authorization", "Bearer " + admin))
                .andExpect(status().isOk())
                .andReturn()).at("/data");
        assertThat(ended.get("status").asText()).isEqualTo("COMPLETED");
        assertThat(ended.get("endDate").asText()).isEqualTo(today.toString());

        mockMvc.perform(delete("/api/v1/resources/" + resource).header("Authorization", "Bearer " + admin))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("HAS_HISTORY"));
        allocate(admin, resource, project, today.plusDays(1), today.plusDays(10), 10)
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("RESOURCE_INACTIVE"));

        assertThat(ids(get("/api/v1/resource-board").param("search", tag), admin)).isEmpty();
        JsonNode withInactive = json(mockMvc.perform(get("/api/v1/resource-board")
                        .param("search", tag)
                        .param("includeInactive", "true")
                        .header("Authorization", "Bearer " + admin))
                .andExpect(status().isOk())
                .andReturn()).at("/data/resources");
        assertThat(withInactive).hasSize(1);
        assertThat(withInactive.get(0).get("status").asText()).isEqualTo("INACTIVE");

        JsonNode reactivated = json(mockMvc.perform(post("/api/v1/resources/" + resource + "/reactivate")
                        .header("Authorization", "Bearer " + admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body(b -> b.put("engagementEndDate", today.plusDays(90).toString()))))
                .andExpect(status().isOk())
                .andReturn()).at("/data/resource");
        assertThat(reactivated.get("status").asText()).isEqualTo("AVAILABLE");
        assertThat(reactivated.get("engagementEndDate").asText()).isEqualTo(today.plusDays(90).toString());

        mockMvc.perform(post("/api/v1/resources/" + resource + "/unavailability")
                        .header("Authorization", "Bearer " + admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body(b -> {
                            b.put("startDate", today.toString());
                            b.put("endDate", today.plusDays(2).toString());
                            b.put("kind", "LEAVE");
                        })))
                .andExpect(status().isOk());
        JsonNode onLeave = json(mockMvc.perform(get("/api/v1/resource-board")
                        .param("search", tag)
                        .header("Authorization", "Bearer " + admin))
                .andExpect(status().isOk())
                .andReturn()).at("/data/resources");
        assertThat(onLeave).hasSize(1);
        assertThat(onLeave.get(0).get("status").asText()).isEqualTo("ON_LEAVE");

        Integer lifecycleAudits = jdbcTemplate.queryForObject(
                "select count(*) from audit_logs where entity_id = ?::uuid and action in ('DEACTIVATE', 'REACTIVATE')",
                Integer.class, resource);
        assertThat(lifecycleAudits).isEqualTo(2);
        Integer endAudits = jdbcTemplate.queryForObject(
                "select count(*) from audit_logs where entity_id = ?::uuid and action = 'END'",
                Integer.class, allocationId);
        assertThat(endAudits).isEqualTo(1);
    }

    @Test
    void approvedTimeIsCostedWithStampedAllocationRates() throws Exception {
        String admin = login("orgadmin@example.com");
        LocalDate today = LocalDate.now();
        LocalDate monday = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        String tag = "Cost" + UUID.randomUUID().toString().substring(0, 6);
        UUID project = newProject(today).getId();
        String resource = createExternal(admin, tag, today.plusDays(300), 5);

        String allocationId = json(mockMvc.perform(post("/api/v1/allocations")
                        .header("Authorization", "Bearer " + admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body(b -> {
                            b.put("projectId", project.toString());
                            b.put("resourceId", resource);
                            b.put("startDate", monday.minusDays(7).toString());
                            b.put("endDate", today.plusDays(60).toString());
                            b.put("allocationPercentage", 50);
                            b.put("costRate", 1100);
                            b.put("billingRate", 2500);
                            b.put("status", "ACTIVE");
                        })))
                .andExpect(status().isOk())
                .andReturn()).at("/data/id").asText();

        String timesheetId = json(mockMvc.perform(post("/api/v1/timesheets")
                        .header("Authorization", "Bearer " + admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body(b -> {
                            b.put("resourceId", resource);
                            b.put("weekStartDate", monday.toString());
                        })))
                .andExpect(status().isOk())
                .andReturn()).at("/data/id").asText();
        String entryId = json(mockMvc.perform(post("/api/v1/timesheets/" + timesheetId + "/entries")
                        .header("Authorization", "Bearer " + admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body(b -> {
                            b.put("projectId", project.toString());
                            b.put("workDate", monday.toString());
                            b.put("hours", 8);
                            b.put("billable", true);
                        })))
                .andExpect(status().isOk())
                .andReturn()).at("/data/id").asText();
        mockMvc.perform(post("/api/v1/timesheets/" + timesheetId + "/submit").header("Authorization", "Bearer " + admin))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/v1/timesheets/" + timesheetId + "/approve").header("Authorization", "Bearer " + admin))
                .andExpect(status().isOk());

        Map<String, Object> stamped = jdbcTemplate.queryForMap(
                "select cost_rate, billing_rate, allocation_id::text as allocation_id from time_entries where id = ?::uuid",
                entryId);
        assertThat((BigDecimal) stamped.get("cost_rate")).isEqualByComparingTo("1100");
        assertThat((BigDecimal) stamped.get("billing_rate")).isEqualByComparingTo("2500");
        assertThat(stamped.get("allocation_id")).isEqualTo(allocationId);

        JsonNode workload = json(mockMvc.perform(get("/api/v1/resource-board/resources/" + resource)
                        .param("periodStart", monday.toString())
                        .param("periodEnd", monday.plusDays(6).toString())
                        .header("Authorization", "Bearer " + admin))
                .andExpect(status().isOk())
                .andReturn()).at("/data");
        JsonNode cost = workload.get("costs").get(0);
        assertThat(cost.get("projectId").asText()).isEqualTo(project.toString());
        assertThat(cost.get("hours").decimalValue()).isEqualByComparingTo("8");
        assertThat(cost.get("cost").decimalValue()).isEqualByComparingTo("8800");
        assertThat(cost.get("revenue").decimalValue()).isEqualByComparingTo("20000");
        assertThat(cost.get("margin").decimalValue()).isEqualByComparingTo("11200");
        assertThat(workload.at("/resource/actualHours").decimalValue()).isEqualByComparingTo("8");
        assertThat(workload.at("/resource/cost").decimalValue()).isEqualByComparingTo("8800");
        assertThat(workload.get("timesheets").get(0).get("status").asText()).isEqualTo("APPROVED");
        assertThat(workload.get("allocations").findValuesAsText("allocationId")).contains(allocationId);
    }

    @Test
    void thresholdsAreConfigurableByResourceManagersOnly() throws Exception {
        String manager = login("resource.mgr@example.com");
        mockMvc.perform(put("/api/v1/resource-board/settings")
                        .header("Authorization", "Bearer " + login("pm@example.com"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body(b -> b.put("endingSoonDays", 30))))
                .andExpect(status().isForbidden());
        mockMvc.perform(put("/api/v1/resource-board/settings")
                        .header("Authorization", "Bearer " + manager)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body(b -> b.put("benchMaxAllocationPct", 99).put("fullAllocationPct", 50))))
                .andExpect(status().isUnprocessableEntity());
        try {
            mockMvc.perform(put("/api/v1/resource-board/settings")
                            .header("Authorization", "Bearer " + manager)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(body(b -> b.put("endingSoonDays", 30))))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.endingSoonDays").value(30));
            mockMvc.perform(get("/api/v1/resource-board").header("Authorization", "Bearer " + manager))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.settings.endingSoonDays").value(30));
        } finally {
            mockMvc.perform(put("/api/v1/resource-board/settings")
                            .header("Authorization", "Bearer " + manager)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(body(b -> b.put("endingSoonDays", 14))))
                    .andExpect(status().isOk());
        }
    }

    @Test
    void boardFollowsRegionScopeAndRegionFilterIncludesChildRegions() throws Exception {
        String admin = login("orgadmin@example.com");
        String tag = "Reg" + UUID.randomUUID().toString().substring(0, 6);
        LocalDate end = LocalDate.now().plusDays(200);
        String inPune = createExternal(admin, tag + " Pune", end, 3, SEED_REGION_ID);
        String inMumbai = createExternal(admin, tag + " Mumbai", end, 3, MUMBAI_REGION_ID);

        assertThat(ids(get("/api/v1/resource-board"), admin)).contains(inPune, inMumbai);
        assertThat(ids(get("/api/v1/resource-board").param("regionId", SEED_REGION_ID.toString()), admin))
                .contains(inPune)
                .doesNotContain(inMumbai);
        assertThat(ids(get("/api/v1/resource-board").param("regionId", WEST_REGION_ID.toString()), admin))
                .contains(inPune, inMumbai);

        String puneAdmin = login("pune.admin@example.com");
        assertThat(ids(get("/api/v1/resource-board"), puneAdmin)).contains(inPune).doesNotContain(inMumbai);
        assertThat(ids(get("/api/v1/resource-board").param("regionId", MUMBAI_REGION_ID.toString()), puneAdmin))
                .doesNotContain(inMumbai);
    }

    private Project newProject(LocalDate today) {
        Project seed = projectRepository.findById(SEED_PROJECT_ID).orElseThrow();
        return projectRepository.save(Project.create(
                seed.getOrganizationId(),
                seed.getRegionId(),
                seed.getAccountId(),
                null,
                seed.getProjectManagerId(),
                "Board Project " + UUID.randomUUID().toString().substring(0, 6),
                "BRD-" + UUID.randomUUID().toString().substring(0, 8),
                null,
                "ACTIVE",
                seed.getPriority(),
                today.minusDays(30),
                today.plusDays(365),
                null,
                null,
                seed.getBillingType()));
    }

    private String createExternal(String token, String name, LocalDate engagementEnd, int experienceYears)
            throws Exception {
        return createExternal(token, name, engagementEnd, experienceYears, SEED_REGION_ID);
    }

    private String createExternal(String token, String name, LocalDate engagementEnd, int experienceYears, UUID regionId)
            throws Exception {
        return json(mockMvc.perform(post("/api/v1/resources")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body(b -> {
                            b.put("regionId", regionId.toString());
                            b.put("resourceType", "CONTRACTOR");
                            b.put("fullName", name);
                            b.put("capacityHoursPerWeek", 40);
                            b.put("costRate", 1000);
                            b.put("billingRate", 2000);
                            b.put("engagementEndDate", engagementEnd.toString());
                            ObjectNode profile = b.putObject("profile");
                            profile.put("engagementStartDate", LocalDate.now().minusDays(60).toString());
                            profile.put("experienceYears", experienceYears);
                            profile.put("location", "Pune");
                        })))
                .andExpect(status().isOk())
                .andReturn()).at("/data/id").asText();
    }

    private ResultActions allocate(String token, String resourceId, UUID projectId, LocalDate start, LocalDate end, int pct)
            throws Exception {
        return mockMvc.perform(post("/api/v1/allocations")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(body(b -> {
                    b.put("projectId", projectId.toString());
                    b.put("resourceId", resourceId);
                    b.put("startDate", start.toString());
                    b.put("endDate", end.toString());
                    b.put("allocationPercentage", pct);
                    b.put("status", "ACTIVE");
                })));
    }

    private java.util.List<String> ids(
            org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder request, String token)
            throws Exception {
        JsonNode data = json(mockMvc.perform(request.header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andReturn()).at("/data");
        JsonNode list = data.has("resources") ? data.get("resources") : data;
        java.util.List<String> ids = new java.util.ArrayList<>();
        list.forEach(n -> ids.add(n.get("id").asText()));
        return ids;
    }

    private static Map<String, JsonNode> rowsById(JsonNode rows) {
        Map<String, JsonNode> map = new java.util.HashMap<>();
        rows.forEach(r -> map.put(r.get("id").asText(), r));
        return map;
    }

    private String body(Consumer<ObjectNode> fill) throws Exception {
        ObjectNode node = objectMapper.createObjectNode();
        fill.accept(node);
        return objectMapper.writeValueAsString(node);
    }

    private JsonNode json(MvcResult result) throws Exception {
        return objectMapper.readTree(result.getResponse().getContentAsString());
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
