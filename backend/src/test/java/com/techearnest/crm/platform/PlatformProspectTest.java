package com.techearnest.crm.platform;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

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
class PlatformProspectTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void superAdminCanCrudAndFilterProspects() throws Exception {
        String token = login("superadmin@example.com");
        String name = "Prospect " + UUID.randomUUID().toString().substring(0, 8);

        ObjectNode body = objectMapper.createObjectNode();
        body.put("name", name);
        body.put("stage", "QUALIFIED");
        body.put("source", "WEBSITE");
        body.put("estimatedArr", 120000);

        mockMvc.perform(post("/api/v1/platform/prospects")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.name").value(name))
                .andExpect(jsonPath("$.data.stage").value("QUALIFIED"));

        mockMvc.perform(get("/api/v1/platform/prospects")
                        .header("Authorization", "Bearer " + token)
                        .param("stage", "QUALIFIED")
                        .param("search", name))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].name").value(name));

        ObjectNode query = objectMapper.createObjectNode();
        query.put("page", 0);
        query.put("size", 20);
        ObjectNode filter = query.putObject("filter");
        filter.put("op", "AND");
        var conditions = filter.putArray("conditions");
        ObjectNode leaf = conditions.addObject();
        leaf.put("field", "estimatedArr");
        leaf.put("operator", "GTE");
        leaf.put("value", 100000);

        mockMvc.perform(post("/api/v1/platform/prospects/query")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(query)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
    }

    @Test
    void orgAdminCannotAccessProspects() throws Exception {
        String token = login("orgadmin@example.com");
        mockMvc.perform(get("/api/v1/platform/prospects").header("Authorization", "Bearer " + token))
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
}
