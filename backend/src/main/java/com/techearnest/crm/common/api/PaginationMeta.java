package com.techearnest.crm.common.api;

import org.springframework.data.domain.Page;

public record PaginationMeta(int page, int size, long totalElements, int totalPages) {

    public static PaginationMeta from(Page<?> page) {
        return new PaginationMeta(
                page.getNumber(),
                page.getSize(),
                page.getTotalElements(),
                page.getTotalPages());
    }
}
