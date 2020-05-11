import * as application from "tns-core-modules/application";
import * as utils from "tns-core-modules/utils/utils";
import {device} from "tns-core-modules/platform";

declare var com: any;

export class TestAndroidService {
    public LVC_RECEIVER_INTENT = "com.nativescript.asvalexa.lvcconfigreceiver";
    public LVC_RECEIVER_CONFIGURATION = "configuration";
    private LVC_SERVICE_ACTION = "com.amazon.alexalve.LocalVoiceControlService";
    private LVC_SERVICE_PACKAGE_NAME = "com.amazon.alexalve";
    public LVC_RECEIVER_FAILURE_REASON = "failure_reason";
    public LVC_RECEIVER_FAILURE_REASON_LVC_NOT_INSTALLED = "lvc_not_installed";
    public mLVCService: any;
    public mLVCConfig: string = '';
    public mConnection: any;
    public mLVCClient: any;

    extendBackgroundService() {
        //register the service
        if (application.android) {
            var that = this;

            (<any>android.app.Service).extend("com.nativescript.TestAndroidService.BackgroundService", {
                onStartCommand: function (intent, flags, startId) {
                    console.log("onStartCommand; startId: " + startId);

                    if (that.mLVCService != null) {
                        // Connection to LVC service is already established
                        console.log("onStartCommand received when LVC service is already connected");
                        if (that.mLVCConfig != '') {
                            // We have config from when LVC started previously
                            that.sendAHEInitSuccess(that.mLVCConfig);
                        } else {
                            console.log("LVC service is already connected but config is not yet available");
                        }
                    } else {
                        // LVC is not connected. Try to initialize LVC
                        console.log("onStartCommand received, LVC service not connected; proceeding to initialize");
                        that.initLVC();
                    }

                    this.super.onStartCommand(intent, flags, startId);
                    return android.app.Service.START_STICKY;
                },
                onCreate: function () {
                    console.log("on Create service");
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

    initLVC() {
        console.log("Attempting to initialize remote LVC service");
        var that = this;
        this.mConnection = new android.content.ServiceConnection({
            onServiceConnected: function(className: android.content.ComponentName, service: android.os.IBinder): void {
                that.serviceConnected(className, service);
            },
            onServiceDisconnected: function(className: android.content.ComponentName): void {
                console.log("onServiceDisconnected. Disconnected from LocalVoiceEngineService");
                that.mLVCService = null;
            }
        });

        // Check if LVC service (from LVC APK) is installed on this device
        const serviceIntent = new android.content.Intent();
        serviceIntent.setAction(this.LVC_SERVICE_ACTION);
        serviceIntent.setPackage(this.LVC_SERVICE_PACKAGE_NAME);
        const packageManager = application.android.context.getPackageManager();
        const resolveInfo = packageManager.resolveService(serviceIntent, 0);

        if (resolveInfo != null) {
            console.log("LVC service found, binding to service");
            application.android.context.bindService(serviceIntent, this.mConnection, android.content.Context.BIND_AUTO_CREATE);
        } else {
            // LVC service not installed. Send failure broadcast and stop this service
            console.log("LVC service not installed on the device. Stopping LVCInteractionService");
            this.sendAHEInitFailure(this.LVC_RECEIVER_FAILURE_REASON_LVC_NOT_INSTALLED);
            // stopSelf();
        }
    }

    serviceConnected(className: android.content.ComponentName, service: android.os.IBinder) {
        console.log("onServiceConnected: Connected to LocalVoiceEngineService");
        var that = this;
        this.mLVCService = com.amazon.alexalve.ILVCService.Stub.asInterface(service);
        if (this.mLVCService == null) {
            return;
        }

        try {
            this.mLVCClient = new com.amazon.alexalve.ILVCClient.Stub({
                getConfiguration: function(): void {
                    that.getConfiguration();
                },
                configure: function (configuration: string): void {
                    console.log("Configuration received from LVC service");
                    that.mLVCConfig = configuration;
                    that.sendAHEInitSuccess(configuration);
                },
                onStart: function (): void {
                    console.log("onStart from LVC service");
                },
                onStop: function (): void {
                    console.log("onStop from LVC service");
                }
            });

            // Register this as the Auto SDK client (config provider and observer) for LVC service
            console.log("Registering as the Auto SDK client for LVC Service");
            this.mLVCService.registerClient(this.mLVCClient);

            // Send signal to LVC service to start when ready
            console.log("Sending start signal to LVC service");
            this.mLVCService.start();
        } catch (e) {
            console.log("Error calling remote process ", e);
        }
    }

    getConfiguration() {
        console.log("Configuration requested from LVC Service");
        let configString = "";
        try {
            // Construct config expected by LVC
            let config: any = {};

            let localSkillServiceNode: any = {};
            let carControlNode: any = {};
            config.put("LocalSkillService", localSkillServiceNode);

            const cacheDir = application.android.context.getCacheDir();
            const appDataDir = new java.io.File(cacheDir, "appdata");
            const appDataDirPath = appDataDir.getAbsolutePath();
            localSkillServiceNode.put("UnixDomainSocketPath", appDataDirPath + "/LSS.socket");

            // To use custom car control assets defined in "CarControlAssets.json", add the
            // "CustomAssetsFilePath". This tells the car control component in the LVC APK about
            // any assets we have defined in our car control configuration that are additions
            // to the default it already uses.
            // If your car control config used by your own application doesn't use additional
            // assets, skip adding the "CarControl" node to this configuration entirely.
            config.put("CarControl", carControlNode);
            const carControlAssetsPath = this.getCarControlAssetsPath(appDataDirPath);
            carControlNode.put("CustomAssetsFilePath", carControlAssetsPath);

            configString = config.toString();
        } catch (e) {
            console.log(e.getMessage());
        }
        console.log("Returning config to LVC service: " + configString);
        return configString;
    }

    sendAHEInitSuccess(result: string) {
        console.log("message supposed to be sent from Service via broadcast " + result);
        const intent = new android.content.Intent(this.LVC_RECEIVER_INTENT);
        intent.putExtra(this.LVC_RECEIVER_CONFIGURATION, result);
        application.android.foregroundActivity.sendBroadcast(intent);
    }

    sendAHEInitFailure(reason: string) {
        const intent = new android.content.Intent();
        intent.setAction(this.LVC_RECEIVER_INTENT);
        intent.putExtra(this.LVC_RECEIVER_FAILURE_REASON, reason);
        application.android.foregroundActivity.sendBroadcast(intent);
    }

    sendMessage(message) {
        console.log("message supposed to be sent from Service via broadcast " + message);
        const intent = new android.content.Intent(this.LVC_RECEIVER_INTENT);
        application.android.foregroundActivity.sendBroadcast(intent);
    }

    getCarControlAssetsPath(appDataDirPath: string) {
        const sdCardPath = android.os.Environment.getExternalStorageDirectory().getAbsolutePath();
        const externalAssetsPath = sdCardPath + "/CarControlAssets.json";
        const externalAssetsFile = new java.io.File(externalAssetsPath);

        if (externalAssetsFile.exists()) {
            console.log("Using car control custom assets from file on SD card");
            return externalAssetsFile.getAbsolutePath();
        } else {
            // The default custom assets live in the assets directory of this application's source
            // code. We copy that file to the "appdata" subdirectory of the cache directory
            // and provide that path
            const cacheDirFile = new java.io.File(appDataDirPath, "CarControlAssets.json");
            com.amazon.sampleapp.FileUtils.copyAsset(application.android.context.getAssets(), "CarControlAssets.json", cacheDirFile, false);
            return cacheDirFile.getAbsolutePath();
        }
    }
}
