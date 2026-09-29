package com.techearnest.crm.common.api;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record ApiResponse<T>(
        boolean success,
        T data,
        String message,
        PaginationMeta pagination,
        List<FieldErrorDetail> errors,
        String code) {

    public static <T> ApiResponse<T> ok(T data, String message) {
        return new ApiResponse<>(true, data, message, null, null, null);
    }

    public static <T> ApiResponse<T> ok(T data) {
        return ok(data, null);
    }

    public static <T> ApiResponse<T> page(T data, PaginationMeta pagination) {
        return new ApiResponse<>(true, data, null, pagination, null, null);
    }

    public static <T> ApiResponse<T> page(T data, String message, PaginationMeta pagination) {
        return new ApiResponse<>(true, data, message, pagination, null, null);
    }

    public static <T> ApiResponse<T> failure(String message, List<FieldErrorDetail> errors) {
        return new ApiResponse<>(false, null, message, null, errors, null);
    }

    public static <T> ApiResponse<T> failure(String message) {
        return failure(message, null);
    }

    public static <T> ApiResponse<T> failure(String code, String message, List<FieldErrorDetail> errors) {
        return new ApiResponse<>(false, null, message, null, errors, code);
    }
}
