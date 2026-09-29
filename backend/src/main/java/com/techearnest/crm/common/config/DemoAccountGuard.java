package com.techearnest.crm.common.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Flyway migrations V14 and V29 seed demo accounts that share the password {@code ChangeMe!123}.
 * Migrations cannot be edited once applied, so in {@code prod} any account still carrying that
 * seeded hash is disabled at startup. A user who has changed their password gets a new salt and
 * is unaffected.
 */
@Component
@Profile("prod")
public class DemoAccountGuard implements ApplicationRunner {

    static final String SEEDED_DEMO_PASSWORD_HASH =
            "$2a$12$cgvJnrKl0NRx/R/xqUZk1OAiZzSAkjmogcc4BHN8h.ygKP9pttflS";

    private static final Logger log = LoggerFactory.getLogger(DemoAccountGuard.class);

    private final JdbcTemplate jdbcTemplate;
    private final boolean allowDemoAccounts;

    public DemoAccountGuard(
            JdbcTemplate jdbcTemplate,
            @Value("${app.security.allow-demo-accounts:false}") boolean allowDemoAccounts) {
        this.jdbcTemplate = jdbcTemplate;
        this.allowDemoAccounts = allowDemoAccounts;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (allowDemoAccounts) {
            log.warn("Demo accounts are allowed in prod (app.security.allow-demo-accounts=true)");
            return;
        }
        int users = jdbcTemplate.update(
                "UPDATE users SET status = 'DEACTIVATED' WHERE password_hash = ? AND status <> 'DEACTIVATED'",
                SEEDED_DEMO_PASSWORD_HASH);
        int portalUsers = jdbcTemplate.update(
                "UPDATE portal_users SET status = 'INACTIVE' WHERE password_hash = ? AND status <> 'INACTIVE'",
                SEEDED_DEMO_PASSWORD_HASH);
        if (users > 0 || portalUsers > 0) {
            log.warn(
                    "Disabled {} internal and {} portal accounts still using the seeded demo password",
                    users,
                    portalUsers);
        }
    }
}
