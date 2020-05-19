import * as application from "tns-core-modules/application";

declare var com: any;

export class AlexaClientHandler extends com.amazon.aace.alexa.AlexaClient {

    private mActivity: any;
    private mConnectionText:any;
    private mAuthText:any;
    private mDialogText:any;
    private mConnectionStatus = com.amazon.aace.alexa.AlexaClient.ConnectionStatus.DISCONNECTED;

    constructor(activity) {
        super();
        this.mActivity = activity;
        this.setupGUI();
    }

    public dialogStateChanged( state ) {
        console.log("AlexaClientHandler: ",state);
    }

    public authStateChanged( state, error ) {

    }

    public connectionStatusChanged( status, reason ) {
        this.mConnectionStatus = status;
        // Notify error state change to AutoVoiceChrome
    }

    public getConnectionStatus () { return this.mConnectionStatus; }

    private setupGUI() {

    }
}
