import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import { randomUUID } from 'node:crypto';
import { AuthUser, JwtClaims } from './auth.types';
import { UsersService } from '../../services/users.service';

const ACCESS_TOKEN_COOKIE = 'homeplants_at';
const ID_TOKEN_COOKIE = 'homeplants_it';

function parseCookieHeader(header: string | undefined): Record<string, string> {
  if (!header) {
    return {};
  }

  return header
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((acc, part) => {
      const separatorIndex = part.indexOf('=');
      if (separatorIndex <= 0) {
        return acc;
      }

      const key = part.slice(0, separatorIndex).trim();
      const value = part.slice(separatorIndex + 1).trim();
      if (!key) {
        return acc;
      }

      acc[key] = decodeURIComponent(value);
      return acc;
    }, {});
}

@Injectable()
export class BearerJwtGuard implements CanActivate {
  private jwksResolver: JWTVerifyGetKey | null = null;
  private issuerForJwks: string | null = null;

  constructor(private readonly usersService: UsersService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<{ headers: Record<string, string | undefined>; user?: AuthUser }>();

    const issuer = (process.env.OIDC_ISSUER_URL ?? '').trim().replace(/\/$/, '');

    // Fallback automatico Dev User se OIDC non è configurato
    if (!issuer) {
      const devUser: AuthUser = {
        id: 'dev-user-00000000-0000-0000-0000-000000000000',
        subject: 'dev-user',
        email: 'dev@homeplants.local',
        displayName: 'Giardiniere Dev',
        pictureUrl: null,
      };
      const persistedUser = await this.usersService.ensureUser(devUser);
      request.user = {
        id: persistedUser.id,
        subject: persistedUser.subject,
        email: persistedUser.email,
        displayName: persistedUser.displayName,
        pictureUrl: persistedUser.pictureUrl,
      };
      return true;
    }

    const authorization = request.headers.authorization;
    const cookies = parseCookieHeader(request.headers.cookie);
    const bearerToken = authorization?.startsWith('Bearer ') ? authorization.slice('Bearer '.length).trim() : null;
    const token = bearerToken ?? cookies[ACCESS_TOKEN_COOKIE];
    const idToken = cookies[ID_TOKEN_COOKIE] ?? null;

    if (!token) {
      throw new UnauthorizedException('Missing authentication token');
    }

    const accessTokenClaims = await this.verifyToken(token);
    let claims: JwtClaims = accessTokenClaims;

    if (idToken && (!claims.email || !claims.name || !claims.preferred_username)) {
      const idTokenClaims = await this.tryVerifyToken(idToken);
      if (idTokenClaims) {
        claims = {
          sub: accessTokenClaims.sub ?? idTokenClaims.sub,
          email: accessTokenClaims.email ?? idTokenClaims.email,
          name: accessTokenClaims.name ?? idTokenClaims.name,
          preferred_username: accessTokenClaims.preferred_username ?? idTokenClaims.preferred_username,
          picture: accessTokenClaims.picture ?? idTokenClaims.picture,
        };
      }
    }

    if (!claims?.sub && !claims?.email && !claims?.name && !claims?.preferred_username) {
      throw new UnauthorizedException('Invalid token');
    }

    const transientUser: AuthUser = {
      id: claims.sub ?? claims.email ?? randomUUID(),
      subject: claims.sub ?? claims.email ?? 'unknown',
      email: claims.email ?? null,
      displayName: claims.name ?? claims.preferred_username ?? claims.email ?? 'HomePlants User',
      pictureUrl: claims.picture ?? null,
    };

    const persistedUser = await this.usersService.ensureUser(transientUser);
    request.user = {
      id: persistedUser.id,
      subject: persistedUser.subject,
      email: persistedUser.email,
      displayName: persistedUser.displayName,
      pictureUrl: persistedUser.pictureUrl,
    };

    return true;
  }

  private async verifyToken(token: string): Promise<JwtClaims> {
    const issuer = (process.env.OIDC_ISSUER_URL ?? '').trim().replace(/\/$/, '');
    const audience = (process.env.OIDC_CLIENT_ID ?? '').trim();
    if (!issuer || !audience) {
      throw new UnauthorizedException('OIDC_ISSUER_URL or OIDC_CLIENT_ID missing');
    }

    const jwks = await this.getJwksResolver(issuer);

    try {
      const result = await jwtVerify(token, jwks, {
        issuer,
        audience,
      });

      const payload = result.payload;
      return {
        sub: payload.sub,
        email: typeof payload['email'] === 'string' ? payload['email'] : undefined,
        name: typeof payload['name'] === 'string' ? payload['name'] : undefined,
        preferred_username:
          typeof payload['preferred_username'] === 'string' ? payload['preferred_username'] : undefined,
        picture: typeof payload['picture'] === 'string' ? payload['picture'] : undefined,
      };
    } catch (err: unknown) {
      throw new UnauthorizedException(err instanceof Error ? err.message : 'Invalid access token');
    }
  }

  private async tryVerifyToken(token: string): Promise<JwtClaims | null> {
    try {
      return await this.verifyToken(token);
    } catch {
      return null;
    }
  }

  private async getJwksResolver(issuer: string): Promise<JWTVerifyGetKey> {
    if (this.jwksResolver && this.issuerForJwks === issuer) {
      return this.jwksResolver;
    }

    const endpoint = `${issuer.replace(/\/$/, '')}/.well-known/openid-configuration`;
    const response = await fetch(endpoint);
    if (!response.ok) {
      throw new UnauthorizedException(`Unable to fetch OIDC configuration from ${endpoint}`);
    }

    const metadata = (await response.json()) as { jwks_uri?: string };
    if (!metadata.jwks_uri) {
      throw new UnauthorizedException('OIDC metadata is missing jwks_uri');
    }

    this.jwksResolver = createRemoteJWKSet(new URL(metadata.jwks_uri));
    this.issuerForJwks = issuer;
    return this.jwksResolver;
  }
}

