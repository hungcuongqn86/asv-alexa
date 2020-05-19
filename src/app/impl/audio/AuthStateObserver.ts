
export interface AuthStateObserver {
    onAuthStateChanged( state: any, error: string, token: string );
}
