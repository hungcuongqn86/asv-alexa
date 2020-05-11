import * as application from "tns-core-modules/application";
import * as utils from "tns-core-modules/utils/utils";
import { device } from "tns-core-modules/platform";

declare var com: any;

export class TestAndroidService
{
    public mLVCService:any;
    public mLVCConfig:string = '';

    extendBackgroundService() {
        //register the service
        if (application.android) {
            var that = this;

            (<any>android.app.Service).extend("com.nativescript.TestAndroidService.BackgroundService", {
                onStartCommand: function (intent, flags, startId) {
                    console.log("onStartCommand; startId: " + startId);

                    /*if (that.mLVCService != null) {
                        // Connection to LVC service is already established
                        console.log("onStartCommand received when LVC service is already connected");
                        if (that.mLVCConfig != '') {
                            // We have config from when LVC started previously
                            sendAHEInitSuccess(that.mLVCConfig);
                        } else {
                            console.log("LVC service is already connected but config is not yet available");
                        }
                    } else {
                        // LVC is not connected. Try to initialize LVC
                        console.log("onStartCommand received, LVC service not connected; proceeding to initialize");
                        initLVC();
                    }*/

                    this.super.onStartCommand(intent, flags, startId);
                    return android.app.Service.START_STICKY;
                },
                onCreate: function () {
                    console.log("on Create service");
                    // that.myPeriodicFunction();
                },
                onBind: function (intent) {
                    console.log("on Bind Services");
                },
                onUnbind: function (intent) {
                    console.log('UnBind Service');
                },
                onDestroy: function () {
                    console.log('service onDestroy');
                }
            });
        }
    }

    id;
    myPeriodicFunction(){
        this.id = setInterval(() => {
            console.log("Executed Every Second");
            var date = new Date();
            var seconds = date.getSeconds();
            this.sendMessage(seconds);

        }, 1000);
    }

    sendMessage(message) {
        console.log("message supposed to be sent from Service via broadcast " + message);
        const intent = new android.content.Intent("test-message");
        application.android.foregroundActivity.sendBroadcast(intent);
    }
}
