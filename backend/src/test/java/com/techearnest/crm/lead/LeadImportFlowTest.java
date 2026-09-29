package com.techearnest.crm.lead;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.techearnest.crm.auth.api.dto.LoginRequest;
import com.techearnest.crm.lead.application.LeadImportService;
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
class LeadImportFlowTest {

    private static final String PUNE_REGION_ID = "22222222-2222-4222-8222-000000000011";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void importsValidRowsAndReportsInvalidOnesByIndex() throws Exception {
        String token = login("orgadmin@example.com");
        String unique = UUID.randomUUID().toString().substring(0, 8);
        String email = "import." + unique + "@example.com";

        ObjectNode body = objectMapper.createObjectNode();
        body.put("skipDuplicates", true);
        ArrayNode rows = body.putArray("rows");
        rows.add(row("Asha", "Rao", "Import Co " + unique, email).put("status", "Contacted").put("priority", "high"));
        rows.add(row("Bad", "Email", "Import Co " + unique, "not-an-email"));
        rows.add(row("Hot", "Status", "Import Co " + unique, null).put("status", "Hot"));
        rows.add(row("Dup", "Row", "Import Co " + unique, email.toUpperCase()));
        rows.add(row(null, null, null, null).put("phone", "+91-9000000000"));
        rows.add(row("Ravi", "Kumar", "Second Co " + unique, null).put("estimatedValue", 5000));

        mockMvc.perform(post("/api/v1/leads/import")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.total").value(6))
                .andExpect(jsonPath("$.data.imported").value(2))
                .andExpect(jsonPath("$.data.skipped").value(1))
                .andExpect(jsonPath("$.data.failed").value(3))
                .andExpect(jsonPath("$.data.issues[0].index").value(1))
                .andExpect(jsonPath("$.data.issues[0].outcome").value("FAILED"))
                .andExpect(jsonPath("$.data.issues[1].index").value(2))
                .andExpect(jsonPath("$.data.issues[2].index").value(3))
                .andExpect(jsonPath("$.data.issues[2].outcome").value("SKIPPED"))
                .andExpect(jsonPath("$.data.issues[3].index").value(4));

        ObjectNode again = objectMapper.createObjectNode();
        again.putArray("rows").add(row("Asha", "Rao", "Import Co " + unique, email));
        mockMvc.perform(post("/api/v1/leads/import")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(again)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.imported").value(0))
                .andExpect(jsonPath("$.data.skipped").value(1));
    }

    @Test
    void rejectsEmptyAndOversizedFiles() throws Exception {
        String token = login("orgadmin@example.com");
        ObjectNode empty = objectMapper.createObjectNode();
        empty.putArray("rows");
        mockMvc.perform(post("/api/v1/leads/import")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(empty)))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("IMPORT_EMPTY"));

        ObjectNode huge = objectMapper.createObjectNode();
        ArrayNode rows = huge.putArray("rows");
        for (int i = 0; i <= LeadImportService.MAX_ROWS; i++) {
            rows.add(row("X", "Y" + i, null, null));
        }
        mockMvc.perform(post("/api/v1/leads/import")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(huge)))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("IMPORT_LIMIT"));
    }

    @Test
    void usersWithoutImportPermissionAreForbidden() throws Exception {
        String token = login("employee@example.com");
        ObjectNode body = objectMapper.createObjectNode();
        body.putArray("rows").add(row("A", "B", "C", null));
        mockMvc.perform(post("/api/v1/leads/import")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isForbidden());
    }

    private ObjectNode row(String firstName, String lastName, String company, String email) {
        ObjectNode row = objectMapper.createObjectNode();
        row.put("regionId", PUNE_REGION_ID);
        if (firstName != null) row.put("firstName", firstName);
        if (lastName != null) row.put("lastName", lastName);
        if (company != null) row.put("companyName", company);
        if (email != null) row.put("email", email);
        return row;
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
