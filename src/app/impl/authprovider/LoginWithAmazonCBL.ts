import * as application from "tns-core-modules/application";
import {AuthHandler} from "../authprovider/AuthHandler";
import {AuthStateObserver} from "../authprovider/AuthStateObserver";
import {NetworkConnectionObserver} from "../networkinfoprovider/NetworkConnectionObserver";
import * as utils from "tns-core-modules/utils/utils";

declare var com: any;

export class LoginWithAmazonCBL implements AuthHandler, NetworkConnectionObserver {
    public sResponseOk = 200;

    // Refresh access token 2 minutes before it expires
    public sRefreshAccessTokenTime = 120000;

    // Poll every 10 seconds when requesting device token
    private sPollInterval = 10;

    // CBL auth endpoint URLs
    private sBaseEndpointUrl = "https://api.amazon.com/auth/O2/";
    public sAuthRequestUrl = this.sBaseEndpointUrl + "create/codepair";
    public sTokenRequestUrl = this.sBaseEndpointUrl + "token";
    public sTokenVerificationRequestUrl = this.sBaseEndpointUrl + "tokeninfo?access_token=";
    public sProfileRequestUrl = "https://api.amazon.com/user/profile";

    //    To fetch User Profile data, set the sUserProfileEnabled to true
    //    You will need additional parameters in your Security Profile for the profile scope request to succeed,
    //    please see the README CBL section for more.
    private sUserProfileEnabled = false;
    public sScopeValue = this.sUserProfileEnabled ? "alexa:all+profile" : "alexa:all";

    public mPreferences: any;
    private mActivity: any;
    public context: any;

    private mExecutor = java.util.concurrent.Executors.newSingleThreadExecutor();
    public mClientId: string;
    public mProductID: string;
    public mProductDSN: string;

    private mObservers: Array<any>;

    public mCurrentAuthState: any;
    public mCurrentAuthError: any;
    public mCurrentAuthToken: string;

    public mConnected = true;

    private mTimer = new java.util.Timer();
    private mAuthorizationTimerTask: any;
    private mRefreshTimerTask: any;

    constructor(activity, context) {
        this.mActivity = activity;
        this.context = context;
        const preferenceFileKeyId = this.context.getResources().getIdentifier("preference_file_key", "string", this.mActivity.getPackageName());
        this.mPreferences = this.mActivity.getSharedPreferences(this.mActivity.getString(preferenceFileKeyId),
            android.content.Context.MODE_PRIVATE);

        this.mProductDSN = this.mPreferences.getString(this.context.getResources().getString(utils.ad.resources.getStringId('preference_product_dsn')), "");
        this.mClientId = this.mPreferences.getString(this.context.getResources().getString(utils.ad.resources.getStringId('preference_client_id')), "");
        this.mProductID = this.mPreferences.getString(this.context.getResources().getString(utils.ad.resources.getStringId('preference_product_id')), "");

        this.mObservers = [];

        this.mCurrentAuthState = com.amazon.aace.alexa.AuthProvider.AuthState.UNINITIALIZED;
        this.mCurrentAuthError = com.amazon.aace.alexa.AuthProvider.AuthError.NO_ERROR;
        this.mCurrentAuthToken = "";
    }

    private requestDeviceAuthorization() {
        this.mExecutor.submit(new requestDeviceAuthorizationTask(this));
    }

    public getResponseJSON(inStream) {
        if (inStream != null) {
            let inputLine: string;
            const response = new java.lang.StringBuilder();
            const input = new java.io.BufferedReader(new java.io.InputStreamReader(inStream));

            try {
                while ((inputLine = input.readLine()) != null) response.append(inputLine);
                return new org.json.JSONObject(response.toString());
            } catch (e) {
            } finally {
                try {
                    inStream.close();
                } catch (e) {
                }
            }
        }
        return null;
    }

