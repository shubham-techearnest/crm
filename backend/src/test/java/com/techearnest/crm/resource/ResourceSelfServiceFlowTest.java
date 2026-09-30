package com.techearnest.crm.resource;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.techearnest.crm.auth.api.dto.LoginRequest;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;
import java.util.function.Consumer;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

/** Resources without a regular login: proxy timesheets, emailed weekly links and the limited portal login. */
@SpringBootTest
@AutoConfigureMockMvc
class ResourceSelfServiceFlowTest {

    private static final UUID SEED_PROJECT_ID = UUID.fromString("99999999-9999-4999-8999-000000000001");
    private static final UUID SEED_REGION_ID = UUID.fromString("22222222-2222-4222-8222-000000000011");
    private static final String PASSWORD = "ChangeMe!123";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void managerEntersTimesheetOnBehalfOfResourceWithoutLogin() throws Exception {
        String admin = login("orgadmin@example.com", PASSWORD);
        LocalDate monday = uniqueMonday();
        String resourceId = createAllocatedResource(admin, monday, null);

        JsonNode sheet = json(mockMvc.perform(post("/api/v1/timesheets")
                        .header("Authorization", "Bearer " + admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body(b -> {
                            b.put("resourceId", resourceId);
                            b.put("weekStartDate", monday.toString());
                        })))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.entrySource").value("PROXY"))
                .andExpect(jsonPath("$.data.resourceName").value("Contractor " + resourceId.substring(0, 8)))
                .andReturn());
        String timesheetId = sheet.at("/data/id").asText();

        mockMvc.perform(get("/api/v1/timesheets/" + timesheetId + "/projects")
                        .header("Authorization", "Bearer " + admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].projectId").value(SEED_PROJECT_ID.toString()));

        mockMvc.perform(post("/api/v1/timesheets/" + timesheetId + "/entries")
                        .header("Authorization", "Bearer " + admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body(b -> {
                            b.put("projectId", SEED_PROJECT_ID.toString());
                            b.put("workDate", monday.plusDays(1).toString());
                            b.put("hours", 7);
                        })))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/v1/timesheets/" + timesheetId + "/submit")
                        .header("Authorization", "Bearer " + admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("SUBMITTED"))
                .andExpect(jsonPath("$.data.enteredBy").isNotEmpty());
    }

    @Test
    void resourceFillsWeekThroughSecureLinkWithoutSigningIn() throws Exception {
        String admin = login("orgadmin@example.com", PASSWORD);
        LocalDate monday = uniqueMonday();
        String resourceId = createAllocatedResource(admin, monday, "link-" + UUID.randomUUID() + "@example.com");

        JsonNode issued = json(mockMvc.perform(post("/api/v1/resources/" + resourceId + "/timesheet-links")
                        .header("Authorization", "Bearer " + admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body(b -> {
                            b.put("weekStartDate", monday.toString());
                            b.put("sendEmail", true);
                        })))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.emailed").value(true))
                .andReturn());
        String token = lastSegment(issued.at("/data/url").asText());

        mockMvc.perform(get("/api/v1/public/timesheet-links/" + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.editable").value(true))
                .andExpect(jsonPath("$.data.projects[0].projectId").value(SEED_PROJECT_ID.toString()));

        ObjectNode submit = objectMapper.createObjectNode();
        ObjectNode entry = submit.putArray("entries").addObject();
        entry.put("projectId", SEED_PROJECT_ID.toString());
        entry.put("workDate", monday.plusDays(2).toString());
        entry.put("hours", 8);
        entry.put("description", "Site visit");
        mockMvc.perform(post("/api/v1/public/timesheet-links/" + token + "/submit")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(submit)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("SUBMITTED"));

        mockMvc.perform(get("/api/v1/public/timesheet-links/" + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("SUBMITTED"))
                .andExpect(jsonPath("$.data.editable").value(false));
        mockMvc.perform(post("/api/v1/public/timesheet-links/" + token + "/submit")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(submit)))
                .andExpect(status().isUnprocessableEntity());

        mockMvc.perform(get("/api/v1/public/timesheet-links/not-a-real-token"))
                .andExpect(status().isNotFound());
    }

    @Test
    void invitedContributorSeesOnlyTheirOwnWorkUntilRevoked() throws Exception {
        String admin = login("orgadmin@example.com", PASSWORD);
        LocalDate monday = uniqueMonday();
        String email = "contrib-" + UUID.randomUUID().toString().substring(0, 8) + "@example.com";
        String resourceId = createAllocatedResource(admin, monday, email);

        JsonNode invited = json(mockMvc.perform(post("/api/v1/resources/" + resourceId + "/portal-access")
                        .header("Authorization", "Bearer " + admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body(b -> b.put("accessExpiresOn", LocalDate.now().plusDays(30).toString()))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.loginStatus").value("INVITED"))
                .andExpect(jsonPath("$.data.portalManaged").value(true))
                .andReturn());
        String inviteToken = lastSegment(invited.at("/data/inviteUrl").asText());

        mockMvc.perform(get("/api/v1/public/invites/" + inviteToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.email").value(email));
        String newPassword = "Portal!Pass123";
        mockMvc.perform(post("/api/v1/public/invites/" + inviteToken + "/accept")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body(b -> b.put("password", newPassword))))
                .andExpect(status().isOk());

        String contributor = login(email, newPassword);
        mockMvc.perform(get("/api/v1/timesheets").header("Authorization", "Bearer " + contributor))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/accounts").header("Authorization", "Bearer " + contributor))
                .andExpect(status().isForbidden());

        mockMvc.perform(delete("/api/v1/resources/" + resourceId + "/portal-access")
                        .header("Authorization", "Bearer " + admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.loginStatus").value("DEACTIVATED"));
        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new LoginRequest(email, newPassword))))
                .andExpect(result -> assertThat(result.getResponse().getStatus()).isIn(401, 403));
    }

    private String createAllocatedResource(String token, LocalDate monday, String email) throws Exception {
        JsonNode resource = json(mockMvc.perform(post("/api/v1/resources")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body(b -> {
                            b.put("regionId", SEED_REGION_ID.toString());
                            b.put("resourceType", "CONTRACTOR");
                            b.put("employeeCode", "EXT-" + UUID.randomUUID().toString().substring(0, 8));
                            b.put("capacityHoursPerWeek", 40);
                            b.put("status", "AVAILABLE");
                            b.put("fullName", "Contractor");
                            if (email != null) b.put("email", email);
                        })))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.loginStatus").value("NONE"))
                .andReturn());
        String resourceId = resource.at("/data/id").asText();

        String uniqueName = "Contractor " + resourceId.substring(0, 8);
        mockMvc.perform(put("/api/v1/resources/" + resourceId)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body(b -> b.put("fullName", uniqueName))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.fullName").value(uniqueName));

        mockMvc.perform(post("/api/v1/allocations")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body(b -> {
                            b.put("projectId", SEED_PROJECT_ID.toString());
                            b.put("resourceId", resourceId);
                            b.put("startDate", monday.minusWeeks(1).toString());
                            b.put("endDate", monday.plusWeeks(2).toString());
                            b.put("allocationPercentage", 50);
                            b.put("status", "ACTIVE");
                        })))
                .andExpect(status().isOk());
        return resourceId;
    }

    private String body(Consumer<ObjectNode> fill) throws Exception {
        ObjectNode node = objectMapper.createObjectNode();
        fill.accept(node);
        return objectMapper.writeValueAsString(node);
    }

    private JsonNode json(MvcResult result) throws Exception {
        return objectMapper.readTree(result.getResponse().getContentAsString());
    }

    private static String lastSegment(String url) {
        return url.substring(url.lastIndexOf('/') + 1);
    }

    /** Tests share a persistent database, so each run needs a week no earlier run has used. */
    private static LocalDate uniqueMonday() {
        return LocalDate.of(2040, 1, 2)
                .with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY))
                .plusWeeks(ThreadLocalRandom.current().nextInt(0, 50_000));
    }

    private String login(String email, String password) throws Exception {
        MvcResult login = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new LoginRequest(email, password))))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(login.getResponse().getContentAsString()).at("/data/accessToken").asText();
    }
}
