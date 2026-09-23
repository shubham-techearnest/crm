package com.techearnest.crm.metadata;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.techearnest.crm.auth.api.dto.LoginRequest;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@SpringBootTest
@AutoConfigureMockMvc
class MetadataStudioPermissionTest {

    private static final UUID ORG_ID = UUID.fromString("11111111-1111-4111-8111-111111111111");

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void orgAdminCanViewStudio_employeeAndSalesExecAndPlatformForbidden() throws Exception {
        String orgAdmin = login("orgadmin@example.com");
        mockMvc.perform(get("/api/v1/metadata/tables").header("Authorization", "Bearer " + orgAdmin))
                .andExpect(status().isOk());

        String employee = login("employee@example.com");
        mockMvc.perform(get("/api/v1/metadata/tables").header("Authorization", "Bearer " + employee))
                .andExpect(status().isForbidden());

        String salesExec = login("sales.exec@example.com");
        mockMvc.perform(get("/api/v1/metadata/tables").header("Authorization", "Bearer " + salesExec))
                .andExpect(status().isForbidden());

        String superAdmin = login("superadmin@example.com");
        mockMvc.perform(get("/api/v1/metadata/tables").header("Authorization", "Bearer " + superAdmin))
                .andExpect(status().isForbidden());
    }

    @Test
    void roleManageAloneIsInsufficientForStudio() throws Exception {
        UUID roleId = UUID.fromString("66666666-6666-4666-8666-000000000099");
        UUID userId = UUID.fromString("77777777-7777-4777-8777-000000000099");
        String email = "role.manage.only@example.com";

        jdbcTemplate.update("DELETE FROM audit_logs WHERE user_id = ?", userId);
        jdbcTemplate.update("DELETE FROM user_roles WHERE user_id = ?", userId);
        jdbcTemplate.update("DELETE FROM users WHERE id = ?", userId);
        jdbcTemplate.update("DELETE FROM role_permissions WHERE role_id = ?", roleId);
        jdbcTemplate.update("DELETE FROM roles WHERE id = ?", roleId);

        jdbcTemplate.update(
                """
                INSERT INTO roles (id, organization_id, code, name, data_scope, is_system)
                VALUES (?, ?, 'ROLE_MGR_ONLY', 'Role Manage Only', 'ORGANIZATION', false)
                """,
                roleId,
                ORG_ID);
        jdbcTemplate.update(
                """
                INSERT INTO role_permissions (role_id, permission_id)
                SELECT ?, id FROM permissions WHERE code = 'ROLE_MANAGE'
                """,
                roleId);
        // password: ChangeMe!123 (same bcrypt as seed users)
        jdbcTemplate.update(
                """
                INSERT INTO users (
                    id, organization_id, region_id, email, password_hash, first_name, last_name, status
                ) VALUES (
                    ?, ?, '22222222-2222-4222-8222-000000000011', ?,
                    '$2a$12$cgvJnrKl0NRx/R/xqUZk1OAiZzSAkjmogcc4BHN8h.ygKP9pttflS',
                    'Role', 'Manage', 'ACTIVE'
                )
                """,
                userId,
                ORG_ID,
                email);
        jdbcTemplate.update("INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)", userId, roleId);

        String token = login(email);
        mockMvc.perform(get("/api/v1/metadata/tables").header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/v1/metadata/tables/" + UUID.fromString("c1000001-0000-4000-8000-000000000001")
                        + "/fields")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden());
    }

    @Test
    void tenantUserCanReadPublishedRuntimeFormLayout() throws Exception {
        String salesExec = login("sales.exec@example.com");
        mockMvc.perform(get("/api/v1/metadata/runtime/tables/lead/form-layout")
                        .param("layoutKey", "CREATE")
                        .header("Authorization", "Bearer " + salesExec))
                .andExpect(status().isOk());
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
