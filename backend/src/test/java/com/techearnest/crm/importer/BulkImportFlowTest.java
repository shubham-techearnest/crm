package com.techearnest.crm.importer;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.techearnest.crm.auth.api.dto.LoginRequest;
import java.util.Map;
import java.util.UUID;
import org.hamcrest.Matchers;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;

@SpringBootTest
@AutoConfigureMockMvc
class BulkImportFlowTest {

    private static final String PUNE_REGION_ID = "22222222-2222-4222-8222-000000000011";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    private String token;
    private String unique;

    @BeforeEach
    void setUp() throws Exception {
        token = login("orgadmin@example.com");
        unique = UUID.randomUUID().toString().substring(0, 8);
    }

    @Test
    void importsRelatedRecordsAcrossModulesUsingNamesInsteadOfIds() throws Exception {
        String accountA = "Import Acct A " + unique;
        String accountB = "Import Acct B " + unique;

        post("accounts",
                Map.of("name", accountA, "accountType", "customer", "billingAddress", "12 MG Road, Pune"),
                Map.of("name", accountB),
                Map.of("name", accountA.toUpperCase()),
                Map.of("name", "Bad Type " + unique, "accountType", "Galaxy"))
                .andExpect(jsonPath("$.data.imported").value(2))
                .andExpect(jsonPath("$.data.skipped").value(1))
                .andExpect(jsonPath("$.data.failed").value(1))
                .andExpect(jsonPath("$.data.issues[1].reason", Matchers.containsString("account type")));

        post("contacts",
                Map.of("accountName", accountA, "firstName", "Asha", "lastName", "Rao",
                        "email", "asha." + unique + "@example.com"),
                Map.of("accountName", "No Such Account " + unique, "firstName", "X", "lastName", "Y"),
                Map.of("accountName", accountB, "firstName", "Only"))
                .andExpect(jsonPath("$.data.imported").value(1))
                .andExpect(jsonPath("$.data.failed").value(2))
                .andExpect(jsonPath("$.data.issues[0].reason", Matchers.containsString("was not found")))
                .andExpect(jsonPath("$.data.issues[1].reason", Matchers.containsString("Last name")));

        post("deals",
                Map.of("accountName", accountA, "name", "Big deal " + unique, "stage", "Proposal",
                        "value", "2,50,000", "contactEmail", "asha." + unique + "@example.com"),
                Map.of("accountName", accountA, "name", "Bad date " + unique, "expectedCloseDate", "31/31/2026"))
                .andExpect(jsonPath("$.data.imported").value(1))
                .andExpect(jsonPath("$.data.issues[0].index").value(1));

        String code = "IMP-" + unique;
        post("projects",
                Map.of("accountName", accountB, "name", "Rollout " + unique, "projectCode", code,
                        "billingType", "hourly", "startDate", "2026-01-01", "endDate", "2026-06-30"),
                Map.of("accountName", accountB, "name", "Clone", "projectCode", code))
                .andExpect(jsonPath("$.data.imported").value(1))
                .andExpect(jsonPath("$.data.skipped").value(1));

        post("invoices",
                Map.of("reference", "INV-1", "accountName", accountB, "projectCode", code,
                        "lineDescription", "Design", "quantity", "2", "unitPrice", "1000"),
                Map.of("reference", "INV-1", "lineDescription", "Build", "quantity", "3", "unitPrice", "500"),
                Map.of("accountName", accountA, "lineDescription", "Support", "quantity", "1"))
                .andExpect(jsonPath("$.data.total").value(3))
                .andExpect(jsonPath("$.data.imported").value(2))
                .andExpect(jsonPath("$.data.failed").value(1))
                .andExpect(jsonPath("$.data.issues[0].index").value(2));

        post("resources",
                Map.of("employeeCode", "EMP-" + unique, "designation", "Engineer", "resourceType", "contractor",
                        "capacityHoursPerWeek", "40"),
                Map.of("designation", "Nobody"))
                .andExpect(jsonPath("$.data.imported").value(1))
                .andExpect(jsonPath("$.data.issues[0].reason", Matchers.containsString("employee code")));

        post("purchase-orders",
                Map.of("poNumber", "PO-" + unique, "vendorName", "Missing Vendor " + unique,
                        "itemDescription", "Laptops", "quantity", "2", "unitPrice", "50000"))
                .andExpect(jsonPath("$.data.failed").value(1))
                .andExpect(jsonPath("$.data.issues[0].reason", Matchers.containsString("Vendor")));
    }