    public startRefreshTimer(delaySeconds: number, refreshToken: string) {
        const that = this;
        this.mRefreshTimerTask = new timerTaskSchedule();
        this.mRefreshTimerTask.run = function () {
            if (!that.mConnected) {
                that.mCurrentAuthState = com.amazon.aace.alexa.AuthProvider.AuthState.EXPIRED;
                that.mCurrentAuthError = com.amazon.aace.alexa.AuthProvider.AuthError.AUTHORIZATION_EXPIRED;
                that.mCurrentAuthToken = "";
                that.notifyAuthObservers();
            } else this.refreshAuthToken(refreshToken);
        }

        this.mTimer.schedule(this.mRefreshTimerTask, delaySeconds * 1000 - this.sRefreshAccessTokenTime);
    }

    public refreshAuthToken(refreshToken: string) {
        this.mExecutor.submit(new refreshAuthTokenTask(refreshToken, this));
    }

    public notifyAuthObservers() {
        if (this.mObservers == null) return;
        const that = this;
        this.mObservers.forEach(function (observer) {
            observer.onAuthStateChanged(that.mCurrentAuthState, that.mCurrentAuthError, that.mCurrentAuthToken);
        });
    }

    private requestUserProfile(accessToken: string) {
        let urlConnection = null;
        try {
            // token authenticity verification
            let requestUrl = new java.net.URL(this.sTokenVerificationRequestUrl + java.net.URLEncoder.encode(accessToken, "UTF-8"));

            urlConnection = requestUrl.openConnection();
            urlConnection.setRequestMethod("GET");
            urlConnection.setRequestProperty("Host", "api.amazon.com");
            urlConnection.setRequestProperty("access_token", java.net.URLEncoder.encode(accessToken, "UTF-8"));

            const responseCode = urlConnection.getResponseCode();

            if (responseCode == java.net.HttpURLConnection.HTTP_OK) {
                const responseJSON = this.getResponseJSON(urlConnection.getInputStream());
                urlConnection.disconnect();
                if (responseJSON == null) {
                } else {
                    if (this.mClientId != responseJSON.getString("aud")) {
                    } else {
                        try {
                            requestUrl = new java.net.URL(this.sProfileRequestUrl);
                            urlConnection = requestUrl.openConnection();
                            urlConnection.setRequestMethod("GET");
                            urlConnection.setRequestProperty("Host", "api.amazon.com");
                            urlConnection.setRequestProperty("Authorization", "bearer " + accessToken);
                            urlConnection.getResponseCode();
                            if (urlConnection != null) {
                                urlConnection.disconnect();
                            }
                        } catch (e) {

                        }
                    }
                }
            }
        } catch (e) {

        }
    }

