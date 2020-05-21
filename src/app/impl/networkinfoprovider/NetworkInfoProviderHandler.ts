import * as application from "tns-core-modules/application";

declare var com: any;

export class NetworkInfoProviderHandler extends com.amazon.aace.network.NetworkInfoProvider {

    private mActivity: any;
    private mEngine: any;
    public mWifiManager: any;
    public mConnectivityManager: any;
    public mReceiver: any;

    public mStatus: any;

    // List of Network Connection observers
    private mObservers: Array<any>;

    constructor(activity,  engine) {
        super();
        this.mActivity = activity;

        this.mEngine = engine;
        this.mStatus = com.amazon.aace.network.NetworkInfoProvider.NetworkStatus.UNKNOWN;
        this.mObservers = [];
        const context = this.mActivity.getApplicationContext();
        // Note: >=API 24 should use NetworkCallback to receive network change updates
        // instead of CONNECTIVITY_ACTION
        this.mReceiver = new NetworkChangeReceiver(this);
        context.registerReceiver( this.mReceiver, new android.content.IntentFilter( android.net.ConnectivityManager.CONNECTIVITY_ACTION ) );
        this.mWifiManager = context.getSystemService( android.content.Context.WIFI_SERVICE );
        this.mConnectivityManager = context.getSystemService( android.content.Context.CONNECTIVITY_SERVICE );
        this.updateNetworkStatus();
    }

    public getNetworkStatus() {
        return this.mStatus;
    }
    public getWifiSignalStrength() { return this.mWifiManager.getConnectionInfo().getRssi(); }
    public unregister() { this.mActivity.getApplicationContext().unregisterReceiver( this.mReceiver ); }

    private showAlertDialog( message: string ) {
        const alertDialog = new android.app.AlertDialog.Builder(this.mActivity).create();
        alertDialog.setMessage( message );

        /*  alertDialog.setButton(android.app.AlertDialog.BUTTON_NEUTRAL, "OK",

        new android.content.DialogInterface.OnClickListener() {
        public void onClick(DialogInterface dialog, int which) {
                dialog.dismiss();
            }
        });
        alertDialog.show();*/
    }

    public updateNetworkStatus() {
        const activeNetwork = this.mConnectivityManager.getActiveNetworkInfo();
        if ( activeNetwork != null ) {
            const state = activeNetwork.getState();
            switch ( state ) {
                case android.net.NetworkInfo.State.CONNECTED:
                    this.mStatus = com.amazon.aace.network.NetworkInfoProvider.NetworkStatus.CONNECTED;
                    break;
                case android.net.NetworkInfo.State.CONNECTING:
                    this.mStatus = com.amazon.aace.network.NetworkInfoProvider.NetworkStatus.CONNECTING;
                    break;
                case android.net.NetworkInfo.State.DISCONNECTING:
                    this.mStatus = com.amazon.aace.network.NetworkInfoProvider.NetworkStatus.DISCONNECTING;
                    break;
                case android.net.NetworkInfo.State.DISCONNECTED:
                case android.net.NetworkInfo.State.SUSPENDED:
                    this.mStatus = com.amazon.aace.network.NetworkInfoProvider.NetworkStatus.DISCONNECTED;
                    break;
                case android.net.NetworkInfo.State.UNKNOWN:
                    this.mStatus = com.amazon.aace.network.NetworkInfoProvider.NetworkStatus.UNKNOWN;
                    break;
            }
        } else {
            this.mStatus = com.amazon.aace.network.NetworkInfoProvider.NetworkStatus.UNKNOWN;
        }
    }

    // Connection State Observable methods
    public registerNetworkConnectionObserver( observer ) {
        if ( observer == null ) return;
        this.mObservers.push( observer );
        observer.onConnectionStatusChanged( this.mStatus );
    }


    public notifyConnectionStatusObservers( status ){
        this.mObservers.forEach(function (observer) {
            observer.onConnectionStatusChanged( status );
        });
    }

    private setNetworkInterface( interfaceText: string ){
        return this.mEngine.setProperty(com.amazon.aace.network.NetworkProperties.NETWORK_INTERFACE, interfaceText );
    }

    private getNetworkInterface(){
        return this.mEngine.getProperty(com.amazon.aace.network.NetworkProperties.NETWORK_INTERFACE );
    }
}

export class NetworkChangeReceiver extends android.content.BroadcastReceiver {
    constructor(private networkInfoProviderHandler: NetworkInfoProviderHandler) {
        super();
    }
    public onReceive( context, intent ){
        if ( this.networkInfoProviderHandler.mConnectivityManager != null ) {
            this.networkInfoProviderHandler.updateNetworkStatus();
            const rssi = this.networkInfoProviderHandler.mWifiManager.getConnectionInfo().getRssi();
            com.amazon.aace.network.NetworkInfoProvider.networkStatusChanged( this.networkInfoProviderHandler.mStatus, rssi );
            this.networkInfoProviderHandler.notifyConnectionStatusObservers( this.networkInfoProviderHandler.mStatus );
        }
    }
}
