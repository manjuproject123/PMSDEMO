package com.aseuro.pms.controller;

import com.aseuro.pms.dto.ForgotPasswordRequest;
import com.aseuro.pms.dto.LoginRequest;
import com.aseuro.pms.dto.LoginResponse;
import com.aseuro.pms.model.Employee;
import com.aseuro.pms.model.Role;
import com.aseuro.pms.repository.EmployeeRepository;
import com.aseuro.pms.security.JwtTokenProvider;
import com.aseuro.pms.security.UserPrincipal;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping({"/api/auth", "/auth"})
public class AuthController {

    private final AuthenticationManager authenticationManager;
    private final JwtTokenProvider tokenProvider;
    private final EmployeeRepository employeeRepository;

    public AuthController(AuthenticationManager authenticationManager, JwtTokenProvider tokenProvider, EmployeeRepository employeeRepository) {
        this.authenticationManager = authenticationManager;
        this.tokenProvider = tokenProvider;
        this.employeeRepository = employeeRepository;
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest loginRequest) {
        if (loginRequest.getEmail() == null || loginRequest.getEmail().trim().isEmpty()) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("message", "Email address is required."));
        }

        String email = loginRequest.getEmail().trim();
        Optional<Employee> empOpt = employeeRepository.findByEmail(email);

        if (empOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("message", "Invalid email or password."));
        }

        Employee emp = empOpt.get();

        // 1. Check Server-Side Account Lock Status
        if (emp.getLockedUntil() != null) {
            java.time.LocalDateTime now = java.time.LocalDateTime.now();
            if (now.isBefore(emp.getLockedUntil())) {
                long remainingSecs = java.time.Duration.between(now, emp.getLockedUntil()).getSeconds();
                if (remainingSecs < 0) remainingSecs = 0;

                Map<String, Object> lockResponse = new HashMap<>();
                lockResponse.put("message", "Too many failed login attempts. Your account has been temporarily locked for 5 minutes.");
                lockResponse.put("locked", true);
                lockResponse.put("lockedUntil", emp.getLockedUntil().toString());
                lockResponse.put("remainingSeconds", remainingSecs);
                return ResponseEntity.status(HttpStatus.LOCKED).body(lockResponse);
            } else {
                // Lock has expired - automatically reset
                emp.setFailedLoginAttempts(0);
                emp.setLockedUntil(null);
                employeeRepository.save(emp);
            }
        }

        // 2. Validate Role if explicitly requested
        String requestedRole = loginRequest.getRole();
        if (requestedRole != null && !requestedRole.trim().isEmpty()) {
            String roleUpper = requestedRole.trim().toUpperCase();
            if (roleUpper.equals("HR") || roleUpper.equals("ROLE_HR")) {
                if (emp.getRole() != Role.ROLE_HR) {
                    return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                            .body(Map.of("message", "Invalid HR email ID."));
                }
            } else if (roleUpper.equals("MANAGER") || roleUpper.equals("ROLE_MANAGER")) {
                if (emp.getRole() != Role.ROLE_MANAGER) {
                    return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                            .body(Map.of("message", "Invalid email ID."));
                }
            } else if (roleUpper.equals("EMPLOYEE") || roleUpper.equals("ROLE_EMPLOYEE")) {
                if (emp.getRole() != Role.ROLE_EMPLOYEE) {
                    return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                            .body(Map.of("message", "Invalid Employee email ID."));
                }
            }
        }

        // 3. Validate Account Active Status
        if (emp.getAccountStatus() != null && !"ACTIVE".equalsIgnoreCase(emp.getAccountStatus())) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("message", "Account is inactive. Please contact HR."));
        }

        // 4. Authenticate Credentials
        try {
            Authentication authentication = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(
                            email,
                            loginRequest.getPassword()
                    )
            );

            SecurityContextHolder.getContext().setAuthentication(authentication);
            String jwt = tokenProvider.generateToken(authentication);
            UserPrincipal userPrincipal = (UserPrincipal) authentication.getPrincipal();

            // Reset failed login attempts on successful login
            if ((emp.getFailedLoginAttempts() != null && emp.getFailedLoginAttempts() > 0) || emp.getLockedUntil() != null) {
                emp.setFailedLoginAttempts(0);
                emp.setLockedUntil(null);
                employeeRepository.save(emp);
            }

            return ResponseEntity.ok(LoginResponse.builder()
                    .token(jwt)
                    .tokenType("Bearer")
                    .id(userPrincipal.getId())
                    .email(userPrincipal.getUsername())
                    .name(userPrincipal.getEmployee().getName())
                    .role(userPrincipal.getEmployee().getRole().name())
                    .build());
        } catch (Exception e) {
            // Track consecutive failed login attempts
            int currentAttempts = (emp.getFailedLoginAttempts() != null ? emp.getFailedLoginAttempts() : 0) + 1;
            emp.setFailedLoginAttempts(currentAttempts);

            if (currentAttempts >= 5) {
                java.time.LocalDateTime lockExpiry = java.time.LocalDateTime.now().plusMinutes(5);
                emp.setLockedUntil(lockExpiry);
                employeeRepository.save(emp);

                Map<String, Object> lockResponse = new HashMap<>();
                lockResponse.put("message", "Too many failed login attempts. Your account has been temporarily locked for 5 minutes.");
                lockResponse.put("locked", true);
                lockResponse.put("lockedUntil", lockExpiry.toString());
                lockResponse.put("remainingSeconds", 300L);
                return ResponseEntity.status(HttpStatus.LOCKED).body(lockResponse);
            } else {
                employeeRepository.save(emp);
                int remainingAttempts = 5 - currentAttempts;

                Map<String, Object> errorResponse = new HashMap<>();
                errorResponse.put("message", "Invalid email or password.");
                errorResponse.put("failedAttempts", currentAttempts);
                errorResponse.put("remainingAttempts", remainingAttempts);
                errorResponse.put("locked", false);
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(errorResponse);
            }
        }
    }

    @GetMapping("/lock-status")
    public ResponseEntity<?> getLockStatus(@RequestParam String email) {
        if (email == null || email.trim().isEmpty()) {
            return ResponseEntity.ok(Map.of("locked", false));
        }

        Optional<Employee> empOpt = employeeRepository.findByEmail(email.trim());
        if (empOpt.isEmpty() || empOpt.get().getLockedUntil() == null) {
            return ResponseEntity.ok(Map.of("locked", false));
        }

        Employee emp = empOpt.get();
        java.time.LocalDateTime now = java.time.LocalDateTime.now();

        if (now.isBefore(emp.getLockedUntil())) {
            long remainingSecs = java.time.Duration.between(now, emp.getLockedUntil()).getSeconds();
            return ResponseEntity.ok(Map.of(
                    "locked", true,
                    "lockedUntil", emp.getLockedUntil().toString(),
                    "remainingSeconds", Math.max(0, remainingSecs),
                    "message", "Account temporarily locked."
            ));
        } else {
            emp.setFailedLoginAttempts(0);
            emp.setLockedUntil(null);
            employeeRepository.save(emp);
            return ResponseEntity.ok(Map.of("locked", false));
        }
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<Map<String, String>> forgotPassword(@RequestBody ForgotPasswordRequest forgotPasswordRequest) {
        Map<String, String> response = new HashMap<>();
        response.put("message", "If an account with " + forgotPasswordRequest.getEmail() + " exists, a password reset link has been sent.");
        return ResponseEntity.ok(response);
    }
}