    public requestDeviceToken(response) {
        try {
            const deviceCode = response.getString("device_code");
            const userCode = response.getString("user_code");
            const expirySeconds = response.getString("expires_in");
            const urlParameters = "grant_type=device_code"
                + "&device_code=" + deviceCode
                + "&user_code=" + userCode;

            let i = (java.lang.Integer.parseInt(expirySeconds)) / this.sPollInterval;
            this.mAuthorizationTimerTask = new timerTaskSchedule();
            const that = this;
            this.mAuthorizationTimerTask.run = function () {
                if (i > 0) {
                    let con = null;
                    let os = null;
                    let input = null;
                    try {
                        const obj = new java.net.URL(that.sTokenRequestUrl);
                        con = obj.openConnection();

                        con.setRequestMethod("POST");
                        con.setRequestProperty("Host", "api.amazon.com");
                        con.setRequestProperty("Content-Type", "application/x-www-form-urlencoded");

                        con.setDoOutput(true);

                        os = new java.io.DataOutputStream(con.getOutputStream());
                        os.writeBytes(urlParameters);

                        const responseCode = con.getResponseCode();
                        if (responseCode == that.sResponseOk) {
                            this.cancel();
                            input = new java.io.BufferedReader(new java.io.InputStreamReader(con.getInputStream()));
                            let inputLine: string;
                            let response = new java.lang.StringBuilder();

                            while ((inputLine = input.readLine()) != null) {
                                response.append(inputLine);
                            }

                            const responseJSON = new org.json.JSONObject(response.toString());
                            that.mCurrentAuthToken = responseJSON.getString("access_token");
                            const refreshToken = responseJSON.getString("refresh_token");
                            const expiresInSeconds = responseJSON.getString("expires_in");

                            // Write refresh token to shared preferences
                            const editor = that.mPreferences.edit();
                            editor.putString(that.context.getResources().getString(utils.ad.resources.getStringId('preference_refresh_token')), refreshToken);
                            editor.apply();

                            // Refresh access token automatically before expiry
                            that.startRefreshTimer(+expiresInSeconds, refreshToken);

                            that.mCurrentAuthState = com.amazon.aace.alexa.AuthProvider.AuthState.REFRESHED;
                            that.mCurrentAuthError = com.amazon.aace.alexa.AuthProvider.AuthError.NO_ERROR;
                            that.notifyAuthObservers();

                            // Fetch User Profile if profile scope was authorized
                            if (that.sScopeValue.indexOf('profile') >= 0) {
                                that.requestUserProfile(that.mCurrentAuthToken);
                            }
                        }
                    } catch (e) {
                        this.cancel();
                        return;
                    } finally {
                        if (con != null) con.disconnect();
                        if (os != null) {
                            try {
                                os.flush();
                                os.close();
                            } catch (e) {
                            }
                        }
                        if (input != null) {
                            try {
                                input.close();
                            } catch (e) {
                            }
                        }
                    }
                    i--;
                } else {
                    this.cancel();
                    // Prompt to attempt authorization again
                    const expiredMessage = "The code has expired. Retry to generate a new code.";
                    try {
                        // Log code expired card
                        const renderJSON = new org.json.JSONObject();
                        renderJSON.put("message", expiredMessage);
                    } catch (e) {
                        return;
                    }
                }
            }

            this.mTimer.schedule(this.mAuthorizationTimerTask, 0, this.sPollInterval * 1000);
        } catch (e) {
        }
    }

    authorize() {
        if ( this.mConnected ) {
            if ( this.mAuthorizationTimerTask != null ) {
                this.mAuthorizationTimerTask.cancel();
            }
            this.requestDeviceAuthorization();
        } else {
            const builder = new android.app.AlertDialog.Builder( this.mActivity ) ;
            builder.setTitle( "Internet not available" );
            builder.setIcon( android.R.drawable.ic_dialog_alert );
            builder.setMessage( "Please verify your network settings." );
            builder.setCancelable( false );
            builder.setPositiveButton( "OK", null );
            const alert = builder.create();
            alert.show();
        }
    }

    public deauthorize() {
        // stop refresh timer task
        if ( this.mRefreshTimerTask != null ) this.mRefreshTimerTask.cancel();

        // Clear refresh token in preferences
        const editor = this.mPreferences.edit();
        editor.putString( this.context.getResources().getString(utils.ad.resources.getStringId('preference_refresh_token')), "" );
        editor.apply();

        this.mCurrentAuthState = com.amazon.aace.alexa.AuthProvider.AuthState.UNINITIALIZED;
        this.mCurrentAuthError = com.amazon.aace.alexa.AuthProvider.AuthError.NO_ERROR;
        this.mCurrentAuthToken = "";
        this.notifyAuthObservers();
    }

    public onConnectionStatusChanged(status) {
        if (status == com.amazon.aace.network.NetworkInfoProvider.NetworkStatus.CONNECTED) {
            this.mConnected = true;
        } else this.mConnected = false;
        this.mExecutor.execute(new ConnectionStateChangedRunnable(this.mConnected, this));
    }

    public registerAuthStateObserver(observer: AuthStateObserver) {
        if (observer == null) return;
        this.mObservers.push(observer);
        observer.onAuthStateChanged(this.mCurrentAuthState, this.mCurrentAuthError, this.mCurrentAuthToken);
    }
}


export class timerTaskSchedule extends java.util.TimerTask {
    constructor() {
        super();
    }
}

export class requestDeviceAuthorizationTask implements java.lang.Runnable {
    public wait(): void;
    public wait(param0: number): void;
    public wait(param0: number, param1: number): void;
    public wait(param0?: any, param1?: any) {
        throw new Error("Method not implemented.");
    }

