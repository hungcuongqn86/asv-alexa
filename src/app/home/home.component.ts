import {Component, OnInit} from "@angular/core";
import * as utils from "tns-core-modules/utils/utils";
import * as app from "tns-core-modules/application";

declare var com: any;

@Component({
    selector: "Home",
    templateUrl: "./home.component.html"
})
export class HomeComponent implements OnInit {
    public asvAlexa: any;

    constructor() {
        // Use the component constructor to inject providers.
    }

    ngOnInit(): void {
        const context = utils.ad.getApplicationContext();
        const activity = app.android.startActivity;
        this.asvAlexa = new com.amazon.sampleapp.AsvAlexaPlugin();
        this.asvAlexa.init(context, activity);
        console.log(65656565, this.asvAlexa);
    }

    public tapToTalk() {
        console.log('tapToTalk');
        const res = this.asvAlexa.tapToTalk();
        console.log(res);
    }
}
