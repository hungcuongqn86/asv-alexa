import * as application from "tns-core-modules/application";
import {AudioInputHandler} from './AudioInputHandler';

declare var com: any;

export class AudioInputProviderHandler extends com.amazon.aace.audio.AudioInputProvider {

    private mDefaultAudioInput = null;
    private mActivity: any;

    constructor(activity) {
        super();
        this.mActivity = activity;
    }

    public openChannel( name: string, type: any )
    {
        if( type == com.amazon.aace.audio.AudioInputProvider.AudioInputType.VOICE || type == com.amazon.aace.audio.AudioInputProvider.AudioInputType.COMMUNICATION ) {
            return this.getDefaultAudioInput();
        }
        else {
            return null;
        }
    }

    private getDefaultAudioInput() {
        if( this.mDefaultAudioInput == null ) {
            this.mDefaultAudioInput = new AudioInputHandler( this.mActivity );
        }
        return this.mDefaultAudioInput;
    }
}
