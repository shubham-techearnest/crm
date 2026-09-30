package com.techearnest.crm.common.config;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

/** Links sent to people outside the CRM (portal invites, secure timesheet links). */
@ConfigurationProperties(prefix = "crm.self-service")
public class SelfServiceProperties {

    /** Public URL of the web app; emailed links are built from it. */
    private String appBaseUrl = "http://localhost:5173";

    private Duration inviteTtl = Duration.ofDays(7);

    /** How long a timesheet link stays usable after it is issued. */
    private Duration timesheetLinkTtl = Duration.ofDays(10);

    /** Send weekly timesheet links to resources that have an email but no login. */
    private boolean weeklyTimesheetLinks = true;

    public String getAppBaseUrl() {
        return appBaseUrl;
    }

    public void setAppBaseUrl(String appBaseUrl) {
        this.appBaseUrl = appBaseUrl;
    }

    public Duration getInviteTtl() {
        return inviteTtl;
    }

    public void setInviteTtl(Duration inviteTtl) {
        this.inviteTtl = inviteTtl;
    }

    public Duration getTimesheetLinkTtl() {
        return timesheetLinkTtl;
    }

    public void setTimesheetLinkTtl(Duration timesheetLinkTtl) {
        this.timesheetLinkTtl = timesheetLinkTtl;
    }

    public boolean isWeeklyTimesheetLinks() {
        return weeklyTimesheetLinks;
    }

    public void setWeeklyTimesheetLinks(boolean weeklyTimesheetLinks) {
        this.weeklyTimesheetLinks = weeklyTimesheetLinks;
    }

    public String link(String path) {
        String base = appBaseUrl.endsWith("/") ? appBaseUrl.substring(0, appBaseUrl.length() - 1) : appBaseUrl;
        return base + path;
    }
}
