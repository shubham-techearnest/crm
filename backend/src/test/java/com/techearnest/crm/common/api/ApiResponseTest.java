package com.techearnest.crm.common.api;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class ApiResponseTest {

    @Test
    void okResponseIsSuccessful() {
        ApiResponse<String> response = ApiResponse.ok("pong", "Ready");
        assertThat(response.success()).isTrue();
        assertThat(response.data()).isEqualTo("pong");
        assertThat(response.message()).isEqualTo("Ready");
        assertThat(response.pagination()).isNull();
        assertThat(response.errors()).isNull();
    }

    @Test
    void failureResponseOmitsData() {
        ApiResponse<Void> response = ApiResponse.failure("Unauthenticated");
        assertThat(response.success()).isFalse();
        assertThat(response.data()).isNull();
        assertThat(response.message()).isEqualTo("Unauthenticated");
    }
}
