"""Confidential OIDC code flow. No provider tokens are persisted or returned to the browser."""

import time
from urllib.parse import urlparse

from authlib.integrations.httpx_client import OAuth2Client
from authlib.oidc.core import CodeIDToken
from joserfc import jwt
from joserfc.jwk import KeySet

from app.modules.administration.security import derived


def https_endpoint(value):
    parsed = urlparse(value)
    if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.fragment:
        raise ValueError("Invalid provider endpoint")
    return value


class OIDCProvider:
    def __init__(self, settings):
        self.settings = settings
        self.redirect_uri = settings.admin_web_origin + "/api/admin/callback"

    def metadata(self, client):
        response = client.request(
            "GET", self.settings.admin_oidc_issuer.rstrip("/") + "/.well-known/openid-configuration", auth=None
        )
        response.raise_for_status()
        metadata = response.json()
        if (
            metadata.get("issuer") != self.settings.admin_oidc_issuer
            or "S256" not in metadata.get("code_challenge_methods_supported", [])
            or "code" not in metadata.get("response_types_supported", [])
            or "client_secret_basic" not in metadata.get("token_endpoint_auth_methods_supported", [])
        ):
            raise ValueError("Unsupported provider configuration")
        for endpoint in ("authorization_endpoint", "token_endpoint", "jwks_uri"):
            https_endpoint(metadata[endpoint])
        return metadata

    def client(self):
        return OAuth2Client(
            self.settings.admin_oidc_client_id,
            self.settings.admin_oidc_client_secret.get_secret_value(),
            token_endpoint_auth_method="client_secret_basic",
            scope="openid",
            redirect_uri=self.redirect_uri,
            code_challenge_method="S256",
            timeout=10,
            follow_redirects=False,
            trust_env=False,
        )

    def authorization_url(self, state, binding):
        with self.client() as client:
            metadata = self.metadata(client)
            options = {"max_age": 300, "prompt": "login"}
            if self.settings.admin_oidc_mfa_claim == "acr":
                options["acr_values"] = " ".join(self.settings.admin_oidc_mfa_values)
            url, _ = client.create_authorization_url(
                metadata["authorization_endpoint"],
                state=state,
                nonce=derived(binding, "nonce:" + state),
                code_verifier=derived(binding, "pkce:" + state),
                **options,
            )
            return url

    def authenticate(self, code, state, binding):
        with self.client() as client:
            metadata = self.metadata(client)
            token = client.fetch_token(
                metadata["token_endpoint"], code=code, code_verifier=derived(binding, "pkce:" + state)
            )
            response = client.request("GET", metadata["jwks_uri"], auth=None)
            response.raise_for_status()
            keys = KeySet.import_key_set(response.json())
            return self.validate_id_token(token, keys, derived(binding, "nonce:" + state))

    def validate_id_token(self, token, keys, nonce):
        # Fixed asymmetric algorithm allowlist, never algorithms chosen by an incoming token.
        decoded = jwt.decode(token["id_token"], keys, algorithms=["RS256", "ES256"])
        claims = CodeIDToken(
            decoded.claims,
            decoded.header,
            options={
                "iss": {"essential": True, "value": self.settings.admin_oidc_issuer},
                "aud": {"essential": True, "value": self.settings.admin_oidc_client_id},
                "auth_time": {"essential": True},
            },
            params={
                "nonce": nonce,
                "client_id": self.settings.admin_oidc_client_id,
                "max_age": 300,
                "access_token": token.get("access_token"),
            },
        )
        claims.validate(leeway=30)
        authenticated = claims["auth_time"]
        if isinstance(authenticated, bool) or not time.time() - 330 <= authenticated <= time.time() + 30:
            raise ValueError("Stale authentication")
        subject = claims["sub"]
        if not isinstance(subject, str) or not 1 <= len(subject) <= 255:
            raise ValueError("Invalid subject")
        evidence = claims.get(self.settings.admin_oidc_mfa_claim)
        if self.settings.admin_oidc_mfa_claim == "acr" and not isinstance(evidence, str):
            raise ValueError("Invalid MFA evidence")
        values = evidence if isinstance(evidence, list) else [evidence]
        if not any(value in self.settings.admin_oidc_mfa_values for value in values):
            raise ValueError("Required MFA evidence missing")
        return self.settings.admin_oidc_issuer, subject
