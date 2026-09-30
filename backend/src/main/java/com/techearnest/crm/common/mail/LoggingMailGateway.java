package com.techearnest.crm.common.mail;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** Default mail transport: writes messages to the log until a real {@link MailGateway} (SMTP etc.) is provided. */
@Configuration
public class LoggingMailGateway {

    private static final Logger log = LoggerFactory.getLogger(LoggingMailGateway.class);

    @Bean
    @ConditionalOnMissingBean(MailGateway.class)
    public MailGateway mailGateway() {
        return (to, subject, body) -> log.info("[mail] to={} subject=\"{}\"\n{}", to, subject, body);
    }
}
