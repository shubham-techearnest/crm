package com.techearnest.crm.common.logging;

public final class RequestContext {

    public static final String REQUEST_ID_HEADER = "X-Request-Id";
    public static final String MDC_REQUEST_ID = "requestId";
    public static final String MDC_USER_ID = "userId";
    public static final String MDC_ORGANIZATION_ID = "organizationId";

    private RequestContext() {}
}
