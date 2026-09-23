package com.techearnest.crm.common.security;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.techearnest.crm.auth.api.AuthController;
import com.techearnest.crm.auth.application.AuthService;
import com.techearnest.crm.auth.application.JwtService;
import com.techearnest.crm.common.config.AppPropertiesConfig;
import com.techearnest.crm.common.logging.RequestIdFilter;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(controllers = AuthController.class)
@Import({SecurityConfig.class, JsonAuthHandlers.class, AppPropertiesConfig.class, RequestIdFilter.class})
class SecurityStubMvcTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private AuthService authService;

    @MockitoBean
    private AccessGuard accessGuard;

    @MockitoBean
    private JwtService jwtService;

    @Test
    void apiRequiresAuthentication() throws Exception {
        mockMvc.perform(get("/api/v1/leads"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("Unauthenticated"));
    }

    @Test
    void requestIdIsEchoedOnUnauthorizedApi() throws Exception {
        mockMvc.perform(get("/api/v1/leads").header("X-Request-Id", "phase1-test"))
                .andExpect(status().isUnauthorized())
                .andExpect(header().string("X-Request-Id", "phase1-test"));
    }
}
