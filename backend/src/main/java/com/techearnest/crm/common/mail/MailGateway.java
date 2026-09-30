package com.techearnest.crm.common.mail;

/** Outgoing email. Replace the logging implementation with an SMTP/provider bean to deliver real mail. */
public interface MailGateway {

    void send(String to, String subject, String body);
}
