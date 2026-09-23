package com.techearnest.crm.metadata;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
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

        MvcResult list = mockMvc.perform(get("/api/v1/resources").header("Authorization", "Bearer " + orgAdmin))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode data = objectMapper.readTree(list.getResponse().getContentAsString()).at("/data");
        if (data.isArray() && !data.isEmpty()) {
            org.assertj.core.api.Assertions.assertThat(data.get(0).hasNonNull("costRate") || data.get(0).has("costRate"))
                    .isTrue();
        }

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
