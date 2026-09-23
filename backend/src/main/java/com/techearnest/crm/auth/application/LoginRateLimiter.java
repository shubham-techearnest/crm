package com.techearnest.crm.auth.application;

import com.techearnest.crm.common.config.SecurityProperties;
import com.techearnest.crm.common.exception.TooManyRequestsException;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Component;

@Component
public class LoginRateLimiter {

    private final SecurityProperties properties;
    private final Map<String, Deque<Instant>> attempts = new ConcurrentHashMap<>();

    public LoginRateLimiter(SecurityProperties properties) {
        this.properties = properties;
    }

    public void check(String email) {
        String key = email.toLowerCase(Locale.ROOT);
        Instant cutoff = Instant.now().minus(properties.getLoginWindow());
        Deque<Instant> window = attempts.computeIfAbsent(key, ignored -> new ArrayDeque<>());
        synchronized (window) {
            while (!window.isEmpty() && window.peekFirst().isBefore(cutoff)) {
                window.removeFirst();
            }
            if (window.size() >= properties.getLoginMaxAttempts()) {
                throw new TooManyRequestsException("Too many login attempts. Try again later.");
            }
        }
    }

    public void recordFailure(String email) {
        String key = email.toLowerCase(Locale.ROOT);
        Deque<Instant> window = attempts.computeIfAbsent(key, ignored -> new ArrayDeque<>());
        synchronized (window) {
            window.addLast(Instant.now());
        }
    }

    public void clear(String email) {
        attempts.remove(email.toLowerCase(Locale.ROOT));
    }
}
