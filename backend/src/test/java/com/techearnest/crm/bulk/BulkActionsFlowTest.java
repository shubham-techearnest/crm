package com.techearnest.crm.bulk;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
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
import org.springframework.test.web.servlet.ResultActions;

@SpringBootTest
@AutoConfigureMockMvc
class BulkActionsFlowTest {

    private static final String PUNE_REGION_ID = "22222222-2222-4222-8222-000000000011";
    private static final String SALES_EXEC_USER_ID = "77777777-7777-4777-8777-000000000005";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void bulkAssignAccountsReportsPerRecordFailuresAndValidatesOwner() throws Exception {
        String admin = login("orgadmin@example.com");
        String employee = login("employee@example.com");
        String first = createAccount(admin);
        String second = createAccount(admin);
        String missing = UUID.randomUUID().toString();

        perform(admin, "/api/v1/accounts/bulk-assign", assignBody(SALES_EXEC_USER_ID, first, second, missing, first))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.succeeded").value(2))
                .andExpect(jsonPath("$.data.failed").value(1))
                .andExpect(jsonPath("$.data.failures[0].id").value(missing));

        mockMvc.perform(get("/api/v1/accounts/" + second).header("Authorization", "Bearer " + admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.ownerId").value(SALES_EXEC_USER_ID));

        perform(admin, "/api/v1/accounts/bulk-assign", assignBody(UUID.randomUUID().toString(), first))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("INVALID_OWNER"));

        perform(employee, "/api/v1/accounts/bulk-assign", assignBody(SALES_EXEC_USER_ID, first))
                .andExpect(status().isForbidden());

        String[] tooMany = new String[101];
        for (int i = 0; i < tooMany.length; i++) {
            tooMany[i] = UUID.randomUUID().toString();
        }
        perform(admin, "/api/v1/accounts/bulk-assign", assignBody(SALES_EXEC_USER_ID, tooMany))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("BULK_LIMIT"));
    }

    @Test
    void bulkTaskStatusCompletesTasksAndRejectsUnknownStatus() throws Exception {
        String admin = login("orgadmin@example.com");
        String accountId = createAccount(admin);

        ObjectNode project = objectMapper.createObjectNode();
        project.put("regionId", PUNE_REGION_ID);
        project.put("accountId", accountId);
        project.put("name", "Bulk status project");
        project.put("projectCode", "BLK-" + UUID.randomUUID().toString().substring(0, 8));
        project.put("billingType", "FIXED_BID");
        project.put("contractValue", 1000);
        String projectId = idOf(perform(admin, "/api/v1/projects", project).andExpect(status().isOk()));

        String firstTask = createTask(admin, projectId, "Bulk task A");
        String secondTask = createTask(admin, projectId, "Bulk task B");

        ObjectNode complete = objectMapper.createObjectNode();
        complete.put("status", "COMPLETED");
        complete.set("ids", objectMapper.createArrayNode().add(firstTask).add(secondTask));
        perform(admin, "/api/v1/tasks/bulk-status", complete)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.succeeded").value(2))
                .andExpect(jsonPath("$.data.failed").value(0));

        mockMvc.perform(get("/api/v1/tasks/" + firstTask).header("Authorization", "Bearer " + admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("COMPLETED"))
                .andExpect(jsonPath("$.data.completionPercentage").value(org.hamcrest.Matchers.anyOf(org.hamcrest.Matchers.is(100), org.hamcrest.Matchers.is(100.0))));

        complete.put("status", "ARCHIVED");
        perform(admin, "/api/v1/tasks/bulk-status", complete)
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("INVALID_STATUS"));
    }

    private String createAccount(String token) throws Exception {
        ObjectNode account = objectMapper.createObjectNode();
        account.put("regionId", PUNE_REGION_ID);
        account.put("name", "Bulk Account " + UUID.randomUUID());
        account.put("accountType", "CUSTOMER");
        return idOf(perform(token, "/api/v1/accounts", account).andExpect(status().isOk()));
    }

    private String createTask(String token, String projectId, String name) throws Exception {
        ObjectNode task = objectMapper.createObjectNode();
        task.put("name", name);
        task.put("status", "TODO");
        task.put("priority", "MEDIUM");
        return idOf(perform(token, "/api/v1/projects/" + projectId + "/tasks", task).andExpect(status().isOk()));
    }

    private ObjectNode assignBody(String ownerId, String... ids) {
        ObjectNode body = objectMapper.createObjectNode();
        body.put("ownerId", ownerId);
        ArrayNode array = body.putArray("ids");
        for (String id : ids) {
            array.add(id);
        }
        return body;
    }

    private ResultActions perform(String token, String path, Object body) throws Exception {
        return mockMvc.perform(post(path)
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(body)));
    }

    private String idOf(ResultActions result) throws Exception {
        MvcResult mvcResult = result.andReturn();
        return objectMapper
                .readTree(mvcResult.getResponse().getContentAsString())
                .at("/data/id")
                .asText();
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
