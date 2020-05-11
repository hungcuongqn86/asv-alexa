import {Component, OnDestroy, OnInit} from "@angular/core";
import {isAndroid, isIOS, screen, device } from "tns-core-modules/platform";
import * as utils from "tns-core-modules/utils/utils";
import { android as applicationModule } from "tns-core-modules/application";

declare var com: any;

@Component({
    selector: "Home",
    templateUrl: "./home.component.html"
})
export class HomeComponent implements OnInit, OnDestroy {
    public LVC_RECEIVER_INTENT = "com.nativescript.asvalexa.lvcconfigreceiver";
    public asvAlexa: any;
    public context: any;
    public activity: any;

    constructor() {
        // Use the component constructor to inject providers.
    }

    ngOnInit(): void {
        this.context = utils.ad.getApplicationContext();
        this.activity = applicationModule.startActivity;

        /*
        const context = utils.ad.getApplicationContext();
        const activity = applicationModule.android.startActivity;
        this.asvAlexa = new com.amazon.sampleapp.AsvAlexaPlugin();
        const res = this.asvAlexa.init(context, activity);
        console.log("Init: ", res);*/
        // console.log(111, com.amazon.sampleapp.LVCInteractionService.LVC_RECEIVER_INTENT);

		if (isAndroid) {
		    this.registerBroadCastReceiver();
            this.startLVCInteractionService();
		}
    }

    private registerBroadCastReceiver(){
        let receiverCallback = (androidContext, intent) => {
            console.log("receiverCallback", com.amazon.sampleapp.LVCInteractionService.LVC_RECEIVER_INTENT, intent.getAction());
        };

        applicationModule.registerBroadcastReceiver(
            this.LVC_RECEIVER_INTENT,
            receiverCallback
        );
        console.log("Registration Completed");
    }

    private startLVCInteractionService() {
        if (device.sdkVersion >= "26") {
            let intent = new android.content.Intent(this.context, com.nativescript.TestAndroidService.BackgroundServiceclass);
            this.context.startForegroundService(intent);
        } else {
            let intent = new android.content.Intent(this.context, com.nativescript.TestAndroidService.BackgroundService.class);
            this.context.startService(intent);
        }
    }

    public tapToTalk() {
        /*
		console.log('tapToTalk');
        const res = this.asvAlexa.tapToTalk();
        console.log(res);
		*/
		this.startLVCInteractionService();
    }

    ngOnDestroy() {
        if (isAndroid) {
            // >> broadcast-receiver-remove-ts
            applicationModule.unregisterBroadcastReceiver(android.content.Intent.ACTION_BATTERY_CHANGED);
            // << broadcast-receiver-remove-ts
        }
    }
}
