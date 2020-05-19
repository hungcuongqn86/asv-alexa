import * as application from "tns-core-modules/application";
import {AudioOutputHandler} from './AudioOutputHandler';

declare var com: any;

export class AudioOutputProviderHandler extends com.amazon.aace.audio.AudioOutputProvider {

    private mActivity: any;
    private mAudioOutputMap: Array<any>;

    constructor( activity ) {
        super();
        this.mActivity = activity;
        this.mAudioOutputMap = [];
    }

    public getOutputChannel( name: string ) {
        return this.mAudioOutputMap.hasOwnProperty( name ) ? this.mAudioOutputMap[name] : null;
    }

    public openChannel( name: string, type: any )
    {
        let audioOutputChannel = null;
        switch( type )
        {
            case com.amazon.aace.audio.AudioOutputProvider.AudioOutputType.COMMUNICATION:
                audioOutputChannel = new com.amazon.sampleapp.impl.Audio.RawAudioOutputHandler( this.mActivity, name );
                break;

            default:
                audioOutputChannel = new AudioOutputHandler( this.mActivity, name );
                break;
        }
        this.mAudioOutputMap[name] = audioOutputChannel;
        return audioOutputChannel;
    }
}
