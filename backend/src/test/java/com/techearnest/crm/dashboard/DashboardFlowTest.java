package com.techearnest.crm.dashboard;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
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
class DashboardFlowTest {

    private static final UUID PUNE_REGION = UUID.fromString("22222222-2222-4222-8222-000000000011");

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void orgAdminSeesOrganizationDashboardAndSearch() throws Exception {
        String token = login("orgadmin@example.com");

        MvcResult dash = mockMvc.perform(get("/api/v1/dashboards/organization")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.title").value("Organization"))
                .andExpect(jsonPath("$.data.cards").isArray())
                .andReturn();

        JsonNode cards = objectMapper.readTree(dash.getResponse().getContentAsString()).at("/data/cards");
        assertThat(cards.size()).isGreaterThanOrEqualTo(4);
        boolean foundLeads = false;
        for (JsonNode card : cards) {
            if ("Leads".equals(card.path("name").asText())) {
                foundLeads = true;
                assertThat(card.path("value").asDouble()).isGreaterThanOrEqualTo(1.0);
            }
        }
        assertThat(foundLeads).isTrue();

        mockMvc.perform(get("/api/v1/search")
                        .param("q", "Horizon")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.results").isArray())
                .andExpect(jsonPath("$.data.results[0].title").isNotEmpty());
    }

    @Test
    void regionDashboardRequiresRegionAndRespectsScope() throws Exception {
        String token = login("pune.admin@example.com");

        mockMvc.perform(get("/api/v1/dashboards/region").header("Authorization", "Bearer " + token))
                .andExpect(status().isUnprocessableEntity());

        mockMvc.perform(get("/api/v1/dashboards/region")
                        .param("regionId", PUNE_REGION.toString())
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.title").value("Region"));

        mockMvc.perform(get("/api/v1/dashboards/organization").header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden());
    }

    @Test
    void employeeDashboardIsSelfScoped() throws Exception {
        String token = login("employee@example.com");

        mockMvc.perform(get("/api/v1/dashboards/employee").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.title").value("Employee"))
                .andExpect(jsonPath("$.data.cards").isArray());

        mockMvc.perform(get("/api/v1/dashboards/organization").header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden());
    }

    @Test
    void salesAndProjectDashboardsAvailableToEntitledRoles() throws Exception {
        String salesToken = login("sales.manager@example.com");
        mockMvc.perform(get("/api/v1/dashboards/sales").header("Authorization", "Bearer " + salesToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.title").value("Sales"));

        String pmToken = login("pm@example.com");
        mockMvc.perform(get("/api/v1/dashboards/project").header("Authorization", "Bearer " + pmToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.title").value("Projects"));
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
