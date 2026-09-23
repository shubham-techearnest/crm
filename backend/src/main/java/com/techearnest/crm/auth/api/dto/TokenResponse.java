package com.techearnest.crm.auth.api.dto;

public record TokenResponse(String accessToken, long expiresIn, String tokenType) {}
