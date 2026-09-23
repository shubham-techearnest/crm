package com.techearnest.crm.document;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.techearnest.crm.auth.api.dto.LoginRequest;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@SpringBootTest
@AutoConfigureMockMvc
class DocumentFoundationTest {

    private static final UUID PUNE_REGION_ID = UUID.fromString("22222222-2222-4222-8222-000000000011");

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void uploadListDownloadNoteSavedViewAndLeadQuery() throws Exception {
        String token = login("sales.exec@example.com");

        ObjectNode createLead = objectMapper.createObjectNode();
        createLead.put("regionId", PUNE_REGION_ID.toString());
        createLead.put("firstName", "Doc");
        createLead.put("lastName", "Tester");
        createLead.put("companyName", "Doc Co " + UUID.randomUUID());
        createLead.put("email", "doc+" + UUID.randomUUID() + "@example.com");
        createLead.put("status", "NEW");
        createLead.put("source", "Web");
        createLead.put("priority", "HIGH");

        MvcResult created = mockMvc.perform(post("/api/v1/leads")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(createLead)))
                .andExpect(status().isOk())
                .andReturn();

        String leadId = objectMapper
                .readTree(created.getResponse().getContentAsString())
                .at("/data/id")
                .asText();

        MockMultipartFile file = new MockMultipartFile(
                "file",
                "brief.pdf",
                "application/pdf",
                "hello-document".getBytes(StandardCharsets.UTF_8));

        MvcResult uploaded = mockMvc.perform(multipart("/api/v1/documents")
                        .file(file)
                        .param("entityType", "LEAD")
                        .param("entityId", leadId)
                        .param("visibility", "INTERNAL")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.fileName").value("brief.pdf"))
                .andReturn();

        String documentId = objectMapper
                .readTree(uploaded.getResponse().getContentAsString())
                .at("/data/id")
                .asText();

        mockMvc.perform(get("/api/v1/documents")
                        .param("entityType", "LEAD")
                        .param("entityId", leadId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].id").value(documentId));

        MvcResult download = mockMvc.perform(get("/api/v1/documents/" + documentId + "/download")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andReturn();
        assertThat(download.getResponse().getContentAsByteArray())
                .isEqualTo("hello-document".getBytes(StandardCharsets.UTF_8));

        ObjectNode note = objectMapper.createObjectNode();
        note.put("entityType", "LEAD");
        note.put("entityId", leadId);
        note.put("body", "Follow up tomorrow");
        mockMvc.perform(post("/api/v1/notes")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(note)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.body").value("Follow up tomorrow"));

        mockMvc.perform(get("/api/v1/notes")
                        .param("entityType", "LEAD")
                        .param("entityId", leadId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].body").value("Follow up tomorrow"));

        ObjectNode query = objectMapper.createObjectNode();
        query.put("search", "Doc");
        ObjectNode filter = query.putObject("filter");
        filter.put("op", "AND");
        var conditions = filter.putArray("conditions");
        ObjectNode statusEq = conditions.addObject();
        statusEq.put("field", "status");
        statusEq.put("operator", "EQ");
        statusEq.put("value", "NEW");
        ObjectNode sourceEq = conditions.addObject();
        sourceEq.put("field", "source");
        sourceEq.put("operator", "EQ");
        sourceEq.put("value", "Web");

        mockMvc.perform(post("/api/v1/leads/query")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(query)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        ObjectNode view = objectMapper.createObjectNode();
        view.put("module", "LEAD");
        view.put("name", "High Web " + UUID.randomUUID());
        view.put("visibility", "PRIVATE");
        view.set("filter", filter);
        mockMvc.perform(post("/api/v1/saved-views")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(view)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.module").value("LEAD"));

        mockMvc.perform(get("/api/v1/saved-views")
                        .param("module", "LEAD")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray());
    }

    private String login(String email) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new LoginRequest(email, "ChangeMe!123"))))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper
                .readTree(result.getResponse().getContentAsString())
                .at("/data/accessToken")
                .asText();
    }
}
