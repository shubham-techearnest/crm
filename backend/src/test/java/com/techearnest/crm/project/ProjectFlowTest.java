package com.techearnest.crm.project;

import static org.assertj.core.api.Assertions.assertThat;
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
class ProjectFlowTest {

    private static final UUID PUNE_REGION_ID = UUID.fromString("22222222-2222-4222-8222-000000000011");
    private static final UUID SEED_RESOURCE_ID = UUID.fromString("bbbbbbb1-bbbb-4bbb-8bbb-000000000001");

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void createProjectFromWonDealThenMilestoneTaskAssignComment() throws Exception {
        String salesToken = login("sales.exec@example.com");
        String orgAdminToken = login("orgadmin@example.com");
        String employeeToken = login("employee@example.com");

        ObjectNode createLead = objectMapper.createObjectNode();
        createLead.put("regionId", PUNE_REGION_ID.toString());
        createLead.put("firstName", "Project");
        createLead.put("lastName", "Client");
        createLead.put("companyName", "Phase6 Delivery Co " + UUID.randomUUID());
        createLead.put("email", "phase6+" + UUID.randomUUID() + "@example.com");
        createLead.put("status", "NEW");

        MvcResult createdLead = mockMvc.perform(post("/api/v1/leads")
                        .header("Authorization", "Bearer " + salesToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(createLead)))
                .andExpect(status().isOk())
                .andReturn();
        String leadId = objectMapper
                .readTree(createdLead.getResponse().getContentAsString())
                .at("/data/id")
                .asText();

        ObjectNode convert = objectMapper.createObjectNode();
        convert.put("createAccount", true);
        convert.put("createContact", true);
        convert.put("createDeal", true);
        convert.put("dealName", "Phase6 Delivery Project");
        convert.put("dealValue", 150000);
        convert.put("dealStage", "NEW");

        MvcResult converted = mockMvc.perform(post("/api/v1/leads/" + leadId + "/convert")
                        .header("Authorization", "Bearer " + salesToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(convert)))
                .andExpect(status().isOk())
                .andReturn();
        String dealId = objectMapper
                .readTree(converted.getResponse().getContentAsString())
                .at("/data/dealId")
                .asText();

        ObjectNode toWon = objectMapper.createObjectNode();
        toWon.put("toStage", "WON");
        mockMvc.perform(post("/api/v1/deals/" + dealId + "/stage")
                        .header("Authorization", "Bearer " + salesToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(toWon)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.stage").value("WON"));

        mockMvc.perform(post("/api/v1/deals/" + dealId + "/create-project")
                        .header("Authorization", "Bearer " + employeeToken)
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isForbidden());

        MvcResult projectCreated = mockMvc.perform(post("/api/v1/deals/" + dealId + "/create-project")
                        .header("Authorization", "Bearer " + orgAdminToken)
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.dealId").value(dealId))
                .andExpect(jsonPath("$.data.status").value("ACTIVE"))
                .andReturn();

        JsonNode project = objectMapper
                .readTree(projectCreated.getResponse().getContentAsString())
                .at("/data");
        String projectId = project.get("id").asText();
        assertThat(project.get("dealId").asText()).isEqualTo(dealId);
        assertThat(project.get("projectCode").asText()).isNotBlank();

        ObjectNode milestone = objectMapper.createObjectNode();
        milestone.put("name", "Kickoff");
        milestone.put("status", "PLANNED");
        milestone.put("sortOrder", 1);

        MvcResult milestoneCreated = mockMvc.perform(post("/api/v1/projects/" + projectId + "/milestones")
                        .header("Authorization", "Bearer " + orgAdminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(milestone)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.name").value("Kickoff"))
                .andReturn();
        String milestoneId = objectMapper
                .readTree(milestoneCreated.getResponse().getContentAsString())
                .at("/data/id")
                .asText();

        ObjectNode task = objectMapper.createObjectNode();
        task.put("name", "Setup repository");
        task.put("status", "TODO");
        task.put("milestoneId", milestoneId);
        task.put("priority", "HIGH");

        MvcResult taskCreated = mockMvc.perform(post("/api/v1/projects/" + projectId + "/tasks")
                        .header("Authorization", "Bearer " + orgAdminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(task)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.name").value("Setup repository"))
                .andReturn();
        String taskId = objectMapper
                .readTree(taskCreated.getResponse().getContentAsString())
                .at("/data/id")
                .asText();

        ObjectNode assign = objectMapper.createObjectNode();
        assign.put("assignedResourceId", SEED_RESOURCE_ID.toString());
        mockMvc.perform(post("/api/v1/tasks/" + taskId + "/assign")
                        .header("Authorization", "Bearer " + orgAdminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(assign)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.assignedResourceId").value(SEED_RESOURCE_ID.toString()));

        ObjectNode comment = objectMapper.createObjectNode();
        comment.put("body", "Starting setup today");
        mockMvc.perform(post("/api/v1/tasks/" + taskId + "/comments")
                        .header("Authorization", "Bearer " + orgAdminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(comment)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.body").value("Starting setup today"));

        mockMvc.perform(post("/api/v1/deals/" + dealId + "/create-project")
                        .header("Authorization", "Bearer " + orgAdminToken)
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isConflict());
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
