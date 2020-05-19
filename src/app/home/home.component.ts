import {Component, OnDestroy, OnInit} from "@angular/core";
import {isAndroid, isIOS, screen, device} from "tns-core-modules/platform";
import * as utils from "tns-core-modules/utils/utils";
import {android as applicationModule} from "tns-core-modules/application";
import * as constant from "../const";
import {AudioInputProviderHandler} from "../impl/audio/AudioInputProviderHandler";
import {AudioOutputProviderHandler} from "../impl/audio/AudioOutputProviderHandler";
import {AlexaClientHandler} from "../impl/alexaclient/AlexaClientHandler";

declare var com: any;

@Component({
    selector: "Home",
    templateUrl: "./home.component.html"
})
export class HomeComponent implements OnInit, OnDestroy {
    public asvAlexa: any;
    public context: any;
    public activity: any;
    public mSpeechRecognizer: any;
    private mEngineStarted: boolean = false;
    private mEngine: any;
    private mPreferences: any;

    private mAudioCueStartVoice: android.media.MediaPlayer; // Voice-initiated listening audio cue
    private mAudioCueStartTouch: android.media.MediaPlayer; // Touch-initiated listening audio cue
    private mAudioCueEnd: android.media.MediaPlayer; // End of listening audio cue
    private sRequiredPermissions = [android.Manifest.permission.RECORD_AUDIO, android.Manifest.permission.ACCESS_FINE_LOCATION, android.Manifest.permission.READ_EXTERNAL_STORAGE];
    private mAudioInputProvider: any;
    private mAudioOutputProvider: any;
    private mAlexaClient: any;

    constructor() {
        // Use the component constructor to inject providers.
    }

    ngOnInit(): void {
        var that = this;
        this.context = utils.ad.getApplicationContext();
        this.activity = applicationModule.startActivity;

        this.asvAlexa = new com.amazon.sampleapp.AsvAlexaPlugin();
        if (this.asvAlexa.reqPermission(this.context, this.activity)) {
            this.create();
        }

        /*
        const context = utils.ad.getApplicationContext();
        const activity = applicationModule.android.startActivity;
        this.asvAlexa = new com.amazon.sampleapp.AsvAlexaPlugin();
        const res = this.asvAlexa.init(context, activity);
        console.log("Init: ", res);*/
        // console.log(111, com.amazon.sampleapp.LVCInteractionService.LVC_RECEIVER_INTENT);


    }

    private create() {
        if (isAndroid) {
            const wakesoundId = this.context.getResources().getIdentifier("med_ui_wakesound", "raw", this.activity.getPackageName());
            const wakesounTouchId = this.context.getResources().getIdentifier("med_ui_wakesound_touch", "raw", this.activity.getPackageName());
            const endpointingTouchId = this.context.getResources().getIdentifier("med_ui_endpointing_touch", "raw", this.activity.getPackageName());

            // Initialize sound effects for speech recognition
            this.mAudioCueStartVoice = android.media.MediaPlayer.create(this.context, wakesoundId);
            this.mAudioCueStartTouch = android.media.MediaPlayer.create(this.context, wakesounTouchId);
            this.mAudioCueEnd = android.media.MediaPlayer.create(this.context, endpointingTouchId);

            // Get shared preferences
            const preferenceFileKeyId = this.context.getResources().getIdentifier("preference_file_key", "string", this.activity.getPackageName());
            this.mPreferences = this.context.getSharedPreferences(this.context.getString(preferenceFileKeyId),
                android.content.Context.MODE_PRIVATE);

            // Retrieve device config from config file and update preferences
            let clientId = "", productId = "", productDsn = "";
            const config = com.amazon.sampleapp.FileUtils.getConfigFromFile(this.context.getAssets(), constant.sDeviceConfigFile, "config");
            if (config != null) {
                try {
                    clientId = config.getString("clientId");
                    productId = config.getString("productId");
                    console.log("AsvAlexaPlugin.create", "clientId: " + clientId + " - productId: " + productId + " - productDsn: " + productDsn);
                } catch (e) {
                    console.log("AsvAlexaPlugin.create", "Missing device info in app_config.json");
                }
                try {
                    productDsn = config.getString("productDsn");
                } catch (e) {
                    try {
                        // set Android ID as product DSN
                        productDsn = android.provider.Settings.Secure.getString(this.context.getContentResolver(),
                            android.provider.Settings.Secure.ANDROID_ID);
                        console.log("AsvAlexaPlugin.create", "android id for DSN: " + productDsn);
                    } catch (error) {
                        productDsn = java.util.UUID.randomUUID().toString();
                        console.log("AsvAlexaPlugin.create", "android id not found, generating random DSN: " + productDsn);
                    }
                }
            }

            this.updateDevicePreferences(clientId, productId, productDsn);

            this.registerBroadCastReceiver();
            this.startLVCInteractionService();
        }
    }

