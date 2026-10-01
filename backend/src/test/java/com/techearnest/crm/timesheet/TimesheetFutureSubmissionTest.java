package com.techearnest.crm.timesheet;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.techearnest.crm.auth.api.dto.LoginRequest;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@SpringBootTest(properties = "crm.timesheet.allow-future-submission=false")
@AutoConfigureMockMvc
class TimesheetFutureSubmissionTest {

    private static final UUID SEED_PROJECT_ID = UUID.fromString("99999999-9999-4999-8999-000000000001");

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void futureHoursCanBeSavedAsDraftButNotSubmitted() throws Exception {
        String token = login("employee@example.com");
        LocalDate monday = LocalDate.of(2040, 1, 2)
                .with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY))
                .plusWeeks(ThreadLocalRandom.current().nextInt(0, 50_000));

        ObjectNode createBody = objectMapper.createObjectNode();
        createBody.put("weekStartDate", monday.toString());
        MvcResult created = mockMvc.perform(post("/api/v1/timesheets")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(createBody)))
                .andExpect(status().isOk())
                .andReturn();
        String id = objectMapper.readTree(created.getResponse().getContentAsString()).at("/data/id").asText();

        ObjectNode body = objectMapper.createObjectNode();
        ArrayNode entries = body.putArray("entries");
        for (int day = 0; day < 2; day++) {
            ObjectNode entry = entries.addObject();
            entry.put("projectId", SEED_PROJECT_ID.toString());
            entry.put("workDate", monday.plusDays(day).toString());
            entry.put("hours", day == 0 ? 8 : 5.5);
            entry.put("description", day == 0 ? "Sprint planning" : "API work");
            entry.put("billable", true);
        }
        mockMvc.perform(put("/api/v1/timesheets/" + id + "/entries")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("DRAFT"))
                .andExpect(jsonPath("$.data.entries[1].description").value("API work"));

        mockMvc.perform(post("/api/v1/timesheets/" + id + "/submit").header("Authorization", "Bearer " + token))
                .andExpect(status().is4xxClientError())
                .andExpect(jsonPath("$.code").value("FUTURE_ENTRIES"));

        mockMvc.perform(get("/api/v1/timesheets/" + id).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("DRAFT"));
    }

    private String login(String email) throws Exception {
        MvcResult login = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new LoginRequest(email, "ChangeMe!123"))))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(login.getResponse().getContentAsString()).at("/data/accessToken").asText();
    }
}
