package com.techearnest.crm.common.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

/** Refuses to start in {@code prod} with the local development JWT secret. */
@Component
public class ProdSecurityGuard implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(ProdSecurityGuard.class);
    private static final String DEV_SECRET = "local-dev-only-change-me-use-32-byte-secret!";

    private final Environment environment;
    private final SecurityProperties securityProperties;

    public ProdSecurityGuard(Environment environment, SecurityProperties securityProperties) {
        this.environment = environment;
        this.securityProperties = securityProperties;
    }

    @Override
    public void run(ApplicationArguments args) {
        boolean prod = false;
        for (String profile : environment.getActiveProfiles()) {
            if ("prod".equalsIgnoreCase(profile)) {
                prod = true;
                break;
            }
        }
        if (!prod) {
            return;
        }
        String secret = securityProperties.getJwtSecret();
        if (secret == null || secret.isBlank() || DEV_SECRET.equals(secret)) {
            throw new IllegalStateException(
                    "JWT_SECRET must be set to a non-default value when running with the prod profile");
        }
        if (secret.getBytes().length < 32) {
            throw new IllegalStateException(
                    "JWT_SECRET must be at least 32 bytes when running with the prod profile");
        }
        Boolean swaggerUi = environment.getProperty("springdoc.swagger-ui.enabled", Boolean.class);
        Boolean apiDocs = environment.getProperty("springdoc.api-docs.enabled", Boolean.class);
        if (Boolean.TRUE.equals(swaggerUi) || Boolean.TRUE.equals(apiDocs)) {
            throw new IllegalStateException(
                    "Swagger / OpenAPI must be disabled when running with the prod profile");
        }
        log.info("Production security checks passed (JWT secret configured, swagger disabled)");
    }
}
