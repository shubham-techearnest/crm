package com.techearnest.crm.resource;

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

@SpringBootTest
@AutoConfigureMockMvc
class ResourceFlowTest {

    private static final UUID SEED_RESOURCE_ID = UUID.fromString("bbbbbbb1-bbbb-4bbb-8bbb-000000000001");
    private static final UUID SEED_PROJECT_ID = UUID.fromString("99999999-9999-4999-8999-000000000001");

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void resourceListUtilizationRatesAndOverAllocation() throws Exception {
        String mgrToken = login("resource.mgr@example.com");

        MvcResult listResult = mockMvc.perform(get("/api/v1/resources").header("Authorization", "Bearer " + mgrToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andReturn();
        JsonNode resources = objectMapper.readTree(listResult.getResponse().getContentAsString()).at("/data");
        assertThat(resources.isArray()).isTrue();
        boolean found = false;
        for (JsonNode node : resources) {
            if (SEED_RESOURCE_ID.toString().equals(node.path("id").asText())
                    || "EMP-1001".equals(node.path("employeeCode").asText())) {
                found = true;
                break;
            }
        }
        assertThat(found).as("seeded EMP-1001 should appear in resource list").isTrue();

        mockMvc.perform(get("/api/v1/resources/" + SEED_RESOURCE_ID + "/utilization")
                        .param("periodStart", "2026-09-01")
                        .param("periodEnd", "2026-09-30")
                        .header("Authorization", "Bearer " + mgrToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.resourceId").value(SEED_RESOURCE_ID.toString()))
                .andExpect(jsonPath("$.data.allocatedHours").isNumber())
                .andExpect(jsonPath("$.data.capacityHours").isNumber());

        MvcResult mgrGet = mockMvc.perform(get("/api/v1/resources/" + SEED_RESOURCE_ID)
                        .header("Authorization", "Bearer " + mgrToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.costRate").value(1200))
                .andExpect(jsonPath("$.data.billingRate").value(2500))
                .andReturn();
        assertThat(mgrGet.getResponse().getContentAsString()).contains("costRate");

        String employeeToken = login("employee@example.com");
        mockMvc.perform(get("/api/v1/resources/" + SEED_RESOURCE_ID)
                        .header("Authorization", "Bearer " + employeeToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.costRate").doesNotExist())
                .andExpect(jsonPath("$.data.billingRate").doesNotExist());

        mockMvc.perform(get("/api/v1/auth/me").header("Authorization", "Bearer " + employeeToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.resourceId").value(SEED_RESOURCE_ID.toString()));

        String pmToken = login("pm@example.com");
        ObjectNode overAlloc = overAllocationBody();
        mockMvc.perform(post("/api/v1/allocations")
                        .header("Authorization", "Bearer " + pmToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(overAlloc)))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.success").value(false));

        mockMvc.perform(post("/api/v1/allocations")
                        .header("Authorization", "Bearer " + mgrToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(overAlloc)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.warning").value("OVER_ALLOCATED"));
    }

    private ObjectNode overAllocationBody() {
        ObjectNode body = objectMapper.createObjectNode();
        body.put("projectId", SEED_PROJECT_ID.toString());
        body.put("resourceId", SEED_RESOURCE_ID.toString());
        body.put("startDate", "2026-09-01");
        body.put("endDate", "2026-09-30");
        body.put("allocatedHours", 500);
        body.put("allocationPercentage", 200);
        body.put("role", "Overbooked Temp");
        body.put("status", "ACTIVE");
        return body;
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
