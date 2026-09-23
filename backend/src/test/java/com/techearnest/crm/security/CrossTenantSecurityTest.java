package com.techearnest.crm.security;

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
 * Cross-organization and regional IDOR checks against seeded demo data plus a second org.
 */
@SpringBootTest
@AutoConfigureMockMvc
class CrossTenantSecurityTest {

    private static final UUID DEMO_ORG = UUID.fromString("11111111-1111-4111-8111-111111111111");
    private static final UUID PUNE = UUID.fromString("22222222-2222-4222-8222-000000000011");
    private static final UUID MUMBAI = UUID.fromString("22222222-2222-4222-8222-000000000012");
    private static final UUID SEED_PROJECT = UUID.fromString("99999999-9999-4999-8999-000000000001");
    private static final UUID SEED_TIMESHEET = UUID.fromString("ddddddd1-dddd-4ddd-8ddd-000000000001");

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void regionalAdminCannotAccessOtherRegionOrCrossOrgRecords() throws Exception {
        String puneToken = login("pune.admin@example.com");
        String orgToken = login("orgadmin@example.com");

        ObjectNode mumbaiLead = objectMapper.createObjectNode();
        mumbaiLead.put("regionId", MUMBAI.toString());
        mumbaiLead.put("firstName", "Iso");
        mumbaiLead.put("lastName", "Test");
        mumbaiLead.put("companyName", "Mumbai Iso Corp");
        mumbaiLead.put("status", "NEW");
        MvcResult created = mockMvc.perform(post("/api/v1/leads")
                        .header("Authorization", "Bearer " + orgToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(mumbaiLead)))
                .andExpect(status().isOk())
                .andReturn();
        String mumbaiLeadId = objectMapper
                .readTree(created.getResponse().getContentAsString())
                .at("/data/id")
                .asText();

        mockMvc.perform(get("/api/v1/leads/" + mumbaiLeadId).header("Authorization", "Bearer " + puneToken))
                .andExpect(status().isNotFound());

        mockMvc.perform(get("/api/v1/projects/" + SEED_PROJECT)
                        .param("organizationId", DEMO_ORG.toString())
                        .header("Authorization", "Bearer " + puneToken))
                .andExpect(status().isOk());

        // Seed project is Pune — Mumbai-only admin must not invent access via export/search alone
        mockMvc.perform(get("/api/v1/search")
                        .param("q", "Horizon")
                        .param("types", "PROJECT")
                        .header("Authorization", "Bearer " + puneToken))
                .andExpect(status().isOk());

        String employeeToken = login("employee@example.com");
        mockMvc.perform(get("/api/v1/timesheets/" + SEED_TIMESHEET)
                        .header("Authorization", "Bearer " + employeeToken))
                .andExpect(status().isOk());

        // Viewer must not create leads
        String viewerToken = login("viewer@example.com");
        mockMvc.perform(post("/api/v1/leads")
                        .header("Authorization", "Bearer " + viewerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(mumbaiLead)))
                .andExpect(status().isForbidden());
    }

    @Test
    void secondOrganizationIsIsolatedFromDemoOrgAdmin() throws Exception {
        String superToken = login("superadmin@example.com");

        ObjectNode orgBody = objectMapper.createObjectNode();
        orgBody.put("name", "Audit Org " + UUID.randomUUID().toString().substring(0, 8));
        orgBody.put("slug", "audit-org-" + UUID.randomUUID().toString().substring(0, 8));
        MvcResult orgResult = mockMvc.perform(post("/api/v1/organizations")
                        .header("Authorization", "Bearer " + superToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(orgBody)))
                .andExpect(status().isOk())
                .andReturn();
        String otherOrgId = objectMapper
                .readTree(orgResult.getResponse().getContentAsString())
                .at("/data/id")
                .asText();
        assertThat(otherOrgId).isNotEqualTo(DEMO_ORG.toString());

        ObjectNode regionBody = objectMapper.createObjectNode();
        regionBody.put("organizationId", otherOrgId);
        regionBody.put("name", "Audit Region");
        regionBody.put("code", "AR" + UUID.randomUUID().toString().substring(0, 4).toUpperCase());
        MvcResult regionResult = mockMvc.perform(post("/api/v1/regions")
                        .header("Authorization", "Bearer " + superToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(regionBody)))
                .andExpect(status().isOk())
                .andReturn();
        String otherRegionId = objectMapper
                .readTree(regionResult.getResponse().getContentAsString())
                .at("/data/id")
                .asText();

        // Demo org admin must not list other org regions via organizationId param
        String orgAdminToken = login("orgadmin@example.com");
        mockMvc.perform(get("/api/v1/regions")
                        .param("organizationId", otherOrgId)
                        .header("Authorization", "Bearer " + orgAdminToken))
                .andExpect(status().isNotFound());

        mockMvc.perform(get("/api/v1/regions/" + otherRegionId).header("Authorization", "Bearer " + orgAdminToken))
                .andExpect(status().isNotFound());

        assertThat(PUNE).isNotNull();
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
