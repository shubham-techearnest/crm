package com.techearnest.crm.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.techearnest.crm.auth.api.dto.LoginRequest;
import java.util.HashSet;
import java.util.Set;
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
class AdminIsolationTest {

    private static final UUID PUNE_REGION_ID = UUID.fromString("22222222-2222-4222-8222-000000000011");
    private static final UUID MUMBAI_REGION_ID = UUID.fromString("22222222-2222-4222-8222-000000000012");

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void regionIsolationAndUserPermissionEnforcement() throws Exception {
        String orgAdminToken = login("orgadmin@example.com");

        MvcResult orgRegions = mockMvc.perform(get("/api/v1/regions").header("Authorization", "Bearer " + orgAdminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andReturn();

        Set<UUID> orgRegionIds = regionIds(orgRegions);
        assertThat(orgRegionIds).contains(PUNE_REGION_ID, MUMBAI_REGION_ID);

        String puneAdminToken = login("pune.admin@example.com");

        MvcResult puneRegions = mockMvc.perform(
                        get("/api/v1/regions").header("Authorization", "Bearer " + puneAdminToken))
                .andExpect(status().isOk())
                .andReturn();

        Set<UUID> puneVisible = regionIds(puneRegions);
        assertThat(puneVisible).contains(PUNE_REGION_ID);
        assertThat(puneVisible).doesNotContain(MUMBAI_REGION_ID);

        mockMvc.perform(get("/api/v1/regions/" + MUMBAI_REGION_ID)
                        .header("Authorization", "Bearer " + puneAdminToken))
                .andExpect(status().isNotFound());

        String employeeToken = login("employee@example.com");
        mockMvc.perform(get("/api/v1/users").header("Authorization", "Bearer " + employeeToken))
                .andExpect(status().isForbidden());
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

    private Set<UUID> regionIds(MvcResult result) throws Exception {
        JsonNode data = objectMapper.readTree(result.getResponse().getContentAsString()).at("/data");
        Set<UUID> ids = new HashSet<>();
        for (JsonNode node : data) {
            ids.add(UUID.fromString(node.get("id").asText()));
        }
        return ids;
    }
}
