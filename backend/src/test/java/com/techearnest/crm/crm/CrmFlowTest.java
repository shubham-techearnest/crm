package com.techearnest.crm.crm;

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
class CrmFlowTest {

    private static final UUID PUNE_REGION_ID = UUID.fromString("22222222-2222-4222-8222-000000000011");
    private static final UUID MUMBAI_REGION_ID = UUID.fromString("22222222-2222-4222-8222-000000000012");

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void leadConvertDealPipelineAndRegionIsolation() throws Exception {
        String salesToken = login("sales.exec@example.com");

        ObjectNode createLead = objectMapper.createObjectNode();
        createLead.put("regionId", PUNE_REGION_ID.toString());
        createLead.put("firstName", "Priya");
        createLead.put("lastName", "Shah");
        createLead.put("companyName", "Acme Solutions " + UUID.randomUUID());
        createLead.put("email", "priya.shah+" + UUID.randomUUID() + "@example.com");
        createLead.put("phone", "+91-9000000099");
        createLead.put("status", "NEW");

        MvcResult created = mockMvc.perform(post("/api/v1/leads")
                        .header("Authorization", "Bearer " + salesToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(createLead)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.status").value("NEW"))
                .andReturn();

        String leadId = objectMapper
                .readTree(created.getResponse().getContentAsString())
                .at("/data/id")
                .asText();
        String ownerId = objectMapper
                .readTree(created.getResponse().getContentAsString())
                .at("/data/ownerId")
                .asText();

        ObjectNode assign = objectMapper.createObjectNode();
        assign.put("ownerId", ownerId);
        mockMvc.perform(post("/api/v1/leads/" + leadId + "/assign")
                        .header("Authorization", "Bearer " + salesToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(assign)))
                .andExpect(status().isOk());

        ObjectNode convert = objectMapper.createObjectNode();
        convert.put("createAccount", true);
        convert.put("createContact", true);
        convert.put("createDeal", true);
        convert.put("dealName", "Acme Website Redesign");
        convert.put("dealValue", 250000);
        convert.put("dealStage", "NEW");

        MvcResult converted = mockMvc.perform(post("/api/v1/leads/" + leadId + "/convert")
                        .header("Authorization", "Bearer " + salesToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(convert)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.accountId").isNotEmpty())
                .andExpect(jsonPath("$.data.contactId").isNotEmpty())
                .andExpect(jsonPath("$.data.dealId").isNotEmpty())
                .andReturn();

        JsonNode convertData =
                objectMapper.readTree(converted.getResponse().getContentAsString()).at("/data");
        String accountId = convertData.get("accountId").asText();
        String contactId = convertData.get("contactId").asText();
        String dealId = convertData.get("dealId").asText();
        assertThat(accountId).isNotBlank();
        assertThat(contactId).isNotBlank();
        assertThat(dealId).isNotBlank();

        mockMvc.perform(get("/api/v1/leads/" + leadId).header("Authorization", "Bearer " + salesToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("CONVERTED"));

        ObjectNode toQualification = objectMapper.createObjectNode();
        toQualification.put("toStage", "QUALIFICATION");
        mockMvc.perform(post("/api/v1/deals/" + dealId + "/stage")
                        .header("Authorization", "Bearer " + salesToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(toQualification)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.stage").value("QUALIFICATION"));

        ObjectNode toWon = objectMapper.createObjectNode();
        toWon.put("toStage", "WON");
        mockMvc.perform(post("/api/v1/deals/" + dealId + "/stage")
                        .header("Authorization", "Bearer " + salesToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(toWon)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.stage").value("WON"));

        MvcResult pipeline = mockMvc.perform(
                        get("/api/v1/deals/pipeline").header("Authorization", "Bearer " + salesToken))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode columns =
                objectMapper.readTree(pipeline.getResponse().getContentAsString()).at("/data");
        boolean wonContainsDeal = false;
        for (JsonNode column : columns) {
            if ("WON".equals(column.get("stage").asText())) {
                for (JsonNode deal : column.get("deals")) {
                    if (dealId.equals(deal.get("id").asText())) {
                        wonContainsDeal = true;
                        break;
                    }
                }
            }
        }
        assertThat(wonContainsDeal).isTrue();

        String puneAdminToken = login("pune.admin@example.com");
        mockMvc.perform(get("/api/v1/leads/" + leadId).header("Authorization", "Bearer " + puneAdminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("CONVERTED"));

        String orgAdminToken = login("orgadmin@example.com");
        ObjectNode mumbaiLead = objectMapper.createObjectNode();
        mumbaiLead.put("regionId", MUMBAI_REGION_ID.toString());
        mumbaiLead.put("firstName", "Mumbai");
        mumbaiLead.put("lastName", "Lead");
        mumbaiLead.put("companyName", "Mumbai Corp");
        mumbaiLead.put("status", "NEW");

        MvcResult mumbaiCreated = mockMvc.perform(post("/api/v1/leads")
                        .header("Authorization", "Bearer " + orgAdminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(mumbaiLead)))
                .andExpect(status().isOk())
                .andReturn();
        String mumbaiLeadId = objectMapper
                .readTree(mumbaiCreated.getResponse().getContentAsString())
                .at("/data/id")
                .asText();

        mockMvc.perform(get("/api/v1/leads/" + mumbaiLeadId).header("Authorization", "Bearer " + puneAdminToken))
                .andExpect(status().isNotFound());

        String employeeToken = login("employee@example.com");
        mockMvc.perform(post("/api/v1/leads")
                        .header("Authorization", "Bearer " + employeeToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(createLead)))
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
