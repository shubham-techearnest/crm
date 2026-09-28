package com.techearnest.crm.security;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
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
class V2CrossTenantIsolationTest {

    private static final UUID MUMBAI_REGION_ID = UUID.fromString("22222222-2222-4222-8222-000000000012");
    private static final UUID RANDOM_LEAD_ID = UUID.fromString("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void v2ModulesEnforceRegionAndAudienceBoundaries() throws Exception {
        String puneAdminToken = login("pune.admin@example.com");
        String employeeToken = login("employee@example.com");
        String portalToken = portalLogin();

        mockMvc.perform(get("/api/v1/leads/" + RANDOM_LEAD_ID)
                        .header("Authorization", "Bearer " + puneAdminToken))
                .andExpect(status().isNotFound());

        mockMvc.perform(get("/api/v1/reports/spend").header("Authorization", "Bearer " + employeeToken))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/v1/regions/" + MUMBAI_REGION_ID)
                        .header("Authorization", "Bearer " + puneAdminToken))
                .andExpect(status().isNotFound());

        mockMvc.perform(get("/api/v1/leads").header("Authorization", "Bearer " + portalToken))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/v1/portal/projects").header("Authorization", "Bearer " + employeeToken))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/v1/portal/documents").header("Authorization", "Bearer " + portalToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
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

    private String portalLogin() throws Exception {
        MvcResult login = mockMvc.perform(post("/api/v1/portal/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(
                                """
                                {"email":"portal@horizon-retail.example.com","password":"ChangeMe!123"}
                                """))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper
                .readTree(login.getResponse().getContentAsString())
                .at("/data/accessToken")
                .asText();
    }
}
