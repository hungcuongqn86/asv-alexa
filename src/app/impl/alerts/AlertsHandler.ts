import * as application from "tns-core-modules/application";

declare var com: any;

export class AlertsHandler extends com.amazon.aace.alexa.Alerts {

    private mActivity: any;
    private mStateText: any;

    constructor(activity) {
        super();
        this.mActivity = activity;
    }

    public alertStateChanged( alertToken: string, state: any, reason: string ) {
        const thas = this;
        const runnable = new java.lang.Runnable();
        runnable.run = function () {
            thas.mStateText.setText( state != null ? state.toString() : "" );
        }
        this.mActivity.runOnUiThread(runnable);
    }

    public alertCreated( alertToken: string, detailedInfo: string ) {
    }

    public alertDeleted( alertToken: string ) {
    }

    private onLocalStop() {
        super.localStop();
    }

    private onRemoveAllAlerts( ) {
        super.removeAllAlerts();
    }
}
