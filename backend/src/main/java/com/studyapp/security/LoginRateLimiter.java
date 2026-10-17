package com.studyapp.security;

import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.LinkedList;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class LoginRateLimiter {
    private static final int MAX_ATTEMPTS = 5;
    private static final long WINDOW_SECONDS = 60;

    private final Map<String, LinkedList<Instant>> attempts = new ConcurrentHashMap<>();

    public synchronized boolean isBlocked(String key) {
        Instant now = Instant.now();
        LinkedList<Instant> timestamps = attempts.computeIfAbsent(key, k -> new LinkedList<>());
        // Remove timestamps older than WINDOW_SECONDS
        while (!timestamps.isEmpty() && timestamps.peekFirst().isBefore(now.minusSeconds(WINDOW_SECONDS))) {
            timestamps.pollFirst();
        }
        return timestamps.size() >= MAX_ATTEMPTS;
    }

    public synchronized void recordAttempt(String key) {
        Instant now = Instant.now();
        LinkedList<Instant> timestamps = attempts.computeIfAbsent(key, k -> new LinkedList<>());
        timestamps.addLast(now);
    }

    public synchronized void reset(String key) {
        attempts.remove(key);
    }
}