    @Test
    void schemaListsTargetFieldsWithTypesAndStudioLabels() throws Exception {
        mockMvc.perform(get("/api/v1/imports/contacts/schema").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.customFieldsSupported").value(false))
                .andExpect(jsonPath("$.data.fields[?(@.key == 'firstName')].required").value(true))
                .andExpect(jsonPath("$.data.fields[?(@.key == 'status')].type").value("ENUM"))
                .andExpect(jsonPath("$.data.fields[?(@.key == 'status')].options[0]").value("ACTIVE"));

        mockMvc.perform(get("/api/v1/imports/leads/schema").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.usesRegion").value(true))
                .andExpect(jsonPath("$.data.fields[?(@.key == 'noOfEmployees')].type").value("INTEGER"));

        mockMvc.perform(get("/api/v1/imports/invoices/schema").header("Authorization", "Bearer " + token))
                .andExpect(jsonPath("$.data.groupKey").value("reference"))
                .andExpect(jsonPath("$.data.fields[?(@.key == 'accountName')].groupHeader").value(true));
    }

    @Test
    void validateReportsRowOutcomesWithoutSavingAnything() throws Exception {
        String account = "Dry Run Acct " + unique;
        ObjectNode body = body(Map.of("name", account), Map.of("name", "Bad " + unique, "accountType", "Galaxy"));
        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .post("/api/v1/imports/accounts/validate")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.dryRun").value(true))
                .andExpect(jsonPath("$.data.imported").value(1))
                .andExpect(jsonPath("$.data.failed").value(1));

        post("contacts", Map.of("accountName", account, "firstName", "A", "lastName", "B"))
                .andExpect(jsonPath("$.data.imported").value(0))
                .andExpect(jsonPath("$.data.issues[0].reason", Matchers.containsString("was not found")));

        post("leads",
                Map.of("firstName", "Lead", "lastName", "Imported " + unique, "noOfEmployees", "25",
                        "emailOptOut", "Yes", "status", "Contacted"),
                Map.of("lastName", "Bad " + unique, "noOfEmployees", "2.5"))
                .andExpect(jsonPath("$.data.imported").value(1))
                .andExpect(jsonPath("$.data.issues[0].reason", Matchers.containsString("whole number")));
    }

    @Test
    void rejectsUnknownModulesAndUsersWithoutPermission() throws Exception {
        mockMvc.perform(request("widgets", token, Map.of("name", "x")))
                .andExpect(status().isNotFound());

        String employee = login("employee@example.com");
        mockMvc.perform(request("accounts", employee, Map.of("name", "x")))
                .andExpect(status().isForbidden());
    }

    @SafeVarargs
    private ResultActions post(String module, Map<String, String>... rows) throws Exception {
        return mockMvc.perform(request(module, token, rows)).andExpect(status().isOk());
    }

    @SafeVarargs
    private org.springframework.test.web.servlet.RequestBuilder request(
            String module, String bearer, Map<String, String>... rows) throws Exception {
        return org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/v1/imports/" + module)
                .header("Authorization", "Bearer " + bearer)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(body(rows)));
    }

    @SafeVarargs
    private ObjectNode body(Map<String, String>... rows) {
        ObjectNode body = objectMapper.createObjectNode();
        body.put("defaultRegionId", PUNE_REGION_ID);
        body.put("skipDuplicates", true);
        ArrayNode array = body.putArray("rows");
        for (Map<String, String> row : rows) {
            array.add(objectMapper.valueToTree(row));
        }
        return body;
    }

    private String login(String email) throws Exception {
        MvcResult login = mockMvc.perform(
                        org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/v1/auth/login")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(new LoginRequest(email, "ChangeMe!123"))))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(login.getResponse().getContentAsString()).at("/data/accessToken").asText();
    }
}
