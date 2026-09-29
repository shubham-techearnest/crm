package com.techearnest.crm.common.exception;

import com.techearnest.crm.common.api.ApiResponse;
import com.techearnest.crm.common.api.FieldErrorDetail;
import jakarta.validation.ConstraintViolationException;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.validation.FieldError;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.support.MissingServletRequestPartException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<ApiResponse<Void>> handleApiException(ApiException ex) {
        log.warn("API exception [{}]: {}", ex.getCode(), ex.getMessage());
        return error(ex.getStatus(), ex.getCode(), ex.getMessage(), null);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Void>> handleValidation(MethodArgumentNotValidException ex) {
        List<FieldErrorDetail> errors = ex.getBindingResult().getFieldErrors().stream()
                .map(this::toDetail)
                .toList();
        return error(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", "Validation failed", errors);
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<ApiResponse<Void>> handleConstraintViolation(ConstraintViolationException ex) {
        List<FieldErrorDetail> errors = ex.getConstraintViolations().stream()
                .map(v -> new FieldErrorDetail(v.getPropertyPath().toString(), "INVALID", v.getMessage()))
                .toList();
        return error(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", "Validation failed", errors);
    }

    @ExceptionHandler(HandlerMethodValidationException.class)
    public ResponseEntity<ApiResponse<Void>> handleMethodValidation(HandlerMethodValidationException ex) {
        return error(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", "Validation failed", null);
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ApiResponse<Void>> handleUnreadable(HttpMessageNotReadableException ex) {
        return error(HttpStatus.BAD_REQUEST, "MALFORMED_BODY", "Malformed request body", null);
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ApiResponse<Void>> handleTypeMismatch(MethodArgumentTypeMismatchException ex) {
        return error(
                HttpStatus.BAD_REQUEST,
                "INVALID_PARAMETER",
                "Invalid value for parameter '" + ex.getName() + "'",
                List.of(new FieldErrorDetail(ex.getName(), "INVALID", "Invalid value")));
    }

    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseEntity<ApiResponse<Void>> handleMissingParameter(MissingServletRequestParameterException ex) {
        return error(
                HttpStatus.BAD_REQUEST,
                "MISSING_PARAMETER",
                "Missing required parameter '" + ex.getParameterName() + "'",
                List.of(new FieldErrorDetail(ex.getParameterName(), "REQUIRED", "Required")));
    }

    @ExceptionHandler(MissingServletRequestPartException.class)
    public ResponseEntity<ApiResponse<Void>> handleMissingPart(MissingServletRequestPartException ex) {
        return error(
                HttpStatus.BAD_REQUEST,
                "MISSING_PARAMETER",
                "Missing required part '" + ex.getRequestPartName() + "'",
                List.of(new FieldErrorDetail(ex.getRequestPartName(), "REQUIRED", "Required")));
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<ApiResponse<Void>> handleMethodNotSupported(HttpRequestMethodNotSupportedException ex) {
        return error(HttpStatus.METHOD_NOT_ALLOWED, "METHOD_NOT_ALLOWED", "HTTP method not supported", null);
    }

    @ExceptionHandler(HttpMediaTypeNotSupportedException.class)
    public ResponseEntity<ApiResponse<Void>> handleMediaType(HttpMediaTypeNotSupportedException ex) {
        return error(
                HttpStatus.UNSUPPORTED_MEDIA_TYPE, "UNSUPPORTED_MEDIA_TYPE", "Unsupported content type", null);
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<ApiResponse<Void>> handleUploadTooLarge(MaxUploadSizeExceededException ex) {
        return error(HttpStatus.PAYLOAD_TOO_LARGE, "FILE_TOO_LARGE", "Uploaded file is too large", null);
    }

    @ExceptionHandler(ObjectOptimisticLockingFailureException.class)
    public ResponseEntity<ApiResponse<Void>> handleOptimisticLock(ObjectOptimisticLockingFailureException ex) {
        return error(
                HttpStatus.CONFLICT,
                "STALE_VERSION",
                "This record was changed by someone else. Reload and try again.",
                null);
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ApiResponse<Void>> handleDataIntegrity(DataIntegrityViolationException ex) {
        log.warn("Data integrity violation: {}", ex.getMostSpecificCause().getMessage());
        return error(
                HttpStatus.CONFLICT,
                "DATA_CONFLICT",
                "The change conflicts with existing data (duplicate or referenced record).",
                null);
    }

    @ExceptionHandler(AuthenticationException.class)
    public ResponseEntity<ApiResponse<Void>> handleAuthentication(AuthenticationException ex) {
        return error(HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED", "Unauthenticated", null);
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ApiResponse<Void>> handleAccessDenied(AccessDeniedException ex) {
        return error(
                HttpStatus.FORBIDDEN, "FORBIDDEN", "You do not have permission to perform this action", null);
    }

    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<ApiResponse<Void>> handleNoResource(NoResourceFoundException ex) {
        return error(HttpStatus.NOT_FOUND, "NOT_FOUND", "Resource not found", null);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Void>> handleUnexpected(Exception ex) {
        log.error("Unhandled exception", ex);
        return error(HttpStatus.INTERNAL_SERVER_ERROR, "INTERNAL_ERROR", "An unexpected error occurred", null);
    }

    private static ResponseEntity<ApiResponse<Void>> error(
            HttpStatus status, String code, String message, List<FieldErrorDetail> errors) {
        return ResponseEntity.status(status).body(ApiResponse.failure(code, message, errors));
    }

    private FieldErrorDetail toDetail(FieldError error) {
        String code = error.getCode() == null ? "INVALID" : error.getCode();
        return new FieldErrorDetail(error.getField(), code, error.getDefaultMessage());
    }
}
