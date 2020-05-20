import * as application from "tns-core-modules/application";

declare var com: any;

export class SpeechRecognizerHandler extends com.amazon.aace.alexa.SpeechRecognizer {

    private mActivity: any;
    private mWakeWordEnabled: boolean;
    public AudioCueState = {
        START_TOUCH: 'START_TOUCH',
        START_VOICE: 'START_VOICE',
        END: 'END'
    };

    private mAudioCueObservable = new AudioCueObservable(this);
    private mAllowStopCapture = false;

    constructor(activity, wakeWordSupported: boolean, wakeWordEnabled: boolean) {
        super(wakeWordSupported && wakeWordEnabled);
        this.mActivity = activity;
        this.mWakeWordEnabled = wakeWordEnabled;
    }

    public wakewordDetected(wakeWord: string) {
        this.mAudioCueObservable.playAudioCue(this.AudioCueState.START_VOICE);

        // Notify Error state to AutoVoiceChrome if disconnected with Alexa

        return true;
    }

    public endOfSpeechDetected() {
        this.mAudioCueObservable.playAudioCue( this.AudioCueState.END );
    }

    public onTapToTalk() {
        if ( com.amazon.aace.alexa.SpeechRecognizer.tapToTalk() ) this.mAudioCueObservable.playAudioCue( this.AudioCueState.START_TOUCH );
    }

    public onHoldToTalk() {
        this.mAllowStopCapture = false;
        if ( com.amazon.aace.alexa.SpeechRecognizer.holdToTalk() ) {
            this.mAllowStopCapture = true;
            this.mAudioCueObservable.playAudioCue( this.AudioCueState.START_TOUCH );
        }
    }

    public onReleaseHoldToTalk() {
        if ( this.mAllowStopCapture ) com.amazon.aace.alexa.SpeechRecognizer.stopCapture();
        this.mAllowStopCapture = false;
    }

    public addObserver( observer ) {
        if ( this.mAudioCueObservable == null ) this.mAudioCueObservable = new AudioCueObservable(this);
        this.mAudioCueObservable.addObserver( observer );
    }
}

export class AudioCueObservable extends java.util.Observable {
    constructor(private speechRecognizerHandler: SpeechRecognizerHandler) {
        super();
    }
    playAudioCue( state ) {
        this.speechRecognizerHandler.setChanged();
        this.speechRecognizerHandler.notifyObservers( state );
    }
}
