package de.htw.chatroomapi.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
public class SecurityConfig {

    @Bean
    SecurityFilterChain securityFilterChain(
            HttpSecurity http,
            @Value("${auth.required:false}") boolean authRequired,
            @Value("${auth.issuer:}") String issuer,
            @Value("${auth.jwk-set-uri:}") String configuredJwkSetUri,
            @Value("${auth.audience:}") String audience) throws Exception {
        http.csrf(AbstractHttpConfigurer::disable)
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS));

        if (!authRequired) {
            http.authorizeHttpRequests(authorize -> authorize.anyRequest().permitAll());
            return http.build();
        }

        if (issuer.isBlank()) {
            throw new IllegalStateException("ZITADEL_ISSUER is required when AUTH_REQUIRED=true");
        }
        String jwkSetUri = configuredJwkSetUri.isBlank()
                ? issuer.replaceAll("/$", "") + "/oauth/v2/keys"
                : configuredJwkSetUri;

        http.authorizeHttpRequests(authorize -> authorize.anyRequest().authenticated())
                .oauth2ResourceServer(oauth2 -> oauth2.jwt(jwt -> jwt.decoder(
                        jwtDecoder(issuer, jwkSetUri, audience))));
        return http.build();
    }

    private JwtDecoder jwtDecoder(String issuer, String jwkSetUri, String audience) {
        NimbusJwtDecoder decoder = NimbusJwtDecoder.withJwkSetUri(jwkSetUri).build();
        OAuth2TokenValidator<Jwt> validator = JwtValidators.createDefaultWithIssuer(issuer);

        if (!audience.isBlank()) {
            OAuth2TokenValidator<Jwt> audienceValidator = token -> {
                if (token.getAudience().contains(audience)) {
                    return OAuth2TokenValidatorResult.success();
                }
                OAuth2Error error = new OAuth2Error(
                        "invalid_token",
                        "Token audience does not include the configured API audience",
                        null);
                return OAuth2TokenValidatorResult.failure(error);
            };
            validator = new DelegatingOAuth2TokenValidator<>(validator, audienceValidator);
        }

        decoder.setJwtValidator(validator);
        return decoder;
    }
}
