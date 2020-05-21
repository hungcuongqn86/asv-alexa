import * as application from "tns-core-modules/application";
import {AuthStateObserver} from "../authprovider/AuthStateObserver";
import {AuthHandler} from "../authprovider/AuthHandler";

declare var com: any;

export class AuthProviderHandler extends com.amazon.aace.alexa.AuthProvider implements AuthStateObserver {

    private mActivity: any;
    private mAuthHandler: AuthHandler;

    private mAuthState = com.amazon.aace.alexa.AuthProvider.AuthState.UNINITIALIZED;
    private mAuthToken = "";

    private mExecutor = java.util.concurrent.Executors.newSingleThreadExecutor();

    constructor(activity, handler: AuthHandler) {
        super();
        this.mActivity = activity;
        this.mAuthHandler = handler;
    }

    public getAuthToken() {
        return this.mAuthToken;
    }

    public getAuthState() {
        return this.mAuthState;
    }

    public onAuthStateChanged(state: any, error: string, token: string) {
        this.mAuthToken = token;
        this.mAuthState = state;
        this.mExecutor.execute( new AuthStateChangedRunnable( this.mAuthState, error));
    }

    public onInitialize(){
        this.mAuthHandler.registerAuthStateObserver( this );
    }
}

export class AuthStateChangedRunnable implements java.lang.Runnable {
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
    public state: any;
    public error: any;

    constructor(s, e) {
        this.state = s;
        this.error = e;
    }

    public run() {
        // call to update engine
        com.amazon.aace.alexa.AuthProvider.authStateChange( this.state, this.error );
    }
}