    public equals(param0: any): boolean {
        throw new Error("Method not implemented.");
    }

    public clone() {
        throw new Error("Method not implemented.");
    }

    public toString(): string {
        throw new Error("Method not implemented.");
    }

    public notify(): void {
        throw new Error("Method not implemented.");
    }

    public getClass(): java.lang.Class<any> {
        throw new Error("Method not implemented.");
    }

    public finalize(): void {
        throw new Error("Method not implemented.");
    }

    public hashCode(): number {
        throw new Error("Method not implemented.");
    }

    public notifyAll(): void {
        throw new Error("Method not implemented.");
    }

    private sDefaultRegExpr = "^<[^>]*>$";

    constructor(private LoginWithAmazonCBL: LoginWithAmazonCBL) {
    }

    public run() {
        try {
            if (!java.util.regex.Pattern.matches(this.sDefaultRegExpr, this.LoginWithAmazonCBL.mClientId)) {
                const scopeData = new org.json.JSONObject();
                const data = new org.json.JSONObject();
                const productInstanceAttributes = new org.json.JSONObject();

                productInstanceAttributes.put("deviceSerialNumber", this.LoginWithAmazonCBL.mProductDSN);
                data.put("productInstanceAttributes", productInstanceAttributes);
                data.put("productID", this.LoginWithAmazonCBL.mProductID);
                scopeData.put("alexa:all", data);

                const urlParameters = "response_type=device_code"
                    + "&client_id=" + this.LoginWithAmazonCBL.mClientId
                    + "&scope=" + this.LoginWithAmazonCBL.sScopeValue
                    + "&scope_data=" + scopeData.toString();

                let con = null;
                let os = null;
                let response = null;

                try {
                    const obj = new java.net.URL(this.LoginWithAmazonCBL.sAuthRequestUrl);
                    con = obj.openConnection();
                    con.setRequestMethod("POST");

                    con.setDoOutput(true);
                    os = new java.io.DataOutputStream(con.getOutputStream());
                    os.writeBytes(urlParameters);

                    const responseCode = con.getResponseCode();
                    if (responseCode == this.LoginWithAmazonCBL.sResponseOk) response = con.getInputStream();

                } catch (e) {
                } finally {
                    if (con != null) con.disconnect();
                    if (os != null) {
                        try {
                            os.flush();
                            os.close();
                        } catch (e) {
                        }
                    }
                }

                const responseJSON = this.LoginWithAmazonCBL.getResponseJSON(response);
                if (responseJSON != null) {
                    const uri = responseJSON.getString("verification_uri");
                    const code = responseJSON.getString("user_code");

                    // Log card
                    const renderJSON = new org.json.JSONObject();
                    renderJSON.put("verification_uri", uri);
                    renderJSON.put("user_code", code);
                    this.LoginWithAmazonCBL.requestDeviceToken(responseJSON);
                }
            }
        } catch (e) {
        }
    }
}

export class refreshAuthTokenTask implements java.lang.Runnable {
    public wait(): void;
    public wait(param0: number): void;
    public wait(param0: number, param1: number): void;
    public wait(param0?: any, param1?: any) {
        throw new Error("Method not implemented.");
    }

    public equals(param0: any): boolean {
        throw new Error("Method not implemented.");
    }

    public clone() {
        throw new Error("Method not implemented.");
    }

    public toString(): string {
        throw new Error("Method not implemented.");
    }

    public notify(): void {
        throw new Error("Method not implemented.");
    }

    public getClass(): java.lang.Class<any> {
        throw new Error("Method not implemented.");
    }

    public finalize(): void {
        throw new Error("Method not implemented.");
    }

    public hashCode(): number {
        throw new Error("Method not implemented.");
    }

    public notifyAll(): void {
        throw new Error("Method not implemented.");
    }

    public mRefreshToken = "";

    constructor(refreshToken: string, private loginWithAmazonCBL: LoginWithAmazonCBL) {
        this.mRefreshToken = refreshToken;
    }