    private updateDevicePreferences(clientId: string, productId, productDsn) {
        const editor: android.content.SharedPreferences.Editor = this.mPreferences.edit();
        editor.putString(this.context.getResources().getString(utils.ad.resources.getStringId('preference_client_id')), clientId);
        editor.putString(this.context.getResources().getString(utils.ad.resources.getStringId('preference_product_id')), productId);
        editor.putString(this.context.getResources().getString(utils.ad.resources.getStringId('preference_product_dsn')), productDsn);
        editor.apply();
        // console.log(123456789, this.context.getResources().getString(utils.ad.resources.getStringId('preference_client_id')));
    }

    private registerBroadCastReceiver() {
        var that = this;

        let receiverCallback = (androidContext, intent) => {
            if (constant.LVC_RECEIVER_INTENT === intent.getAction()) {
                if (intent.hasExtra(constant.LVC_RECEIVER_FAILURE_REASON)) {
                    // LVCInteractionService was unable to provide config from LVC
                    const reason = intent.getStringExtra(constant.LVC_RECEIVER_FAILURE_REASON);
                    that.onLVCConfigReceived(null);
                    console.log("LVCConfigReceiver", "Failed to init LVC: " + reason);
                } else if (intent.hasExtra(constant.LVC_RECEIVER_CONFIGURATION)) {
                    // LVCInteractionService received config from LVC
                    const config = intent.getStringExtra(constant.LVC_RECEIVER_CONFIGURATION);
                    that.onLVCConfigReceived(config);
                    console.log("LVCConfigReceiver", "Received config from LVC, starting engine now");
                }
            }
        };

        applicationModule.registerBroadcastReceiver(
            constant.LVC_RECEIVER_INTENT,
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

    private onLVCConfigReceived(config: string) {
        // Initialize AAC engine and register platform interfaces
        try {
            if (!this.mEngineStarted) {
                this.startEngine(config);
            }
        } catch (e) {
            console.log("onLVCConfigReceived", "Could not start engine. Reason: " + e.getMessage());
            return;
        }
        // this.mSpeechRecognizer.addObserver(this);
    }

    private startEngine(json: string) {
        try {
            const cacheDir: java.io.File = this.activity.getCacheDir();
            const appDataDir: java.io.File = new java.io.File(cacheDir, "appdata");

            // Copy certs from assets to certs subdirectory of cache directory
            const certsDir: java.io.File = new java.io.File(appDataDir, "certs");
            com.amazon.sampleapp.FileUtils.copyAllAssets(this.activity.getAssets(), "certs", certsDir, false);

            // Copy models from assets to certs subdirectory of cache directory.
            // Force copy the models on every start so that the models on device cache are always the latest
            // from the APK
            const modelsDir: java.io.File = new java.io.File(appDataDir, "models");
            com.amazon.sampleapp.FileUtils.copyAllAssets(this.activity.getAssets(), "models", modelsDir, true);

            // Create AAC engine
            this.mEngine = com.amazon.aace.core.Engine.create(this.context);
            const configuration: any[] = this.getEngineConfigurations(json, appDataDir, certsDir, modelsDir);
            const configureSucceeded = this.mEngine.configure(configuration);
            if (!configureSucceeded) {
                console.log("startEngine", "Engine configuration failed");
                return false;
            }

            // Create the platform implementation handlers and register them with the engine

            // AudioInputProvider
            this.mAudioInputProvider = new AudioInputProviderHandler(this.activity)
            if (!this.mEngine.registerPlatformInterface(this.mAudioInputProvider)) {
                console.log("Could not register AudioInputProvider platform interface");
            }

            this.mAudioOutputProvider = new AudioOutputProviderHandler(this.activity)
            if (!this.mEngine.registerPlatformInterface(this.mAudioOutputProvider)) {
                console.log("Could not register AudioOutputProvider platform interface");
            }

            this.mAlexaClient = new AlexaClientHandler(this.activity)
            if (!this.mEngine.registerPlatformInterface(this.mAlexaClient)) {
                console.log("Could not register AlexaClient platform interface");
            }



            console.log("startEngine Succeeded");
        } catch (e) {
            console.log("Error----------", e);
            return;
        }
    }

    public tapToTalk() {
        /*
		console.log('tapToTalk');
        const res = this.asvAlexa.tapToTalk();
        console.log(res);
		*/
        // this.startLVCInteractionService();
    }

    private getEngineConfigurations(json: string, appDataDir: java.io.File, certsDir: java.io.File, modelsDir: java.io.File) {
        // Configure the engine
        const productDsn = this.mPreferences.getString(this.context.getResources().getString(utils.ad.resources.getStringId('preference_product_dsn')), "");
        const clientId = this.mPreferences.getString(this.context.getResources().getString(utils.ad.resources.getStringId('preference_client_id')), "");
        const productId = this.mPreferences.getString(this.context.getResources().getString(utils.ad.resources.getStringId('preference_product_id')), "");
        // console.log('getEngineConfigurations', productDsn, clientId, productId);

        // console.log(22222222, this.mEngine.getProperty(com.amazon.sampleapp.aace.core.CoreProperties.VERSION));

        const configuration = [
            com.amazon.aace.alexa.config.AlexaConfiguration.createCurlConfig(certsDir.getPath()),
            com.amazon.aace.alexa.config.AlexaConfiguration.createDeviceInfoConfig(productDsn, clientId, productId),
            com.amazon.aace.alexa.config.AlexaConfiguration.createMiscStorageConfig(appDataDir.getPath() + "/miscStorage.sqlite"),
            com.amazon.aace.alexa.config.AlexaConfiguration.createCertifiedSenderConfig(appDataDir.getPath() + "/certifiedSender.sqlite"),
            com.amazon.aace.alexa.config.AlexaConfiguration.createAlertsConfig(appDataDir.getPath() + "/alerts.sqlite"),
            com.amazon.aace.alexa.config.AlexaConfiguration.createSettingsConfig(appDataDir.getPath() + "/settings.sqlite"),
            com.amazon.aace.alexa.config.AlexaConfiguration.createNotificationsConfig(appDataDir.getPath() + "/notifications.sqlite"),
            com.amazon.aace.storage.config.StorageConfiguration.createLocalStorageConfig(appDataDir.getPath() + "/localStorage.sqlite"),

            com.amazon.aace.vehicle.config.VehicleConfiguration.createVehicleInfoConfig(
                [
                    new com.amazon.aace.vehicle.config.VehicleConfiguration.VehicleProperty(com.amazon.aace.vehicle.config.VehicleConfiguration.VehiclePropertyType.MAKE, "Amazon"),
                    new com.amazon.aace.vehicle.config.VehicleConfiguration.VehicleProperty(com.amazon.aace.vehicle.config.VehicleConfiguration.VehiclePropertyType.MODEL, "AmazonCarOne"),
                    new com.amazon.aace.vehicle.config.VehicleConfiguration.VehicleProperty(com.amazon.aace.vehicle.config.VehicleConfiguration.VehiclePropertyType.TRIM, "Advance"),
                    new com.amazon.aace.vehicle.config.VehicleConfiguration.VehicleProperty(com.amazon.aace.vehicle.config.VehicleConfiguration.VehiclePropertyType.YEAR, "2025"),
                    new com.amazon.aace.vehicle.config.VehicleConfiguration.VehicleProperty(com.amazon.aace.vehicle.config.VehicleConfiguration.VehiclePropertyType.GEOGRAPHY, "US"),
                    /*new com.amazon.sampleapp.aace.vehicle.config.VehicleConfiguration.VehicleProperty(com.amazon.sampleapp.aace.vehicle.config.VehicleConfiguration.VehiclePropertyType.VERSION, java.lang.String.format(
                        "Vehicle Software Version 1.0 (Auto SDK Version %s)", this.mEngine.getProperty(com.amazon.sampleapp.aace.core.CoreProperties.VERSION))),*/
                    new com.amazon.aace.vehicle.config.VehicleConfiguration.VehicleProperty(com.amazon.aace.vehicle.config.VehicleConfiguration.VehiclePropertyType.OPERATING_SYSTEM, "Android 8.1 Oreo API Level 26"),
                    new com.amazon.aace.vehicle.config.VehicleConfiguration.VehicleProperty(com.amazon.aace.vehicle.config.VehicleConfiguration.VehiclePropertyType.HARDWARE_ARCH, "Armv8a"),
                    new com.amazon.aace.vehicle.config.VehicleConfiguration.VehicleProperty(com.amazon.aace.vehicle.config.VehicleConfiguration.VehiclePropertyType.LANGUAGE, "en-US"),
                    new com.amazon.aace.vehicle.config.VehicleConfiguration.VehicleProperty(com.amazon.aace.vehicle.config.VehicleConfiguration.VehiclePropertyType.MICROPHONE, "Single, roof mounted"),
                    // If this list is left blank, it will be fetched by the engine using amazon default endpoint
                    new com.amazon.aace.vehicle.config.VehicleConfiguration.VehicleProperty(com.amazon.aace.vehicle.config.VehicleConfiguration.VehiclePropertyType.COUNTRY_LIST, "US,GB,IE,CA,DE,AT,IN,JP,AU,NZ,FR"),
                    new com.amazon.aace.vehicle.config.VehicleConfiguration.VehicleProperty(com.amazon.aace.vehicle.config.VehicleConfiguration.VehiclePropertyType.VEHICLE_IDENTIFIER, "123456789a")
                ]
            )
        ]

        const endpointConfigPath = android.os.Environment.getExternalStorageDirectory().getAbsolutePath() + "/aace.json";
        if (new java.io.File(endpointConfigPath).exists()) {
            const alexaEndpointsConfig = com.amazon.aace.core.config.ConfigurationFile.create(android.os.Environment.getExternalStorageDirectory().getAbsolutePath() + "/aace.json");
            configuration.push(alexaEndpointsConfig);
            console.log("getEngineConfigurations", "Overriding endpoints");
        }

        return configuration;
    }

    ngOnDestroy() {
        if (isAndroid) {
            // >> broadcast-receiver-remove-ts
            applicationModule.unregisterBroadcastReceiver(android.content.Intent.ACTION_BATTERY_CHANGED);
            // << broadcast-receiver-remove-ts
        }
    }
}
