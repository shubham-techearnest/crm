package com.techearnest.crm;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.greaterThanOrEqualTo;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.techearnest.crm.auth.api.dto.LoginRequest;
import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.UUID;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

/**
 * Phase 11 business workflow UAT scenarios executed against the live API surface.
 */
@SpringBootTest
@AutoConfigureMockMvc
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class BusinessWorkflowUatIntegrationTest {

    private static final UUID PUNE = UUID.fromString("22222222-2222-4222-8222-000000000011");
    private static final UUID MUMBAI = UUID.fromString("22222222-2222-4222-8222-000000000012");
    private static final UUID SALES_EXEC = UUID.fromString("77777777-7777-4777-8777-000000000005");
    private static final UUID PM_USER = UUID.fromString("77777777-7777-4777-8777-000000000006");
    private static final UUID SEED_RESOURCE = UUID.fromString("bbbbbbb1-bbbb-4bbb-8bbb-000000000001");
    private static final String PASSWORD = "ChangeMe!123";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    @Order(1)
    void scenario1_newSalesLeadLifecycle() throws Exception {
        String token = login("sales.exec@example.com");
        String suffix = unique();

        ObjectNode leadBody = objectMapper.createObjectNode();
        leadBody.put("regionId", PUNE.toString());
        leadBody.put("firstName", "Priya");
        leadBody.put("lastName", "Mehta");
        leadBody.put("companyName", "UAT Horizon " + suffix);
        leadBody.put("email", "priya.uat+" + suffix + "@example.com");
        leadBody.put("status", "NEW");
        leadBody.put("source", "WEBSITE");
        MvcResult created = mockMvc.perform(post("/api/v1/leads")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(leadBody)))
                .andExpect(status().isOk())
                .andReturn();
        String leadId = id(created);

        ObjectNode assign = objectMapper.createObjectNode();
        assign.put("ownerId", SALES_EXEC.toString());
        mockMvc.perform(post("/api/v1/leads/" + leadId + "/assign")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(assign)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.ownerId").value(SALES_EXEC.toString()));

        ObjectNode followUp = objectMapper.createObjectNode();
        followUp.put("type", "CALL");
        followUp.put("subject", "Intro call " + suffix);
        followUp.put("status", "OPEN");
        followUp.put("relatedEntityType", "LEAD");
        followUp.put("relatedEntityId", leadId);
        followUp.put("regionId", PUNE.toString());
        String activityId = id(postOk("/api/v1/activities", token, followUp));
        mockMvc.perform(get("/api/v1/activities/" + activityId).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());

        ObjectNode contacted = objectMapper.createObjectNode();
        contacted.put("status", "CONTACTED");
        mockMvc.perform(put("/api/v1/leads/" + leadId)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(contacted)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("CONTACTED"));

        ObjectNode qualified = objectMapper.createObjectNode();
        qualified.put("status", "QUALIFIED");
        mockMvc.perform(put("/api/v1/leads/" + leadId)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(qualified)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("QUALIFIED"));

        mockMvc.perform(get("/api/v1/activities")
                        .param("relatedEntityType", "LEAD")
                        .param("relatedEntityId", leadId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(greaterThanOrEqualTo(1)));
    }

    @Test
    @Order(2)
    void scenario2_leadConversionNoDuplicates() throws Exception {
        String token = login("sales.exec@example.com");
        String suffix = unique();
        String company = "UAT DupCo " + suffix;
        String email = "dup.contact+" + suffix + "@example.com";

        ObjectNode firstLead = baseLead(company, email, "Asha", "One");
        String lead1 = id(postOk("/api/v1/leads", token, firstLead));

        ObjectNode convert1 = convertBody();
        MvcResult c1 = postOk("/api/v1/leads/" + lead1 + "/convert", token, convert1);
        JsonNode data1 = data(c1);
        String accountId = data1.get("accountId").asText();
        String contactId = data1.get("contactId").asText();
        String dealId = data1.get("dealId").asText();

        ObjectNode secondLead = baseLead(company, email, "Asha", "Two");
        String lead2 = id(postOk("/api/v1/leads", token, secondLead));
        MvcResult c2 = postOk("/api/v1/leads/" + lead2 + "/convert", token, convertBody());
        JsonNode data2 = data(c2);

        assertThat(data2.get("accountId").asText()).isEqualTo(accountId);
        assertThat(data2.get("contactId").asText()).isEqualTo(contactId);
        assertThat(data2.get("dealId").asText()).isNotEqualTo(dealId);

        mockMvc.perform(get("/api/v1/accounts/" + accountId).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.regionId").value(PUNE.toString()));
        mockMvc.perform(get("/api/v1/deals/" + dealId).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.accountId").value(accountId))
                .andExpect(jsonPath("$.data.ownerId").value(SALES_EXEC.toString()));
    }

    @Test
    @Order(3)
    void scenario3_salesPipelineAndDashboard() throws Exception {
        String token = login("sales.exec@example.com");
        String orgToken = login("orgadmin@example.com");
        String suffix = unique();
        String leadId = id(postOk("/api/v1/leads", token, baseLead("Pipe Co " + suffix, "pipe+" + suffix + "@ex.com", "Raj", "Pipe")));
        String dealId = data(postOk("/api/v1/leads/" + leadId + "/convert", token, convertBody())).get("dealId").asText();

        for (String stage : new String[] {
            "QUALIFICATION", "REQUIREMENT", "PROPOSAL", "NEGOTIATION", "WON"
        }) {
            ObjectNode body = objectMapper.createObjectNode();
            body.put("toStage", stage);
            mockMvc.perform(post("/api/v1/deals/" + dealId + "/stage")
                            .header("Authorization", "Bearer " + token)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(body)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.stage").value(stage));
        }

        mockMvc.perform(get("/api/v1/dashboards/sales").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.cards").isArray());
        mockMvc.perform(get("/api/v1/dashboards/organization").header("Authorization", "Bearer " + orgToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.cards").isArray());

        String lostLead = id(postOk(
                "/api/v1/leads",
                token,
                baseLead("Lost Co " + suffix, "lost+" + suffix + "@ex.com", "Lost", "Deal")));
        String lostDeal = data(postOk("/api/v1/leads/" + lostLead + "/convert", token, convertBody()))
                .get("dealId")
                .asText();
        ObjectNode lost = objectMapper.createObjectNode();
        lost.put("toStage", "LOST");
        lost.put("lostReason", "Budget");
        mockMvc.perform(post("/api/v1/deals/" + lostDeal + "/stage")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(lost)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.stage").value("LOST"));
    }

    @Test
    @Order(4)
    void scenario4_dealToProjectRelationships() throws Exception {
        String sales = login("sales.exec@example.com");
        String orgAdmin = login("orgadmin@example.com");
        String suffix = unique();
        String leadId = id(postOk("/api/v1/leads", sales, baseLead("ProjRel " + suffix, "projrel+" + suffix + "@ex.com", "Kim", "Rel")));
        JsonNode converted = data(postOk("/api/v1/leads/" + leadId + "/convert", sales, convertBody()));
        String accountId = converted.get("accountId").asText();
        String contactId = converted.get("contactId").asText();
        String dealId = converted.get("dealId").asText();

        ObjectNode won = objectMapper.createObjectNode();
        won.put("toStage", "WON");
        postOk("/api/v1/deals/" + dealId + "/stage", sales, won);

        MvcResult projectResult = mockMvc.perform(post("/api/v1/deals/" + dealId + "/create-project")
                        .header("Authorization", "Bearer " + orgAdmin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode project = data(projectResult);
        assertThat(project.get("dealId").asText()).isEqualTo(dealId);
        assertThat(project.get("accountId").asText()).isEqualTo(accountId);

        mockMvc.perform(get("/api/v1/deals/" + dealId).header("Authorization", "Bearer " + sales))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.contactId").value(contactId));
    }

    @Test
    @Order(5)
    void scenario5_projectExecutionProgress() throws Exception {
        String orgAdmin = login("orgadmin@example.com");
        String pm = login("pm@example.com");
        String suffix = unique();
        String projectId = createWonProject(orgAdmin, suffix);

        ObjectNode milestone = objectMapper.createObjectNode();
        milestone.put("name", "Delivery");
        milestone.put("status", "ACTIVE");
        String milestoneId = id(postOk("/api/v1/projects/" + projectId + "/milestones", orgAdmin, milestone));

        ObjectNode task = objectMapper.createObjectNode();
        task.put("name", "Build module");
        task.put("status", "IN_PROGRESS");
        task.put("milestoneId", milestoneId);
        task.put("completionPercentage", 40);
        String taskId = id(postOk("/api/v1/projects/" + projectId + "/tasks", orgAdmin, task));

        ObjectNode subtask = objectMapper.createObjectNode();
        subtask.put("name", "Unit tests");
        subtask.put("status", "COMPLETED");
        subtask.put("parentTaskId", taskId);
        subtask.put("milestoneId", milestoneId);
        subtask.put("completionPercentage", 100);
        postOk("/api/v1/projects/" + projectId + "/tasks", orgAdmin, subtask);

        mockMvc.perform(get("/api/v1/projects/" + projectId).header("Authorization", "Bearer " + orgAdmin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.progressPercent").isNumber());
        // PM is assigned as project manager on create — must see the project under TEAM scope.
        mockMvc.perform(get("/api/v1/projects/" + projectId).header("Authorization", "Bearer " + pm))
                .andExpect(status().isOk());
    }

    @Test
    @Order(6)
    void scenario6_resourceAllocationLevels() throws Exception {
        String orgAdmin = login("orgadmin@example.com");
        String mgr = login("resource.mgr@example.com");
        String suffix = unique();
        String projectA = createWonProject(orgAdmin, "A-" + suffix);
        String projectB = createWonProject(orgAdmin, "B-" + suffix);

        LocalDate start = LocalDate.of(2029, 3, 1);
        LocalDate end = LocalDate.of(2029, 3, 31);

        allocate(mgr, projectA, 20, start, end); // under
        allocate(mgr, projectA, 40, start.plusMonths(1), end.plusMonths(1)); // normal-ish
        allocate(mgr, projectB, 80, start.plusMonths(2), end.plusMonths(2)); // near full

        ObjectNode over = allocationBody(projectB, 120, start.plusMonths(3), end.plusMonths(3));
        over.put("allocatedHours", 500);
        over.put("allocationPercentage", 200);
        over.put("dryRun", true);
        mockMvc.perform(post("/api/v1/allocations")
                        .header("Authorization", "Bearer " + mgr)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(over)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value(containsString("OVER")));

        // Persist over-allocation with override permission — warning must surface.
        over.put("dryRun", false);
        mockMvc.perform(post("/api/v1/allocations")
                        .header("Authorization", "Bearer " + mgr)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(over)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.warning").value("OVER_ALLOCATED"));

        mockMvc.perform(get("/api/v1/resources/" + SEED_RESOURCE + "/utilization")
                        .param("periodStart", start.toString())
                        .param("periodEnd", end.plusMonths(4).toString())
                        .header("Authorization", "Bearer " + mgr))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.utilizationPercent").isNumber());
    }

    @Test
    @Order(7)
    void scenario7_timesheetApprovesProjectHours() throws Exception {
        String orgAdmin = login("orgadmin@example.com");
        String mgr = login("resource.mgr@example.com");
        String employee = login("employee@example.com");
        String pm = login("pm@example.com");
        String suffix = unique();
        String projectId = createWonProject(orgAdmin, "TS-" + suffix);

        LocalDate start = LocalDate.of(2030, 1, 1);
        allocate(mgr, projectId, 50, start, start.plusDays(60));

        LocalDate monday = LocalDate.of(2030, 1, 7)
                .plusDays(Math.abs(suffix.hashCode() % 200) * 7L)
                .with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        ObjectNode sheet = objectMapper.createObjectNode();
        sheet.put("weekStartDate", monday.toString());
        String timesheetId = id(postOk("/api/v1/timesheets", employee, sheet));

        ObjectNode entry = objectMapper.createObjectNode();
        entry.put("projectId", projectId);
        entry.put("workDate", monday.plusDays(1).toString());
        entry.put("hours", 6);
        entry.put("billable", true);
        entry.put("description", "UAT delivery work");
        postOk("/api/v1/timesheets/" + timesheetId + "/entries", employee, entry);

        mockMvc.perform(post("/api/v1/timesheets/" + timesheetId + "/submit")
                        .header("Authorization", "Bearer " + employee))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/v1/timesheets/" + timesheetId + "/approve")
                        .header("Authorization", "Bearer " + pm))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("APPROVED"));

        MvcResult project = mockMvc.perform(get("/api/v1/projects/" + projectId).header("Authorization", "Bearer " + orgAdmin))
                .andExpect(status().isOk())
                .andReturn();
        BigDecimal actual = new BigDecimal(data(project).get("actualHours").asText());
        assertThat(actual).isGreaterThanOrEqualTo(new BigDecimal("6"));

        mockMvc.perform(get("/api/v1/notifications").header("Authorization", "Bearer " + employee))
                .andExpect(status().isOk());
    }

    @Test
    @Order(8)
    void scenario8_regionalAdminIsolation() throws Exception {
        String orgAdmin = login("orgadmin@example.com");
        String puneAdmin = login("pune.admin@example.com");
        String suffix = unique();

        ObjectNode mumbaiLead = baseLead("Mumbai Only " + suffix, "mum+" + suffix + "@ex.com", "Mum", "Lead");
        mumbaiLead.put("regionId", MUMBAI.toString());
        String mumbaiLeadId = id(postOk("/api/v1/leads", orgAdmin, mumbaiLead));

        mockMvc.perform(get("/api/v1/leads/" + mumbaiLeadId).header("Authorization", "Bearer " + puneAdmin))
                .andExpect(status().isNotFound());
        mockMvc.perform(get("/api/v1/leads").header("Authorization", "Bearer " + puneAdmin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[?(@.id=='" + mumbaiLeadId + "')]").doesNotExist());
        mockMvc.perform(get("/api/v1/search")
                        .param("q", "Mumbai Only " + suffix)
                        .header("Authorization", "Bearer " + puneAdmin))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/dashboards/region")
                        .param("regionId", MUMBAI.toString())
                        .header("Authorization", "Bearer " + puneAdmin))
                .andExpect(status().is4xxClientError());
        mockMvc.perform(get("/api/v1/leads/export").header("Authorization", "Bearer " + puneAdmin))
                .andExpect(status().isOk());
    }

    @Test
    @Order(9)
    void scenario9_organizationIsolation() throws Exception {
        String orgAdmin = login("orgadmin@example.com");
        String superAdmin = login("superadmin@example.com");
        String suffix = unique();

        ObjectNode otherOrg = objectMapper.createObjectNode();
        otherOrg.put("name", "UAT Org B " + suffix);
        otherOrg.put("slug", "uat-org-b-" + suffix);
        otherOrg.put("timezone", "Asia/Kolkata");
        otherOrg.put("locale", "en-IN");
        otherOrg.put("currencyCode", "INR");
        MvcResult orgCreated = mockMvc.perform(post("/api/v1/organizations")
                        .header("Authorization", "Bearer " + superAdmin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(otherOrg)))
                .andExpect(status().isOk())
                .andReturn();
        String otherOrgId = id(orgCreated);

        mockMvc.perform(get("/api/v1/organizations/" + otherOrgId).header("Authorization", "Bearer " + orgAdmin))
                .andExpect(status().is4xxClientError());

        String leadId = id(postOk("/api/v1/leads", orgAdmin, baseLead("Iso " + suffix, "iso+" + suffix + "@ex.com", "Iso", "Lead")));
        // Foreign org id on list should not widen scope for org-scoped user.
        mockMvc.perform(get("/api/v1/leads")
                        .param("organizationId", otherOrgId)
                        .header("Authorization", "Bearer " + orgAdmin))
                .andExpect(status().isNotFound());
        mockMvc.perform(get("/api/v1/leads/" + leadId)
                        .param("organizationId", otherOrgId)
                        .header("Authorization", "Bearer " + orgAdmin))
                .andExpect(status().isOk());
    }

    @Test
    @Order(10)
    void scenario10_roleMatrixSmoke() throws Exception {
        assertStatus("superadmin@example.com", get("/api/v1/organizations"), 200);
        assertStatus("orgadmin@example.com", get("/api/v1/users"), 200);
        assertStatus("pune.admin@example.com", get("/api/v1/leads"), 200);
        assertStatus("sales.manager@example.com", get("/api/v1/leads"), 200);
        assertStatus("sales.exec@example.com", get("/api/v1/leads"), 200);
        assertStatus("pm@example.com", get("/api/v1/projects"), 200);
        assertStatus("resource.mgr@example.com", get("/api/v1/resources"), 200);
        assertStatus("employee@example.com", get("/api/v1/timesheets"), 200);
        assertStatus("viewer@example.com", get("/api/v1/leads"), 200);

        // Viewer cannot create leads
        String viewer = login("viewer@example.com");
        mockMvc.perform(post("/api/v1/leads")
                        .header("Authorization", "Bearer " + viewer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                baseLead("Viewer Block", "viewer.block@ex.com", "No", "Create"))))
                .andExpect(status().isForbidden());

        // Sales manager can see team executive lead
        String exec = login("sales.exec@example.com");
        String manager = login("sales.manager@example.com");
        String leadId = id(postOk(
                "/api/v1/leads",
                exec,
                baseLead("Team Lead " + unique(), "team.lead+" + unique() + "@ex.com", "Team", "Lead")));
        mockMvc.perform(get("/api/v1/leads/" + leadId).header("Authorization", "Bearer " + manager))
                .andExpect(status().isOk());
    }

    private void assertStatus(String email, org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder req, int expected)
            throws Exception {
        mockMvc.perform(req.header("Authorization", "Bearer " + login(email))).andExpect(status().is(expected));
    }

    private String createWonProject(String orgToken, String suffix) throws Exception {
        String sales = login("sales.exec@example.com");
        String leadId = id(postOk(
                "/api/v1/leads",
                sales,
                baseLead("Win " + suffix, "win+" + suffix + "@ex.com", "Win", "Lead")));
        String dealId = data(postOk("/api/v1/leads/" + leadId + "/convert", sales, convertBody()))
                .get("dealId")
                .asText();
        ObjectNode won = objectMapper.createObjectNode();
        won.put("toStage", "WON");
        postOk("/api/v1/deals/" + dealId + "/stage", sales, won);
        ObjectNode projectBody = objectMapper.createObjectNode();
        projectBody.put("projectManagerId", PM_USER.toString());
        return id(postOk("/api/v1/deals/" + dealId + "/create-project", orgToken, projectBody));
    }

    private void allocate(String token, String projectId, int percent, LocalDate start, LocalDate end)
            throws Exception {
        postOk("/api/v1/allocations", token, allocationBody(projectId, percent, start, end));
    }

    private ObjectNode allocationBody(String projectId, int percent, LocalDate start, LocalDate end) {
        ObjectNode allocation = objectMapper.createObjectNode();
        allocation.put("projectId", projectId);
        allocation.put("resourceId", SEED_RESOURCE.toString());
        allocation.put("startDate", start.toString());
        allocation.put("endDate", end.toString());
        allocation.put("allocatedHours", percent);
        allocation.put("allocationPercentage", percent);
        allocation.put("role", "Engineer");
        allocation.put("status", "ACTIVE");
        return allocation;
    }

    private ObjectNode baseLead(String company, String email, String first, String last) {
        ObjectNode lead = objectMapper.createObjectNode();
        lead.put("regionId", PUNE.toString());
        lead.put("firstName", first);
        lead.put("lastName", last);
        lead.put("companyName", company);
        lead.put("email", email);
        lead.put("status", "QUALIFIED");
        return lead;
    }

    private ObjectNode convertBody() {
        ObjectNode convert = objectMapper.createObjectNode();
        convert.put("createAccount", true);
        convert.put("createContact", true);
        convert.put("createDeal", true);
        convert.put("dealStage", "NEW");
        convert.put("dealValue", 50000);
        return convert;
    }

    private MvcResult postOk(String path, String token, ObjectNode body) throws Exception {
        return mockMvc.perform(post(path)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isOk())
                .andReturn();
    }

    private JsonNode data(MvcResult result) throws Exception {
        return objectMapper.readTree(result.getResponse().getContentAsString()).at("/data");
    }

    private String id(MvcResult result) throws Exception {
        return data(result).get("id").asText();
    }

    private String unique() {
        return UUID.randomUUID().toString().substring(0, 8);
    }

    private String login(String email) throws Exception {
        MvcResult login = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new LoginRequest(email, PASSWORD))))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper
                .readTree(login.getResponse().getContentAsString())
                .at("/data/accessToken")
                .asText();
    }
}
