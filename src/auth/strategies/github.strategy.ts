import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-github2';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
    constructor(private configService: ConfigService) {
        super({
            clientID: configService.get<string>('GITHUB_CLIENT_ID') || 'placeholder',
            clientSecret:
                configService.get<string>('GITHUB_CLIENT_SECRET') || 'placeholder',
            callbackURL:
                configService.get<string>('GITHUB_CALLBACK_URL') ||
                'http://localhost:3000/api/auth/github/callback',
            scope: ['user:email'],
        });
    }

    async validate(
        accessToken: string,
        refreshToken: string,
        profile: Profile,
        done: (err: any, user: any, info?: any) => void,
    ): Promise<any> {
        const { id, username, emails, photos } = profile;
        const user = {
            providerId: id,
            email: emails?.[0]?.value || `${username}@github.com`,
            firstName: profile.displayName?.split(' ')[0] || username,
            lastName: profile.displayName?.split(' ').slice(1).join(' ') || '',
            avatar: photos?.[0]?.value,
            provider: 'GITHUB',
        };
        done(null, user);
    }
}

