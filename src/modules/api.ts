import * as qs from 'qs';

import {Settings} from './settings';
import urlJoin from 'url-join';


export class Api {
    protected baseUrl: string = '';
    protected settings: Settings;

    constructor(settings: Settings) {
        this.settings = settings;
    }

    public async fetch(api: string, init: RequestInit): Promise<Response> {
        let url;
        if (api.match(/^https?:\/\//)) {
            url = api;
        } else {
            url = urlJoin(this.baseUrl, api);
        }
        const headers: { [key: string]: string } = init.headers as {} || {};
        if (headers['Accept'] == undefined) {
            headers['Accept'] = 'application/json';
        }
        if (headers['Content-Type'] == undefined) {
            headers['Content-Type'] = 'application/json';
        }
        init.headers = headers;

        return await fetch(url, init);
    }

    public async get(api: string, params: string | {}, headers: HeadersInit = {}) {
        const method = 'GET';
        if (typeof params !== 'string') {
            params = qs.stringify(params);
        }
        if (params) {
            params = `?${params}`;
        }
        const url = `${api}${params}`;

        return await this.fetch(url, {method, headers});
    }

    public async post(api: string, params: string | {}, headers: HeadersInit = {}) {
        const method = 'POST';
        const body = (typeof params === 'string') ? params : JSON.stringify(params);

        return await this.fetch(api, {method, headers, body});
    }

    public async patch(api: string, params: string | {}, headers: HeadersInit = {}) {
        const method = 'PATCH';
        const body = (typeof params === 'string') ? params : JSON.stringify(params);

        return await this.fetch(api, {method, headers, body});
    }
}

export class GoogleDriveApi extends Api {
    protected baseUrl = 'https://www.googleapis.com/drive/v3';
    protected uploadUrl = 'https://www.googleapis.com/upload/drive/v3';
    protected authUrl = 'https://accounts.google.com/o/oauth2/auth';
    protected clientID: string;

    constructor(settings: Settings) {
        super(settings);
        this.clientID = settings.googleDriveApiKey;
    }

    public async authenticate(): Promise<string> {
        const params = {
            client_id: this.clientID,
            response_type: 'token',
            redirect_uri: browser.identity.getRedirectURL() + 'callback',
            scope: ["https://www.googleapis.com/auth/drive"].join(' '),
        };
        const returnURL = await browser.identity.launchWebAuthFlow({
            interactive: true,
            url: this.authUrl + '?' + qs.stringify(params),
        });

        const query = new URL(returnURL).hash.replace('#', '?');
        const token = new URLSearchParams(query).get('access_token');
        console.log(`authenticate: ${token}`);
        return token || '';
    }

    public async fetch(url: string, init: RequestInit): Promise<Response> {
        // upload の時だけ baseUrl が変わる変態設計
        if (url.startsWith(`upload/`)) {
            url = urlJoin(this.uploadUrl, url.replace(`upload/`, ''));
        }

        // ヘッダに Authorization を仕込む
        if (init.headers == undefined) {
            init.headers = {};
        }
        (init.headers as { [key: string]: string })['Authorization'] = `Bearer ${this.settings.googleDriveAuthInfo}`;

        let response = await super.fetch(url, init);

        // 401 エラーの時はトークンを取り直して一回だけリトライする
        if (response.status === 401) {
            this.settings.googleDriveAuthInfo = await this.authenticate();
            this.settings.save().then();
            (init.headers as {
                [key: string]: string
            })['Authorization'] = `Bearer ${this.settings.googleDriveAuthInfo}`;
            response = await super.fetch(url, init);
        }
        return response;
    }
}
