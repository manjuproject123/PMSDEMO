package com.aseuro.pms.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class LoginRequest {
    private String email;
    private String identifier;
    private String password;
    private String role;

    public LoginRequest(String email, String password, String role) {
        this.email = email;
        this.password = password;
        this.role = role;
    }

    public String getEmail() {
        if (email != null && !email.trim().isEmpty()) {
            return email;
        }
        return identifier;
    }

    public String email() {
        return getEmail();
    }

    public String password() {
        return this.password;
    }

    public String role() {
        return this.role;
    }
}