    public run() {
        if ((this.mRefreshToken != "") && (this.loginWithAmazonCBL.mClientId != "")) {
            const urlParameters = "grant_type=refresh_token"
                + "&refresh_token=" + this.mRefreshToken
                + "&client_id=" + this.loginWithAmazonCBL.mClientId;
            let con = null;
            let os = null;
            let response = null;

            try {
                const obj = new java.net.URL(this.loginWithAmazonCBL.sTokenRequestUrl);
                con = obj.openConnection();
                con.setRequestMethod("POST");

                con.setDoOutput(true);
                os = new java.io.DataOutputStream(con.getOutputStream());
                os.writeBytes(urlParameters);

                const responseCode = con.getResponseCode();
                if (responseCode == this.loginWithAmazonCBL.sResponseOk) response = con.getInputStream();

            } catch (e) {

            } finally {
                if (con != null) con.disconnect();
                if (os != null) {
                    try {
                        os.flush();
                        os.close();
                    } catch (e) {

                    }
                }
            }

            const responseJSON = this.loginWithAmazonCBL.getResponseJSON(response);

            if (responseJSON != null) {
                try {

                    const expiresInSeconds = responseJSON.getString("expires_in");
                    this.loginWithAmazonCBL.mCurrentAuthToken = responseJSON.getString("access_token");

                    // Refresh access token automatically before expiry
                    this.loginWithAmazonCBL.startRefreshTimer(+expiresInSeconds, this.mRefreshToken);


                    this.loginWithAmazonCBL.mCurrentAuthState = com.amazon.aace.alexa.AuthProvider.AuthState.REFRESHED;
                    this.loginWithAmazonCBL.mCurrentAuthError = com.amazon.aace.alexa.AuthProvider.AuthError.NO_ERROR;
                    this.loginWithAmazonCBL.notifyAuthObservers();

                } catch (e) {
                }

            } else {
                this.loginWithAmazonCBL.mCurrentAuthState = com.amazon.aace.alexa.AuthProvider.AuthState.UNINITIALIZED;
                this.loginWithAmazonCBL.mCurrentAuthError = com.amazon.aace.alexa.AuthProvider.AuthError.AUTHORIZATION_FAILED;
                this.loginWithAmazonCBL.mCurrentAuthToken = "";
                this.loginWithAmazonCBL.notifyAuthObservers();
            }
        }
    }
}

export class ConnectionStateChangedRunnable implements java.lang.Runnable {
    public wait(): void;
    public wait(param0: number): void;
    public wait(param0: number, param1: number): void;
    public wait(param0?: any, param1?: any) {
        throw new Error("Method not implemented.");
    }

    public equals(param0: any): boolean {
        throw new Error("Method not implemented.");
    }

    public clone() {
        throw new Error("Method not implemented.");
    }

    public toString(): string {
        throw new Error("Method not implemented.");
    }

    public notify(): void {
        throw new Error("Method not implemented.");
    }

    public getClass(): java.lang.Class<any> {
        throw new Error("Method not implemented.");
    }

    public finalize(): void {
        throw new Error("Method not implemented.");
    }

    public hashCode(): number {
        throw new Error("Method not implemented.");
    }

    public notifyAll(): void {
        throw new Error("Method not implemented.");
    }

    private mConnectionStatus: boolean;

    constructor(connected: boolean, private loginWithAmazonCBL: LoginWithAmazonCBL) {
        this.mConnectionStatus = connected;
    }

    public run() {
        const refreshToken = this.loginWithAmazonCBL.mPreferences.getString(this.loginWithAmazonCBL.context.getResources().getString(utils.ad.resources.getStringId('preference_refresh_token')), "");
        // call refresh on connect if auth state is not refreshed, and have a saved refresh token
        if (this.loginWithAmazonCBL.mCurrentAuthState != com.amazon.aace.alexa.AuthProvider.AuthState.REFRESHED && (refreshToken != "")) {
            if (this.mConnectionStatus) {
                this.loginWithAmazonCBL.refreshAuthToken(refreshToken);
            }
        }
    }
}
