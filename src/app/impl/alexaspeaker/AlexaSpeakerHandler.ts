import * as application from "tns-core-modules/application";

declare var com: any;

export class AlexaSpeakerHandler extends com.amazon.aace.alexa.AlexaSpeaker {

    private mActivity: any;

    private mIsMuted = false;
    private mAlexaVolume = 50;
    private mAlertsVolume = 50;

    private mAlexaVolumeControl: any;
    private mAlertsVolumeControl: any;
    private mMuteButton: any;

    constructor(activity) {
        super();
        this.mActivity = activity;
    }

    public speakerSettingsChanged( type, local, volume, mute ){
        if( type == com.amazon.aace.alexa.AlexaSpeaker.SpeakerType.ALEXA_VOLUME ) {
            this.mAlexaVolume = volume;
            this.mIsMuted = mute;
        } else if( type == com.amazon.aace.alexa.AlexaSpeaker.SpeakerType.ALERTS_VOLUME ) {
            this.mAlertsVolume = volume;
        }
    }
}
