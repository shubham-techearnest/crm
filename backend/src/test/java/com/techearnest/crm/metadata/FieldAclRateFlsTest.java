package com.techearnest.crm.metadata;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.techearnest.crm.auth.api.dto.LoginRequest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@SpringBootTest
@AutoConfigureMockMvc
class FieldAclRateFlsTest {

    private static final String SEED_RESOURCE_WITH_RATES = "bbbbbbb1-bbbb-4bbb-8bbb-000000000001";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void salesExecFieldAclHidesRates_orgAdminCanListResources() throws Exception {
        String sales = login("sales.exec@example.com");
        mockMvc.perform(get("/api/v1/metadata/field-acls/me")
                        .param("tableCode", "resource")
                        .header("Authorization", "Bearer " + sales))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.costRate").value("HIDDEN"))
                .andExpect(jsonPath("$.data.billingRate").value("HIDDEN"));

        String orgAdmin = login("orgadmin@example.com");
        mockMvc.perform(get("/api/v1/metadata/field-acls/me")
                        .param("tableCode", "resource")
                        .header("Authorization", "Bearer " + orgAdmin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.costRate").value("WRITE"));

        mockMvc.perform(get("/api/v1/resources").header("Authorization", "Bearer " + orgAdmin))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/resources/" + SEED_RESOURCE_WITH_RATES)
                        .header("Authorization", "Bearer " + orgAdmin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.costRate").isNotEmpty());

        mockMvc.perform(get("/api/v1/metadata/table-acls/me").header("Authorization", "Bearer " + orgAdmin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.project_task").exists());
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
