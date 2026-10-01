package com.techearnest.crm.platform;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
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
class PlatformOrganizationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void provisionSuspendAndBlockLogin() throws Exception {
        String superToken = login("superadmin@example.com");
        String slug = "qa-org-" + UUID.randomUUID().toString().substring(0, 8);
        String adminEmail = "admin-" + slug + "@example.com";

        ObjectNode body = objectMapper.createObjectNode();
        body.put("name", "QA Org " + slug);
        body.put("slug", slug);
        body.put("timezone", "Asia/Kolkata");
        body.put("locale", "en-IN");
        body.put("currencyCode", "INR");
        body.put("defaultRegionName", "Head Office");
        body.put("defaultRegionCode", "HQ");
        body.put("adminEmail", adminEmail);
        body.put("adminPassword", "ChangeMe!123");
        body.put("adminFirstName", "Org");
        body.put("adminLastName", "Admin");

        MvcResult created = mockMvc.perform(post("/api/v1/platform/organizations")
                        .header("Authorization", "Bearer " + superToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.slug").value(slug))
                .andExpect(jsonPath("$.data.status").value("ACTIVE"))
                .andReturn();

        String orgId = objectMapper
                .readTree(created.getResponse().getContentAsString())
                .at("/data/id")
                .asText();

        mockMvc.perform(get("/api/v1/platform/organizations")
                        .header("Authorization", "Bearer " + superToken)
                        .param("search", slug))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].slug").value(slug));

        String adminToken = login(adminEmail);
        assertThat(adminToken).isNotBlank();

        mockMvc.perform(put("/api/v1/platform/organizations/" + orgId + "/status")
                        .header("Authorization", "Bearer " + superToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"SUSPENDED\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("SUSPENDED"));

        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new LoginRequest(adminEmail, "ChangeMe!123"))))
                .andExpect(status().isForbidden());

        mockMvc.perform(put("/api/v1/platform/organizations/" + orgId + "/status")
                        .header("Authorization", "Bearer " + superToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"ACTIVE\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("ACTIVE"));

        login(adminEmail);
    }

    @Test
    void modulesLimitTenantAccessAndPlatformManagesAclForOrg() throws Exception {
        String superToken = login("superadmin@example.com");
        String slug = "qa-mod-" + UUID.randomUUID().toString().substring(0, 8);
        String adminEmail = "admin-" + slug + "@example.com";

        ObjectNode body = objectMapper.createObjectNode();
        body.put("name", "QA Modules " + slug);
        body.put("slug", slug);
        body.put("timezone", "Asia/Kolkata");
        body.put("locale", "en-IN");
        body.put("currencyCode", "INR");
        body.put("defaultRegionName", "Head Office");
        body.put("defaultRegionCode", "HQ");
        body.put("adminEmail", adminEmail);
        body.put("adminPassword", "ChangeMe!123");
        body.put("adminFirstName", "Org");
        body.put("adminLastName", "Admin");
        body.putArray("modules").add("LEADS").add("USERS").add("ROLES");

        MvcResult created = mockMvc.perform(post("/api/v1/platform/organizations")
                        .header("Authorization", "Bearer " + superToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isOk())
                .andReturn();
        String orgId = objectMapper.readTree(created.getResponse().getContentAsString()).at("/data/id").asText();

        String adminToken = login(adminEmail);
        JsonNode me = objectMapper.readTree(mockMvc.perform(get("/api/v1/auth/me")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString());
        assertThat(me.at("/data/permissions").toString()).contains("LEAD_VIEW").doesNotContain("PROJECT_VIEW", "ACL_VIEW");

        mockMvc.perform(get("/api/v1/projects").header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/v1/metadata/table-acls").header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/v1/metadata/table-acls")
                        .header("Authorization", "Bearer " + superToken)
                        .header("X-Organization-Id", orgId))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/leads")
                        .header("Authorization", "Bearer " + superToken)
                        .header("X-Organization-Id", orgId))
                .andExpect(status().isForbidden());

        mockMvc.perform(put("/api/v1/platform/organizations/" + orgId + "/modules")
                        .header("Authorization", "Bearer " + superToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"enabledModules\":[\"USERS\",\"ROLES\",\"PROJECTS\"]}"))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/leads").header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/v1/projects").header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk());
    }

    @Test
    void orgAdminCannotProvisionOrganization() throws Exception {
        String token = login("orgadmin@example.com");
        ObjectNode body = objectMapper.createObjectNode();
        body.put("name", "Forbidden Org");
        body.put("slug", "forbidden-" + UUID.randomUUID().toString().substring(0, 8));
        body.put("timezone", "Asia/Kolkata");
        body.put("locale", "en-IN");
        body.put("currencyCode", "INR");
        body.put("defaultRegionName", "HQ");
        body.put("defaultRegionCode", "HQ");
        body.put("adminEmail", "x-" + UUID.randomUUID() + "@example.com");
        body.put("adminPassword", "ChangeMe!123");
        body.put("adminFirstName", "X");
        body.put("adminLastName", "Y");

        mockMvc.perform(post("/api/v1/platform/organizations")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isForbidden());
    }

    private String login(String email) throws Exception {
        MvcResult login = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new LoginRequest(email, "ChangeMe!123"))))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode tree = objectMapper.readTree(login.getResponse().getContentAsString());
        return tree.at("/data/accessToken").asText();
    }
}
