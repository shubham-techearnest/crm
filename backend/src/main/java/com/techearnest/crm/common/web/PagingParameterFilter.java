package com.techearnest.crm.common.web;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Collections;
import java.util.Enumeration;
import java.util.HashMap;
import java.util.Map;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Clamps {@code page} and {@code size} query parameters so out-of-range values never reach
 * {@code PageRequest.of}, which throws on negative page or non-positive size.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
public class PagingParameterFilter extends OncePerRequestFilter {

    static final int MAX_PAGE_SIZE = 100;

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        if (!request.getRequestURI().startsWith("/api/")) {
            return true;
        }
        if ("GET".equals(request.getMethod())) {
            return request.getParameter("page") == null && request.getParameter("size") == null;
        }
        // Avoid getParameter on other methods: it can force form/multipart body parsing.
        String query = request.getQueryString();
        return query == null || (!query.contains("page=") && !query.contains("size="));
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        Map<String, String[]> params = new HashMap<>(request.getParameterMap());
        clamp(params, "page", 0, Integer.MAX_VALUE);
        clamp(params, "size", 1, MAX_PAGE_SIZE);
        filterChain.doFilter(new ParameterOverrideRequest(request, params), response);
    }

    private static void clamp(Map<String, String[]> params, String name, int min, int max) {
        String[] values = params.get(name);
        if (values == null || values.length == 0) {
            return;
        }
        try {
            long parsed = Long.parseLong(values[0].trim());
            long bounded = Math.max(min, Math.min(max, parsed));
            params.put(name, new String[] {Long.toString(bounded)});
        } catch (NumberFormatException ignored) {
            // Left as-is so the controller reports a 400 type mismatch.
        }
    }

    private static final class ParameterOverrideRequest extends HttpServletRequestWrapper {

        private final Map<String, String[]> params;

        ParameterOverrideRequest(HttpServletRequest request, Map<String, String[]> params) {
            super(request);
            this.params = Collections.unmodifiableMap(params);
        }

        @Override
        public String getParameter(String name) {
            String[] values = params.get(name);
            return values == null || values.length == 0 ? null : values[0];
        }

        @Override
        public Map<String, String[]> getParameterMap() {
            return params;
        }

        @Override
        public Enumeration<String> getParameterNames() {
            return Collections.enumeration(params.keySet());
        }

        @Override
        public String[] getParameterValues(String name) {
            return params.get(name);
        }
    }
}
