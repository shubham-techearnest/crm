package com.techearnest.crm.common.config;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.Test;
import org.springframework.boot.DefaultApplicationArguments;
import org.springframework.jdbc.core.JdbcTemplate;

class DemoAccountGuardTest {

    @Test
    void disablesAccountsStillUsingTheSeededHash() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.update(anyString(), eq(DemoAccountGuard.SEEDED_DEMO_PASSWORD_HASH))).thenReturn(1);

        new DemoAccountGuard(jdbc, false).run(new DefaultApplicationArguments());

        verify(jdbc).update(contains("UPDATE users SET status = 'DEACTIVATED'"), eq(DemoAccountGuard.SEEDED_DEMO_PASSWORD_HASH));
        verify(jdbc).update(contains("UPDATE portal_users SET status = 'INACTIVE'"), eq(DemoAccountGuard.SEEDED_DEMO_PASSWORD_HASH));
    }

    @Test
    void doesNothingWhenDemoAccountsAreExplicitlyAllowed() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);

        new DemoAccountGuard(jdbc, true).run(new DefaultApplicationArguments());

        verify(jdbc, never()).update(anyString(), eq(DemoAccountGuard.SEEDED_DEMO_PASSWORD_HASH));
    }
}
