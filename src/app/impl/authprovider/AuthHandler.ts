import {AuthStateObserver} from "../authprovider/AuthStateObserver";

export interface AuthHandler {
    // Initiate device authorization request
    authorize();
    // Clear current user authorization/data
    deauthorize();
    // Register an observer of this interfaces authstate changes
    registerAuthStateObserver( observer: AuthStateObserver );
}
